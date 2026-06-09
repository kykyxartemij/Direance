import { PrismaClient } from '../../../generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { withFts } from '../prismaFts';
import { withCrud } from '../prismaCrud';
import { withLazyCleanup } from '../prismaLazyCleanup';
import type { FieldMappingModel } from '../../../generated/prisma/models/FieldMapping';
import type { InviteModel } from '../../../generated/prisma/models/Invite';

function makePrisma() {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
  const base = new PrismaClient({ adapter });

  // collectionCacheKey (4th arg) must match a CACHE_KEYS.<key>.invalidate()[0] entry.
  // Enforced by the local/require-fts-cache-key-match ESLint rule.
  return base.$extends({
    model: {
      exportSetting: withFts(base, base.exportSetting, '"ExportSetting"', 'exportSetting', 'name'),
      fieldMapping:  {
        ...withFts(base, base.fieldMapping, '"FieldMapping"', 'mapping', 'name'),
        ...withCrud<FieldMappingModel>(base, '"FieldMapping"')
      },
      invite: {
        ...withCrud<InviteModel>(base, '"Invite"'),
        ...withLazyCleanup<InviteModel>(base, '"Invite"', {
          ttl:                  { field: 'createdAt', days: 14 },
          limit:                50,
          limitExceededMessage: 'Too many invites sent. Please try again later, after some invitations expire.',
        }),
      },
      user: withFts(base, base.user, '"User"', 'user', 'name', ['email']),
      connection: withFts(base, base.connection, '"Connection"', 'connection', 'name'),
    },
  });
}

type ExtendedPrisma = ReturnType<typeof makePrisma>;
const globalForPrisma = globalThis as unknown as { prisma: ExtendedPrisma };

export const prisma = globalForPrisma.prisma || makePrisma();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
