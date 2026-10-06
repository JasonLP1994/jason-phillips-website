import test from 'node:test';
import assert from 'node:assert/strict';
import { practiceState, homeworkGroups, validView } from '../portal/learning-view.js';

const now = Date.parse('2026-10-06T09:00:00Z');
const lesson = {id:'lesson-one',title:'Introductions',homework_due_date:'2026-10-05',next_steps:''};
const file = {lesson_id:lesson.id,kind:'resource',state:'ready',expires_at:'2026-10-12T12:00:00Z'};

test('an empty lesson or expired resource is not presented as overdue homework', () => {
  for (const files of [[],[{...file,expires_at:'2026-10-05T12:00:00Z'}],[{...file,state:'pending'}],[{...file,lesson_id:'another-lesson'}]]) {
    const data = {lessons:[lesson],homeworkFiles:files};
    assert.equal(practiceState(lesson,data,now).label,'No homework set');
    assert.equal(practiceState(lesson,data,now).overdue,false);
    assert.equal(homeworkGroups(data,false,now).current.length,0);
    assert.equal(homeworkGroups(data,true,now).current.length,1);
  }
});

test('uploading work and completing practice remain separate states', () => {
  const data = {lessons:[lesson],homeworkFiles:[{...file,kind:'submission'}]};
  assert.equal(practiceState(lesson,data,now).label,'Work uploaded');
  assert.equal(practiceState(lesson,data,now).completed,false);
  assert.equal(practiceState(lesson,data,now).overdue,true);
  data.homeworkProgress = [{lesson_id:lesson.id,completed_at:'2026-10-06T08:00:00Z'}];
  assert.equal(practiceState(lesson,data,now).label,'Completed');
  assert.equal(homeworkGroups(data,false,now).current.length,0);
  assert.equal(homeworkGroups(data,false,now).completed.length,1);
  data.homeworkFiles = [];
  assert.equal(homeworkGroups(data,false,now).completed.length,1,'completion survives file expiry');
});

test('the earliest unfinished assigned task comes before an empty or completed lesson', () => {
  const data = {lessons:[
    {...lesson,id:'empty'},
    {...lesson,id:'later',next_steps:'Practise later',homework_due_date:'2026-10-10'},
    {...lesson,id:'done',next_steps:'Finished',homework_due_date:'2026-10-01'},
    {...lesson,id:'next',next_steps:'Practise first',homework_due_date:'2026-10-07'}
  ],homeworkProgress:[{lesson_id:'done',completed_at:'2026-10-05T12:00:00Z'}]};
  assert.deepEqual(homeworkGroups(data,true,now).current.map(item=>item.lesson.id),['next','later','empty']);
  assert.deepEqual(homeworkGroups(data,false,now).current.map(item=>item.lesson.id),['next','later']);
  assert.equal(practiceState({...lesson,next_steps:'Practise'},data,now).label,'Past target date');
});

test('navigation accepts only public view names, never arbitrary URL values', () => {
  assert.equal(validView('homework'),'homework');
  for (const value of [null,'','password','token_hash=secret','https://example.com','../feedback']) assert.equal(validView(value),'overview');
});
