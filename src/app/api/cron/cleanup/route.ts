import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { runAllCleanups } from '@/lib/prismaLazyCleanup';

// Vercel Cron sets Authorization: Bearer <CRON_SECRET>
// https://vercel.com/docs/cron-jobs/manage-cron-jobs#securing-cron-jobs

// eslint-disable-next-line local/require-api-try-catch
export async function GET(req: NextRequest): Promise<NextResponse> {
  const auth = req.headers.get('authorization');
  const secret = process.env.CRON_SECRET;
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Referencing prisma ensures all withLazyCleanup registrations run before cleanup
  void prisma;

  const deleted = await runAllCleanups();
  return NextResponse.json({ deleted });
}
