import { createClient } from '@supabase/supabase-js';
import { cronAuthorized, purgeExpiredHomework } from '../lib/homework.js';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'private, no-store, max-age=0');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  if (req.method !== 'GET') { res.statusCode = 405; res.end(JSON.stringify({ error: 'Method not allowed.' })); return; }
  if (!cronAuthorized(req.headers.authorization, process.env.CRON_SECRET)) {
    res.statusCode = 401; res.end(JSON.stringify({ error: 'Unauthorized.' })); return;
  }
  try {
    const admin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY,
      { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
    const result = await purgeExpiredHomework(admin);
    // Counts only: never log filenames, learner records, links or credentials.
    console.log('Homework cleanup completed.', { removed: result.removed, more: result.more });
    res.statusCode = 200; res.end(JSON.stringify({ ok: true, ...result }));
  } catch {
    console.error('Homework cleanup failed. Retrying at the next scheduled run.');
    res.statusCode = 503; res.end(JSON.stringify({ error: 'Cleanup could not finish.' }));
  }
}
