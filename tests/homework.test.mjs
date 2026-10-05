import test from 'node:test';
import assert from 'node:assert/strict';
import { uploadFields, downloadLifetime, verifyStoredFile, cronAuthorized, purgeExpiredHomework, MAX_HOMEWORK_BYTES } from '../lib/homework.js';
import { makeHandler, SITE_ORIGIN } from '../lib/learning.js';

test('uploads reject executable types, paths, empty files, false MIME types and oversized files', () => {
  const valid = {filename:'Introduction.TXT',mime_type:'text/plain',size_bytes:120};
  assert.equal(uploadFields(valid).extension,'txt');
  assert.equal(uploadFields({...valid,size_bytes:MAX_HOMEWORK_BYTES}).size_bytes,MAX_HOMEWORK_BYTES);
  for (const filename of ['../work.txt','folder\\work.txt','work\u0000.txt','work.html','work.js','x'.repeat(181)]) {
    assert.throws(() => uploadFields({...valid,filename}));
  }
  for (const size_bytes of [0,-1,1.5,MAX_HOMEWORK_BYTES+1,'120']) assert.throws(() => uploadFields({...valid,size_bytes}));
  assert.throws(() => uploadFields({...valid,mime_type:'text/html'}));
  assert.equal(uploadFields({...valid,mime_type:'application/octet-stream'}).mime_type,'text/plain');
});

test('downloads cannot outlive seven-day expiry, and pending or expired files cannot be downloaded', () => {
  const now = Date.parse('2026-10-05T12:00:00Z');
  const file = {state:'ready',expires_at:'2026-10-12T12:00:00Z'};
  assert.equal(downloadLifetime(file,now),60);
  assert.equal(downloadLifetime({...file,expires_at:'2026-10-05T12:00:01Z'},now),1);
  assert.throws(() => downloadLifetime({...file,state:'pending'},now),e => e.status===404);
  for (const expires_at of ['2026-10-05T12:00:00Z','2026-10-04T12:00:00Z','invalid']) {
    assert.throws(() => downloadLifetime({...file,expires_at},now),e => e.status===410);
  }
});

test('upload finalisation checks actual stored size and type', () => {
  const file = {size_bytes:120,mime_type:'text/plain'};
  verifyStoredFile({size:120,contentType:'text/plain'},file);
  verifyStoredFile({metadata:{size:120,mimetype:'text/plain'}},file);
  assert.throws(() => verifyStoredFile({size:121,contentType:'text/plain'},file));
  assert.throws(() => verifyStoredFile({size:120,contentType:'text/html'},file));
  assert.throws(() => verifyStoredFile(null,file));
});

test('scheduled cleanup fails closed without the exact long secret', () => {
  const secret = 'a'.repeat(64);
  assert.equal(cronAuthorized(`Bearer ${secret}`,secret),true);
  for (const [header,key] of [[undefined,secret],[`Bearer ${secret}`,undefined],['Bearer short','short'],[`Bearer ${'b'.repeat(64)}`,secret],['',secret]]) {
    assert.equal(cronAuthorized(header,key),false);
  }
});

function cleanupClient({batches=[[]],storageFailure=false,metadataFailure=false}={}) {
  const events=[];
  let cursor=0;
  const client={
    from(table) {
      assert.equal(table,'lms_homework_files');
      let mode='read';
      const query={select(){return query;},or(value){events.push(['filter',value]);return query;},order(){return query;},limit(){return query;},eq(k,v){events.push(['scope',k,v]);return query;},delete(){mode='delete';return query;},in(k,v){events.push(['metadata',v]);return query;},then(resolve,reject){
        const result=mode==='read' ? {data:batches[cursor++]||[],error:null} : {data:batches[cursor-1]||[],error:metadataFailure?{}:null};
        return Promise.resolve(result).then(resolve,reject);
      }};
      return query;
    },
    storage:{from(bucket){assert.equal(bucket,'lms-homework');return {async remove(paths){events.push(['bytes',paths]);return {error:storageFailure?{}:null};}};}}
  };
  return {client,events};
}
test('cleanup removes bytes first, scopes opportunistic cleanup, and safely handles an empty retry', async () => {
  const {client,events}=cleanupClient({batches:[[{id:'one',object_path:'one.txt'}],[]]});
  const result=await purgeExpiredHomework(client,{now:new Date('2026-10-05T12:00:00Z'),lessonId:'lesson-one'});
  assert.deepEqual(result,{removed:1,more:false});
  assert.ok(events.findIndex(e=>e[0]==='bytes')<events.findIndex(e=>e[0]==='metadata'));
  assert.deepEqual(events.find(e=>e[0]==='scope'),['scope','lesson_id','lesson-one']);
  assert.match(events[0][1],/created_at.lte.2026-10-05T09:00:00.000Z/);
  assert.deepEqual(await purgeExpiredHomework(client),{removed:0,more:false});
});
test('storage failures preserve metadata for retry; a bounded job reports more work', async () => {
  const failed=cleanupClient({batches:[[{id:'one',object_path:'one.txt'}]],storageFailure:true});
  await assert.rejects(purgeExpiredHomework(failed.client),e=>e.status===503);
  assert.equal(failed.events.some(e=>e[0]==='metadata'),false);
  const bounded=cleanupClient({batches:[[{id:'one',object_path:'one.txt'}]]});
  assert.deepEqual(await purgeExpiredHomework(bounded.client,{maxBatches:1}),{removed:1,more:true});
});

const studentId='11111111-1111-4111-8111-111111111111';
const teacherId='22222222-2222-4222-8222-222222222222';
const outsiderId='33333333-3333-4333-8333-333333333333';
const lessonId='44444444-4444-4444-8444-444444444444';
const fileId='55555555-5555-4555-8555-555555555555';
const lesson={id:lessonId,student_id:studentId,teacher_id:teacherId,next_steps:'Practise your introduction.'};
const file={id:fileId,lesson_id:lessonId,uploaded_by:teacherId,object_path:`${fileId}.txt`,state:'ready',expires_at:'2099-10-12T12:00:00Z',filename:'work.txt',size_bytes:120,mime_type:'text/plain'};
function provider({role='student',currentLesson=lesson,currentFile=file,needsPassword=false,active=true}={}) {
  const writes=[]; const capabilities=[];
  const currentId=role==='teacher'?teacherId:studentId;
  const env={SUPABASE_URL:'https://example.supabase.co',SUPABASE_PUBLISHABLE_KEY:'public-test-key',SUPABASE_SECRET_KEY:'private-test-key'};
  function createClient(url,key) {
    const admin=key==='private-test-key';
    return {
      auth:{async setSession(){return {data:{session:{access_token:'test-access',refresh_token:'test-refresh'}}};},async getUser(){return {data:{user:{id:currentId,email:'demo@example.invalid',email_confirmed_at:'2026-10-05'}}};}},
      from(table) {
        const filters={}; let mode='read'; let value;
        const query={select(){return query;},eq(k,v){filters[k]=v;return query;},gt(){return query;},or(){return query;},order(){return query;},limit(){return query;},maybeSingle(){return query;},single(){return query;},delete(){mode='delete';return query;},insert(v){mode='insert';value=v;return query;},update(v){mode='update';value=v;return query;},upsert(v){mode='upsert';value=v;return query;},then(resolve,reject){
          let data;
          if(mode!=='read') {writes.push({table,mode,value,filters});data=mode==='insert'?{...value,expires_at:file.expires_at}:[];}
          else if(table==='lms_staff') data=role==='teacher'?{user_id:teacherId,display_name:'Demo teacher'}:null;
          else if(table==='lms_students') data={user_id:studentId,display_name:'Demo student',active,activated_at:needsPassword?null:'2026-10-05',created_by:teacherId};
          else if(table==='lms_lessons') data=currentLesson;
          else if(table==='lms_homework_files') data=filters.id?currentFile:[];
          return Promise.resolve({data,error:null}).then(resolve,reject);
        }};
        return query;
      },
      storage:{from(){assert.ok(admin);return {
        async createSignedUrl(path,lifetime){capabilities.push({kind:'download',path,lifetime});return {data:{signedUrl:'https://example.supabase.co/signed-test'}};},
        async createSignedUploadUrl(path){capabilities.push({kind:'upload',path});return {data:{signedUrl:'https://example.supabase.co/upload-test'}};},
        async info(){return {data:{size:120,contentType:'text/plain'}};},async remove(){throw new Error('No expired test files expected');}
      };}}
    };
  }
  return {handler:makeHandler(createClient,env),writes,capabilities};
}
async function call(handler,action,body={}) {
  let result;
  const req={method:'POST',url:`/api/learning?action=${action}`,body,headers:{origin:SITE_ORIGIN,'x-pe-request':'1','content-type':'application/json',cookie:'__Host-pe_access=test-access; __Host-pe_refresh=test-refresh'}};
  const res={setHeader(){},statusCode:200,end(text){result={status:this.statusCode,body:JSON.parse(text)};}};
  await handler(req,res); return result;
}
test('known file IDs cannot bypass cross-student or cross-teacher lesson ownership', async () => {
  for(const [role,currentLesson] of [['student',{...lesson,student_id:outsiderId}],['teacher',{...lesson,teacher_id:outsiderId}]]) {
    const p=provider({role,currentLesson});
    assert.equal((await call(p.handler,'homework-download',{id:fileId})).status,404);
    assert.equal((await call(p.handler,'homework-upload',{lesson_id:lessonId,filename:'work.txt',size_bytes:120})).status,404);
    assert.equal((await call(p.handler,'homework-complete',{lesson_id:lessonId,completed:true})).status,404);
    assert.deepEqual(p.capabilities,[]);assert.deepEqual(p.writes,[]);
  }
});
test('unfinished accounts cannot access files and students cannot finish a teacher upload', async () => {
  const unfinished=provider({needsPassword:true});
  assert.equal((await call(unfinished.handler,'homework-download',{id:fileId})).status,403);
  assert.deepEqual(unfinished.capabilities,[]);
  const student=provider();
  assert.equal((await call(student.handler,'homework-finish',{id:fileId})).status,403);
  assert.deepEqual(student.writes,[]);
});
test('completion and upload identities come from the verified lesson and session, not editable request fields', async () => {
  const p=provider();
  assert.equal((await call(p.handler,'homework-complete',{lesson_id:lessonId,completed:true,student_id:outsiderId,teacher_id:outsiderId})).status,200);
  assert.equal(p.writes[0].value.student_id,studentId);
  assert.equal(p.writes[0].value.teacher_id,teacherId);
  const result=await call(p.handler,'homework-upload',{lesson_id:lessonId,filename:'work.txt',mime_type:'text/plain',size_bytes:120,role:'teacher',kind:'resource',uploaded_by:outsiderId});
  assert.equal(result.status,200);
  const saved=p.writes.find(w=>w.mode==='insert').value;
  assert.equal(saved.kind,'submission');assert.equal(saved.uploaded_by,studentId);
  assert.equal(saved.student_id,studentId);assert.equal(saved.teacher_id,teacherId);
  assert.match(saved.object_path,/^[a-f0-9-]{36}\.txt$/);
});
test('authorized downloads use a short capability; expired files never reach storage signing', async () => {
  const own=provider();
  assert.equal((await call(own.handler,'homework-download',{id:fileId})).status,200);
  assert.equal(own.capabilities[0].lifetime,60);
  const expired=provider({currentFile:{...file,expires_at:'2020-01-01T00:00:00Z'}});
  assert.equal((await call(expired.handler,'homework-download',{id:fileId})).status,410);
  assert.deepEqual(expired.capabilities,[]);
});
