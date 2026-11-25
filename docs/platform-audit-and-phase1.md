# Platform Evolution — Audit & Phase 1 Architecture Proposal

Source requirements: Product Design & Development Brief v1.2 (SMT – Your Companion platform).
Repository: CII Accountability Tracker (React 19 + TypeScript + Vite + Firebase, deployed at ciitracker.vercel.app).
Date: 2026-11-25.

---

## 1. Current platform: what actually exists

### 1.1 Technical baseline

| Area | State |
| --- | --- |
| Frontend | React 19, Vite 8, Tailwind 4, React Router 7, Recharts, jsPDF, XLSX |
| Backend | Firebase Auth, Firestore (named DB `ai-studio-8bcede04-…`), Storage |
| Security | 1,040-line `firestore.rules` with per-role validation, PII subcollection, immutable audit log collection |
| Deployment | Vercel SPA rewrite; Firebase Hosting config added; rules/storage deploy config added |
| Tests | Typecheck + build only. `firestore.rules.test.ts` is a stale scaffold with no runner |
| AI | `@google/genai` is installed but **never imported** |
| Offline | No service worker, no IndexedDB persistence, no draft queue |
| State | React context + realtime Firestore subscriptions; no client cache layer |

### 1.2 Identity model today

One Firebase Auth identity, one CII-specific profile document at `users/{uid}` with a single `role` from:
`super_admin | admin | programme_manager | reviewer | partner | member`.
There is **no workspace concept, no membership layer, no per-workspace permissions, no subscription entitlement**.
`WorkspaceContext` is only the realtime data loader for the CII programme — it is not a multi-workspace abstraction.

### 1.3 Feature inventory (existing)

- Public: landing + email/password + Google sign-in, invite-code activation, password reset, dedicated `/admin/login`.
- Member: dashboard (check-in streak, assigned activities, announcements), activities list/detail with evidence upload, daily check-in, weekly reports + detail, progress charts, notifications, profile.
- Partner: overview, assigned members, member detail, check-ins, review queue (approval gated by programme setting), follow-ups.
- Admin: overview + audit tab, admin users (super admin only), participants + detail, partners (manual creation, XLSX/CSV bulk import with validation report, activation links, caseload), assignments (8 KPIs, manual + auto-assign with preview), cohorts, activities, submissions review, weekly report review, analytics, announcements, settings + audit log.
- Ops: CSV/PDF exports, immutable audit entries, in-app notifications only.

---

## 2. Feature comparison against the brief

Legend: **Working** = production-grade · **Partial** = some capability exists · **Missing** = absent · **Config** = needs external service · **Decision** = needs product-owner input.

| Brief part | Status | Detail |
| --- | --- | --- |
| 1. Account & workspace model | **Missing** | Single CII role per user; no individual/coach/business workspaces; no profile categories or membership separation |
| 2. Registration & onboarding | **Partial** + **Missing** | Auth, verification, invite activation exist; no 5-path onboarding, country, profile category, consent capture, progressive flow |
| 3. Individual workspace | **Missing** | `/dashboard` is the CII member dashboard; no personal goals/tasks/affirmations/journal |
| 4. Goal management | **Missing** | No goal, milestone, category, horizon, baseline or success-criteria data model |
| 5. Execution planner | **Missing** | Only CII activity deadlines; no tasks, views, recurrence, blocked/rescheduled reasons |
| 6. Daily check-in (personal) | **Partial** | CII check-in exists (status + note + follow-up flag); no 2-minute personal flow, drafts, offline, sync states |
| 7. Weekly/monthly reviews | **Partial** | CII weekly reports + partner feedback exist; no monthly review, no generated summaries, no fact-vs-AI distinction |
| 8. Accountability partner system | **Working** (CII-scoped) + **Missing** | Assignment/reassignment, caseload, comments, follow-ups, audit all exist; no partner acceptance, assignment history UI, or personal-data sharing controls |
| 9. Affirmations | **Missing** | No library, rotation, favourites, history, sharing, admin manager |
| 10. SMT AI assistant | **Missing** + **Config** + **Decision** | No integration; requires backend key, model choice, usage limits and cost logging |
| 11. Clarity session booking | **Missing** + **Decision** | Requires fee confirmation, payment provider, calendar/booking flow |
| 12. Coach/mentor workspace | **Missing** | No clients, programmes, sessions, records, private notes |
| 13. Business goals workspace | **Missing** | No business profile, goals, collaborators, weekly/monthly reviews |
| 14. CII community workspace | **Working, not restructured** | All listed features work; routes are not under `/community/cii`; no groups/subgroups, membership renewal/grace/reinstatement, membership ID concept beyond invite code |
| 15. Subscriptions & payments | **Missing** + **Config** + **Decision** | No plans, entitlements, transactions, webhooks; requires server-side verification |
| 16. Offline-first | **Missing** | No persistence, queue, conflict handling or sync UI |
| 17. Notifications | **Partial** + **Config** | In-app only, several events missing, no email/push, no preferences, no scheduled reminders |
| 18. Platform administration | **Partial** | Strong CII admin; missing workspace/user oversight, affirmation manager, sessions, subscriptions, payments, AI usage, coach/business oversight |
| 19. Privacy & security | **Partial** | Strong RBAC/PII isolation/audit; missing journal privacy model, explicit sharing, data export, account deletion, consent records, server-verified payments, server-side AI |
| 20. Responsive design | **Partial** | Mobile-first Tailwind, drawer nav, dark mode, loading/empty/error states; palette is emerald/indigo not purple/yellow; no offline/sync states |
| 21. Phased implementation | — | This document is the audit deliverable for that step |
| 22. Acceptance tests | **Missing** | None of the new-platform tests exist |

### 2.1 Requires external configuration

1. Firebase **Blaze plan + Cloud Functions** (payments verification, AI proxy, scheduled notifications, audit hardening).
2. **Gemini API** key and project quota (already-installed SDK, unused).
3. **Paystack and/or Flutterwave** account, webhook secret, public/secret keys.
4. **Transactional email** provider (Firebase Trigger Email extension, Resend, or SendGrid) + verified sender domain.
5. **FCM/push** credentials — only when mobile support is added.
6. **Affirmation library content** (the owner's curated 100 affirmations, with categories).
7. **JDK** on the dev machine if we want local Firestore rules emulation tests.

### 2.2 Requires product-owner decision

1. **`/dashboard` ownership.** The brief assigns the personal workspace to `/dashboard`; today that route is the CII member dashboard. Options in §3.3.
2. **Brand strategy.** Platform shell in purple/yellow while the CII workspace keeps its emerald identity — confirm.
3. **Pricing and billing currency**; when prices become final. No price will be hardcoded before then.
4. **Payment provider order** (Paystack first vs Flutterwave first).
5. **AI model tier and per-plan usage limits**; whether free plan gets SMT at all.
6. **Coach plan client-capacity limits.**
7. **Community licensing model** (flat licence vs per-active-member) for CII-type communities.
8. **Data-retention and NDPA compliance review** before launch.
9. **Whether CII admins may ever see personal workspace data** (recommended: never, except explicitly shared items).

---

## 3. Phase 1 architecture proposal

Scope per brief: identity, workspaces, roles/permissions, registration/onboarding, individual dashboard, goals, milestones, execution planner.
Everything is additive. No existing collection, route or rule is deleted in Phase 1.

### 3.1 Data model

Identity stays on `users/{uid}` (extended, not replaced):

```
users/{uid}                          // identity + CII profile (existing doc)
  + country: string
  + profileCategory: student | employed | self_employed | coach | organisation | other
  + onboardingPath: know_goal | need_clarity | join_community | coach | business | skipped
  + onboardingCompletedAt: timestamp | null
  (existing CII fields unchanged)
```

New collections (implemented as top-level collections so the client only needs single-field
`where` queries and no composite indexes):

```
workspaces/{workspaceId}              // Phase 1: one individual workspace per user
  type: 'individual' | 'community' | 'coach' | 'business'
  name, ownerId, status, createdAt, updatedAt

workspace_members/{workspaceId}_{uid} // membership separate from identity
  workspaceId, uid, role (owner|member|coach|client|collaborator|accountability_partner),
  status (active|removed), createdAt, updatedAt

goals/{goalId}
  ownerId, workspaceId, title, category, why, baseline, targetOutcome,
  successCriteria, horizonMonths (1|3|6|12), startDate, targetDate,
  status (active|paused|completed|archived), progress, createdAt, updatedAt

goal_milestones/{milestoneId}
  goalId, ownerId, title, dueDate, status (pending|in_progress|completed),
  order, completedAt, createdAt, updatedAt

planner_tasks/{taskId}
  ownerId, workspaceId, goalId, milestoneId, title, description, dueDate,
  priority (low|medium|high), status (not_started|in_progress|completed|blocked|rescheduled),
  blockedReason, rescheduleReason, recurrence, reminderAt, completedAt,
  createdAt, updatedAt
```

Goal progress is derived: milestone completion ratio when milestones exist, otherwise completed
task ratio. It is recomputed client-side after milestone/task changes and written to the goal
document.

Why separate `workspace_members` from `users`: the brief requires identity, membership, permissions and entitlements to be independent. It also lets one person be a CII member and an individual-plan user simultaneously without duplicating profiles.

Existing CII data is **not migrated**. Phase 1 deliberately does not create a CII workspace
document: existing `role`, `cohortId` and partner fields remain the source of truth for programme
access, so CII behaviour is untouched. A programme workspace document can be introduced later
without rewriting member data.

### 3.2 Roles and permissions

Two independent layers:

- **Platform layer** (planned): `platform_owner`, `platform_admin`, `support` — to be stored as `isPlatformAdmin` on the profile plus a rules helper. These will **not** grant access to personal goals or journals. Not implemented in Phase 1 because no platform-staff workflow exists yet.
- **Workspace layer** (new): membership role per workspace — `owner`, `member`, `coach`, `client`, `collaborator`, `accountability_partner`. Phase 1 creates only the `owner` membership.
- **CII layer** (existing): unchanged `super_admin | admin | programme_manager | reviewer | partner | member`.

Rules helpers: `memberOf(workspaceId)`, `hasWorkspaceRole(workspaceId, role)`, `ownsGoal(goalId)`. Personal collections (`goals`, `tasks`) are owner-only; no admin bypass — this satisfies Parts 18 and 19.

### 3.3 Routing — the `/dashboard` decision

Recommended (Option A):

| Route | Owner |
| --- | --- |
| `/dashboard` | **Personal workspace** (new) |
| `/community/cii` + `/community/cii/*` | CII member dashboard, activities, check-in, weekly reports, progress |
| `/admin`, `/admin/*` | Unchanged |
| `/partner`, `/partner/*` | Unchanged (CII partner workspace) |
| `/goals`, `/goals/:id`, `/planner` | Personal workspace |
| `/onboarding` | New post-registration flow |
| Legacy `/activities`, `/check-in`, `/weekly-reports`, `/progress` | Redirect to `/community/cii/*` when the user is a CII member |

Alternatives: (B) keep `/dashboard` as CII and put the personal workspace at `/me/*` — least disruptive, deviates from brief; (C) `/` becomes the workspace picker — most disruptive.

A **workspace switcher** in the app shell selects the active workspace; navigation is generated per workspace type, retiring the current role-only `navByRole` map.

### 3.4 Onboarding

`/onboarding` after first verified sign-in, five entry cards exactly as specified. Progressive: path choice → name/country/category/phone (prefilled from auth) → consent → personal workspace auto-created → dashboard. Community path points enrolled members to the live CII workspace; coach and business cards state clearly that those workspaces arrive in Phase 3. Onboarding is skippable and never blocks access to an already-working CII account. The personal dashboard also surfaces a "Finish setup" banner until the profile records `onboardingCompletedAt`.

### 3.5 Phase 1 pages

1. `/onboarding` + workspace creation.
2. Personal dashboard: greeting, active goals, today's tasks and overdue items, next-7-days list, milestones due soon, completed-this-week count, workspace switcher, and honest "roadmap" labels for weekly review, check-ins, affirmations and SMT instead of fake status cards.
3. Goals: list with filters by category/status/search; create/edit form (why, baseline, target outcome, success criteria, horizon, dates); pause/resume/complete/archive/restore; detail with milestones and linked tasks.
4. Planner: daily/weekly/monthly/calendar/list views over `planner_tasks`; create/edit with goal + milestone linkage, recurrence, and reminder timestamp; blocked/rescheduled capture a written reason (reschedule also captures a new due date).
5. Settings: profile, country, category, onboarding entry point, workspace summary and privacy statement.

### 3.6 Security changes

- Extend `isValidUserProfile` with the optional new fields (rules currently use `hasOnly`, so this is mandatory before writing them).
- New rule blocks for `workspaces`, `workspace_members`, `goals`, `goal_milestones`, `planner_tasks` with strict owner checks and field validation, mirroring the existing validation style.
- Phase 1 workspace creation is limited to `type == 'individual'` owned by the caller; membership creation is limited to the caller's own `owner` membership in a workspace they own. Wider workspace sharing must add its own rule path in a later phase.
- No admin read path into goals/tasks/journals. Sharing (Phase 2/8) will require an explicit sharing record and matching rules branch.
- Profile writes stay on the existing self-service allow-list, extended with the new optional keys.

### 3.7 Indexes

No composite indexes are required. Every Phase 1 subscription and lookup filters on a single field
(`ownerId`, `uid`) and sorts in JavaScript, matching the existing CII data-layer convention.
`firestore.indexes.json` remains empty intentionally.

### 3.8 Offline groundwork (deferred to Phase 7)

`persistentLocalCache` is **not** enabled in Phase 1. The data layer is structured so a draft queue
can be added later, but offline drafts, sync states and server-confirmed submission are not claimed
until Phase 7.

### 3.9 Phase 1 acceptance mapping

| Brief acceptance test | Phase 1 result |
| --- | --- |
| New individual registers | Partially — Google sign-in or CII invitation activation creates the identity, then `/onboarding` runs. Open email/password self-registration was not added because the current backend maps non-invited sign-ups into the CII member role; separating that needs an owner decision. |
| Creates personal workspace | Yes |
| Creates 1/3/6/12-month goal | Yes |
| Goal has milestones | Yes |
| Milestones have tasks | Yes |
| Tasks completed/blocked/rescheduled with reasons | Yes |
| Existing CII functionality intact | Yes — additive routes, unchanged collections |
| Daily check-in / weekly / monthly / affirmations / SMT / coach / business / payments | Deferred to Phases 2–6 |

### 3.10 What Phase 1 will not do

No deletions, no CII route removals (redirects only), no schema rewrites, no AI calls, no payments, no email/push, no offline claims, no subscription enforcement beyond placeholder fields.

---

## 4. Risks and mitigations

| Risk | Mitigation |
| --- | --- |
| `users` doc `hasOnly` validation rejects new fields | Update `isValidUserProfile` first, deploy before client release |
| CII admins accidentally exposed to personal data | Separate collections, no admin rule path, explicit sharing only |
| Route churn breaks bookmarked CII deep links | Keep legacy paths as redirects; verify with the 12 previously tested deep links |
| Named-database rules deploy limitations | Documented CLI target + console fallback in README |
| Phase 1 scope creep (drift into AI/payments) | Navigation marks unbuilt surfaces with a phase label and no clickable action; acceptance tests limited to §3.9 |
| No rules emulator locally (no JDK) | Rules reviewed by inspection; validate on a staging project or install a JDK before deploying to production |
| Open self-registration would create false CII memberships | Phase 1 keeps invitation/Google provisioning and records the gap in §3.9 instead of silently changing roles |

---

## 5. Phase 1 implementation status

Implemented in this repository:

- `firestore.rules`: optional profile fields, plus owner-only rules for `workspaces`, `workspace_members`, `goals`, `goal_milestones`, `planner_tasks`.
- `src/platformTypes.ts`, `src/services/platformService.ts`, `src/context/PlatformContext.tsx`: types, real-time subscriptions, and writes. No composite indexes.
- `src/components/PlatformShell.tsx`: purple/amber personal-workspace shell with CII workspace links and phase-labelled roadmap items.
- `src/pages/platform/*`: onboarding, personal dashboard, goals, goal detail, planner (list/daily/weekly/monthly/calendar), settings.
- Route split: personal routes at `/dashboard`, `/goals`, `/planner`, `/settings`, `/onboarding`; CII member routes at `/community/cii/*`; legacy CII paths redirect.

Verification performed: `tsc --noEmit` clean, `vite build` clean, unauthenticated route guards and legacy redirects checked in the browser with no console errors.

Verification still required before calling Phase 1 production-complete:

1. Deploy the updated `firestore.rules` to the named database.
2. Sign in with a test account and exercise: onboarding save, workspace auto-creation, goal create/edit/pause/complete/archive, milestone add/complete, task create/complete/block/reschedule (with reasons), and planner views.
3. Confirm an accountability partner or administrator cannot read personal collections.
4. Decide whether open (non-invited) self-registration should exist and, if so, which role such accounts receive.

Then proceed to Phase 2 (personal daily check-in, weekly and monthly reviews, sharing controls).
