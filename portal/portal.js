import { homeworkGroups, practiceState, validView, views } from './learning-view.js';

(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
  const date = value => value ? new Intl.DateTimeFormat('en-GB', { day:'numeric', month:'short', year:'numeric', timeZone:'UTC' }).format(new Date(value)) : '';
  const today = () => new Date().toISOString().slice(0,10);
  const levels = ['','Needs close guidance','Frequent prompts','Occasional prompts','Mostly independent','Independent and consistent'];
  const skills = { pronunciation:'Pronunciation', fluency:'Fluency', accuracy:'Accuracy', vocabulary:'Vocabulary' };
  const statuses = { not_started:'Not started', in_progress:'In progress', achieved:'Achieved' };
  const fileTypes = {pdf:'application/pdf',docx:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',txt:'text/plain',jpg:'image/jpeg',jpeg:'image/jpeg',png:'image/png',webp:'image/webp',mp3:'audio/mpeg',m4a:'audio/mp4'};
  const fileAccept = '.pdf,.docx,.txt,.jpg,.jpeg,.png,.webp,.mp3,.m4a';
  const storageOrigin = 'https://xfjhfieqvzlxinstnzxu.supabase.co';
  const fileDeadline = value => new Intl.DateTimeFormat('en-GB', {dateStyle:'medium',timeStyle:'short'}).format(new Date(value));
  const fileSize = bytes => bytes < 1024 ? `${bytes} bytes` : bytes < 1024 * 1024 ? `${Math.ceil(bytes / 1024)} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  let data = null;
  let activeView = validView(new URLSearchParams(location.search).get('view'));
  let loadSerial = 0;
  let editorKind = null;
  let editorItem = null;
  let invitationLink = null;
  let feedbackSearch = '';
  const teacher = () => data?.user?.role === 'teacher';

  function message(id, value, success = false) {
    const node = $(id);
    node.textContent = value || '';
    node.hidden = !value;
    node.classList.toggle('success', success);
  }
  async function api(action, body, query = {}) {
    const params = new URLSearchParams({ action, ...query });
    const response = await fetch(`/api/learning?${params}`, {
      method: body === undefined ? 'GET' : 'POST', credentials:'same-origin', cache:'no-store',
      headers: body === undefined ? {} : { 'Content-Type':'application/json', 'X-PE-Request':'1' },
      body: body === undefined ? undefined : JSON.stringify(body)
    });
    const result = await response.json();
    if (!response.ok) {
      if (response.status === 401 && data) showSignIn();
      throw new Error(result.error || 'We could not connect. Please try again.');
    }
    return result;
  }
  function empty(title, copy, button = '') {
    return `<div class="empty"><span class="empty-icon" aria-hidden="true">↗</span><h3>${escape(title)}</h3><p>${escape(copy)}</p>${button}</div>`;
  }
  function badge(goal) { return `<span class="badge ${escape(goal.status)}">${escape(statuses[goal.status] || goal.status)}</span>`; }
  function lessonHtml(lesson, full = false) {
    if (!lesson) return empty('No lesson feedback yet.', teacher() ? 'Add the first lesson using the button above.' : 'After your first lesson, Jason will add your feedback here.');
    const practice = practiceState(lesson,data);
    if (!full) return `<p class="lesson-date">${date(lesson.lesson_date)}</p><h3 class="lesson-title">${escape(lesson.title)}</h3><p class="lesson-summary">Strengths, weaknesses and ${lesson.corrections?.length || 0} ${(lesson.corrections?.length || 0) === 1 ? 'correction' : 'corrections'} to revisit.</p><div class="lesson-actions"><button class="button secondary" type="button" data-open-feedback="${escape(lesson.id)}">Read lesson feedback</button>${practice.hasPractice ? `<button class="text-button" type="button" data-open-homework="${escape(lesson.id)}">View homework</button>` : ''}</div>`;
    const corrections = lesson.corrections?.length ? lesson.corrections.map(c => `<div class="correction"><p class="original">You said: ${escape(c.original)}</p><p class="corrected">Try: ${escape(c.corrected)}</p>${c.explanation ? `<p class="why">${escape(c.explanation)}</p>` : ''}</div>`).join('') : '<p>No corrections recorded for this lesson.</p>';
    return `<p class="lesson-date">${date(lesson.lesson_date)}</p><h3 class="lesson-title">${escape(lesson.title)}</h3><div class="feedback-boxes"><section class="feedback-box strengths-box"><h4>Strengths</h4><p>${escape(lesson.strengths)}</p></section><section class="feedback-box weaknesses-box"><h4>Weaknesses</h4><p>${escape(lesson.focus)}</p></section><section class="feedback-box corrections-box"><h4>Corrections</h4>${corrections}</section></div><div class="lesson-actions">${teacher() ? `<button class="button secondary" type="button" data-edit-lesson="${escape(lesson.id)}">Edit feedback</button>` : ''}${teacher() || practice.hasPractice ? `<button class="${teacher() ? 'text-button' : 'button secondary'}" type="button" data-open-homework="${escape(lesson.id)}">${practice.hasPractice ? 'View homework' : 'Set homework'}</button>` : '<p class="field-note">No homework has been set for this lesson.</p>'}</div>`;
  }

  function fileList(files, title) {
    if (!files.length) return '';
    return `<div class="homework-files"><h4>${title}</h4>${files.map(f => `<div class="homework-file"><div><strong>${escape(f.filename)}</strong><p>${fileSize(f.size_bytes)} · Download until ${escape(fileDeadline(f.expires_at))}</p></div><button type="button" class="button secondary" data-download-homework="${escape(f.id)}" aria-label="Download ${escape(f.filename)}">Download</button></div>`).join('')}</div>`;
  }
  function homeworkCard(item) {
    const { lesson:l, files, completed:done, overdue, hasPractice, uploaded } = item;
    const resources = files.filter(file => file.kind === 'resource');
    const submissions = files.filter(file => file.kind === 'submission');
    const capacity = files.length >= 6;
    return `<article class="homework-card" id="homework-${escape(l.id)}" tabindex="-1"><div class="homework-heading"><div><p class="lesson-date">${date(l.lesson_date)}</p><h3>${escape(l.title)}</h3></div><span class="badge ${done ? 'achieved' : !hasPractice ? 'not_started' : overdue ? 'overdue' : ''}">${escape(item.label)}</span></div><section class="practice-task"><h4>${teacher() ? 'Task and target date' : '1. Read your task'}</h4>${l.next_steps ? `<p class="homework-instructions">${escape(l.next_steps)}</p>` : `<p class="muted">${teacher() ? 'No written instructions yet. Add a task below, or share a file for your student to practise with.' : resources.length ? 'Use the lesson files below for your practice.' : 'No written instructions were added. Ask Jason if you are unsure what to practise.'}</p>`}${l.homework_due_date ? `<p class="goal-date">${overdue ? 'Target date was' : 'Aim to finish by'} <strong>${date(l.homework_due_date)}</strong></p>` : ''}${teacher() ? `<button type="button" class="text-button" data-edit-lesson="${escape(l.id)}">${l.next_steps ? 'Edit task or target date' : 'Add task instructions'}</button>` : ''}${fileList(resources,teacher() ? 'Files shared with your student' : 'Files from Jason')}</section>${teacher() ? `<section class="student-work"><h4>Work uploaded by your student</h4>${submissions.length ? fileList(submissions,'Student uploads') : '<p class="muted">Nothing uploaded yet.</p>'}</section>` : fileList(submissions,'Your uploaded work')}<form class="homework-upload" data-homework-form="${escape(l.id)}"><h4>${teacher() ? 'Share a file' : '2. Upload your work, if requested'}</h4><label for="homework-file-${escape(l.id)}">${teacher() ? 'Choose a homework file or marked copy' : 'Choose your completed work'}</label><div class="homework-upload-row"><input type="file" id="homework-file-${escape(l.id)}" accept="${fileAccept}" ${capacity ? 'disabled' : ''} required><button type="submit" class="button secondary" disabled>${teacher() ? 'Share file' : 'Upload work'}</button></div><p class="field-note">${capacity ? 'This lesson has six files. Download anything you need before its expiry; you can add another file once space is available.' : 'Choose a file, then press the upload button. PDF, Word, text, images or audio. Up to 10 MB per file, six files per lesson.'}</p><p class="upload-status" role="status" aria-live="polite"></p></form>${hasPractice ? `<section class="practice-finish"><h4>${teacher() ? 'Practice status' : '3. Mark your practice complete'}</h4><p class="muted">${teacher() ? 'Uploading a file does not mark the task complete. Update this when the agreed practice is finished.' : uploaded ? 'Your file is uploaded. When you have finished the practice, mark it complete below.' : 'You can complete a task without uploading a file. Mark it complete when you have finished practising.'}</p><button type="button" class="button ${done ? 'secondary' : 'primary'}" data-complete-homework="${escape(l.id)}" data-completed="${done ? 'true' : 'false'}">${done ? 'Reopen practice' : 'Mark practice complete'}</button></section>` : ''}<div class="homework-actions"><button type="button" class="text-button" data-open-feedback="${escape(l.id)}">Read this lesson’s feedback</button></div></article>`;
  }
  function renderHomework() {
    const lessons = data.lessons || [];
    const groups = homeworkGroups(data,teacher());
    const current = groups.current.length ? groups.current.map(homeworkCard).join('') : `<div class="panel">${empty(groups.completed.length ? 'All loaded practice is complete.' : 'No homework set yet.', teacher() ? 'Add lesson feedback first, then set a task or share a file for that lesson.' : groups.completed.length ? 'Well done. You can reopen a completed task below whenever you want to practise again.' : 'Jason will add practice after a lesson. You can still revisit your feedback.', teacher() && data.selectedId && !lessons.length ? '<button type="button" class="button primary" data-new-lesson>Add lesson feedback</button>' : lessons.length ? '<button type="button" class="button secondary" data-view="feedback">Read lesson feedback</button>' : '')}</div>`;
    $('homework-list').innerHTML = current + (groups.completed.length ? `<details class="completed-practice"><summary>Completed practice (${groups.completed.length})</summary><div>${groups.completed.map(homeworkCard).join('')}</div></details>` : '');
    $('load-homework').hidden = lessons.length >= (data.lessonCount || 0);
  }
  function renderFeedback() {
    const lessons = data.lessons || [];
    const query = feedbackSearch.trim().toLowerCase();
    const shown = lessons.filter(l => `${l.title} ${l.lesson_date} ${date(l.lesson_date)}`.toLowerCase().includes(query));
    $('feedback-list').innerHTML = shown.length ? shown.map(l => `<article class="feedback-card" id="feedback-${escape(l.id)}" tabindex="-1">${lessonHtml(l,true)}</article>`).join('') : `<div class="panel">${empty(query ? 'No matching lessons in this list.' : 'No lesson feedback yet.', query ? 'Try a different title or date, or load earlier lessons below.' : teacher() ? 'Add feedback after a lesson using the button above.' : 'Jason will add your feedback after a lesson. You can return to it whenever you practise.')}</div>`;
    const more = lessons.length < (data.lessonCount || 0);
    $('feedback-search-note').textContent = `${query ? `${shown.length} matching ${shown.length === 1 ? 'lesson' : 'lessons'}. ` : ''}${more ? `${lessons.length} of ${data.lessonCount} lessons loaded. Load earlier lessons to search more.` : `${lessons.length} ${lessons.length === 1 ? 'lesson' : 'lessons'} available.`}`;
  }
  function renderNextTask() {
    const groups = homeworkGroups(data,teacher());
    const next = groups.current.find(item => item.hasPractice);
    const latest = data.lessons?.[0];
    const heading = teacher() ? 'NEXT STUDENT TASK' : 'START HERE';
    $('next-task').innerHTML = next ? `<div><p class="eyebrow">${heading}</p><h2>${escape(next.lesson.title)}</h2><p>${escape(next.lesson.next_steps || (next.uploaded ? teacher() ? 'The student has uploaded work. Review it and update the practice status when ready.' : 'Your work is uploaded. Mark the practice complete when you have finished.' : 'Download the lesson files and work through the practice task.'))}</p>${next.lesson.homework_due_date ? `<small>${next.overdue ? 'Target date was' : 'Aim to finish by'} ${date(next.lesson.homework_due_date)}</small>` : ''}</div><button type="button" class="button primary" data-open-homework="${escape(next.lesson.id)}">${teacher() ? 'Review homework' : 'Open this task'}</button>` : `<div><p class="eyebrow">${heading}</p><h2>${latest ? groups.completed.length ? teacher() ? 'All loaded practice is complete.' : 'Practice complete. Nicely done.' : 'Revisit the latest lesson.' : teacher() ? data.selectedId ? 'Add the first lesson.' : 'Add your first student.' : 'Your first lesson starts here.'}</h2><p>${latest ? 'Read the feedback and try a corrected sentence again.' : teacher() ? data.selectedId ? 'Record strengths, weaknesses and corrections, then set a practice task.' : 'Create an invitation, share the private link and let your student choose their password.' : 'After your lesson, read your feedback, practise the task and check your progress. Jason will add everything here.'}</p></div>${latest ? `<button type="button" class="button primary" data-open-feedback="${escape(latest.id)}">Read lesson feedback</button>` : teacher() ? `<button type="button" class="button primary" ${data.selectedId ? 'data-new-lesson' : 'data-new-student'}>${data.selectedId ? 'Add lesson feedback' : 'Add student'}</button>` : ''}`;
    const more = (data.lessons?.length || 0) < (data.lessonCount || 0);
    if (more) $('next-task').insertAdjacentHTML('beforeend','<p class="next-task-note">This shows the next task among loaded lessons. Open Homework and load earlier lessons to check older tasks.</p>');
  }
  function goalHtml(goal, preview = false) {
    return `<article class="${preview ? 'goal-preview' : 'goal-card'}">${badge(goal)}<h3>${escape(goal.title)}</h3><p class="goal-date">${goal.due_date ? `Working towards ${date(goal.due_date)}` : 'One useful step at a time.'}</p>${teacher() && !preview ? `<button class="text-button" type="button" data-edit-goal="${escape(goal.id)}">Update goal</button>` : ''}</article>`;
  }
  function render() {
    const user = data.user;
    const lessons = data.lessons || [];
    const goals = data.goals || [];
    const assessments = data.assessments || [];
    const students = data.students || [];
    $('auth-screen').hidden = true;
    $('workspace').hidden = false;
    document.querySelector('.skip-link').setAttribute('href','#learning-main');
    $('workspace-role').textContent = teacher() ? 'Teaching workspace' : 'Student portal';
    $('account-name').textContent = user.name;
    const selectedStudent = students.find(s => s.user_id === data.selectedId);
    $('heading-kicker').textContent = teacher() ? (selectedStudent ? `${selectedStudent.display_name} · TEACHING WORKSPACE` : 'TEACHING WORKSPACE') : 'YOUR LEARNING SPACE';
    $('teacher-tools').hidden = !teacher();
    $('student-select').innerHTML = students.length ? students.filter(s => s.active).map(s => `<option value="${escape(s.user_id)}">${escape(s.display_name)}${s.activated_at ? '' : ' · invited'}</option>`).join('') : '<option value="">No students yet</option>';
    $('student-select').value = data.selectedId || '';
    document.querySelectorAll('.teacher-action').forEach(node => {
      node.hidden = !teacher() || !data.selectedId;
      if (node.tagName === 'BUTTON') node.disabled = !data.selectedId;
    });
    document.querySelector('.home-actions').hidden = !teacher() || !data.selectedId || !lessons.length;
    $('student-access-note').hidden = !teacher() || !selectedStudent || Boolean(selectedStudent.activated_at);
    $('student-access-note').textContent = 'Invitation created. This student still needs to open their private link and choose a password.';
    ['overview-grid','stats','progress-callout'].forEach(id => { $(id).hidden = teacher() && !data.selectedId; });
    const completed = goals.filter(goal => goal.status === 'achieved').length;
    const latestAssessment = assessments.at(-1);
    $('stats').innerHTML = `<div class="stat"><span>Lessons with feedback</span><strong>${data.lessonCount || 0}</strong></div><div class="stat"><span>Goals to work on</span><strong>${goals.filter(g => g.status !== 'achieved').length}</strong></div><div class="stat"><span>Goals achieved</span><strong>${completed}</strong></div><div class="stat"><span>Latest skill check-in</span><strong class="date-stat">${latestAssessment ? date(latestAssessment.assessed_on) : 'Not yet'}</strong></div>`;
    $('latest-lesson').innerHTML = lessonHtml(lessons[0]);
    const currentGoals = goals.filter(g => g.status !== 'achieved').slice(0,3);
    $('overview-goals').innerHTML = currentGoals.length ? currentGoals.map(g => goalHtml(g,true)).join('') : empty(goals.length ? 'Time for the next challenge.' : 'Let’s choose a useful goal.', goals.length ? 'Your recorded goals are achieved. Talk with Jason about what comes next.' : 'A clear goal helps you turn practice into something that matters to you.');
    renderFeedback();
    renderHomework();
    renderNextTask();
    $('load-feedback').hidden = lessons.length >= (data.lessonCount || 0);
    $('goals-list').innerHTML = goals.length ? goals.map(g => goalHtml(g)).join('') : `<div class="panel">${empty('What would you like to do with your English?', teacher() ? 'Add a specific goal you can work towards together.' : 'Talk with Jason about your next goal. It will appear here once you’ve agreed it.')}</div>`;
    $('skills-grid').innerHTML = Object.entries(skills).map(([key,label]) => {
      const entries = assessments.filter(a => a[key] !== null && a[key] !== undefined);
      const first = entries[0];
      const latest = entries.at(-1);
      return `<section class="skill-card"><h3>${label}</h3>${latest ? `<p class="skill-level">${latest[key]}<small>/ 5</small></p><p class="skill-label">${levels[latest[key]]}</p><div class="skill-steps" role="img" aria-label="${label}: level ${latest[key]} out of 5">${[1,2,3,4,5].map(n => `<span class="${n <= latest[key] ? 'filled' : ''}"></span>`).join('')}</div><p class="skill-baseline">First recorded: ${first[key]} / 5 on ${date(first.assessed_on)}<br>Latest: ${date(latest.assessed_on)}</p>` : `<p class="skill-level">Not yet</p><p class="skill-label">Your first check-in will appear here.</p>`}</section>`;
    }).join('');
    $('assessment-history').innerHTML = assessments.length ? [...assessments].reverse().map(a => `<article class="assessment-entry"><h3>${date(a.assessed_on)}</h3><div class="assessment-levels">${Object.entries(skills).filter(([key]) => a[key] !== null).map(([key,label]) => `<span>${label}: ${a[key]} / 5</span>`).join('')}</div>${a.notes ? `<p>${escape(a.notes)}</p>` : ''}${teacher() ? `<button type="button" class="text-button" data-edit-assessment="${escape(a.id)}">Edit check-in</button>` : ''}</article>`).join('') : empty('Small changes add up.', 'Jason will record skill check-ins as you work together. They’ll give you a useful way to look back.');
    if (user.needsPassword) message('workspace-message','Choose a password to finish setting up your account. Use the Password button above.');
    showView(activeView);
  }
  async function loadDashboard(studentId = data?.selectedId, append = false) {
    const serial = ++loadSerial;
    const loadedCount = studentId && studentId === data?.selectedId ? (data.lessons?.length || 0) : 0;
    const query = {};
    if (teacher() && studentId) query.student = studentId;
    if (append) query.offset = String(data.lessons?.length || 0);
    const next = await api('dashboard', undefined, query);
    if (serial !== loadSerial) return;
    if (append) next.lessons = [...(data.lessons || []),...next.lessons];
    // Keep earlier loaded lessons available after saving or completing a task.
    while (!append && next.lessons?.length < Math.min(loadedCount,next.lessonCount || 0)) {
      const earlier = await api('dashboard',undefined,{...query,offset:String(next.lessons.length)});
      if (serial !== loadSerial) return;
      if (!earlier.lessons?.length) break;
      next.lessons.push(...earlier.lessons);
    }
    data = next;
    render();
  }
  function showView(view, focus = false) {
    if (!views.includes(view)) return;
    const changed = activeView !== view;
    activeView = view;
    document.querySelectorAll('.view').forEach(node => { node.hidden = node.id !== `view-${view}`; });
    document.querySelectorAll('.portal-nav [data-view]').forEach(node => {
      node.setAttribute('aria-pressed',String(node.dataset.view === view));
      if (node.dataset.view === view) node.setAttribute('aria-current','page');
      else node.removeAttribute('aria-current');
    });
    if (data) {
      const studentName = data.students?.find(s => s.user_id === data.selectedId)?.display_name;
      const titles = {overview:teacher() ? studentName ? `${studentName}’s home` : 'Teaching workspace' : `Good to see you, ${data.user.name.split(' ')[0]}.`,feedback:'Lesson feedback',homework:'Homework',goals:'Goals',progress:'Progress'};
      const introductions = {overview:teacher() ? 'Add feedback, set practice and follow this student’s progress.' : 'Start with your next task, then revisit your lesson feedback.',feedback:'Strengths, weaknesses and corrections, organised by lesson.',homework:teacher() ? 'Set practice, share files and review work uploaded by your student.' : 'Read the task, practise, then upload your work if requested.',goals:teacher() ? 'Agree a specific goal and update it as your student progresses.' : 'Your agreed goals and what you are working towards.',progress:'Teacher observations of the support needed in lessons. A higher level means greater independence.'};
      $('page-title').textContent = titles[view];
      $('page-intro').textContent = introductions[view];
      document.title = `${view === 'overview' ? 'Home' : titles[view]} | Phillips English portal`;
    }
    if (focus) {
      if (changed) history.pushState(null,'',`${location.pathname}${view === 'overview' ? '' : `?view=${view}`}`);
      $('learning-main').focus({ preventScroll:true });
      if (changed) $('learning-main').scrollIntoView({block:'start'});
    }
  }
  function showLesson(view,id) {
    if (view === 'feedback') {
      feedbackSearch = ''; $('feedback-search').value = ''; renderFeedback();
    }
    showView(view,true);
    const card = $(`${view}-${id}`);
    if (card) {
      const completed = card.closest('.completed-practice');
      if (completed) completed.open = true;
      card.focus({preventScroll:true});
      card.scrollIntoView({block:'start'});
    }
  }
  function showSignIn() {
    data = null;
    invitationLink = null;
    feedbackSearch = '';
    activeView = 'overview';
    history.replaceState(null,'',location.pathname);
    document.title = 'Student portal | Phillips English';
    $('feedback-search').value = '';
    message('homework-message','');
    $('workspace').hidden = true;
    $('auth-screen').hidden = false;
    document.querySelector('.skip-link').setAttribute('href','#main-content');
    if ($('editor-dialog').open) $('editor-dialog').close();
    $('sign-in-password').value = '';
    $('account-name').textContent = '';
    $('student-select').replaceChildren();
    $('page-title').textContent = '';
    ['feedback-list','homework-list','next-task','goals-list','assessment-history','latest-lesson','overview-goals','skills-grid','stats'].forEach(id => { $(id).replaceChildren(); });
  }
  function openDialog(kind, item = null) {
    editorKind = kind;
    editorItem = item;
    invitationLink = null;
    message('dialog-message','');
    const titles = { invite:'Invite a student', lesson:item ? 'Edit lesson feedback' : 'Add lesson feedback', goal:item ? 'Update this goal' : 'Add a useful goal', assessment:item ? 'Edit skill check-in' : 'Add a skill check-in', password:'Choose your password' };
    $('dialog-title').textContent = titles[kind];
    $('dialog-kicker').textContent = kind === 'password' ? 'YOUR ACCOUNT' : 'YOUR TEACHING WORKSPACE';
    const footer = `<div class="form-actions"><button type="submit" class="button primary">${kind === 'lesson' ? 'Save lesson feedback' : 'Save'}</button><button type="button" class="button secondary" data-cancel>Cancel</button></div>`;
    const field = (label,name,value = '',type = 'text',max = 4000,required = true) => `<div><label for="edit-${name}">${label}</label>${type === 'textarea' ? `<textarea id="edit-${name}" name="${name}" maxlength="${max}" ${required ? 'required' : ''}>${escape(value)}</textarea>` : `<input id="edit-${name}" name="${name}" type="${type}" value="${escape(value)}" maxlength="${max}" ${required ? 'required' : ''}>`}</div>`;
    if (kind === 'invite') $('dialog-content').innerHTML = `<form class="editor-form" id="editor-form">${field('Student name','display_name','','text',150)}${field('Student email','email','','email',254)}<p class="dialog-footnote">You’ll get a private, one-use link to share directly. No automatic invitation email will be sent.</p><div class="form-actions"><button type="submit" class="button primary">Create invitation</button><button type="button" class="button secondary" data-cancel>Cancel</button></div></form>`;
    if (kind === 'lesson') {
      $('dialog-content').innerHTML = `<form class="editor-form" id="editor-form"><div class="form-row">${field('Lesson date','lesson_date',item?.lesson_date || today(),'date')}${field('Lesson title','title',item?.title || '','text',160)}</div>${field('Strengths','strengths',item?.strengths,'textarea')}${field('Weaknesses','focus',item?.focus,'textarea')}<fieldset class="corrections-editor"><legend>Corrections</legend><div id="correction-fields"></div><button type="button" class="text-button" id="add-correction">Add a correction +</button></fieldset>${field('Homework instructions (optional)','next_steps',item?.next_steps,'textarea',4000,false)}${field('Homework target date (optional)','homework_due_date',item?.homework_due_date || '','date',4000,false)}<p class="field-note">Save your changes, then use this lesson’s Homework card to share a file. The target date does not extend a file’s seven-day download deadline.</p>${footer}</form>`;
      (item?.corrections || []).forEach(addCorrection);
    }
    if (kind === 'goal') $('dialog-content').innerHTML = `<form class="editor-form" id="editor-form">${field('Goal','title',item?.title || '','text',240)}<div class="form-row">${field('Target date (optional)','due_date',item?.due_date || '','date',4000,false)}<div><label for="edit-status">Status</label><select name="status" id="edit-status">${Object.entries(statuses).map(([value,label]) => `<option value="${value}" ${value === (item?.status || 'in_progress') ? 'selected' : ''}>${label}</option>`).join('')}</select></div></div>${footer}</form>`;
    if (kind === 'assessment') $('dialog-content').innerHTML = `<form class="editor-form" id="editor-form">${field('Check-in date','assessed_on',item?.assessed_on || today(),'date')}<p class="dialog-footnote">Record the support needed in lessons. Leave unassessed skills blank. These are coaching observations, not exam grades.</p><div class="form-row">${Object.entries(skills).map(([key,label]) => `<div><label for="edit-${key}">${label}</label><select name="${key}" id="edit-${key}"><option value="">Not assessed</option>${[1,2,3,4,5].map(n => `<option value="${n}" ${item?.[key] === n ? 'selected' : ''}>${n} · ${levels[n]}</option>`).join('')}</select></div>`).join('')}</div>${field('Useful context (optional)','notes',item?.notes || '','textarea',4000,false)}${footer}</form>`;
    if (kind === 'password') $('dialog-content').innerHTML = `<p class="password-intro">Use a password with at least 12 characters. Keep it just for this account.</p><form class="editor-form" id="editor-form"><div><label for="new-password">New password</label><input id="new-password" name="password" type="password" autocomplete="new-password" minlength="12" maxlength="128" required></div><div><label for="confirm-password">Confirm password</label><input id="confirm-password" name="confirm_password" type="password" autocomplete="new-password" minlength="12" maxlength="128" required></div><div class="form-actions"><button type="submit" class="button primary">Save password</button><button type="button" class="button secondary" data-cancel>Cancel</button></div></form>`;
    $('editor-form')?.addEventListener('submit',saveEditor);
    $('add-correction')?.addEventListener('click',() => addCorrection());
    if (!$('editor-dialog').open) $('editor-dialog').showModal();
  }
  function addCorrection(value = {}) {
    const container = $('correction-fields');
    if (container.children.length >= 12) { message('dialog-message','Add up to 12 corrections.'); return; }
    const node = document.createElement('div');
    node.className = 'correction-fields';
    const token = crypto.randomUUID();
    node.innerHTML = `<div><strong>Correction</strong><button type="button" class="text-button" data-remove-correction>Remove</button></div><div><label for="original-${token}">The student said</label><input id="original-${token}" data-correction="original" maxlength="300" value="${escape(value.original)}" required></div><div><label for="corrected-${token}">Try this</label><input id="corrected-${token}" data-correction="corrected" maxlength="300" value="${escape(value.corrected)}" required></div><div><label for="explanation-${token}">Why? (optional)</label><input id="explanation-${token}" data-correction="explanation" maxlength="600" value="${escape(value.explanation)}"></div>`;
    container.append(node);
  }
  async function saveEditor(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const submit = form.querySelector('[type="submit"]');
    submit.disabled = true;
    message('dialog-message','');
    const body = Object.fromEntries(new FormData(form));
    try {
      if (editorKind === 'password') {
        if (body.password !== body.confirm_password) throw new Error('The passwords don’t match. Please check them.');
        await api('password',{ password:body.password });
        form.reset();
        $('editor-dialog').close();
        await loadDashboard();
        message('workspace-message','Password saved. You’re ready to continue.',true);
        return;
      }
      if (editorKind === 'invite') {
        const result = await api('invite',body);
        invitationLink = result.link;
        $('dialog-title').textContent = 'Your invitation is ready.';
        $('dialog-content').innerHTML = `<div class="invite-result"><h3>${escape(result.name)}</h3><p>${escape(result.email)}</p><p>${escape(result.notice)}</p><label for="invite-link">Private invitation link</label><input id="invite-link" readonly value="${escape(result.link)}"><button type="button" class="button primary" id="copy-invite">Copy private link</button><p class="dialog-footnote">The link expires after about an hour. If needed, open the student’s record and create a fresh access link.</p></div><div class="form-actions"><button type="button" class="button secondary" data-cancel>Done</button></div>`;
        await loadDashboard();
        return;
      }
      body.student_id = data.selectedId;
      if (editorItem) body.id = editorItem.id;
      if (editorKind === 'lesson') body.corrections = [...form.querySelectorAll('.correction-fields')].map(row => Object.fromEntries([...row.querySelectorAll('[data-correction]')].map(node => [node.dataset.correction,node.value])));
      if (editorKind === 'assessment') Object.keys(skills).forEach(key => { body[key] = body[key] ? Number(body[key]) : null; });
      const savedKind = editorKind;
      const savedId = editorItem?.id;
      await api(editorKind,body);
      $('editor-dialog').close();
      await loadDashboard();
      if (savedKind === 'lesson' && savedId) showLesson(activeView === 'homework' ? 'homework' : 'feedback',savedId);
      const activated = data.students?.find(s => s.user_id === data.selectedId)?.activated_at;
      message('workspace-message',activated ? 'Saved. The update is available in this student’s portal.' : 'Saved. The update will be ready when this student completes their account setup.',true);
    } catch (error) { message($('editor-dialog').open ? 'dialog-message' : 'workspace-message',error.message); }
    finally { if (submit.isConnected) submit.disabled = false; }
  }
  async function freshLink() {
    message('workspace-message','');
    try {
      const result = await api('access-link',{ student_id:data.selectedId });
      editorKind = 'invite';
      invitationLink = result.link;
      $('dialog-title').textContent = 'A fresh access link';
      $('dialog-kicker').textContent = 'YOUR TEACHING WORKSPACE';
      message('dialog-message','');
      $('dialog-content').innerHTML = `<div class="invite-result"><h3>${escape(result.name)}</h3><p>${escape(result.email)}</p><p>${escape(result.notice)}</p><label for="invite-link">Private access link</label><input id="invite-link" readonly value="${escape(result.link)}"><button type="button" class="button primary" id="copy-invite">Copy private link</button><p class="dialog-footnote">Share it only after you’ve verified the student’s identity. It can be used to choose a new password.</p></div><div class="form-actions"><button type="button" class="button secondary" data-cancel>Done</button></div>`;
      $('editor-dialog').showModal();
    } catch (error) { message('workspace-message',error.message); }
  }
  async function uploadHomework(form) {
    const input = form.querySelector('input[type="file"]');
    const file = input.files?.[0];
    const extension = file?.name.split('.').at(-1)?.toLowerCase();
    const status = form.querySelector('[role="status"]');
    const submit = form.querySelector('button[type="submit"]');
    if (!file || !fileTypes[extension] || file.size < 1 || file.size > 10 * 1024 * 1024) {
      status.textContent = 'Choose a supported file up to 10 MB.'; return;
    }
    submit.disabled = true; input.disabled = true;
    status.textContent = `Uploading ${file.name}…`;
    let timeout;
    try {
      const ticket = await api('homework-upload', {lesson_id:form.dataset.homeworkForm,filename:file.name,mime_type:fileTypes[extension],size_bytes:file.size});
      const target = new URL(ticket.uploadUrl);
      if (target.origin !== storageOrigin || !target.pathname.startsWith('/storage/v1/object/upload/sign/lms-homework/')) throw new Error('The upload could not start. Please try again.');
      const body = new FormData();
      body.append('cacheControl','0');
      body.append('',new Blob([file],{type:ticket.mimeType}),file.name);
      const controller = new AbortController();
      timeout = setTimeout(() => controller.abort(),120000);
      const upload = await fetch(target, {method:'PUT',body,credentials:'omit',headers:{'x-upsert':'false'},signal:controller.signal});
      clearTimeout(timeout);
      if (!upload.ok) throw new Error('The file could not upload. Please try again.');
      await api('homework-finish',{id:ticket.id});
      await loadDashboard();
      showLesson('homework',form.dataset.homeworkForm);
      const savedStatus = $(`homework-${form.dataset.homeworkForm}`)?.querySelector('.upload-status');
      if (savedStatus) savedStatus.textContent = `Uploaded successfully. Download this file before ${fileDeadline(ticket.expiresAt)}.`;
    } catch (error) {
      status.textContent = error.name === 'AbortError' ? 'The upload took too long. Please try a smaller file or try again.' : error.message;
    } finally { clearTimeout(timeout); if (submit.isConnected) { submit.disabled = false; input.disabled = false; } }
  }
  async function downloadHomework(button) {
    button.disabled = true;
    message('homework-message','');
    try {
      const result = await api('homework-download',{id:button.dataset.downloadHomework});
      const target = new URL(result.url);
      if (target.origin !== storageOrigin || !target.pathname.startsWith('/storage/v1/object/sign/lms-homework/')) throw new Error('This download is not available. Please try again.');
      const anchor = document.createElement('a');
      anchor.href = target.toString(); anchor.rel = 'noreferrer'; anchor.download = '';
      document.body.append(anchor); anchor.click(); anchor.remove();
    } catch (error) { message('homework-message',error.message); }
    finally { if (button.isConnected) button.disabled = false; }
  }
  document.addEventListener('submit',event => {
    const form = event.target.closest('[data-homework-form]');
    if (form) { event.preventDefault(); uploadHomework(form); }
  });
  document.addEventListener('change',event => {
    const form = event.target.closest('[data-homework-form]');
    if (form) {
      const input = form.querySelector('input[type="file"]');
      form.querySelector('[type="submit"]').disabled = !input.files?.length;
      form.querySelector('.upload-status').textContent = input.files?.length ? 'File selected. Press the upload button to send it.' : '';
    }
  });
  document.addEventListener('click',async event => {
    const homework = event.target.closest('[data-open-homework]');
    if (homework) { showLesson('homework',homework.dataset.openHomework); return; }
    const feedback = event.target.closest('[data-open-feedback]');
    if (feedback) { showLesson('feedback',feedback.dataset.openFeedback); return; }
    const download = event.target.closest('[data-download-homework]');
    if (download) { await downloadHomework(download); return; }
    const completed = event.target.closest('[data-complete-homework]');
    if (completed) {
      completed.disabled = true;
      try {
        await api('homework-complete',{lesson_id:completed.dataset.completeHomework,completed:completed.dataset.completed !== 'true'});
        await loadDashboard();
        showLesson('homework',completed.dataset.completeHomework);
      }
      catch (error) { message('homework-message',error.message); }
      finally { if (completed.isConnected) completed.disabled = false; }
      return;
    }
    const view = event.target.closest('[data-view]');
    if (view) { showView(view.dataset.view,true); return; }
    if (event.target.closest('[data-new-lesson]') && teacher() && data.selectedId) { openDialog('lesson'); return; }
    if (event.target.closest('[data-new-student]') && teacher()) { openDialog('invite'); return; }
    if (event.target.closest('[data-cancel]')) { $('editor-dialog').close(); return; }
    const remove = event.target.closest('[data-remove-correction]');
    if (remove) { remove.closest('.correction-fields').remove(); return; }
    const editLesson = event.target.closest('[data-edit-lesson]');
    if (editLesson) { openDialog('lesson',data.lessons.find(l => l.id === editLesson.dataset.editLesson)); return; }
    const editGoal = event.target.closest('[data-edit-goal]');
    if (editGoal) { openDialog('goal',data.goals.find(g => g.id === editGoal.dataset.editGoal)); return; }
    const editAssessment = event.target.closest('[data-edit-assessment]');
    if (editAssessment) { openDialog('assessment',data.assessments.find(a => a.id === editAssessment.dataset.editAssessment)); return; }
    if (event.target.closest('#copy-invite') && invitationLink) {
      try { await navigator.clipboard.writeText(invitationLink); message('dialog-message','Copied. Share it directly with this student.',true); }
      catch { $('invite-link').select(); message('dialog-message','Select and copy the private link above.',true); }
    }
    if (event.target.closest('#fresh-access-link')) await freshLink();
  });
  $('editor-dialog').addEventListener('close',() => { invitationLink = null; editorKind = null; editorItem = null; $('dialog-content').replaceChildren(); });
  $('close-dialog').addEventListener('click',() => $('editor-dialog').close());
  $('add-student').addEventListener('click',() => openDialog('invite'));
  $('add-feedback').addEventListener('click',() => openDialog('lesson'));
  $('add-goal').addEventListener('click',() => openDialog('goal'));
  $('add-assessment').addEventListener('click',() => openDialog('assessment'));
  $('account-settings').addEventListener('click',() => openDialog('password'));
  $('student-select').addEventListener('change',async event => {
    const select = event.currentTarget;
    select.disabled = true;
    message('workspace-message','');
    message('homework-message','');
    feedbackSearch = ''; $('feedback-search').value = '';
    try { await loadDashboard(select.value); }
    catch (error) { select.value = data?.selectedId || ''; message('workspace-message',error.message); }
    finally { select.disabled = false; }
  });
  $('load-feedback').addEventListener('click',async event => {
    event.currentTarget.disabled = true;
    try { await loadDashboard(data.selectedId,true); } catch (error) { message('workspace-message',error.message); }
    finally { $('load-feedback').disabled = false; }
  });
  $('load-homework').addEventListener('click',async event => {
    event.currentTarget.disabled = true;
    try { await loadDashboard(data.selectedId,true); } catch (error) { message('homework-message',error.message); }
    finally { $('load-homework').disabled = false; }
  });
  $('feedback-search').addEventListener('input',event => { feedbackSearch = event.currentTarget.value; renderFeedback(); });
  window.addEventListener('popstate',() => {
    showView(validView(new URLSearchParams(location.search).get('view')));
    if (data) { $('learning-main').focus({preventScroll:true}); $('learning-main').scrollIntoView({block:'start'}); }
  });
  $('sign-out').addEventListener('click',async event => {
    event.currentTarget.disabled = true;
    try { await api('sign-out',{}); showSignIn(); message('auth-message','You’ve signed out.',true); }
    catch (error) { message('workspace-message',error.message); }
    finally { $('sign-out').disabled = false; }
  });
  $('sign-in-form').addEventListener('submit',async event => {
    event.preventDefault();
    const form = event.currentTarget;
    const submit = form.querySelector('[type="submit"]');
    submit.disabled = true;
    message('auth-message','');
    try {
      const result = await api('sign-in',Object.fromEntries(new FormData(form)));
      data = { user:result.user };
      $('sign-in-password').value = '';
      await loadDashboard();
      if (data.user.needsPassword) openDialog('password');
    } catch (error) { message('auth-message',error.message); }
    finally { submit.disabled = false; }
  });
  $('teacher-setup-form').addEventListener('submit',async event => {
    event.preventDefault();
    const form = event.currentTarget;
    const submit = form.querySelector('[type="submit"]');
    submit.disabled = true;
    message('auth-message','');
    try { const result = await api('teacher-setup',Object.fromEntries(new FormData(form))); form.reset(); message('auth-message',result.message,true); $('teacher-setup').open = false; }
    catch (error) { message('auth-message',error.message); }
    finally { submit.disabled = false; }
  });
  async function start() {
    const hash = new URLSearchParams(location.hash.slice(1));
    let setPassword = false;
    if (location.hash) history.replaceState(null,'',`${location.pathname}${activeView === 'overview' ? '' : `?view=${activeView}`}`);
    try {
      if (hash.has('token_hash')) {
        const result = await api('verify',{ token_hash:hash.get('token_hash'), type:hash.get('type') });
        data = { user:result.user };
        setPassword = true;
      } else if (hash.has('access_token') && hash.has('refresh_token')) {
        const result = await api('confirm-session',{ access_token:hash.get('access_token'), refresh_token:hash.get('refresh_token'), type:hash.get('type') });
        data = { user:result.user };
        setPassword = result.setPassword;
      } else {
        if (hash.has('error')) throw new Error(hash.get('error_description') || 'This link has expired. Ask Jason for a fresh link.');
        const result = await api('session');
        if (!result.user) return;
        data = { user:result.user };
      }
      await loadDashboard();
      if (setPassword || data.user.needsPassword) openDialog('password');
    } catch (error) { showSignIn(); message('auth-message',error.message); }
  }
  // Add account recovery to the teacher controls without exposing any secrets.
  const accessButton = document.createElement('button');
  accessButton.id = 'fresh-access-link';
  accessButton.type = 'button';
  accessButton.className = 'text-button teacher-action';
  accessButton.textContent = 'Fresh access link';
  accessButton.hidden = true;
  $('teacher-tools').append(accessButton);
  start();
})();
