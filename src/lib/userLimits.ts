import 'server-only';
import { prisma } from '@/lib/prisma';
import { ApiError } from '@/models/api-error';
import { Permission, hasPermission } from '@/lib/permissions';
import { populateCache } from '@/lib/serverCache';
import { CACHE_KEYS } from '@/lib/cacheKeys';
import type { DbConsumption } from '@/models/user.models';

// ==== Limits ====

export const USER_DB_LIMIT_BYTES = 1 * 1024 * 1024; // 1 MB — shown in error messages
const USER_DB_INTERNAL_LIMIT = Math.floor(USER_DB_LIMIT_BYTES * 0.95); // 5% buffer, never disclosed

// ==== Consumption ====

// pg_column_size(t.*) sums the on-disk size of every column in the row — unlike hand-picking
// Json/Bytes columns, this can't drift out of sync when a table gains a new column.
// Covers every row actually attributable to this user, including the User row itself and
// Auth.js session/account/invite rows — not just app-created content.
export async function computeUserDbConsumption(userId: string): Promise<DbConsumption> {
  const [row] = await prisma.$queryRaw<[{ total: bigint }]>`
    SELECT (
      SELECT COALESCE(pg_column_size(t.*), 0) FROM "User" t WHERE t."id" = ${userId}
    ) + (
      SELECT COALESCE(SUM(pg_column_size(t.*)), 0) FROM "Connection" t WHERE t."userId" = ${userId}
    ) + (
      SELECT COALESCE(SUM(pg_column_size(t.*)), 0) FROM "FieldMapping" t WHERE t."userId" = ${userId}
    ) + (
      SELECT COALESCE(SUM(pg_column_size(t.*)), 0) FROM "ExportSetting" t WHERE t."userId" = ${userId}
    ) + (
      SELECT COALESCE(SUM(pg_column_size(t.*)), 0) FROM "Logo" t WHERE t."userId" = ${userId}
    ) + (
      SELECT COALESCE(SUM(pg_column_size(t.*)), 0) FROM "Invite" t WHERE t."invitedBy" = ${userId}
    ) + (
      SELECT COALESCE(SUM(pg_column_size(t.*)), 0) FROM "Account" t WHERE t."userId" = ${userId}
    ) + (
      SELECT COALESCE(SUM(pg_column_size(t.*)), 0) FROM "Session" t WHERE t."userId" = ${userId}
    ) AS total
  `;
  return { used: Number(row.total), limit: USER_DB_LIMIT_BYTES };
}

// ==== Checks ====

/**
 * Call on CREATE and UPDATE (not DELETE — size only decreases there). No-op when user has
 * NO_DB_SIZE_LIMITS. Also primes the consumption cache so GET /api/user/me/consumption is zero-cost after.
 */
export async function checkUserDbLimits(userId: string, permissions: string[]): Promise<void> {
  if (hasPermission({ permissions }, Permission.NO_DB_SIZE_LIMITS)) return;
  const consumption = await populateCache(
    () => computeUserDbConsumption(userId),
    CACHE_KEYS.user.dbConsumption(userId)
  )
  if (consumption.used > USER_DB_INTERNAL_LIMIT) {
    throw new ApiError('Storage limit reached: 1 MB per account', 403);
  }
}
