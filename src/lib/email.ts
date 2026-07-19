import 'server-only';
import { BrevoClient } from '@getbrevo/brevo';
import nodemailer from 'nodemailer';
import { invalidateCache } from '@/lib/serverCache';
import { CACHE_KEYS } from '@/lib/cacheKeys';
import type { InviteLimitsModel } from '@/models/invite.models';

// ==== Brevo client ====
// GMAIL_FALLBACK=true: send via Gmail SMTP (nodemailer). No domain needed, Gmail-to-Gmail works.
// GMAIL_FALLBACK=false: send via Brevo API. Requires verified domain in Brevo dashboard.
// When eu.org domain is approved: verify in Brevo, set GMAIL_FALLBACK=false.

const useGmailFallback = process.env.GMAIL_FALLBACK === 'true';
const baseUrl = process.env.AUTH_URL ?? 'http://localhost:3000';

// ==== Brevo ====

const brevoApiKey = process.env.BREVO_API_KEY;
const brevoFromEmail = process.env.BREVO_FROM_EMAIL ?? 'noreply@direance.eu.org';
const brevoFromName = process.env.BREVO_FROM_NAME ?? 'Direance';

const brevo = brevoApiKey ? new BrevoClient({ apiKey: brevoApiKey }) : null;

// ==== Gmail SMTP ====

const gmailUser = process.env.GMAIL_USER;
const gmailPass = process.env.GMAIL_APP_PASSWORD;

const gmail = gmailUser && gmailPass
  ? nodemailer.createTransport({ service: 'gmail', auth: { user: gmailUser, pass: gmailPass } })
  : null;

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

async function send(opts: { to: string; subject: string; html: string; text: string; devNote: string; link: string }): Promise<void> {
  const brevoReady = brevo && brevoFromEmail;

  if (brevoReady) {
    await brevo.transactionalEmails.sendTransacEmail({
      sender: { name: brevoFromName, email: brevoFromEmail },
      to: [{ email: opts.to }],
      subject: opts.subject,
      htmlContent: opts.html,
      textContent: opts.text,
    });
    invalidateCache(...CACHE_KEYS.invite.limits());
    return;
  }

  if (useGmailFallback) {
    if (!gmail) {
      console.warn(`\n[email:dev-stub] ${opts.devNote}\n  to: ${opts.to}\n  (GMAIL_USER / GMAIL_APP_PASSWORD not set)\n`);
      return;
    }
    await gmail.sendMail({ from: `Direance <${gmailUser}>`, to: opts.to, subject: opts.subject, html: opts.html, text: opts.text });
    invalidateCache(...CACHE_KEYS.invite.limits());
    return;
  }

  throw new Error('Email service is not configured.');
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
// Gmail SMTP has no usage API. Brevo stats wired later when domain verified.

export async function fetchInviteLimits(): Promise<InviteLimitsModel | null> {
  return null;
}
