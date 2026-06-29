# Feature roadmap — build status

Tracking the 20-feature roadmap. Implemented across `/loop` iterations.

| # | Feature | Category | Status |
|---|---------|----------|--------|
| 1 | Eyes-On-Me screen lock / focus mode | Safety & Control | ☑ |
| 2 | Lesson templates | Teaching | ☑ |
| 3 | Broadcast & spotlight | Teaching | ☑ |
| 4 | Handout drop & collect work | Teaching | ☑ |
| 5 | Attendance from activity | Teaching | ☑ |
| 6 | Take control / remote assist | Safety & Control | ☑ |
| 7 | Guided internet allowlist/blocklist | Safety & Control | ☑ |
| 8 | Activity & audit log | Safety & Control | ☑ |
| 9 | Locked-down exam mode | Safety & Control | ☑ |
| 10 | Content safety screening + panic button | Safety & Control | ☑ |
| 11 | Warm pool pre-provisioning (volume pre-warm) | Scale & Ops | ☑ |
| 12 | Scheduled class auto-boot | Scale & Ops | ☑ |
| 13 | Idle reclaim with grace warning | Scale & Ops | ☑ |
| 14 | Cost & usage analytics dashboard | Scale & Ops | ☑ |
| 15 | Concurrency & spend guardrails | Scale & Ops | ☑ |
| 16 | App catalog & golden-image snapshots | Platform | ☑ |
| 17 | Group workstations | Collaboration | ☑ |
| 18 | Roster sync (paste / CSV import) | Admin & Billing | ☑ |
| 19 | District SSO & admin console | Admin & Billing | ☑ |
| 20 | Annual billing & seat packs | Admin & Billing | ☑ |

☐ = not started · ◐ = in progress · ☑ = done

**All 20 features shipped.** Each was built and verified end-to-end against real Daytona
desktops, with every sandbox cleaned up after testing.

## v2 additions

A second batch, brainstormed and adversarially scored by a multi-agent workflow, then
implemented and verified end-to-end the same way:

| Feature | Category | Status |
|---------|----------|--------|
| Per-student extend/trim time during a live session | Classroom management | ☑ |
| Per-student join PINs (opt-in) — stops roster impersonation | Access control | ☑ |
| Teacher text announcements (student banner, `aria-live`) | Communication | ☑ |
| Bell-schedule auto-shutdown at class-period end | Time & cost control | ☑ |
| One-click class clone / duplicate | Admin | ☑ |
| Low-bandwidth connection-saver desktop mode | Low-bandwidth access | ☑ |

## Major integrations

Standards-based, shipped and verified end-to-end locally (simulating the LMS/SIS/caller):

| Feature | Standard / target | Status |
|---------|-------------------|--------|
| Public REST API v1 + scoped API keys + OpenAPI 3.1 | Platform / developers | ☑ |
| Outbound webhooks (HMAC-signed, retries + dead-letter) | Slack/Teams/Zapier/SIEM | ☑ |
| OneRoster 1.1 CSV roster sync + de-provisioning | Clever/ClassLink/PowerSchool/SIS | ☑ |
| LTI 1.3 Tool Provider (OIDC launch + JIT) | Canvas/Schoology/Moodle/Blackboard/D2L | ☑ |
| Assignment hand-back (graded work + score record) | Teaching loop / LTI AGS-ready | ☑ |
| LTI Advantage: NRPS roster pull + AGS grade passback | Two-way LMS sync | ☑ |
| Login/PIN brute-force throttle + lockout | Account security | ☑ |
