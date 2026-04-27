import 'server-only';
import { NextResponse } from 'next/server';
import { cached } from '@/lib/serverCache';
import { CACHE_KEYS } from '@/lib/cacheKeys';
import { handleApiError } from '@/lib/errorHandler';
import { requireAuth } from '@/auth';
import { Permission } from '@/lib/permissions';
import { ApiError } from '@/models/api-error';

// ==== Types ====

type NeonProjectConsumption = {
  logical_size_for_root_bytes: number;  // current storage used — matches dashboard
  compute_time_seconds: number;         // CU-hrs = / 3600
  data_transfer_bytes: number;          // network egress this month
};

type NeonProject = {
  branch_logical_size_limit_bytes: number; // storage limit from plan
  quota_reset_at: string;                  // end of current billing period
};

// ==== Fetchers ====

function neonHeaders(): HeadersInit {
  return { Authorization: `Bearer ${process.env.NEON_API_KEY}`, Accept: 'application/json' };
}

async function fetchProjectConsumption(): Promise<NeonProjectConsumption | null> {
  const projectId = process.env.NEON_PROJECT_ID;
  if (!process.env.NEON_API_KEY || !projectId) return null;

  const res = await fetch(
    `https://console.neon.tech/api/v2/projects/${projectId}/consumption`,
    { headers: neonHeaders() },
  );
  if (!res.ok) return null;
  return res.json() as Promise<NeonProjectConsumption>;
}

async function fetchProject(): Promise<NeonProject | null> {
  const projectId = process.env.NEON_PROJECT_ID;
  if (!process.env.NEON_API_KEY || !projectId) return null;

  const res = await fetch(
    `https://console.neon.tech/api/v2/projects/${projectId}`,
    { headers: neonHeaders() },
  );
  if (!res.ok) return null;
  const body = await res.json();
  // Neon returns { project: {...} } for GET /projects/{id}
  return (body.project ?? body) as NeonProject;
}

// ==== HTTP handlers ====

export async function getDbStats(): Promise<NextResponse> {
  try {
    await requireAuth(Permission.CAN_ACCESS_DB_STATS);

    const TTL = 1 * 30 * 60; // 1,5 hours — monitoring data

    const [consumption, project] = await Promise.all([
      cached(fetchProjectConsumption, CACHE_KEYS.admin.neonConsumption(), TTL),
      cached(fetchProject, CACHE_KEYS.admin.dbSize(), TTL),
    ]);

    if (!consumption || !project) {
      throw new ApiError('Neon usage data unavailable — check NEON_API_KEY and NEON_PROJECT_ID', 503);
    }

    const transferLimitBytes  = Number(process.env.NEON_TRANSFER_LIMIT_BYTES  ?? 5_368_709_120);
    const computeLimitCuHours = Number(process.env.NEON_COMPUTE_LIMIT_CU_HOURS ?? 100);

    return NextResponse.json({
      storage: {
        usedBytes:  consumption.logical_size_for_root_bytes,
        limitBytes: project.branch_logical_size_limit_bytes,
      },
      transfer: {
        usedBytes:  consumption.data_transfer_bytes,
        limitBytes: transferLimitBytes,
      },
      compute: {
        usedCuHours:  consumption.compute_time_seconds / 3600,
        limitCuHours: computeLimitCuHours,
      },
      periodEnd: project.quota_reset_at,
    });
  } catch (error) {
    return handleApiError(error, 'GET /api/admin/db-stats');
  }
}
