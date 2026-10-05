import test from 'node:test';
import assert from 'node:assert/strict';
import { makeHandler, requestIsSameOrigin, lessonFields, assessmentFields, dateField, cookiesFrom, SITE_ORIGIN } from '../lib/learning.js';

function request(method = 'POST', overrides = {}) {
  return { method, url:'/api/learning?action=invite', body:{}, headers:{ origin:SITE_ORIGIN, 'x-pe-request':'1', 'content-type':'application/json', ...overrides } };
}
async function invoke(handler, req) {
  const headers = {};
  let result;
  const res = { setHeader(k,v){ headers[k]=v; }, statusCode:200, end(value){ result={ status:this.statusCode, body:JSON.parse(value), headers }; } };
  await handler(req,res);
  return result;
}

test('cross-site requests and ordinary form posts cannot change learner data', () => {
  assert.equal(requestIsSameOrigin(request()),true);
  for (const headers of [ { origin:'https://other.example' }, { origin:'null' }, { origin:undefined }, { 'x-pe-request':undefined }, { 'content-type':'text/plain' }, { 'sec-fetch-site':'cross-site' } ]) {
    assert.equal(requestIsSameOrigin(request('POST',headers)),false);
  }
});
test('unauthenticated requests cannot reach teacher actions or learner records', async () => {
  const handler = makeHandler(() => { throw new Error('Unexpected provider access'); },{});
  const invite = await invoke(handler,request());
  assert.equal(invite.status,401);
  const dashboard = await invoke(handler,{ ...request('GET'),url:'/api/learning?action=dashboard' });
  assert.equal(dashboard.status,401);
  const session = await invoke(handler,{ ...request('GET'),url:'/api/learning?action=session' });
  assert.equal(session.status,200);
  assert.deepEqual(session.body,{ user:null });
  assert.match(dashboard.headers['Cache-Control'],/no-store/);
});
test('GET requests cannot trigger writes and invalid origins stop before auth', async () => {
  const handler = makeHandler(() => { throw new Error('Unexpected provider access'); },{});
  assert.equal((await invoke(handler,request('GET'))).status,405);
  assert.equal((await invoke(handler,request('POST',{ origin:'https://other.example' }))).status,403);
});
test('skill assessments require an observed skill and reject invented percentages', () => {
  assert.throws(() => assessmentFields({ assessed_on:'2026-10-05' }),/at least one/);
  assert.throws(() => assessmentFields({ assessed_on:'2026-10-05', pronunciation:90 }),/1 to 5/);
  assert.throws(() => assessmentFields({ assessed_on:'2026-10-05', fluency:2.5 }),/1 to 5/);
  assert.equal(assessmentFields({ assessed_on:'2026-10-05', fluency:3 }).fluency,3);
});
test('feedback validation preserves examples but caps oversized content and corrections', () => {
  const valid = { lesson_date:'2026-10-05',title:'Meeting practice',strengths:'Clear opening',focus:'Past tense',next_steps:'Practise aloud',corrections:[{ original:'I do a crime',corrected:'I commit a crime',explanation:'Learn the verb and noun together.' }] };
  assert.deepEqual(lessonFields(valid).corrections,valid.corrections);
  assert.throws(() => lessonFields({ ...valid,title:'x'.repeat(161) }),/lesson title/);
  assert.throws(() => lessonFields({ ...valid,corrections:Array(13).fill(valid.corrections[0]) }),/12 corrections/);
  assert.throws(() => lessonFields({ ...valid,strengths:'' }),/what went well/);
});
test('dates and cookies handle invalid input without changing identity', () => {
  assert.throws(() => dateField('2026-02-31'),/valid date/);
  assert.equal(dateField('2026-10-05'),'2026-10-05');
  assert.equal(dateField('',false),null);
  assert.deepEqual(cookiesFrom({ headers:{ cookie:'irrelevant=x; __Host-pe_access=token; broken=%zz' } }),{ irrelevant:'x', '__Host-pe_access':'token' });
});
