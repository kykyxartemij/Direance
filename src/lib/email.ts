import 'server-only';
import { Resend } from 'resend';
import { invalidateCache } from '@/lib/serverCache';
import { CACHE_KEYS } from '@/lib/cacheKeys';
import type { InviteLimitsModel } from '@/models/invite.models';

// ==== Resend client ====
// Real send when RESEND_API_KEY is set. Otherwise dev stub logs to console.
// Free tier: 3000 emails/month, 100/day. Use onboarding@resend.dev until you
// verify a custom domain in the Resend dashboard.

const apiKey = process.env.RESEND_API_KEY;
const baseUrl = process.env.AUTH_URL ?? 'http://localhost:3000';
const from = process.env.RESEND_FROM ?? 'Direance <onboarding@resend.dev>';

const resend = apiKey ? new Resend(apiKey) : null;

// ==== Template ====

function wrap(message: string): string {
  return `
    <div style="font-family: system-ui, sans-serif; max-width: 560px; margin: 0 auto;">
      <p style="font-size: 18px; margin: 0 0 16px;">Hello hello! It's Direance!</p>
      ${message}
    </div>
  `;
}

// ==== Send helper ====
// Every successful send invalidates the invite-limits cache so the stats panel
// reflects the new send on next view. Dev stubs don't invalidate — counts are real.

async function send(opts: { to: string; subject: string; html: string; text: string; devNote: string; link: string }): Promise<void> {
  if (!resend) {
    console.warn(
      `\n[email:dev-stub] ${opts.devNote}\n  to:      ${opts.to}\n  subject: ${opts.subject}\n  link:    ${opts.link}\n  (RESEND_API_KEY not set — configure to send real email)\n`,
    );
    return;
  }
  const result = await resend.emails.send({
    from,
    to: opts.to,
    subject: opts.subject,
    html: opts.html,
    text: opts.text,
  });
  if (result.error) throw new Error(`Resend error: ${result.error.name} — ${result.error.message}`);
  invalidateCache(...CACHE_KEYS.invite.limits());
}

// ==== Public senders ====

export async function sendInviteEmail(to: string, token: string): Promise<void> {
  const link = `${baseUrl}/auth/accept-invite?token=${token}`;
  await send({
    to,
    subject: "You've been invited to Direance",
    devNote: 'invite',
    link,
    html: wrap(`
      <p>You've been invited to join Direance.</p>
      <p>Click the link below to create your account. The link expires in 2 weeks.</p>
      <p><a href="${link}">${link}</a></p>
    `),
    text: `Hello hello! It's Direance!\n\nYou've been invited to join Direance.\n\nCreate your account: ${link}\n\nLink expires in 2 weeks.`,
  });
}

export async function sendInviteExtendedEmail(to: string, token: string): Promise<void> {
  const link = `${baseUrl}/auth/accept-invite?token=${token}`;
  await send({
    to,
    subject: 'Your Direance invitation got extended',
    devNote: 'invite-extended',
    link,
    html: wrap(`
      <p>Your invitation got extended.</p>
      <p>You can still use this link to create your account. It expires in 2 weeks from now.</p>
      <p><a href="${link}">${link}</a></p>
    `),
    text: `Hello hello! It's Direance!\n\nYour invitation got extended.\n\nUse this link: ${link}\n\nExpires in 2 weeks.`,
  });
}

// ==== Invite limits ====
// Resend exposes no dedicated usage endpoint. Pulls the most-recent 100 emails
// via emails.list and buckets created_at against now. has_more=true → real
// recent volume exceeds 100; the panel surfaces this as a "capped" badge.

const DAILY_LIMIT = 100;
const MONTHLY_LIMIT = 3000;
const DAY_MS = 24 * 60 * 60 * 1000;
const MONTH_MS = 30 * DAY_MS;

export async function fetchInviteLimits(): Promise<InviteLimitsModel | null> {
  if (!resend) return null;

  const result = await resend.emails.list({ limit: 100 });
  if (result.error) throw new Error(`Resend error: ${result.error.name} — ${result.error.message}`);

  const items = result.data?.data ?? [];
  const hasMore = result.data?.has_more ?? false;
  const now = Date.now();

  let daily = 0;
  let monthly = 0;
  for (const item of items) {
    const ts = new Date(item.created_at).getTime();
    const age = now - ts;
    if (age <= MONTH_MS) monthly += 1;
    if (age <= DAY_MS)   daily   += 1;
  }

  return {
    daily:   { sent: daily,   limit: DAILY_LIMIT },
    monthly: { sent: monthly, limit: MONTHLY_LIMIT },
    capped: hasMore,
  };
}
