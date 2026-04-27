import 'server-only';
import { prisma } from '@/lib/prisma';
import { ApiError } from '@/models/api-error';
import { Permission, hasPermission } from '@/lib/permissions';
import { cached, invalidateCache } from '@/lib/serverCache';
import { CACHE_KEYS } from '@/lib/cacheKeys';

// ==== Limits ====

export const USER_DB_LIMIT_BYTES = 1 * 1024 * 1024; // 1 MB — shown in error messages
const USER_DB_INTERNAL_LIMIT = Math.floor(USER_DB_LIMIT_BYTES * 0.95); // 5% buffer, never disclosed

// ==== Consumption ====

export type DbConsumption = { used: number; limit: number };

export async function computeUserDbConsumption(userId: string): Promise<DbConsumption> {
  const [row] = await prisma.$queryRaw<[{ total: bigint }]>`
    SELECT (
      SELECT COALESCE(SUM(octet_length(config::text)), 0) FROM "FieldMapping" WHERE "userId" = ${userId}
    ) + (
      SELECT COALESCE(SUM(octet_length(data)), 0) FROM "Logo" WHERE "userId" = ${userId}
    ) + (
      SELECT COALESCE(SUM(octet_length("headerLayout"::text)), 0) FROM "ExportSetting"
      WHERE "userId" = ${userId} AND "headerLayout" IS NOT NULL
    ) AS total
  `;
  return { used: Number(row.total), limit: USER_DB_LIMIT_BYTES };
}

// ==== Checks ====

/**
 * Enforce total DB storage per user before any write.
 * Measures all user-owned content: mapping configs + export setting logos + header layouts.
 * Call on CREATE and UPDATE (not DELETE — size only decreases there).
 * No-op when user has NO_DB_SIZE_LIMITS.
 * Side-effect: primes the consumption cache so GET /api/user/me/consumption is zero-cost after any write.
 */
export async function checkUserDbLimits(userId: string, permissions: string[]): Promise<void> {
  if (hasPermission({ permissions }, Permission.NO_DB_SIZE_LIMITS)) return;
  const consumption = await computeUserDbConsumption(userId);
  invalidateCache(...CACHE_KEYS.user.dbConsumption(userId));
  await cached(() => Promise.resolve(consumption), CACHE_KEYS.user.dbConsumption(userId));
  if (consumption.used > USER_DB_INTERNAL_LIMIT) {
    throw new ApiError('Storage limit reached: 1 MB per account', 403);
  }
}
