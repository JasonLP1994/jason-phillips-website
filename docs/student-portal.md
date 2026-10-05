# Phillips English student portal

The portal adds email and password sign-in, private lesson feedback, corrections,
practice suggestions, agreed goals and a history of teacher skill check-ins to
the existing static website. Jason has a separate teaching workspace to invite
students and maintain their records. Invitations are private links to share
directly; this application does not send messages to students.

## Current setup

Supabase project `phillips-english-lms` is connected to the existing Vercel
project for Production only, on the Free plan in London. Its credentials stay
in sensitive Vercel environment variables. Preview and Development do not have
access to the Production database.

The first schema was applied atomically in Supabase Studio on 5 October 2026.
The source is `supabase/migrations/20261005133735_student_portal.sql`. Studio
execution does not update the Supabase CLI migration-history table. Before a
future CLI migration, verify this schema and baseline that migration as applied;
do not run its table-creation statements a second time on this database.

The portal launched on 5 October 2026 at `https://www.phillipsenglish.com/portal`.
The owner approved the fixed teacher email and one-time live verification.
The live checks passed, and their temporary accounts and records were removed.
`LMS_VERIFY_ON_BUILD` is now `0`, so future builds do not create test accounts.
No real teacher or student account was created automatically. Jason completes
Teacher account setup by choosing his own password and confirming his email.

## Application configuration

| Variable | Purpose |
| --- | --- |
| `SUPABASE_URL` | Connected project URL |
| `SUPABASE_PUBLISHABLE_KEY` or `SUPABASE_ANON_KEY` | Authenticated requests governed by database policies |
| `SUPABASE_SECRET_KEY` or `SUPABASE_SERVICE_ROLE_KEY` | Server-only invitations, verified owner setup and student activation |
| `LMS_TEACHER_EMAIL` | Confirmed, fixed owner email allowed to establish the teacher role |
| `LMS_VERIFY_ON_BUILD` | Optional live verification; disabled unless exactly `1` |

The first three configuration values are already managed by the approved
Supabase integration. Keep all privileged credentials on the server. The public
portal calls `/api/learning`; it contains no database keys and keeps sessions in
Secure, HttpOnly, SameSite cookies rather than browser storage. POST requests
must come from `https://www.phillipsenglish.com` and use the application form.

After the owner email is confirmed and configured, Jason completes Teacher
account setup on `/portal`, chooses his own password and confirms his email.
Supabase's default email sender is restricted to project-team addresses with a
low sending limit. If it cannot deliver this one confirmation, the owner must
configure authentication email delivery or use the dashboard account invitation
flow. Never mark an unverified real address as confirmed to skip this step.

Jason can then add a student, copy the private invitation and share it directly.
The student opens it and chooses their own password. Fresh access links are
available from the teaching workspace if a student needs to reset a password.
Links can grant account access: verify the intended recipient and share privately.

## Data access

All five LMS tables use row-level security with explicit grants. Anonymous
clients cannot read learner records. Students can read their own active profile,
feedback, goals and check-ins. Students cannot assign roles or edit teacher
records. Teacher writes require an active student assigned to that teacher.
Roles are stored in a server-managed staff table, not editable user metadata.

The 1 to 5 skill scale describes the guidance needed during coaching. It is not
an IELTS score, CEFR level, percentage or examination grade. The portal starts
with real empty states and displays only saved records.

## Validation and launch

Local checks pass: `npm test` (six tests), `npm run build`,
`python scripts/check_links.py`, JavaScript syntax checks and `git diff --check`.
Supabase's initial refreshed security advisor reported no errors or warnings.
Its initial performance advice contained seven unused-index suggestions;
the ownership and feedback indexes are retained for their intended queries.

The Production launch build passed live sign-in, invitation verification,
password activation, feedback, goals, progress, cross-student and cross-teacher
denial, blocked role escalation and protected cookie checks. Its log confirmed
cleanup of the synthetic accounts and their records. Deployed HTTP checks also
confirmed the portal and website load, signed-out sessions return no user, and
the dashboard rejects signed-out access with HTTP 401. Portal responses are
private, uncached and excluded from search indexing.

The optional `scripts/verify-lms.mjs` runs only with the private Vercel
environment. It creates
temporary synthetic accounts under `example.invalid`, exercises sign-in,
invitation activation, feedback, goals, progress and cross-account denial, then
removes only that run's temporary accounts and associated records. It sends no
emails and does not export credentials, tokens or learner records.

Do not re-enable this workflow without approval for its Production side effects.
For an approved future verification, enable it for one build, inspect the pass
and cleanup results, then disable it so ordinary builds do not create accounts.
