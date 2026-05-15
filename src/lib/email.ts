import 'server-only';
import nodemailer from 'nodemailer';

// ==== Transporter ====
// Single SMTP transport — no dev/prod split. App is pre-release, dev IS prod.
// Configure via SMTP_HOST / SMTP_PORT / SMTP_USER / SMTP_PASS env vars.

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT ?? 587),
  secure: Number(process.env.SMTP_PORT ?? 587) === 465,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

const from = process.env.AUTH_EMAIL_FROM ?? 'Direance <noreply@direance.com>';
const baseUrl = process.env.AUTH_URL ?? 'http://localhost:3000';

// ==== Template ====

function wrap(message: string): string {
  return `
    <div style="font-family: system-ui, sans-serif; max-width: 560px; margin: 0 auto;">
      <p style="font-size: 18px; margin: 0 0 16px;">Hello hello! It's Direance!</p>
      ${message}
    </div>
  `;
}

// ==== Send helpers ====

export async function sendInviteEmail(to: string, token: string): Promise<void> {
  const link = `${baseUrl}/auth/accept-invite?token=${token}`;

  await transporter.sendMail({
    from,
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

  await transporter.sendMail({
    from,
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
