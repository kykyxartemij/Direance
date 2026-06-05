# Domain Setup — direance.eu.org

Step-by-step for once EU.org approves the domain. Until then, `RESEND_API_KEY`
unset → `email.ts` falls back to console dev-stub.

## ==== Status ====

- Domain: `direance.eu.org` (free, EU.org volunteer registry)
- DNS host: Hurricane Electric (`dns.he.net`) — 5 nameservers ns1…ns5.he.net
- EU.org request: `20260519180907-arf-50919` (submitted 2026-05-19, awaiting review, 1–4 weeks)
  - 2026-06-06: confirmed still active (re-submit attempt was ignored — request alive)
- Cloudflare zone for `direance.eu.org`: **dead weight, delete after approval**

## ==== After EU.org approves ====

### 1. Verify delegation is live

```powershell
nslookup -type=SOA direance.eu.org
```

Should resolve via public DNS (not just ns1.he.net direct). If timeout, wait 24h
for global propagation.

### 2. Remove `direance.eu.org` zone from Cloudflare

`dash.cloudflare.com` → Websites → `direance.eu.org` → Overview → bottom of page → **Remove Site**.

Reason: zone is unused (EU.org points to HE, not CF). Removing avoids confusion
later when editing DNS records — you'd otherwise have two copies that drift.

### 3. Add DNS records at HE for email

`dns.he.net` → manage `direance.eu.org` zone. Add records Resend will require
(values come from Resend dashboard → Domains → Add Domain → `direance.eu.org`):

| Type | Name | Purpose |
|------|------|---------|
| MX   | `send` | Resend bounce handling |
| TXT  | `send` | SPF (`v=spf1 include:amazonses.com ~all`) |
| TXT  | `resend._domainkey` | DKIM (Resend gives you the value) |
| TXT  | `_dmarc` | DMARC (`v=DMARC1; p=none;`) |

Exact values: copy-paste from Resend dashboard. Don't guess.

### 4. Verify in Resend

Resend dashboard → Domains → `direance.eu.org` → **Verify DNS Records**. Green = ready.

### 5. Switch sending address

`.env`:

```
RESEND_API_KEY=re_...                          # already set
RESEND_FROM=Direance <noreply@direance.eu.org>
AUTH_URL=https://direance.eu.org               # or wherever app deployed
```

No code change needed — `src/lib/email.ts` reads `RESEND_FROM` env.

### 6. Test

Send invite to a non-signup email address. Free Resend tier sends to any address
once domain is verified (before verification it's locked to signup email only).

## ==== If EU.org rejects ====

Volunteer reviewers can deny for non-EU presence or weak justification. Recovery options:

- Reply to rejection email with EU residency proof (Estonia address fine)
- Re-submit with better description in "Information" field
- Fall back to **Gmail SMTP** via nodemailer (no domain needed, ~500/day, From = personal Gmail)

## ==== If you give up on domains ====

Swap `email.ts` to nodemailer + Gmail SMTP. Steps:

1. `npm uninstall resend && npm install nodemailer`
2. Replace `Resend` client with `nodemailer.createTransport({ service: 'gmail', auth: { user, pass } })`
3. `.env`: `GMAIL_USER`, `GMAIL_APP_PASSWORD` (generate at myaccount.google.com → Security → App passwords)
4. Drop `fetchInviteLimits` (Gmail has no usage API) — remove the stats panel or hardcode `{daily:0,monthly:0,limit:500}`

Trade-off: free, no domain, but From address is `artemiy.vorozhun@gmail.com`,
deliverability is fine but unprofessional.

## ==== Files touched when this happens ====

- `.env` — change/add `RESEND_FROM`, `AUTH_URL`
- `src/lib/email.ts` — only if switching providers
- No frontend changes needed
