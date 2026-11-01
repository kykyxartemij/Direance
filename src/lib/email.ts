import 'server-only';
import nodemailer from 'nodemailer';

const baseUrl = process.env.AUTH_URL ?? 'http://localhost:3000';

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

async function send(opts: { to: string; subject: string; html: string; text: string }): Promise<void> {
  if (!gmail) throw new Error('Email service is not configured: GMAIL_USER / GMAIL_APP_PASSWORD not set.');
  await gmail.sendMail({ from: `Direance <${gmailUser}>`, to: opts.to, subject: opts.subject, html: opts.html, text: opts.text });
}

// ==== Public senders ====

export async function sendInviteEmail(to: string, token: string): Promise<void> {
  const link = `${baseUrl}/auth/accept-invite?token=${token}`;
  await send({
    to,
    subject: "You've been invited to Direance",
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
    html: wrap(`
      <p>Your invitation got extended.</p>
      <p>You can still use this link to create your account. It expires in 2 weeks from now.</p>
      <p><a href="${link}">${link}</a></p>
    `),
    text: `Hello hello! It's Direance!\n\nYour invitation got extended.\n\nUse this link: ${link}\n\nExpires in 2 weeks.`,
  });
}
