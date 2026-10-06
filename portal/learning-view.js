export const views = ['overview', 'feedback', 'homework', 'goals', 'progress'];

export function validView(value) {
  return views.includes(value) ? value : 'overview';
}

// Presentation only. The API still enforces all lesson, file and account access.
export function practiceState(lesson, data, now = Date.now()) {
  const files = (data.homeworkFiles || []).filter(file => file.lesson_id === lesson.id && file.state === 'ready' && Date.parse(file.expires_at) > now);
  const completed = Boolean(data.homeworkProgress?.some(item => item.lesson_id === lesson.id && item.completed_at));
  const assigned = Boolean(lesson.next_steps?.trim() || files.some(file => file.kind === 'resource'));
  const uploaded = files.some(file => file.kind === 'submission');
  const hasPractice = assigned || uploaded || completed;
  const overdue = Boolean(hasPractice && !completed && lesson.homework_due_date && lesson.homework_due_date < new Date(now).toISOString().slice(0, 10));
  const label = completed ? 'Completed' : !hasPractice ? 'No homework set' : uploaded ? 'Work uploaded' : overdue ? 'Past target date' : 'To practise';
  return { files, completed, assigned, uploaded, hasPractice, overdue, label };
}

export function homeworkGroups(data, isTeacher, now = Date.now()) {
  const items = (data.lessons || []).map(lesson => ({ lesson, ...practiceState(lesson, data, now) }));
  const current = items.filter(item => !item.completed && (isTeacher || item.hasPractice)).sort((a, b) =>
    Number(b.hasPractice) - Number(a.hasPractice) ||
    (a.lesson.homework_due_date || '9999').localeCompare(b.lesson.homework_due_date || '9999')
  );
  return { current, completed: items.filter(item => item.completed) };
}
