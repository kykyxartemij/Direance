'use client';

import { useGetInviteLimits } from '@/hooks/invite.hooks';
import ArtProgress from '@/components/ui/ArtProgress';
import ArtSkeleton from '@/components/ui/ArtSkeleton';
import ArtTitle from '@/components/ui/ArtTitle';
import type { ArtColor } from '@/components/ui/art.types';

// ==== Helpers ====

function barColor(usedRaw: number, limitRaw: number): ArtColor {
  const ratio = usedRaw / limitRaw;
  if (ratio >= 0.9) return 'danger';
  if (ratio >= 0.7) return 'warning';
  return 'primary';
}

// ==== StatBar ====
// Mirrors admin StatsSection layout: label · used/limit · ArtProgress · description.

function StatBar({ label, used, limit, usedRaw, limitRaw, description }: {
  label: string;
  used: string;
  limit: string;
  usedRaw: number;
  limitRaw: number;
  description?: string;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between text-sm">
        <span style={{ color: 'var(--text)' }}>{label}</span>
        <span style={{ color: 'var(--text-muted)' }}>{used} / {limit}</span>
      </div>
      <ArtProgress value={usedRaw} max={limitRaw} color={barColor(usedRaw, limitRaw)} />
      {description && (
        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{description}</p>
      )}
    </div>
  );
}

// ==== Section ====

export default function InviteLimitsSection() {
  const { data, isLoading, error } = useGetInviteLimits();

  if (error) {
    return (
      <div>
        <ArtTitle title="Invite Limits Stats" description="Resend free-tier caps. Updates every few minutes." />
        <div
          className="rounded-lg p-6 text-sm"
          style={{ border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text-muted)' }}
        >
          Resend usage unavailable — set RESEND_API_KEY to enable.
        </div>
      </div>
    );
  }

  const daily   = data?.daily   ?? { sent: 0, limit: 100 };
  const monthly = data?.monthly ?? { sent: 0, limit: 3000 };
  const capped  = data?.capped ?? false;

  const content = (
    <div
      className="flex flex-col gap-4 rounded-lg p-6"
      style={{ border: '1px solid var(--border)', background: 'var(--surface)' }}
    >
      <StatBar
        label="Today"
        used={`${daily.sent}`}
        limit={`${daily.limit}`}
        usedRaw={daily.sent}
        limitRaw={daily.limit || 1}
        description="Invites sent in the last 24 hours. Free tier caps at 100 per day. Resets rolling — no fixed midnight reset."
      />
      <StatBar
        label="Last 30 days"
        used={`${monthly.sent}`}
        limit={`${monthly.limit}`}
        usedRaw={monthly.sent}
        limitRaw={monthly.limit || 1}
        description={
          capped
            ? 'Resend free tier allows 3000/month. Page-capped count — real volume may be higher than shown.'
            : 'Invites sent in the last 30 days. Free tier caps at 3000/month.'
        }
      />
    </div>
  );

  const wrapped = (
    <div>
      <ArtTitle title="Invite Limits Stats" description="Resend free-tier caps. Updates every few minutes." />
      {content}
    </div>
  );

  if (isLoading) return <ArtSkeleton wrap>{wrapped}</ArtSkeleton>;
  return wrapped;
}
