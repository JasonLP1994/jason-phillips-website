# Archived one-off GitHub Actions — Phillips English

Archived on 4 November 2026 during a repository safety review. These **15 workflows have been preserved byte-for-byte** from the original `.github/workflows/` entries, with their original filenames and Git blob SHAs. They are not active GitHub Actions in this directory.

## Why these were archived

Each historical workflow had `contents: write` and used Git commands to modify tracked HTML, CSS, assets, SEO data, or the sitemap. Their push triggers mostly matched edits to their own workflow file, and several also allowed manual dispatch. Keeping them active creates an accidental site rewrite risk during future maintenance.

## Still active

- `.github/workflows/content-audit.yml` — read-only link/SEO checking and artifacts.
- `.github/workflows/free-trial-conversion.yml` — trial booking conversion regression test.
- `.github/workflows/export-site.yml` — creates an export ZIP artifact on demand; no git write commands.

## Recovery and safe reuse

Source content has not been lost. Git history retains each original workflow, and copies are in this folder. **Do not simply move an archived workflow back into `.github/workflows/`:** pushing its YAML file may trigger the historical page mutation it contains. To reuse its logic, extract the necessary script into a separate reviewed maintenance tool that runs on a test branch and opens a PR instead of pushing to production.

## Site preservation

This archival changes GitHub automation only. It does not modify website source files, assets, builds, redirects, tracking, booking, portals, credentials or Vercel configuration. Validate the proposed change in PR and compare GitHub files before merge.
