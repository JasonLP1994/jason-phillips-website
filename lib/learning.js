export const SITE_ORIGIN = 'https://www.phillipsenglish.com';
const PORTAL_URL = `${SITE_ORIGIN}/portal`;
const ACCESS_COOKIE = '__Host-pe_access';
const REFRESH_COOKIE = '__Host-pe_refresh';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SKILLS = ['pronunciation', 'fluency', 'accuracy', 'vocabulary'];

export class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

export function textField(value, label, max = 4000, required = true) {
  if (value === undefined || value === null || value === '') {
    if (!required) return '';
    throw new HttpError(400, `Please enter ${label}.`);
  }
  if (typeof value !== 'string' || value.trim().length > max || !value.trim()) {
    throw new HttpError(400, `Please check ${label}.`);
  }
  return value.trim();
}

export function dateField(value, required = true) {
  if (!value && !required) return null;
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
      Number.isNaN(Date.parse(`${value}T00:00:00Z`)) ||
      new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) !== value) {
    throw new HttpError(400, 'Please choose a valid date.');
  }
  return value;
}

function userId(value) {
  if (typeof value !== 'string' || !UUID.test(value)) throw new HttpError(400, 'Please select a student.');
  return value;
}

function passwordField(value) {
  if (typeof value !== 'string' || value.length < 12 || value.length > 128) {
    throw new HttpError(400, 'Use a password with 12 to 128 characters.');
  }
  return value;
}

export function lessonFields(body) {
  const corrections = body.corrections ?? [];
  if (!Array.isArray(corrections) || corrections.length > 12) throw new HttpError(400, 'Add up to 12 corrections.');
  return {
    lesson_date: dateField(body.lesson_date),
    title: textField(body.title, 'a lesson title', 160),
    strengths: textField(body.strengths, 'what went well', 4000),
    focus: textField(body.focus, 'the next focus', 4000),
    next_steps: textField(body.next_steps, 'practice for next time', 4000),
    corrections: corrections.map(c => ({
      original: textField(c?.original, 'the original phrase', 300),
      corrected: textField(c?.corrected, 'the corrected phrase', 300),
      explanation: textField(c?.explanation, 'an explanation', 600, false)
    }))
  };
}

export function assessmentFields(body) {
  const fields = { assessed_on: dateField(body.assessed_on), notes: textField(body.notes, 'assessment notes', 4000, false) };
  for (const skill of SKILLS) {
    const n = body[skill];
    if (n === null || n === undefined || n === '') { fields[skill] = null; continue; }
    if (!Number.isInteger(n) || n < 1 || n > 5) throw new HttpError(400, 'Choose a skill level from 1 to 5.');
    fields[skill] = n;
  }
  if (SKILLS.every(skill => fields[skill] === null)) throw new HttpError(400, 'Assess at least one skill.');
  return fields;
}

export function requestIsSameOrigin(req) {
  return req.headers.origin === SITE_ORIGIN &&
    req.headers['x-pe-request'] === '1' &&
    /^application\/json(?:\s*;|$)/i.test(req.headers['content-type'] || '') &&
    req.headers['sec-fetch-site'] !== 'cross-site';
}

export function cookiesFrom(req) {
  const result = {};
  for (const part of (req.headers.cookie || '').split(';')) {
    const index = part.indexOf('=');
    if (index === -1) continue;
    try { result[part.slice(0, index).trim()] = decodeURIComponent(part.slice(index + 1).trim()); } catch { /* Ignore malformed cookies. */ }
  }
  return result;
}

function cookie(name, value, maxAge) {
  return `${name}=${encodeURIComponent(value)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;
}

function sessionCookies(res, session) {
  res.setHeader('Set-Cookie', [
    cookie(ACCESS_COOKIE, session.access_token, Math.max(60, session.expires_in || 3600)),
    cookie(REFRESH_COOKIE, session.refresh_token, 60 * 60 * 24 * 21)
  ]);
}

function clearSession(res) {
  res.setHeader('Set-Cookie', [cookie(ACCESS_COOKIE, '', 0), cookie(REFRESH_COOKIE, '', 0)]);
}

async function requestBody(req) {
  if (Number(req.headers['content-length'] || 0) > 24000) throw new HttpError(413, 'This entry is too long.');
  let body = req.body;
  if (body === undefined) {
    let raw = '';
    for await (const chunk of req) {
      raw += chunk;
      if (Buffer.byteLength(raw) > 24000) throw new HttpError(413, 'This entry is too long.');
    }
    body = raw;
  }
  if (typeof body === 'string') {
    if (Buffer.byteLength(body) > 24000) throw new HttpError(413, 'This entry is too long.');
    try { body = JSON.parse(body); } catch { throw new HttpError(400, 'Please try again.'); }
  }
  if (!body || typeof body !== 'object' || Array.isArray(body) || Buffer.byteLength(JSON.stringify(body)) > 24000) {
    throw new HttpError(400, 'Please check the form and try again.');
  }
  return body;
}

function dbResult(result, message = 'We could not save this change. Please try again.') {
  if (result.error) throw new HttpError(result.error.code === '42501' ? 403 : 503, message);
  return result.data;
}

function publicUser(context) {
  return { id: context.user.id, email: context.user.email, role: context.role, name: context.name, needsPassword: context.needsPassword };
}

export function makeHandler(createClient, env = process.env) {
  function client(key) {
    if (!env.SUPABASE_URL || !key) throw new HttpError(503, 'The student portal is being set up. Please try again shortly.');
    return createClient(env.SUPABASE_URL, key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
  }
  const publicClient = () => client(env.SUPABASE_PUBLISHABLE_KEY || env.SUPABASE_ANON_KEY);
  const adminClient = () => client(env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY);

  async function identify(auth, user) {
    if (!user?.id || !user.email_confirmed_at || user.is_anonymous) throw new HttpError(403, 'Please confirm your email before signing in.');
    const staff = await auth.from('lms_staff').select('user_id,display_name').eq('user_id', user.id).maybeSingle();
    if (staff.error) throw new HttpError(503, 'The student portal is being set up. Please try again shortly.');
    if (staff.data) return { auth, user, role: 'teacher', name: staff.data.display_name, needsPassword: false };
    const teacherEmail = env.LMS_TEACHER_EMAIL?.trim().toLowerCase();
    if (teacherEmail && user.email?.toLowerCase() === teacherEmail) {
      // The email is verified by Supabase, never taken from editable user metadata.
      dbResult(await adminClient().from('lms_staff').upsert({ user_id: user.id, display_name: 'Jason Phillips' }, { onConflict: 'user_id' }));
      return { auth, user, role: 'teacher', name: 'Jason Phillips', needsPassword: false };
    }
    const profile = await auth.from('lms_students').select('user_id,display_name,activated_at,active').eq('user_id', user.id).maybeSingle();
    if (profile.error) throw new HttpError(503, 'We could not load your account. Please try again.');
    if (!profile.data?.active) throw new HttpError(403, 'Ask Jason for a student invitation or help with your account.');
    return { auth, user, role: 'student', name: profile.data.display_name, needsPassword: !profile.data.activated_at };
  }

  async function acceptSession(res, auth, session) {
    if (!session?.access_token || !session?.refresh_token) throw new HttpError(401, 'Please sign in again.');
    const verified = await auth.auth.getUser(session.access_token);
    if (verified.error || !verified.data.user) throw new HttpError(401, 'Please sign in again.');
    const context = await identify(auth, verified.data.user);
    sessionCookies(res, session);
    return context;
  }

  async function signedIn(req, res) {
    const cookies = cookiesFrom(req);
    if (!cookies[ACCESS_COOKIE] && !cookies[REFRESH_COOKIE]) throw new HttpError(401, 'Please sign in to continue.');
    const auth = publicClient();
    let result;
    if (cookies[ACCESS_COOKIE] && cookies[REFRESH_COOKIE]) {
      result = await auth.auth.setSession({ access_token: cookies[ACCESS_COOKIE], refresh_token: cookies[REFRESH_COOKIE] });
    } else if (cookies[REFRESH_COOKIE]) {
      result = await auth.auth.refreshSession({ refresh_token: cookies[REFRESH_COOKIE] });
    }
    if (result?.error || !result?.data.session) {
      if (result?.error?.status >= 500) throw new HttpError(503, 'We could not connect. Please try again.');
      clearSession(res);
      throw new HttpError(401, 'Your session has ended. Please sign in again.');
    }
    return acceptSession(res, auth, result.data.session);
  }

  async function teacher(req, res) {
    const context = await signedIn(req, res);
    if (context.role !== 'teacher') throw new HttpError(403, 'Only your teacher can make this change.');
    return context;
  }

  async function ownedStudent(context, id) {
    const student = await context.auth.from('lms_students').select('user_id,email,display_name,created_by,active').eq('user_id', userId(id)).eq('created_by', context.user.id).maybeSingle();
    if (student.error) throw new HttpError(503, 'We could not load this student.');
    if (!student.data?.active) throw new HttpError(404, 'Student not found.');
    return student.data;
  }

  async function dashboard(req, res, url) {
    const context = await signedIn(req, res);
    if (context.needsPassword) return { user: publicUser(context) };
    const isTeacher = context.role === 'teacher';
    const students = isTeacher ? dbResult(await context.auth.from('lms_students').select('user_id,display_name,email,created_at,activated_at,active').order('display_name').limit(500), 'We could not load your students.') : [];
    const requested = url.searchParams.get('student');
    const selectedId = isTeacher ? (requested ? userId(requested) : students.find(s => s.active)?.user_id) : context.user.id;
    if (isTeacher && selectedId && !students.some(s => s.user_id === selectedId && s.active)) throw new HttpError(404, 'Student not found.');
    if (!selectedId) return { user: publicUser(context), students, selectedId: null, lessons: [], goals: [], assessments: [], lessonCount: 0 };
    const offsetText = url.searchParams.get('offset') || '0';
    if (!/^\d{1,6}$/.test(offsetText)) throw new HttpError(400, 'Please reload your feedback.');
    const offset = Number(offsetText);
    const results = await Promise.all([
      context.auth.from('lms_lessons').select('*', { count: 'exact' }).eq('student_id', selectedId).order('lesson_date', { ascending: false }).order('created_at', { ascending: false }).order('id', { ascending: false }).range(offset, offset + 19),
      context.auth.from('lms_goals').select('*').eq('student_id', selectedId).order('created_at', { ascending: false }).limit(500),
      context.auth.from('lms_assessments').select('*').eq('student_id', selectedId).order('assessed_on', { ascending: true }).order('created_at', { ascending: true }).limit(1000)
    ]);
    const [lessons, goals, assessments] = results.map(r => dbResult(r, 'We could not load this progress. Please try again.'));
    return { user: publicUser(context), students, selectedId, lessons, lessonCount: results[0].count ?? lessons.length, goals, assessments };
  }

  async function invitation(context, body, recovery = false) {
    const admin = adminClient();
    let student;
    let email;
    let name;
    if (recovery) {
      student = await ownedStudent(context, body.student_id);
      email = student.email;
      name = student.display_name;
    } else {
      email = textField(body.email, 'a student email', 254).toLowerCase();
      name = textField(body.display_name, 'a student name', 150);
      if (!EMAIL.test(email)) throw new HttpError(400, 'Please check the student email address.');
      if (email === env.LMS_TEACHER_EMAIL?.trim().toLowerCase()) throw new HttpError(400, 'Use the student’s email address.');
      const existing = await context.auth.from('lms_students').select('user_id').eq('email', email).maybeSingle();
      if (existing.data) throw new HttpError(409, 'This student already has an account. Open their record to create a fresh access link.');
    }
    const generated = await admin.auth.admin.generateLink({ type: recovery ? 'recovery' : 'invite', email, options: { redirectTo: PORTAL_URL } });
    if (generated.error || !generated.data?.properties?.hashed_token || !generated.data?.user?.id) {
      throw new HttpError(409, recovery ? 'Could not create an access link. Please try again.' : 'This email may already have a Supabase account. Check the student email or use an existing student record.');
    }
    if (!recovery) {
      dbResult(await admin.from('lms_students').insert({ user_id: generated.data.user.id, display_name: name, email, created_by: context.user.id }));
    } else if (generated.data.user.id !== student.user_id) {
      throw new HttpError(409, 'The student email has changed. Check their account in Supabase before sending a new link.');
    }
    // A fragment keeps the one-use credential out of server URLs and referrers.
    const link = `${PORTAL_URL}#token_hash=${encodeURIComponent(generated.data.properties.hashed_token)}&type=${recovery ? 'recovery' : 'invite'}`;
    return { link, name, email, notice: 'Share this private, one-use link directly with this student. No email has been sent.' };
  }

  return async function handler(req, res) {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'private, no-store, max-age=0');
    res.setHeader('Vary', 'Cookie');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Robots-Tag', 'noindex, nofollow');
    res.setHeader('Referrer-Policy', 'no-referrer');
    const respond = (status, data) => { res.statusCode = status; res.end(JSON.stringify(data)); };
    try {
      const url = new URL(req.url, SITE_ORIGIN);
      const action = url.searchParams.get('action') || 'dashboard';
      if (!['GET', 'POST'].includes(req.method)) { res.setHeader('Allow', 'GET, POST'); throw new HttpError(405, 'Method not allowed.'); }
      if (req.method === 'GET') {
        if (action === 'session') {
          try { const context = await signedIn(req, res); return respond(200, { user: publicUser(context) }); }
          catch (error) { if (error.status === 401) return respond(200, { user: null }); throw error; }
        }
        if (action === 'dashboard') return respond(200, await dashboard(req, res, url));
        throw new HttpError(405, 'Use the form to make this change.');
      }
      if (!requestIsSameOrigin(req)) throw new HttpError(403, 'Please use the form on Phillips English.');
      const body = await requestBody(req);
      if (action === 'sign-in') {
        const email = textField(body.email, 'your email', 254).toLowerCase();
        const password = body.password;
        if (typeof password !== 'string' || !password || password.length > 128) throw new HttpError(400, 'Please enter your password.');
        const auth = publicClient();
        const result = await auth.auth.signInWithPassword({ email, password });
        if (result.error) throw new HttpError(result.error.status === 429 ? 429 : 401, result.error.status === 429 ? 'Too many attempts. Please wait before trying again.' : 'Check your email and password, and make sure your email is confirmed.');
        const context = await acceptSession(res, auth, result.data.session);
        return respond(200, { user: publicUser(context) });
      }
      if (action === 'teacher-setup') {
        const email = textField(body.email, 'your teacher email', 254).toLowerCase();
        if (!env.LMS_TEACHER_EMAIL || email !== env.LMS_TEACHER_EMAIL.trim().toLowerCase()) throw new HttpError(403, 'Teacher setup is reserved for the Phillips English account owner.');
        const result = await publicClient().auth.signUp({ email, password: passwordField(body.password), options: { emailRedirectTo: PORTAL_URL } });
        if (result.error) throw new HttpError(503, 'We could not send the confirmation. Use your Supabase dashboard to invite the teacher account, or configure authentication email delivery.');
        return respond(200, { message: 'Check your inbox and confirm your email. Then sign in here with your password.' });
      }
      if (action === 'verify') {
        if (!['invite', 'recovery'].includes(body.type) || typeof body.token_hash !== 'string' || !/^[a-z0-9_-]{20,128}$/i.test(body.token_hash)) throw new HttpError(400, 'This access link is not valid. Ask Jason for a fresh link.');
        const auth = publicClient();
        const result = await auth.auth.verifyOtp({ token_hash: body.token_hash, type: body.type });
        if (result.error) throw new HttpError(401, 'This link has expired or has already been used. Ask Jason for a fresh link.');
        const context = await acceptSession(res, auth, result.data.session);
        return respond(200, { user: publicUser(context), setPassword: true });
      }
      if (action === 'confirm-session') {
        const auth = publicClient();
        const access = textField(body.access_token, 'an access token', 8000);
        const refresh = textField(body.refresh_token, 'a refresh token', 1000);
        const result = await auth.auth.setSession({ access_token: access, refresh_token: refresh });
        if (result.error) throw new HttpError(401, 'This confirmation has expired. Please sign in again.');
        const context = await acceptSession(res, auth, result.data.session);
        return respond(200, { user: publicUser(context), setPassword: body.type === 'recovery' || body.type === 'invite' });
      }
      if (action === 'sign-out') {
        try { const context = await signedIn(req, res); await context.auth.auth.signOut({ scope: 'local' }); } catch { /* Local cookies are always removed. */ }
        clearSession(res);
        return respond(200, { ok: true });
      }
      if (action === 'password') {
        const context = await signedIn(req, res);
        const result = await context.auth.auth.updateUser({ password: passwordField(body.password) });
        if (result.error) throw new HttpError(400, 'This password could not be saved. Use a new password with at least 12 characters.');
        if (context.role === 'student') dbResult(await adminClient().from('lms_students').update({ activated_at: new Date().toISOString() }).eq('user_id', context.user.id));
        return respond(200, { ok: true });
      }
      const context = await teacher(req, res);
      if (action === 'invite') return respond(200, await invitation(context, body));
      if (action === 'access-link') return respond(200, await invitation(context, body, true));
      const student = await ownedStudent(context, body.student_id);
      if (action === 'lesson') {
        const fields = { ...lessonFields(body), student_id: student.user_id, teacher_id: context.user.id };
        if (body.id) {
          const rows = dbResult(await context.auth.from('lms_lessons').update(fields).eq('id', userId(body.id)).eq('student_id', student.user_id).select('id'));
          if (!rows.length) throw new HttpError(404, 'Feedback not found.');
        } else dbResult(await context.auth.from('lms_lessons').insert(fields));
        return respond(200, { ok: true });
      }
      if (action === 'goal') {
        const status = body.status || 'in_progress';
        if (!['not_started', 'in_progress', 'achieved'].includes(status)) throw new HttpError(400, 'Please choose a valid goal status.');
        const fields = { student_id: student.user_id, teacher_id: context.user.id, title: textField(body.title, 'a goal', 240), due_date: dateField(body.due_date, false), status };
        if (body.id) {
          const rows = dbResult(await context.auth.from('lms_goals').update(fields).eq('id', userId(body.id)).eq('student_id', student.user_id).select('id'));
          if (!rows.length) throw new HttpError(404, 'Goal not found.');
        } else dbResult(await context.auth.from('lms_goals').insert(fields));
        return respond(200, { ok: true });
      }
      if (action === 'assessment') {
        const fields = { ...assessmentFields(body), student_id: student.user_id, teacher_id: context.user.id };
        if (body.id) {
          const rows = dbResult(await context.auth.from('lms_assessments').update(fields).eq('id', userId(body.id)).eq('student_id', student.user_id).select('id'));
          if (!rows.length) throw new HttpError(404, 'Check-in not found.');
        } else dbResult(await context.auth.from('lms_assessments').insert(fields));
        return respond(200, { ok: true });
      }
      throw new HttpError(404, 'This action is not available.');
    } catch (error) {
      // Never log request bodies, tokens, invite links or student feedback.
      respond(error instanceof HttpError ? error.status : 503, { error: error instanceof HttpError ? error.message : 'We could not connect to the portal. Please try again.' });
    }
  };
}
