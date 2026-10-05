import { cp, mkdir, readdir, rm } from 'node:fs/promises';
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
for (const directory of ['assets', 'blog', 'portal']) {
  await cp(resolve(root, directory), resolve(dist, directory), { recursive: true });
}
if (process.env.LMS_VERIFY_ON_BUILD === '1') {
  const { verifyLms } = await import('./verify-lms.mjs');
  await verifyLms();
}
console.log('Marketing pages and student portal built. Server credentials stay in Vercel.');
