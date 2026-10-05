import assert from 'node:assert/strict';
import { randomUUID, randomBytes } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { makeHandler, SITE_ORIGIN } from '../lib/learning.js';

// Run only in Vercel with its existing private environment. No credentials,
// sessions, invitation links or learner records are exported or logged.
export async function verifyLms() {
  const env = process.env;
  assert.ok(env.SUPABASE_URL && (env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY),'LMS verification needs the connected Vercel environment.');
  const options = { auth:{ persistSession:false,autoRefreshToken:false,detectSessionInUrl:false } };
  const publicKey = env.SUPABASE_PUBLISHABLE_KEY || env.SUPABASE_ANON_KEY;
  const admin = createClient(env.SUPABASE_URL,env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY,options);
  const publicClient = () => createClient(env.SUPABASE_URL,publicKey,options);
  const handler = makeHandler(createClient,env);
  const created = [];
  const sessions = [];
  const run = randomUUID();
  const password = `Pe-${randomBytes(24).toString('base64url')}!9aA`;
  const must = (result,message) => { assert.equal(result.error,null,message); return result.data; };
  async function account(label) {
    const email = `lms-check-${label}-${run}@example.invalid`;
    const result = must(await admin.auth.admin.createUser({ email,password,email_confirm:true,app_metadata:{ lms_verification_run:run } }),`Create temporary ${label} account`);
    created.push(result.user.id);
    const client = publicClient();
    const signed = must(await client.auth.signInWithPassword({ email,password }),`Sign in temporary ${label} account`);
    sessions.push(signed.session.access_token);
    return { id:result.user.id,email,client,session:signed.session };
  }
  function cookie(session) { return `__Host-pe_access=${encodeURIComponent(session.access_token)}; __Host-pe_refresh=${encodeURIComponent(session.refresh_token)}`; }
  async function call(action,session,body,query = {}) {
    let result;
    const headers = {};
    const res = { statusCode:200,setHeader(k,v){ headers[k]=v; },end(text){ result={ status:this.statusCode,body:JSON.parse(text),headers }; } };
    await handler({ method:body === undefined ? 'GET':'POST', url:`/api/learning?${new URLSearchParams({ action,...query })}`,body,headers:{ origin:SITE_ORIGIN,'content-type':'application/json','x-pe-request':'1',cookie:session ? cookie(session):'' } },res);
    return result;
  }
  try {
    must(await admin.from('lms_staff').select('user_id').limit(1),'LMS schema exists');
    const t = await account('teacher');
    const otherTeacher = await account('otherteacher');
    const a = await account('student-a');
    const b = await account('student-b');
    must(await admin.from('lms_staff').insert([{ user_id:t.id,display_name:'Verification teacher' },{ user_id:otherTeacher.id,display_name:'Verification other teacher' }]),'Temporary teacher roles');
    must(await admin.from('lms_students').insert([{ user_id:a.id,created_by:t.id,display_name:'Verification student A',email:a.email,activated_at:new Date().toISOString() },{ user_id:b.id,created_by:t.id,display_name:'Verification student B',email:b.email,activated_at:new Date().toISOString() }]),'Temporary student profiles');
    for (const student of [a,b]) {
      const feedback = await call('lesson',t.session,{ student_id:student.id,lesson_date:'2026-10-05',title:'Verification lesson',strengths:'Clear opening',focus:'Past tense',next_steps:'Practise aloud',corrections:[{ original:'I do a crime',corrected:'I commit a crime',explanation:'Learn this collocation together.' }] });
      assert.equal(feedback.status,200,'Teacher saves feedback through the API');
      assert.equal((await call('goal',t.session,{ student_id:student.id,title:'Verification goal',status:'in_progress' })).status,200,'Teacher saves a goal');
      assert.equal((await call('assessment',t.session,{ student_id:student.id,assessed_on:'2026-10-05',fluency:3,notes:'Verification check-in' })).status,200,'Teacher saves an assessment');
    }
    for (const table of ['lms_lessons','lms_goals','lms_assessments']) {
      const own = must(await a.client.from(table).select('*').eq('student_id',a.id),'Student reads own records');
      assert.equal(own.length,1,'Student owns one verification record');
      const other = must(await a.client.from(table).select('*').eq('student_id',b.id),'Cross-student read is filtered by RLS');
      assert.equal(other.length,0,'Student cannot read another student');
      const otherTeacherRows = must(await otherTeacher.client.from(table).select('*').eq('student_id',a.id),'Teacher ownership filtering');
      assert.equal(otherTeacherRows.length,0,'Unassigned teacher cannot read a student');
    }
    const dashboard = await call('dashboard',a.session,undefined,{ student:b.id });
    assert.equal(dashboard.status,200,'Student dashboard loads');
    assert.equal(dashboard.body.selectedId,a.id,'Student cannot switch identity through URL parameters');
    assert.equal(dashboard.body.lessons.length,1,'Feedback is visible in the student dashboard');
    assert.deepEqual(dashboard.body.students,[],'Student receives no class roster');
    assert.ok(dashboard.headers['Set-Cookie'].every(c => /HttpOnly/.test(c) && /Secure/.test(c) && /SameSite=Lax/.test(c)),'Session cookies are protected');
    assert.equal((await call('dashboard',otherTeacher.session,undefined,{ student:a.id })).status,404,'Other teacher cannot load assigned dashboard');
    must(await a.client.auth.updateUser({ data:{ role:'teacher',admin:true } }),'User metadata mutation');
    assert.equal((await call('invite',a.session,{ display_name:'Unwanted account',email:`unwanted-${run}@example.invalid` })).status,403,'Editable metadata cannot grant teacher privileges');
    const roleWrite = await a.client.from('lms_staff').insert({ user_id:a.id,display_name:'Unwanted role' });
    assert.ok(roleWrite.error,'Student cannot write a teacher role');
    const lesson = dashboard.body.lessons[0];
    const write = await a.client.from('lms_lessons').update({ strengths:'Unwanted edit' }).eq('id',lesson.id).select('id');
    assert.ok(write.error || !write.data?.length,'Student cannot edit teacher feedback through the Data API');
    const unchanged = must(await admin.from('lms_lessons').select('strengths').eq('id',lesson.id).single(),'Read back unchanged feedback');
    assert.equal(unchanged.strengths,'Clear opening','Student mutation did not change feedback');
    const anonymous = await publicClient().from('lms_lessons').select('*').eq('id',lesson.id);
    assert.ok(anonymous.error || !anonymous.data?.length,'No anonymous learner data');
    const outsider = await call('dashboard',null);
    assert.equal(outsider.status,401,'Signed-out dashboard is private');
    const invitedEmail = `lms-check-invite-${run}@example.invalid`;
    const invite = await call('invite',t.session,{ display_name:'Verification invited student',email:invitedEmail });
    assert.equal(invite.status,200,'Teacher creates an invitation without sending an email');
    const invitedProfile = must(await admin.from('lms_students').select('user_id').eq('email',invitedEmail).single(),'Read temporary invited account');
    created.push(invitedProfile.user_id);
    const invitation = new URL(invite.body.link);
    assert.equal(invitation.origin,SITE_ORIGIN,'Invitation uses the Phillips English website');
    assert.equal(invitation.search,'','Invitation credential is not in a server query string');
    const hash = new URLSearchParams(invitation.hash.slice(1));
    const verified = await call('verify',null,{ type:hash.get('type'),token_hash:hash.get('token_hash') });
    assert.equal(verified.status,200,'One-use invitation can be verified');
    const verifyCookie = verified.headers['Set-Cookie'].map(c => c.split(';')[0]).join('; ');
    let passwordResult;
    const passwordResponse = { statusCode:200,setHeader(){},end(text){ passwordResult={ status:this.statusCode,body:JSON.parse(text) }; } };
    await handler({ method:'POST',url:'/api/learning?action=password',body:{ password },headers:{ origin:SITE_ORIGIN,'content-type':'application/json','x-pe-request':'1',cookie:verifyCookie } },passwordResponse);
    assert.equal(passwordResult.status,200,'Invited student can set a password');
    const newClient = publicClient();
    const newSession = must(await newClient.auth.signInWithPassword({ email:invitedEmail,password }),'Invited student signs in with the chosen password').session;
    sessions.push(newSession.access_token);
    assert.equal((await call('dashboard',newSession)).body.user.needsPassword,false,'Activation is saved');
    assert.equal((await call('verify',null,{ type:hash.get('type'),token_hash:hash.get('token_hash') })).status,401,'Invitation cannot be reused');
    const updatedGoal = dashboard.body.goals[0];
    assert.equal((await call('goal',t.session,{ student_id:a.id,id:updatedGoal.id,title:updatedGoal.title,status:'achieved' })).status,200,'Teacher can record an achieved milestone');
    const updated = await call('dashboard',a.session);
    assert.equal(updated.body.goals[0].status,'achieved','Student sees the milestone update');
    console.log('LMS verification passed: sign-in, invitations, password activation, feedback, goals, progress, RLS and private cookies.');
  } finally {
    for (const token of sessions) await admin.auth.admin.signOut(token,'global');
    for (const id of [...created].reverse()) {
      const removed = await admin.auth.admin.deleteUser(id);
      assert.equal(removed.error,null,'Remove only this run’s temporary verification account');
    }
    console.log('Temporary LMS verification accounts and records removed.');
  }
}
if (process.argv[1] && new URL(import.meta.url).pathname === process.argv[1]) await verifyLms();
