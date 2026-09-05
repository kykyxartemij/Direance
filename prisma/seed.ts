import 'dotenv/config';
import { PrismaClient } from '../generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import type { MappingConfig } from '../src/models/mapping.models';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

// ==== Merit Eesti P&L mapping config ====
// sourceName values are the exact (trimmed) Estonian strings Merit's getprofitrep API
// returns — pulled from a live fetch, not translated back from the English UI export.

const MERIT_EE_PNL_CONFIG: MappingConfig = {
  currency: 'EUR',
  sourceLayout: { regions: [{ descriptionColumn: 0, valueColumns: [] }], headerRow: 0 },
  rowMappings: [
    { sourceName: 'Kasumiaruanne (skeem 1)', displayName: 'Statement of Profit or Loss (Scheme 1)' },
    { sourceName: 'Müügitulu', displayName: 'Revenue' },
    { sourceName: 'Muud äritulud', displayName: 'Other income' },
    { sourceName: 'Kaubad, toore, materjal ja teenused', displayName: 'Raw materials and consumables used' },
    { sourceName: 'Mitmesugused tegevuskulud', displayName: 'Other operating expenses' },
    { sourceName: 'Tööjõukulud', displayName: 'Employee expense' },
    { sourceName: 'Palgakulu', displayName: 'Wage and salary expense' },
    { sourceName: 'Sotsiaalmaksud', displayName: 'Social security taxes' },
    { sourceName: 'Kokku tööjõukulud', displayName: 'Total labor expense', nameColor: 'primary' },
    { sourceName: 'Muud ärikulud', displayName: 'Other expense' },
    { sourceName: 'Kokku ärikasum (-kahjum)', displayName: 'Total profit (loss)', nameColor: 'primary' },
    { sourceName: 'Kasum (kahjum) enne tulumaksustamist', displayName: 'Profit (loss) before income tax', nameColor: 'primary' },
    { sourceName: 'Aruandeaasta kasum (kahjum)', displayName: 'Net profit/loss for financial year', nameColor: 'success' },
  ],
  columnHeaders: [],
};

// ==== Merit Eesti Financial Position mapping config ====
// Same sourcing rule as MERIT_EE_PNL_CONFIG — real getbalancerep Estonian strings.

const MERIT_EE_FP_CONFIG: MappingConfig = {
  currency: 'EUR',
  sourceLayout: { regions: [{ descriptionColumn: 0, valueColumns: [] }], headerRow: 0 },
  rowMappings: [
    { sourceName: 'Varad', displayName: 'Assets' },
    { sourceName: 'Käibevarad', displayName: 'Current assets' },
    { sourceName: 'Raha', displayName: 'Cash and cash equivalents' },
    { sourceName: 'Nõuded ja ettemaksed', displayName: 'Receivables and prepayments' },
    { sourceName: 'Nõuded ostjate vastu', displayName: 'Trade receivables' },
    { sourceName: 'Kokku nõuded ja ettemaksed', displayName: 'Total receivables and prepayments', nameColor: 'primary' },
    { sourceName: 'Kokku käibevarad', displayName: 'Total current assets', nameColor: 'primary' },
    { sourceName: 'Põhivarad', displayName: 'Fixed assets' },
    { sourceName: 'Immateriaalsed põhivarad', displayName: 'Intangible assets' },
    { sourceName: 'Muud immateriaalsed põhivarad', displayName: 'Other intangible assets' },
    { sourceName: 'Kokku immateriaalsed põhivarad', displayName: 'Total intangible assets', nameColor: 'primary' },
    { sourceName: 'Kokku põhivarad', displayName: 'Total fixed assets', nameColor: 'primary' },
    { sourceName: 'Kokku varad', displayName: 'Total assets', nameColor: 'success' },
    { sourceName: 'Kohustised ja omakapital', displayName: "Liabilities and owners' equity" },
    { sourceName: 'Kohustised', displayName: 'Liabilities' },
    { sourceName: 'Lühiajalised kohustised', displayName: 'Current liabilities' },
    { sourceName: 'Laenukohustised', displayName: 'Loan liabilities' },
    { sourceName: 'Lühiajalised laenud ja võlakirjad', displayName: 'Current loans and notes payable' },
    { sourceName: 'Kokku laenukohustised', displayName: 'Total loan commitments', nameColor: 'primary' },
    { sourceName: 'Võlad ja ettemaksed', displayName: 'Payables and prepayments' },
    { sourceName: 'Võlad tarnijatele', displayName: 'Trade payables' },
    { sourceName: 'Võlad töövõtjatele', displayName: 'Payables to employees' },
    { sourceName: 'Maksuvõlad', displayName: 'Tax payables' },
    { sourceName: 'Muud võlad', displayName: 'Other payables' },
    { sourceName: 'Kokku võlad ja ettemaksed', displayName: 'Total payables and prepayments', nameColor: 'primary' },
    { sourceName: 'Kokku lühiajalised kohustised', displayName: 'Total current liabilities', nameColor: 'primary' },
    { sourceName: 'Kokku kohustised', displayName: 'Total liabilities', nameColor: 'primary' },
    { sourceName: 'Omakapital', displayName: 'Equity' },
    { sourceName: 'Osakapital nimiväärtuses', displayName: 'Issued capital' },
    { sourceName: 'Eelmiste perioodide jaotamata kasum (kahjum)', displayName: 'Retained earnings (deficit)' },
    { sourceName: 'Aruandeaasta kasum (kahjum)', displayName: 'Profit (loss) for the year' },
    { sourceName: 'Kokku omakapital', displayName: 'Total equity', nameColor: 'primary' },
    { sourceName: 'Kokku kohustised ja omakapital', displayName: "Total liabilities and owners' equity", nameColor: 'success' },
  ],
  columnHeaders: [],
};

// ==== Seed ====

const MERIT_EE_PNL_ID = 'f70028a7-344b-4aee-8018-749f09a5ff0c';
const MERIT_EE_FP_ID = 'a9e62209-1264-4046-a700-ee33fbdf64dc';

async function main() {
  const name1 = "Merit Eesti Pnl -> Merit.ee English";
  await prisma.fieldMapping.upsert({
    where: { id: MERIT_EE_PNL_ID },
    update: { name: name1, config: MERIT_EE_PNL_CONFIG as any },
    create: {
      id: MERIT_EE_PNL_ID,
      name: name1,
      isGlobal: true,
      reportType: 'pnl',
      userId: null,
      config: MERIT_EE_PNL_CONFIG as any,
    },
  });

  const name2 = "Merit Eesti Financial Position -> Merit.ee English";
  await prisma.fieldMapping.upsert({
    where: { id: MERIT_EE_FP_ID },
    update: { name: name2, config: MERIT_EE_FP_CONFIG as any },
    create: {
      id: MERIT_EE_FP_ID,
      name: name2,
      isGlobal: true,
      reportType: 'financial_position',
      userId: null,
      config: MERIT_EE_FP_CONFIG as any,
    },
  });

  console.log('Seeded: Merit Eesti global mappings (P&L + Financial Position)');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
