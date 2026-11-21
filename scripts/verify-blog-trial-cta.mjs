// Verify the free-trial banner appears in the generated HTML of every article.
import { readdir, readFile, stat } from 'node:fs/promises';
import { resolve } from 'node:path';
const root = resolve(import.meta.dirname, '..');
const directory = resolve(root, 'dist/blog');
const css = resolve(root, 'dist/assets/blog-trial-cta.css');
await stat(css);
const pages = (await readdir(directory)).filter(name => name.endsWith('.html'));
if (pages.length < 31) throw new Error('Unexpectedly few blog articles: ' + pages.length);
for (const name of pages) {
  const html = await readFile(resolve(directory, name), 'utf8');
  const count = (html.match(/class="pe-blog-trial-callout"/g) || []).length;
  const ctaIndex = html.indexOf('class="pe-blog-trial-callout"');
  const mainIndex = html.search(/<main\b/i);
  const linked = html.includes('href="/assets/blog-trial-cta.css"');
  const button = html.includes('class="pe-blog-trial-callout__button" href="/free-trial.html"');
  if (count !== 1 || ctaIndex < 0 || mainIndex < ctaIndex || !linked || !button) {
    throw new Error('Free trial CTA invalid or missing on blog/' + name);
  }
}
console.log('Verified prominent free-trial CTA on all ' + pages.length + ' built blog articles.');
