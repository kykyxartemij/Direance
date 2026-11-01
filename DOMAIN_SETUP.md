# Domain Setup — direance.eu.org

Step-by-step for once EU.org approves the domain. Email does not depend on the domain:
invites go through Gmail SMTP (`GMAIL_USER`, `GMAIL_APP_PASSWORD`).

## ==== Status ====

- Domain: `direance.eu.org` (free, EU.org volunteer registry)
- DNS host: Hurricane Electric (`dns.he.net`) — 5 nameservers ns1…ns5.he.net
- EU.org request: `20260519180907-arf-50919` (submitted 2026-05-19, awaiting review, 1–4 weeks)
  - 2026-06-06: confirmed still active (re-submit attempt was ignored — request alive)
  - 2026-06-21: re-submit attempt again ignored (`IGNORED: you already have a pending request`) — sent follow-up email from `artemijvorozhun@yandex.com` asking for status
    - first sent to `webmaster@eu.org` — bounced back: that address is web-matters only, DNS/domain questions go to `hostmaster@eu.org`
    - resent same message to `hostmaster@eu.org` — correct contact, awaiting reply
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

### 3. Point the app at the domain

Set `AUTH_URL=https://direance.eu.org` — invite links are built from it.

## ==== If EU.org rejects ====

Volunteer reviewers can deny for non-EU presence or weak justification. Recovery options:

- Reply to rejection email with EU residency proof (Estonia address fine)
- Re-submit with better description in "Information" field
