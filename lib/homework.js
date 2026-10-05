import { timingSafeEqual } from 'node:crypto';

export const HOMEWORK_BUCKET = 'lms-homework';
export const MAX_HOMEWORK_BYTES = 10 * 1024 * 1024;
export const HOMEWORK_TYPES = {
  pdf: 'application/pdf',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  txt: 'text/plain',
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp',
  mp3: 'audio/mpeg', m4a: 'audio/mp4'
};
export class HomeworkError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
export function uploadFields(body) {
  if (typeof body.filename !== 'string' || body.filename.length > 180 || /[\x00-\x1f\x7f/\\]/.test(body.filename)) {
    throw new HomeworkError(400, 'Please choose a file with a simple name.');
  }
  const filename = body.filename.trim().normalize('NFC');
  const extension = filename.split('.').at(-1)?.toLowerCase();
  const mime_type = HOMEWORK_TYPES[extension];
  if (!filename || !mime_type) throw new HomeworkError(400, 'Choose a PDF, Word document, text file, image or audio file.');
  if (body.mime_type && body.mime_type !== mime_type && body.mime_type !== 'application/octet-stream') {
    throw new HomeworkError(400, 'The file type does not match its name.');
  }
  if (!Number.isInteger(body.size_bytes) || body.size_bytes < 1 || body.size_bytes > MAX_HOMEWORK_BYTES) {
    throw new HomeworkError(400, 'Choose a file smaller than 10 MB.');
  }
  return { filename, extension, mime_type, size_bytes: body.size_bytes };
}
export function downloadLifetime(file, now = Date.now()) {
  if (file.state !== 'ready') throw new HomeworkError(404, 'This file is not ready to download.');
  const remaining = Math.floor((Date.parse(file.expires_at) - now) / 1000);
  if (!Number.isFinite(remaining) || remaining <= 0) throw new HomeworkError(410, 'This file has expired. Ask Jason to upload it again.');
  return Math.min(60, remaining);
}
export function verifyStoredFile(info, file) {
  const size = info?.size ?? info?.metadata?.size;
  const mime = info?.contentType ?? info?.metadata?.mimetype;
  if (size !== file.size_bytes || mime !== file.mime_type) {
    throw new HomeworkError(400, 'The upload did not match the selected file. Please try again.');
  }
}
export function cronAuthorized(header, secret) {
  if (typeof secret !== 'string' || secret.length < 32 || typeof header !== 'string') return false;
  const actual = Buffer.from(header);
  const expected = Buffer.from(`Bearer ${secret}`);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

// Remove object bytes before metadata so a provider failure can be retried.
// Never delete rows from storage.objects: that would leave the file bytes behind.
export async function purgeExpiredHomework(admin, { now = new Date(), lessonId, maxBatches = 5 } = {}) {
  const deadline = now.toISOString();
  const abandoned = new Date(now.getTime() - 3 * 60 * 60 * 1000).toISOString();
  let removed = 0;
  for (let batch = 0; batch < maxBatches; batch++) {
    let query = admin.from('lms_homework_files').select('id,object_path')
      .or(`expires_at.lte.${deadline},and(state.eq.pending,created_at.lte.${abandoned})`)
      .order('created_at').limit(100);
    if (lessonId) query = query.eq('lesson_id', lessonId);
    const rows = await query;
    if (rows.error) throw new HomeworkError(503, 'File cleanup could not finish. It will be retried.');
    if (!rows.data?.length) return { removed, more: false };
    const objects = await admin.storage.from(HOMEWORK_BUCKET).remove(rows.data.map(row => row.object_path));
    if (objects.error) throw new HomeworkError(503, 'File cleanup could not finish. It will be retried.');
    const deleted = await admin.from('lms_homework_files').delete().in('id', rows.data.map(row => row.id)).select('id');
    if (deleted.error) throw new HomeworkError(503, 'File cleanup could not finish. It will be retried.');
    removed += deleted.data.length;
  }
  return { removed, more: true };
}
