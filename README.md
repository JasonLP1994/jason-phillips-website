# Phillips English — website repository

Website: https://www.phillipsenglish.com

This repository contains the live website source, its static pages and media, and the separate student portal and API code. It is **not** safe to assume a file is unused merely because it is not linked from the homepage.

## What belongs here

- Root `*.html`, `blog/`, and `it/`, `fr/`, `de/`, `es/`: published pages and localized content.
- `assets/` and root images: website styling, scripts, photography, blog/social media artwork and other media. Some assets can be referenced by remote posts or generated output.
- `portal/`, `api/`, `lib/`, `supabase/migrations/`: student portal, learning/homework APIs and database schema. Protect these even if they are not visible in the marketing navigation.
- `scripts/build-site.mjs`: copies website and portal files into the generated `dist/` directory. `dist/` is ignored by Git.
- `vercel.json`: redirects, rewrites, headers and deployment behavior. Preserve existing routes.
- `tests/`: tests for website/booking and learning functions.
- `.github/workflows/`: both recurring validation workflows and older one-off site-modification workflows. These are **not interchangeable**.

## Local checks (do not deploy)

Use a compatible Node version (see `package.json`):

```sh
npm ci
npm test
npm run build
python3 scripts/check_links.py
node scripts/seo-audit.mjs
```

The build writes to `dist/` locally. Running tests and a local build is distinct from publishing a Vercel deployment. Some integration checks may require service credentials; never place private keys in source control.

## Safety rules for maintenance

1. Protect the existing booking flow and Cal.com integration, GA4 events, redirects, contact forms, the student portal and Supabase migration history.
2. Do not delete, rename or move website assets or page files based on filenames alone. Validate references, redirects, generated output and external uses first.
3. Several historical GitHub Actions workflows can **write commits and modify live page source if manually dispatched or if their workflow file is changed on the triggering branch**. Avoid running these until each has been audited. Retain the regression and content-audit workflows.
4. Prepare one narrowly scoped pull request at a time. Run tests and a build, compare rendered output if source files change, and require an explicit review before merging to `main`.
5. Never store API secrets, .env files, student information or production credentials in Git.

Earlier `README.txt` and `README_V17.txt` files are historical change notes retained intentionally; this file is the current repository orientation.

## Cleanup status — 4 November 2026

The initial hygiene pass adds repository guidance and editor/ignore rules only. **No published HTML, CSS, JavaScript, images, routes, student data, GitHub workflow triggers or Vercel settings are changed.** A separate dependency/reference audit is required before any code or asset removal.
