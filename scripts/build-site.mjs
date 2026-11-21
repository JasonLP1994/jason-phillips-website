import { cp, mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const dist = resolve(root, 'dist');
await rm(dist, { recursive: true, force: true });
await mkdir(dist);
for (const entry of await readdir(root, { withFileTypes: true })) {
  if (entry.isFile() && /\.(html|webp|png|jpg|jpeg|svg|ico|txt|xml)$/i.test(entry.name)) {
    await cp(resolve(root, entry.name), resolve(dist, entry.name));
  }
}
for (const directory of ['assets', 'blog', 'portal', 'es', 'fr', 'de', 'it']) {
  await cp(resolve(root, directory), resolve(dist, directory), { recursive: true });
}

// Render a noticeable, accessible free-trial invitation on EVERY blog
// article. Injecting at build time keeps the published HTML crawlable and
// ensures existing and future articles share the same conversion pathway.
const blogTrialCallout = `
<aside class="pe-blog-trial-callout" aria-label="Free English trial lesson">
  <div class="pe-blog-trial-callout__inner">
    <div class="pe-blog-trial-callout__copy">
      <div class="pe-blog-trial-callout__eyebrow">YOUR FIRST 25 MINUTES ARE FREE</div>
      <h2>Turn what you've learnt into confident English.</h2>
      <p>Practise with a British English coach, get personalised corrections and discuss your goals. No payment details or obligation to continue.</p>
    </div>
    <a class="pe-blog-trial-callout__button" href="/free-trial.html" aria-label="Book a free 25-minute English trial lesson">Book my free trial <span aria-hidden="true">→</span></a>
  </div>
</aside>
`;

async function cleanRenderedHtml(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const fullPath = resolve(directory, entry.name);
    if (entry.isDirectory()) {
      await cleanRenderedHtml(fullPath);
      continue;
    }
    if (!entry.isFile() || !/\.html$/i.test(entry.name)) continue;

    const original = await readFile(fullPath, 'utf8');
    let cleaned = original
      .replace(/(<\/a>)\\n(?=\s*<a\b)/g, '$1\n')
      .replace(/(<\/button>)\\n(?=\s*<a\b)/g, '$1\n');

    // Every existing and future /blog/*.html page receives the banner.
    // This runs on the generated site; source articles are left unchanged.
    if (directory === resolve(dist, 'blog')) {
      if (!/<main\\b/i.test(cleaned) || !/<\\/head>/i.test(cleaned)) {
        throw new Error('Blog article missing required main/head: ' + entry.name);
      }
      if (!cleaned.includes('class="pe-blog-trial-callout"')) {
        cleaned = cleaned
          .replace(/<\\/head>/i, '<link rel="stylesheet" href="/assets/blog-trial-cta.css">\\n</head>')
          .replace(/<main\\b/i, blogTrialCallout + '<main');
      }
    }

    if (cleaned !== original) {
      await writeFile(fullPath, cleaned, 'utf8');
    }
  }
}

await cleanRenderedHtml(dist);

if (process.env.LMS_VERIFY_ON_BUILD === '1') {
  const { verifyLms } = await import('./verify-lms.mjs');
  await verifyLms();
}
console.log('Marketing pages and student portal built. Server credentials stay in Vercel.');
