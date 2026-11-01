import 'dotenv/config';
import { readFileSync } from 'node:fs';
import { prisma } from '../../../src/lib/prisma';
import { decryptSecret } from '../../../src/lib/crypto';
import { runPnlConnectionDriver, runFinancialPositionConnectionDriver } from '../../../src/lib/connections';
import { buildSheetsWorkbook } from '../../../src/page/reports/buildReport';
import { applyMappingMultiSheet, autoDetectLayout, extractRowNames } from '../../../src/page/mapping/applyMapping';
import { CreateMappingValidator, type MappingConfig, type RowMapping } from '../../../src/models/mapping.models';
import type { ConnectionSecret, ConnectionType } from '../../../src/models/connection.models';

// ==== Connection report ====

async function loadConnectionReport(connectionId: string) {
  const connection = await prisma.connection.findUniqueOrThrow({
    where: { id: connectionId },
    select: {
      id: true, name: true, type: true, reportType: true, userId: true, config: true, secret: true,
      mapping: { select: { id: true, name: true, config: true } },
    },
  });

  const input = {
    type: connection.type as ConnectionType,
    config: connection.config as Record<string, unknown>,
    secret: await decryptSecret<ConnectionSecret>(connection.secret),
    filters: { periods: 1 },
  };
  const report = connection.reportType === 'pnl'
    ? await runPnlConnectionDriver(input)
    : await runFinancialPositionConnectionDriver(input);
  if (report.sheets.length !== 1) throw new Error(`Expected 1 sheet, got ${report.sheets.length}`);

  const { workbook, activeSheet } = buildSheetsWorkbook(report.sheets);
  const detected = autoDetectLayout(workbook, activeSheet);
  // Empty valueColumns = inferred on apply, so reports with more periods keep every column.
  const sourceLayout = { ...detected, regions: detected.regions.map((r) => ({ ...r, valueColumns: [] })) };
  const sourceNames = extractRowNames(workbook, activeSheet, sourceLayout);

  return { connection, workbook, activeSheet, sourceLayout, sourceNames };
}

// ==== Commands ====

async function read(connectionId: string) {
  const { connection, sourceLayout, sourceNames } = await loadConnectionReport(connectionId);
  const linked = connection.mapping;
  const linkedNames = new Set((linked?.config as MappingConfig | undefined)?.rowMappings.map((r) => r.sourceName));

  console.log(JSON.stringify({
    connection: { id: connection.id, name: connection.name, type: connection.type, reportType: connection.reportType },
    linkedMapping: linked && {
      id: linked.id,
      name: linked.name,
      sourceNamesNotInMapping: sourceNames.filter((n) => !linkedNames.has(n)),
    },
    sourceLayout,
    sourceNames,
  }, null, 2));
}

type MappingDraft = {
  name: string;
  rowMappings: RowMapping[];
  currency?: string;
  isGlobal?: boolean;
  linkConnection?: boolean;
};

async function create(connectionId: string, draftPath: string, dryRun: boolean) {
  const draft = JSON.parse(readFileSync(draftPath, 'utf8')) as MappingDraft;
  const { connection, workbook, activeSheet, sourceLayout, sourceNames } = await loadConnectionReport(connectionId);

  const isGlobal = draft.isGlobal ?? true;
  const data = await CreateMappingValidator.validate({
    name: draft.name,
    reportType: connection.reportType,
    isGlobal,
    config: { currency: draft.currency ?? 'EUR', sourceLayout, rowMappings: draft.rowMappings, columnHeaders: [] },
  }, { abortEarly: false });

  const mappedNames = new Set(draft.rowMappings.map((r) => r.sourceName));
  const unmapped = sourceNames.filter((n) => !mappedNames.has(n));
  const unknown = draft.rowMappings.map((r) => r.sourceName).filter((n) => !sourceNames.includes(n));
  if (unmapped.length || unknown.length) throw new Error(`Row mismatch: ${JSON.stringify({ unmapped, unknown })}`);

  const applied = applyMappingMultiSheet(workbook, [activeSheet], data.config as MappingConfig);
  if (new Set(applied.headers).size !== applied.headers.length) {
    throw new Error(`Duplicate output headers: ${applied.headers.join(', ')}`);
  }

  const duplicate = await prisma.fieldMapping.findFirst({
    where: { name: data.name, ...(isGlobal ? { isGlobal: true } : { userId: connection.userId }) },
    select: { id: true },
  });
  if (duplicate) throw new Error(`Mapping named "${data.name}" already exists: ${duplicate.id}`);

  const summary = { name: data.name, reportType: data.reportType, isGlobal, headers: applied.headers, rows: applied.rows.length };
  if (dryRun) {
    console.log(JSON.stringify({ dryRun: true, ...summary }, null, 2));
    return;
  }

  const mapping = await prisma.fieldMapping.create({
    data: {
      name: data.name,
      reportType: connection.reportType,
      isGlobal,
      userId: isGlobal ? null : connection.userId,
      config: data.config as MappingConfig,
    },
    select: { id: true },
  });
  if (draft.linkConnection) {
    await prisma.connection.update({ where: { id: connection.id }, data: { mappingId: mapping.id } });
  }

  console.log(JSON.stringify({ id: mapping.id, linked: !!draft.linkConnection, ...summary }, null, 2));
}

// ==== CLI ====

async function main() {
  const [command, connectionId, draftPath, flag] = process.argv.slice(2);
  if (command === 'read' && connectionId) return read(connectionId);
  if (command === 'create' && connectionId && draftPath) return create(connectionId, draftPath, flag === '--dry-run');
  throw new Error('Usage: read <connectionId> | create <connectionId> <draft.json> [--dry-run]');
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
