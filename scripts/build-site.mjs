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

async function cleanRenderedHtml(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const fullPath = resolve(directory, entry.name);
    if (entry.isDirectory()) {
      await cleanRenderedHtml(fullPath);
      continue;
    }
    if (!entry.isFile() || !/\.html$/i.test(entry.name)) continue;

    const original = await readFile(fullPath, 'utf8');
    const cleaned = original
      .replace(/(<\/a>)\\n(?=\s*<a\b)/g, '$1\n')
      .replace(/(<\/button>)\\n(?=\s*<a\b)/g, '$1\n');

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
