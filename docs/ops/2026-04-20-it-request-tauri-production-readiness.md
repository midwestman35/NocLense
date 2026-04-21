# NocLense Production Readiness — IT Procurement Request

**Date:** 2026-04-20
**Owner:** Enrique Velazquez, Network Engineer, SaaS Operations (Axon Enterprise / APEX)
**Subject:** Infrastructure + vendor approvals to move NocLense from web-Electron (Vercel) to signed Tauri standalone with server-side integration proxy
**Companion design doc:** `docs/superpowers/specs/2026-04-20-tauri-migration-design.md`

## TL;DR

NocLense (internal NOC diagnostic tool for Axon APEX) is currently offline following a Vercel incident. Returning to production requires three one-time approvals and one annual recurring cost:

| # | Ask | Cost | Recurring? |
|---|---|---|---|
| 1 | AWS services for proxy + updater manifest + secrets (existing Axon account) | ~$60–360/yr | Yes |
| 2 | EV Authenticode code-signing certificate (new vendor) | ~$500/yr | Yes |
| 3 | DNS subdomain under existing Axon domain | $0 | No |
| 4 | Security review sign-off | $0 (labor) | One-time |

**Total annual: ~$980/yr. No one-time capex. Engineering timeline: ~6–8 weeks after approvals land.**

## Background

NocLense is used daily by the SaaS Operations NOC team for Zendesk ticket triage, Jira escalations, Datadog log analysis, and AI-assisted root-cause investigation on the Axon APEX (formerly Carbyne APEX) NG911 platform. It integrates with Unleashed AI (RAG over internal Confluence/Zendesk/Slack), Datadog (log search), Zendesk (tickets), Confluence (runbooks), and Jira (R&D escalations).

The current deployment is a hybrid web + Electron app with Vercel-hosted serverless proxies. The Vercel incident over the weekend of 2026-04-18 took the tool offline. Returning to service in the same architecture would reproduce the same single-point-of-failure and additionally expose the current Electron builds' compiled-in API tokens to anyone with access to the installer binary.

This proposal migrates NocLense to a standalone Tauri desktop application with a dedicated integration proxy on AWS, auto-updates delivered via GitHub Enterprise Releases, and signed installers distributed to NOC seats. All org-wide integration credentials move from the client binary to a server-side credential vault.

## Architecture

```
┌──────────────────────────────────────────────┐
│  NocLense Tauri app (installed on NOC seats) │
│  Zero integration secrets in binary.         │
│  Holds only: 1 HMAC key, user preferences.   │
└──────────────────────────────────────────────┘
        │                                │
        │ HMAC-signed HTTPS              │ Auto-update poll
        ▼                                ▼
┌──────────────────────┐        ┌──────────────────────┐
│  AWS integration     │        │  GitHub Enterprise   │
│  proxy (Lambda +     │        │  Releases            │
│  API Gateway)        │        │  - Signed .msi       │
│                      │        │  - latest.json       │
│  - /proxy/unleash    │        │    manifest (Ed25519)│
│  - /proxy/datadog    │        └──────────────────────┘
│  - /proxy/zendesk    │
│  - /proxy/confluence │
│  - /proxy/jira       │
└──────────────────────┘
        │
        │ (credentials injected from AWS Secrets Manager)
        ▼
┌─────────────────────────────────────────────┐
│  Unleashed AI / Datadog / Zendesk /         │
│  Confluence / Jira (Axon-held accounts)     │
└─────────────────────────────────────────────┘
```

## Inventory of asks

### 1. AWS services — proxy infrastructure

| Field | Detail |
|---|---|
| **What** | AWS account access to provision: AWS Lambda, API Gateway, Secrets Manager, CloudWatch Logs, Route 53 entry for subdomain. |
| **Why** | A stateless integration proxy is required to keep org-wide API credentials off the client binary. Lambda + API Gateway is the lowest-cost, lowest-ops fit for an internal tool with low QPS (~thousands of calls/day) and scales to zero during off-hours. Axon already operates production workloads on AWS, so this extends existing infrastructure rather than introducing a new vendor. |
| **Cost** | **$0–30/mo** realistic range. Lambda free tier covers ~1M invocations/mo; our expected load is <100K/mo. API Gateway ~$3.50 per million calls. Secrets Manager ~$0.40/secret/mo × 7 secrets = ~$3/mo. CloudWatch log ingest negligible at this volume. Budget ceiling of **~$30/mo ($360/yr)** accommodates headroom for staging env and traffic spikes. |
| **Alternatives considered** | **(a)** Stay on Vercel — rejected due to the incident that triggered this effort. **(b)** Fly.io / Railway — technically fine but each requires a net-new vendor approval, SOC2 review, and billing relationship; adds weeks to timeline vs reusing AWS. **(c)** Self-hosted VPS — too much operational burden for a production-critical tool. **(d)** ECS Fargate — always-warm container, ~$8–15/mo minimum; overkill for our load pattern. |
| **Approval needed from** | Finance (monthly budget line), IT (AWS IAM role / sub-account allocation), Security (folds into existing AWS SOC2 posture). |

### 2. EV Authenticode code-signing certificate

| Field | Detail |
|---|---|
| **What** | One Extended Validation Authenticode code-signing certificate issued to Axon Enterprise, Inc. Preferred vendors: DigiCert, Sectigo, or SSL.com (SSL.com includes cloud HSM signing at no extra cost). |
| **Why** | Windows SmartScreen flags every install of an unsigned or non-EV-signed `.msi` with a prominent "Unknown publisher — Windows protected your PC" warning. EV-signed installers are trusted immediately on first install with no reputation-building delay. Standard OV certs require weeks of reputation-seeding before SmartScreen trusts them, creating ongoing friction during the pilot phase. For an internal tool deployed to engineers who already understand security prompts, the friction is tolerable; for a production-grade install experience, EV removes a recurring support burden. |
| **Cost** | **$400–700/yr** depending on vendor. Recommend SSL.com at ~$500/yr (cloud signing included, lowest operational overhead). DigiCert at ~$700/yr if vendor procurement prefers a Tier-1 CA. |
| **Alternatives considered** | **(a)** Standard (OV) cert at ~$250/yr — rejected because SmartScreen reputation-building takes weeks per release, and we plan frequent pilot releases during the initial migration. **(b)** Unsigned installer — rejected: every install shows a red warning, users are trained to not click through it, rollout dies. **(c)** Self-signed cert — rejected: doesn't reach OS-level trust without manual trust store changes on every endpoint. |
| **Approval needed from** | Legal (authorized signatory for cert application — needs a named Axon employee as code-signing authority), Finance (annual renewal), Security (inventory of code-signing authority). |
| **Additional requirement** | EV issuance requires Axon Enterprise's D&B number, legal entity details, and verification phone call. Typical issuance 3–7 business days. |

### 3. DNS subdomain

| Field | Detail |
|---|---|
| **What** | A subdomain under an existing Axon-owned domain. Suggested: `noclense-proxy.axon.com` or an internal subdomain like `noclense-proxy.internal.axon.com` if corp policy prefers. |
| **Why** | A stable subdomain lets us rotate hosting (e.g., Lambda → ECS, or AWS region change) without rebuilding and re-signing every client binary. The proxy URL is baked into the Tauri build at compile time; pointing a DNS CNAME at the current host preserves client compatibility across infra changes. Also enables automatic TLS via AWS Certificate Manager. |
| **Cost** | **$0** — reuses existing domain. Route 53 record ~$0.50/mo if not already hosted. |
| **Alternatives considered** | **(a)** Use raw API Gateway URL (e.g., `<id>.execute-api.us-east-1.amazonaws.com`) — rejected; ties client binaries to a specific AWS resource identifier, forces rebuild-and-redeploy on any infra migration. **(b)** Register a new dedicated domain — rejected; unnecessary given corp domain availability. **(c)** Use `carbyne.com` subdomain (legacy) — rejected; Axon branding going forward. |
| **Approval needed from** | IT / DNS admin to create the CNAME / A record. |

### 4. AWS Secrets Manager entries

| Field | Detail |
|---|---|
| **What** | Seven secrets provisioned in AWS Secrets Manager (or AWS Systems Manager Parameter Store, whichever corp standard dictates): Unleashed bearer + assistant ID, Datadog API key + App key, Zendesk admin token, Confluence admin token, Jira admin token, HMAC shared secret (generated once, rotated on major client releases), Tauri updater Ed25519 private signing key. |
| **Why** | Centralized, auditable, rotatable credential storage. Lambda function reads at cold start via IAM role; no secrets in code, git history, or environment variables outside AWS's managed vault. Rotation via console or CLI propagates to the Lambda without code changes. |
| **Cost** | **~$3/mo** (~$36/yr) total — $0.40/secret/mo × 7. Folded into ask #1's budget. |
| **Alternatives considered** | **(a)** Plain Lambda environment variables — rejected; visible in Lambda console to anyone with describe-function permission, not rotation-friendly. **(b)** HashiCorp Vault — rejected; net-new service to operate for minimal marginal benefit over AWS Secrets Manager at this scale. |
| **Approval needed from** | IT (IAM role for Lambda to read these specific secrets — principle of least privilege). |

### 5. Token rotation authority

| Field | Detail |
|---|---|
| **What** | Confirmation of admin access to rotate API tokens at each vendor: Unleashed, Datadog, Zendesk, Confluence, Jira. |
| **Why** | Any Electron builds of NocLense distributed prior to the Vercel incident have the current set of tokens compiled into the bundle. Those tokens are effectively leaked to any holder of an installer. Before the Tauri production release, we will rotate all five vendor tokens, install only the new values into AWS Secrets Manager, and let the old tokens die. This establishes a clean baseline for the Tauri release and closes the historical exposure. |
| **Cost** | **$0** — labor only, ~1–2 hours ops work. |
| **Alternatives considered** | **(a)** Skip rotation — rejected; any former employee or device with an old Electron build retains functional access to Zendesk, Datadog, and Confluence through the baked-in tokens. **(b)** Let tokens naturally expire — rejected; most of these don't have short TTLs, and we have no current mechanism to force expiration. |
| **Approval needed from** | Confirmation that current admin access is retained (no IT approval per se — this is a sanity check that we can still rotate). |

### 6. GitHub Enterprise Releases permissions

| Field | Detail |
|---|---|
| **What** | Confirmation that release artifacts (signed `.msi` binaries) and the Ed25519 public verification key + `latest.json` manifest can be published under the NocLense repository on the Axon Enterprise GitHub org. GitHub Actions secret storage for the Ed25519 private signing key. |
| **Why** | GitHub Releases is the auto-update delivery path for Tauri's built-in updater. Reuses existing Axon GitHub Enterprise infrastructure — zero new vendor. The Ed25519 signature chain gives cryptographic assurance that an update came from Axon, not a compromised S3 bucket or CDN cache. |
| **Cost** | **$0** — already covered by existing GitHub Enterprise subscription. |
| **Alternatives considered** | **(a)** Self-hosted S3 bucket with CloudFront — rejected; adds infra without meaningful benefit over GitHub Releases for an internal tool. **(b)** Ship unsigned updates — rejected; bypasses Tauri's signature verification, defeats supply-chain protections. |
| **Approval needed from** | GitHub Enterprise admin (confirm the repo can host release artifacts; confirm Actions can access secret scope). |

### 7. Security / compliance review

| Field | Detail |
|---|---|
| **What** | Formal security sign-off covering the data-flow diagram (see section below), SOC2 attestations for AWS (already on file) and the chosen EV cert vendor, and confirmation that no data types crossing the proxy require additional compliance controls (HIPAA BAA, CJIS, etc.). |
| **Why** | NocLense operates adjacent to 911-platform data. While the proxy itself does not touch call audio, PIDF geolocation, or caller PII (see data flow below), the security team should document that boundary explicitly for future audit purposes. |
| **Cost** | **$0** — labor only. |
| **Alternatives considered** | Skipping review is not an option for anything production-bound at Axon. |
| **Approval needed from** | Security / Compliance Lead. |

### 8. Dev / staging environment (optional, recommended)

| Field | Detail |
|---|---|
| **What** | A separate AWS resource set (separate API Gateway, separate Lambda function, separate Secrets Manager entries) for dev/staging testing, distinguishable by naming convention or resource tag. |
| **Why** | Lets the engineering team test proxy changes and updater manifests against a non-production environment before promoting to the NOC-facing URL. |
| **Cost** | **~$5–10/mo** additional. Almost entirely Secrets Manager at this volume. |
| **Alternatives considered** | **(a)** Test in production — rejected; any auth bug or credential misconfiguration impacts live NOC. **(b)** Local-only dev (no AWS staging) — rejected; doesn't exercise IAM, API Gateway, or WebView2 → Lambda path realistically. |
| **Approval needed from** | Same as ask #1 — folds into existing AWS account provisioning. |

## Data flow and security posture

The proxy is a narrow pass-through. It does **not** see or handle:

- Caller audio (stays entirely within APEX)
- PIDF+XML emergency geolocation (stays entirely within APEX)
- PSAP caller PII or session recordings (stays entirely within APEX)
- SIP session contents (stays entirely within APEX)

The proxy **does** relay:

- AI prompts and responses (to/from Unleashed AI) — these contain ticket text, log excerpts, and Confluence snippets as RAG grounding. No caller PII unless an agent pastes some into a prompt manually.
- Datadog log search queries and results — Axon production service logs, not customer call data.
- Zendesk ticket reads and writes — agent-facing tickets, same access the agent already has via the Zendesk web UI.
- Confluence page reads — internal runbooks.
- Jira issue reads and writes — internal R&D escalation tickets.

**Trust boundary:** the proxy holds Axon admin credentials in AWS Secrets Manager and will refuse any request without a valid HMAC signature from a current NocLense build. The HMAC key is baked into the Tauri installer and rotates on every major client release via auto-update. Agents with a current installer can call the proxy; external internet traffic cannot.

**What a leaked HMAC key enables:** an attacker with a copy of the NocLense installer and network access to the proxy URL could call the 5 endpoints at normal rate limits. They would not get raw credentials back — the proxy returns only the upstream API response. Blast radius: similar to the attacker having Zendesk / Datadog / Confluence / Jira credentials at the team's admin-tier, which is already the operational reality for our small team. The improvement over the current Electron build is that the attacker no longer gets the raw tokens themselves, which would persist until manual rotation at each vendor.

## Budget summary

| Line item | One-time | Annual |
|---|---|---|
| AWS Lambda + API Gateway + Secrets Manager + CloudWatch | — | $360 (upper bound) |
| EV Authenticode cert (SSL.com recommended) | — | $500 |
| Dev/staging AWS resources | — | $120 |
| DNS subdomain | — | $0 |
| GitHub Enterprise Releases | — | $0 (already owned) |
| Existing Datadog for proxy observability | — | $0 (already owned) |
| **TOTAL** | **$0** | **$980/yr** |

Upper bound budget ceiling of **$1,000/yr** is safe to pitch.

## Timeline

| Milestone | Duration | Dependency |
|---|---|---|
| Executive + Finance budget approval | 1–2 weeks | This document |
| AWS account / sub-account allocation + IAM role provisioning | 1 week | Budget approval |
| EV cert procurement + issuance | 2 weeks | Legal signatory approval |
| DNS subdomain allocation | 2 days | IT approval |
| Security review sign-off | 1–3 weeks | This document + data-flow diagram |
| Engineering implementation (proxy + Tauri + updater) | 6–8 weeks | AWS ready; can proceed in parallel with cert while cert is in issuance |
| Pilot rollout to internal NOC seats | 2 weeks | Engineering complete + cert issued |

**Total wall-clock to production: ~10–12 weeks from today** (longest critical path is cert issuance + security review, both of which can run in parallel with engineering work once AWS access is granted).

## Approval sign-off checklist

For each approver, please tick when approved:

- [ ] **Finance:** Annual budget of up to $1,000/yr approved.
- [ ] **IT:** AWS Lambda / API Gateway / Secrets Manager provisioned under existing Axon AWS account; IAM role created for Lambda to read designated secrets.
- [ ] **IT (DNS):** Subdomain `noclense-proxy.axon.com` (or equivalent) created, pointing to API Gateway custom domain.
- [ ] **Legal:** EV Authenticode cert application authorized; named signatory designated (____________________________).
- [ ] **Security:** Data-flow diagram reviewed; SOC2 posture confirmed acceptable; no additional compliance controls required (HIPAA/CJIS/etc.).
- [ ] **GitHub Enterprise Admin:** NocLense repository confirmed as valid target for Release artifacts + Actions secret storage.
- [ ] **Procurement:** Vendor selection for EV cert (SSL.com / DigiCert / Sectigo) approved.
- [ ] **Self (ops):** Token rotation authority confirmed at all five vendors.
