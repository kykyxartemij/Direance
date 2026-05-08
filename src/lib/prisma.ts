import { PrismaClient } from '../../generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { withFts } from './fts';

function makePrisma() {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
  const base = new PrismaClient({ adapter });

  return base.$extends({
    model: {
      exportSetting: withFts(base, base.exportSetting, '"ExportSetting"', 'exportSetting', 'name'),
      fieldMapping:  withFts(base, base.fieldMapping, '"FieldMapping"', 'mapping', 'name'),
    },
  });
}

type ExtendedPrisma = ReturnType<typeof makePrisma>;
const globalForPrisma = globalThis as unknown as { prisma: ExtendedPrisma };

export const prisma = globalForPrisma.prisma || makePrisma();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
