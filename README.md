# CII Accountability Tracker

Accountability and engagement platform for the Corper Impact Initiative (CII), now with a personal goal-execution workspace. Corps Members log daily check-ins, activity evidence, and weekly reports; Accountability Partners review their assigned caseload; administrators manage cohorts, assignments, partners, and governance settings with an immutable audit trail. Every signed-in user also gets a private personal workspace for goals, milestones and planner tasks.

**Stack:** React 19 + TypeScript + Vite, Tailwind CSS 4, Firebase (Auth, Firestore, Storage), Recharts, jsPDF/XLSX exports.

## Quick start (local)

```bash
npm install
cp .env.example .env        # optional: only needed to override firebase-applet-config.json
npm run dev                 # http://localhost:3000
npm run lint                # typecheck
npm run build               # production bundle in dist/
```

The app boots against the Firebase project in `firebase-applet-config.json`, so no local setup is required to browse the UI.

## Firebase project setup

Everything below is required once per environment. The current project is `decent-envelope-q07pf` with a **named** Firestore database (`ai-studio-8bcede04-2667-4ce9-9e3a-640af99c64a4`).

### 1. Point the app at your project

Either edit `firebase-applet-config.json`, or set the `VITE_FIREBASE_*` variables from `.env.example` (they take precedence).

### 2. Authentication

Firebase Console → Authentication → Sign-in method:

- Enable **Email/Password** (used for account activation and the admin login screen).
- Enable **Google** (optional, used on the corps-member login screen).
- Add every deployed hostname (e.g. `your-app.vercel.app`) under **Settings → Authorized domains**.

### 3. Firestore security rules

```bash
npm install -g firebase-tools   # once
firebase login
npm run deploy:rules            # targets the named database above
```

If the CLI refuses to deploy to a named database (a known firebase-tools limitation), paste `firestore.rules` into Console → Firestore → Rules after selecting that database.

### 4. Storage rules (activity evidence uploads)

Console → Storage → Get started (create the default bucket, which must match `storageBucket` in the config), then:

```bash
npm run deploy:storage
```

`storage.rules` mirrors the client-side limits: 5 MB max, PDF/image/text/Office documents, uploads only into your own `submissions/{uid}/…` folder.

### 5. First-run initialization

1. Sign in with the project-owner account. The email must match `VITE_PROJECT_OWNER_EMAIL` **and** `isProjectOwnerBootstrap()` in `firestore.rules` (default: `olosundelouis@gmail.com`). The account is created — or upgraded once — as **Super Admin**.
2. Verify the email when prompted.
3. Open **Admin → Admin Overview** and click **Initialize Baseline Data**. This creates two cohorts, four published activities, an opening announcement, and default governance settings.
4. From **Participants** and **Partners**, issue activation invitations. Users activate via `/activate-account` with the invite code.
5. Optionally create scoped administrators (Programme Manager / Reviewer) under **Admin Users**.

## Roles

| Role | Access |
| --- | --- |
| Corps Member | Own dashboard, assigned activities, daily check-ins, weekly reports, progress |
| Accountability Partner | Assigned caseload, member check-ins, submission/report reviews (approval gated by programme settings), follow-ups |
| Reviewer | Read + feedback on submissions and reports for assigned cohorts |
| Programme Manager | Participants, partners, cohorts, activities, analytics for assigned cohorts |
| Admin | All programme data and users of non-admin tier |
| Super Admin | Everything, including Administrators, programme settings, and bootstrap |

Role checks are enforced **server-side** in `firestore.rules`; client guards in `src/components/RouteGuards.tsx` only shape the UI.

## Workspaces and routes

| Route | Workspace |
| --- | --- |
| `/dashboard`, `/goals`, `/goals/:id`, `/planner`, `/settings`, `/onboarding` | Personal workspace (private per user, all roles) |
| `/community/cii` + `/community/cii/*` | CII programme workspace for Corps Members |
| `/partner`, `/partner/*` | CII Accountability Partner console |
| `/admin`, `/admin/*` | CII administration |
| `/activities`, `/check-in`, `/weekly-reports`, `/progress` | Legacy aliases that redirect to `/community/cii/*` |

Personal data lives in separate top-level collections (`workspaces`, `workspace_members`, `goals`,
`goal_milestones`, `planner_tasks`) and is owner-only in `firestore.rules`. No CII administrator or
partner has a read path into it. Phase 1 is intentionally limited to goals, milestones and the
execution planner; weekly reviews, affirmations, SMT assistance, coach/business workspaces and
payments are labelled as later phases in the UI and are not implemented.

## Deployment

**Vercel:** import the repo, build command `npm run build`, output directory `dist`. `vercel.json` already rewrites all routes to `index.html`. Add the domain to Firebase Auth authorized domains.

**Firebase Hosting:** `npm run deploy:hosting` (builds, then deploys `dist` with the SPA rewrite from `firebase.json`).

## Emulators

```bash
npm run emulators
```

Auth (9099), Firestore (8080), Storage (9199), and the Emulator UI start. Point the app at the emulators with `connectAuthEmulator`/`connectFirestoreEmulator` in `src/lib/firebase.ts` when developing rules locally.

## Project layout

```
src/
  services/ciiService.ts        CII Firestore reads/writes, audit logging, notifications, seeding
  services/platformService.ts   Personal workspace, goals, milestones, planner tasks
  platformTypes.ts              Goal/task/workspace types and label maps
  context/                      Auth, workspace (CII subscriptions), platform, theme
  components/PlatformShell.tsx  Purple/amber personal-workspace shell
  components/platform/          Goal and task modals
  pages/platform/               Onboarding, personal dashboard, goals, planner, settings
  pages/public|member|partner|admin|shared
  lib/                          firebase init, validators, CSV/PDF exports, partner import
firestore.rules            Server-side RBAC, validation, immutable audit logs, platform collections
storage.rules              Evidence upload constraints
firebase.json / .firebaserc  Rules, storage target, hosting, emulators
```

## Troubleshooting

| Symptom | Cause / fix |
| --- | --- |
| `Missing or insufficient permissions` on seed | Signed-in account is not Super Admin; settings writes are Super-Admin only |
| Owner still a Corps Member | Email mismatch between `VITE_PROJECT_OWNER_EMAIL` and `firestore.rules`; fix and redeploy rules, then reload |
| `auth/unauthorized-domain` | Add the hostname in Firebase Auth authorized domains |
| Verification email never arrives | Check spam; resend from the verification screen; ensure Email/Password provider is enabled |
| Evidence upload rejected | File over 5 MB or unsupported type — see `validateEvidenceFile()` in `src/lib/validators.ts` |
| Empty participant emails for Programme Managers | PII reads are restricted to owner and full admins by design |

## Known limitations

- Audit log entries are client-written; entries are immutable but not cryptographically server-authoritative. Moving to callable Cloud Functions is the next hardening step.
- No email dispatch: invitations are shared manually and reminders are opt-in only (settings fields are stored but no scheduler consumes them yet). Planner reminder timestamps are displayed but no notification worker fires them.
- `firestore.rules.test.ts` is a stale scaffold and is not wired to a test runner.
- Phase 1 personal workspace ships without offline drafts, weekly/monthly reviews, affirmations, SMT AI, coach/business workspaces, or payments. Those surfaces appear in navigation marked with their target phase.
- Goal progress is derived client-side; it is a convenience indicator, not an authoritative financial or contractual measure.
