# Historical Phillips English GitHub Actions (inactive)

These 15 workflow definitions were moved out of `.github/workflows/` on 4 November 2026 as part of a repository cleanup. Their contents are preserved byte-for-byte and remain recoverable in Git history and the `backup/pre-cleanup-2026-11-04` branch.

**They are not active GitHub Actions workflows here.** Most were one-off mutation tools which edit pages, metadata, navigation, styling, images or sitemaps and then automatically commit and push. Several accept `workflow_dispatch`; running them after restoring may override newer work, including the live booking/analytics setup. Do not reactivate or run them without separately reviewing the behavior against the current source.

The following remain active in `.github/workflows/`:

- `content-audit.yml` — read-only site and SEO checks with a report artifact.
- `free-trial-conversion.yml` — Cal.com/GA4 regression tests.
- `export-site.yml` — on-demand website ZIP export; does not modify site files.

This archive intentionally does not remove or alter HTML, CSS, JavaScript, media, redirects, Vercel configuration, Supabase schema, APIs or student portal source. To restore an old workflow, first make a dedicated pull request and test it on a nonproduction branch.
