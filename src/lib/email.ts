import 'server-only';
import nodemailer from 'nodemailer';

// ==== Transporter ====
// Dev: Ethereal (fake inbox, preview URL logged to console)
// Prod: real SMTP via env vars

async function createTransporter() {
  if (process.env.NODE_ENV !== 'production' && !process.env.SMTP_HOST) {
    const testAccount = await nodemailer.createTestAccount();
    console.log('[email] Ethereal test account:', testAccount.user);
    return nodemailer.createTransport({
      host: 'smtp.ethereal.email',
      port: 587,
      auth: { user: testAccount.user, pass: testAccount.pass },
    });
  }

  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT ?? 587),
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
}

const from = process.env.AUTH_EMAIL_FROM ?? 'Direance <noreply@direance.com>';

// ==== Send helpers ====

export async function sendInviteEmail(to: string, token: string): Promise<void> {
  const transport = await createTransporter();
  const baseUrl = process.env.AUTH_URL ?? 'http://localhost:3000';
  const link = `${baseUrl}/auth/accept-invite?token=${token}`;

  const info = await transport.sendMail({
    from,
    to,
    subject: "You've been invited to Direance",
    html: `
      <p>You've been invited to join Direance.</p>
      <p>Click the link below to create your account. The link expires in 72 hours.</p>
      <p><a href="${link}">${link}</a></p>
    `,
    text: `You've been invited to join Direance.\n\nCreate your account: ${link}\n\nLink expires in 72 hours.`,
  });

  // In dev, log the Ethereal preview URL so you can view the email in browser
  if (process.env.NODE_ENV !== 'production') {
    console.log('[email] Preview URL:', nodemailer.getTestMessageUrl(info));
  }
}
