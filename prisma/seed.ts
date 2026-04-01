import 'dotenv/config';
import { PrismaClient } from '../generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import type { MappingConfig } from '../src/models/mapping.models';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

// ==== Merit.ee P&L mapping config ====

const MERIT_PNL_CONFIG: MappingConfig = {
  currency: 'EUR',
  sourceLayout: { regions: [{ descriptionColumn: 0, valueColumns: [] }], headerRow: 0 },
  rowMappings: [
    { sourceName: 'Revenue' },
    { sourceName: 'Cost of goods sold' },
    { sourceName: 'Gross profit', nameColor: 'primary' },
    { sourceName: 'Marketing expenses' },
    { sourceName: 'General and administrative expenses' },
    { sourceName: 'Operating profit (loss)', nameColor: 'primary' },
    { sourceName: 'Other financial income and expense' },
    { sourceName: 'Profit (loss) before income tax', nameColor: 'primary' },
    { sourceName: 'Income tax expense' },
    { sourceName: 'Net profit/loss for financial year', nameColor: 'success' },
  ],
  columnHeaders: [],
};

// ==== Merit.ee Financial Position mapping config ====

const MERIT_FP_CONFIG: MappingConfig = {
  currency: 'EUR',
  sourceLayout: { regions: [{ descriptionColumn: 0, valueColumns: [] }], headerRow: 0 },
  rowMappings: [
    { sourceName: 'Assets' },
    { sourceName: 'Current assets' },
    { sourceName: 'Cash and cash equivalents' },
    { sourceName: 'Financial investments' },
    { sourceName: 'Trade receivables' },
    { sourceName: 'Tax prepayments and receivables' },
    { sourceName: 'Total receivables and prepayments', nameColor: 'primary' },
    { sourceName: 'Total current assets', nameColor: 'primary' },
    { sourceName: 'Non-current assets' },
    { sourceName: 'Total non-current assets', nameColor: 'primary' },
    { sourceName: 'Total assets', nameColor: 'success' },
    { sourceName: 'Liabilities and equity' },
    { sourceName: 'Current liabilities' },
    { sourceName: 'Total current liabilities', nameColor: 'primary' },
    { sourceName: 'Total liabilities', nameColor: 'primary' },
    { sourceName: 'Equity' },
    { sourceName: 'Total equity', nameColor: 'primary' },
    { sourceName: 'Total liabilities and equity', nameColor: 'success' },
  ],
  columnHeaders: [],
};

// ==== Seed ====

const MERIT_PNL_ID = '00000000-0000-0000-0000-000000000001';
const MERIT_FP_ID = '00000000-0000-0000-0000-000000000002';

async function main() {
  await prisma.fieldMapping.upsert({
    where: { id: MERIT_PNL_ID },
    update: { name: 'Merit.ee — P&L', config: MERIT_PNL_CONFIG as any },
    create: {
      id: MERIT_PNL_ID,
      name: 'Merit.ee — P&L',
      isGlobal: true,
      reportType: 'pnl',
      userId: null,
      config: MERIT_PNL_CONFIG as any,
    },
  });

  await prisma.fieldMapping.upsert({
    where: { id: MERIT_FP_ID },
    update: { name: 'Merit.ee — Financial Position', config: MERIT_FP_CONFIG as any },
    create: {
      id: MERIT_FP_ID,
      name: 'Merit.ee — Financial Position',
      isGlobal: true,
      reportType: 'financial_position',
      userId: null,
      config: MERIT_FP_CONFIG as any,
    },
  });

  console.log('Seeded: Merit.ee global mappings (P&L + Financial Position)');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
