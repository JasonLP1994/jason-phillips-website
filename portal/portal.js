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
  let activeView = 'overview';
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
    if (!lesson) return empty('Your next useful step starts here.', teacher() ? 'Add lesson feedback to give this student something clear to practise.' : 'After your lesson, Jason will add feedback and a few useful next steps here.');
    const corrections = lesson.corrections?.length ? lesson.corrections.map(c => `<div class="correction"><p class="original">You said: ${escape(c.original)}</p><p class="corrected">Try: ${escape(c.corrected)}</p>${c.explanation ? `<p class="why">${escape(c.explanation)}</p>` : ''}</div>`).join('') : '<p>No corrections recorded for this lesson.</p>';
    return `<p class="lesson-date">${date(lesson.lesson_date)}</p><h3 class="lesson-title">${escape(lesson.title)}</h3><div class="feedback-boxes ${full ? '' : 'compact'}"><section class="feedback-box strengths-box"><h4>Strengths</h4><p>${escape(lesson.strengths)}</p></section><section class="feedback-box weaknesses-box"><h4>Weaknesses</h4><p>${escape(lesson.focus)}</p></section><section class="feedback-box corrections-box"><h4>Corrections</h4>${corrections}</section></div><div class="lesson-actions">${teacher() ? `<button class="text-button" type="button" data-edit-lesson="${escape(lesson.id)}">Edit feedback</button>` : ''}<button class="text-button" type="button" data-open-homework="${escape(lesson.id)}">Open homework</button></div>`;
  }

  function homeworkDone(lesson) { return data.homeworkProgress?.some(p => p.lesson_id === lesson.id && p.completed_at); }
  function lessonFiles(lesson) { return (data.homeworkFiles || []).filter(f => f.lesson_id === lesson.id && Date.parse(f.expires_at) > Date.now()); }
  function homeworkLessons() { return (data.lessons || []).filter(l => l.next_steps || lessonFiles(l).length || homeworkDone(l)); }
  function fileList(files, title) {
    if (!files.length) return '';
    return `<div class="homework-files"><h4>${title}</h4>${files.map(f => `<div class="homework-file"><div><strong>${escape(f.filename)}</strong><p>${fileSize(f.size_bytes)} · Download until ${escape(fileDeadline(f.expires_at))}</p></div><button type="button" class="button secondary" data-download-homework="${escape(f.id)}" aria-label="Download ${escape(f.filename)}">Download</button></div>`).join('')}</div>`;
  }
  function renderHomework() {
    const lessons = data.lessons || [];
    $('homework-list').innerHTML = lessons.length ? lessons.map(l => {
      const files = lessonFiles(l);
      const done = homeworkDone(l);
      const overdue = l.homework_due_date && l.homework_due_date < today() && !done;
      return `<article class="homework-card" id="homework-${escape(l.id)}"><div class="homework-heading"><div><p class="lesson-date">${date(l.lesson_date)}</p><h3>${escape(l.title)}</h3></div><span class="badge ${done ? 'achieved' : overdue ? 'overdue' : ''}">${done ? 'Completed' : overdue ? 'To catch up on' : 'To practise'}</span></div>${l.next_steps ? `<p class="homework-instructions">${escape(l.next_steps)}</p>` : '<p class="muted">No written task for this lesson. Add a file or agree a useful practice task with Jason.</p>'}${l.homework_due_date ? `<p class="goal-date">Aim to finish by ${date(l.homework_due_date)}</p>` : ''}${fileList(files.filter(f => f.kind === 'resource'),'Lesson files')}${fileList(files.filter(f => f.kind === 'submission'),teacher() ? 'Completed work from your student' : 'Your uploaded work')}<form class="homework-upload" data-homework-form="${escape(l.id)}"><label for="homework-file-${escape(l.id)}">${teacher() ? 'Upload homework or a marked copy' : 'Upload your completed work'}</label><div class="homework-upload-row"><input type="file" id="homework-file-${escape(l.id)}" accept="${fileAccept}" required><button type="submit" class="button secondary">Upload file</button></div><p class="field-note">PDF, Word, text, images or audio. Up to 10 MB per file, six files per lesson.</p><p class="upload-status" role="status" aria-live="polite"></p></form><div class="homework-actions"><button type="button" class="text-button" data-complete-homework="${escape(l.id)}" data-completed="${done ? 'true' : 'false'}">${done ? 'Mark as still practising' : 'Mark as completed'}</button><button type="button" class="text-button" data-view="feedback">View lesson feedback</button></div></article>`;
    }).join('') : `<div class="panel">${empty('Your next bit of practice starts here.', teacher() ? 'Add lesson feedback first. You can then attach homework to that lesson.' : 'Jason will add a task and any useful files after your lesson.')}</div>`;
    $('load-homework').hidden = lessons.length >= (data.lessonCount || 0);
  }
  function renderFeedback() {
    const lessons = data.lessons || [];
    const query = feedbackSearch.trim().toLowerCase();
    const shown = lessons.filter(l => `${l.title} ${l.lesson_date} ${date(l.lesson_date)}`.toLowerCase().includes(query));
    $('feedback-list').innerHTML = shown.length ? shown.map(l => `<article class="feedback-card">${lessonHtml(l,true)}</article>`).join('') : `<div class="panel">${empty(query ? 'No matching lessons in this list.' : 'The first page of your progress.', query ? 'Try a different title or date, or load earlier lessons below.' : teacher() ? 'Add feedback after a lesson. This student will see it when they sign in.' : 'Jason will add your feedback after a lesson. You can return to it whenever you practise.')}</div>`;
    $('feedback-search-note').textContent = `Searching ${lessons.length} of ${data.lessonCount || 0} lessons. Load earlier feedback to search more.`;
  }
  function renderNextTask() {
    const next = homeworkLessons().filter(l => !homeworkDone(l)).sort((a,b) => (a.homework_due_date || '9999').localeCompare(b.homework_due_date || '9999'))[0];
    const heading = teacher() ? 'The next useful step.' : 'Your next step.';
    $('next-task').innerHTML = next ? `<div><p class="eyebrow">${heading}</p><h2>${escape(next.title)}</h2><p>${escape(next.next_steps || 'Download the lesson files and work through the practice task.')}</p>${next.homework_due_date ? `<small>Aim for ${date(next.homework_due_date)}</small>` : ''}</div><button type="button" class="button primary" data-open-homework="${escape(next.id)}">Open homework</button>` : `<div><p class="eyebrow">${heading}</p><h2>${data.lessons?.length ? 'Ready to revisit your latest lesson?' : teacher() ? 'Add the first lesson.' : 'Ready when you are.'}</h2><p>${data.lessons?.length ? 'Look back at the strengths, weaknesses and corrections, then try one sentence again.' : teacher() ? 'Start with strengths, weaknesses and a few useful corrections.' : 'After your first lesson, your feedback and next task will appear here.'}</p></div>${data.lessons?.length ? '<button type="button" class="button primary" data-view="feedback">Read feedback</button>' : ''}`;
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
    $('heading-kicker').textContent = teacher() ? 'TEACHING WORKSPACE' : 'YOUR LEARNING SPACE';
    const studentName = students.find(s => s.user_id === data.selectedId)?.display_name;
    $('page-title').textContent = teacher() ? (studentName ? `${studentName}’s learning` : 'Your teaching workspace.') : `Good to see you, ${user.name.split(' ')[0]}.`;
    $('page-intro').textContent = teacher() ? (studentName ? 'Useful feedback today. Something clear to practise tomorrow.' : 'Add your first student and give them a clear place to see their progress.') : 'Your feedback, next steps and small wins, all together.';
    $('teacher-tools').hidden = !teacher();
    $('student-select').innerHTML = students.length ? students.filter(s => s.active).map(s => `<option value="${escape(s.user_id)}">${escape(s.display_name)}${s.activated_at ? '' : ' · invited'}</option>`).join('') : '<option value="">No students yet</option>';
    $('student-select').value = data.selectedId || '';
    document.querySelectorAll('.teacher-action').forEach(node => { node.hidden = !teacher(); node.disabled = !data.selectedId; });
    document.querySelectorAll('.portal-nav [data-view="goals"]').forEach(node => { node.innerHTML = '<span aria-hidden="true">◎</span>' + (teacher() ? 'Student goals' : 'My goals'); });
    document.querySelectorAll('.portal-nav [data-view="progress"]').forEach(node => { node.innerHTML = '<span aria-hidden="true">↗</span>' + (teacher() ? 'Student progress' : 'My progress'); });
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
    const query = {};
    if (teacher() && studentId) query.student = studentId;
    if (append) query.offset = String(data.lessons?.length || 0);
    const next = await api('dashboard', undefined, query);
    if (serial !== loadSerial) return;
    if (append) next.lessons = [...(data.lessons || []),...next.lessons];
    data = next;
    render();
  }
  function showView(view, focus = false) {
    if (!['overview','feedback','homework','goals','progress'].includes(view)) return;
    activeView = view;
    document.querySelectorAll('.view').forEach(node => { node.hidden = node.id !== `view-${view}`; });
    document.querySelectorAll('.portal-nav [data-view]').forEach(node => node.setAttribute('aria-pressed', String(node.dataset.view === view)));
    if (focus) $('learning-main').focus({ preventScroll:true });
  }
  function showSignIn() {
    data = null;
    invitationLink = null;
    feedbackSearch = '';
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
    const footer = '<div class="form-actions"><button type="submit" class="button primary">Save</button><button type="button" class="button secondary" data-cancel>Cancel</button></div>';
    const field = (label,name,value = '',type = 'text',max = 4000,required = true) => `<div><label for="edit-${name}">${label}</label>${type === 'textarea' ? `<textarea id="edit-${name}" name="${name}" maxlength="${max}" ${required ? 'required' : ''}>${escape(value)}</textarea>` : `<input id="edit-${name}" name="${name}" type="${type}" value="${escape(value)}" maxlength="${max}" ${required ? 'required' : ''}>`}</div>`;
    if (kind === 'invite') $('dialog-content').innerHTML = `<form class="editor-form" id="editor-form">${field('Student name','display_name','','text',150)}${field('Student email','email','','email',254)}<p class="dialog-footnote">You’ll get a private, one-use link to share directly. No automatic invitation email will be sent.</p><div class="form-actions"><button type="submit" class="button primary">Create invitation</button><button type="button" class="button secondary" data-cancel>Cancel</button></div></form>`;
    if (kind === 'lesson') {
      $('dialog-content').innerHTML = `<form class="editor-form" id="editor-form"><div class="form-row">${field('Lesson date','lesson_date',item?.lesson_date || today(),'date')}${field('Lesson title','title',item?.title || '','text',160)}</div>${field('Strengths','strengths',item?.strengths,'textarea')}${field('Weaknesses','focus',item?.focus,'textarea')}<fieldset class="corrections-editor"><legend>Corrections</legend><div id="correction-fields"></div><button type="button" class="text-button" id="add-correction">Add a correction +</button></fieldset>${field('Homework instructions (optional)','next_steps',item?.next_steps,'textarea',4000,false)}${field('Homework target date (optional)','homework_due_date',item?.homework_due_date || '','date',4000,false)}<p class="field-note">Save the lesson, then open Homework to attach a file. Files stay available for seven days after upload.</p>${footer}</form>`;
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
      await api(editorKind,body);
      $('editor-dialog').close();
      await loadDashboard();
      message('workspace-message','Saved. This student can see the update in their learning space.',true);
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
      message('homework-message',`Uploaded. Download this file before ${fileDeadline(ticket.expiresAt)}.`,true);
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
  document.addEventListener('click',async event => {
    const homework = event.target.closest('[data-open-homework]');
    if (homework) { showView('homework',true); $(`homework-${homework.dataset.openHomework}`)?.scrollIntoView({block:'start'}); return; }
    const download = event.target.closest('[data-download-homework]');
    if (download) { await downloadHomework(download); return; }
    const completed = event.target.closest('[data-complete-homework]');
    if (completed) {
      completed.disabled = true;
      try { await api('homework-complete',{lesson_id:completed.dataset.completeHomework,completed:completed.dataset.completed !== 'true'}); await loadDashboard(); message('homework-message','Homework status updated.',true); }
      catch (error) { message('homework-message',error.message); }
      finally { if (completed.isConnected) completed.disabled = false; }
      return;
    }
    const view = event.target.closest('[data-view]');
    if (view) { showView(view.dataset.view,true); return; }
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
    if (location.hash) history.replaceState(null,'',location.pathname);
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
