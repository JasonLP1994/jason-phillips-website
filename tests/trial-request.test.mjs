import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { test } from 'node:test';

function trial({ ok = true, consent = true } = {}) {
  const events = [], handlers = {}, fields = new Map();
  const status = { dataset: {}, focus() {} };
  const button = { textContent: 'Send my availability' };
  const panel = { hidden: true };
  const fallback = { hidden: false };
  const form = {
    action: 'https://formspree.io/f/test', hidden: false,
    parentElement: { querySelector: s => s === '.trial-status' ? status : panel },
    querySelector: s => s === 'button[type="submit"]' ? button : null,
    appendChild: el => fields.set(el.name, el.value),
    addEventListener: (n, fn) => { handlers[n] = fn; },
    reportValidity: () => true, setAttribute() {}, removeAttribute() {}
  };
  const document = {
    referrer: '', activeElement: null,
    querySelectorAll: s => s === 'form[data-trial-request]' ? [form] : s.includes('.calendar-fallback') ? [fallback] : [],
    querySelector: () => null, createElement: () => ({}), addEventListener() {}
  };
  const storage = () => ({ getItem: () => null, setItem() {} });
  const window = { location: { search: '', pathname: '/free-trial.html', origin: 'https://www.phillipsenglish.com', href: 'https://www.phillipsenglish.com/free-trial.html' }, addEventListener() {}, fetch: true, FormData: true };
  if (consent) window.gtag = (...args) => events.push(args);
  runInNewContext(readFileSync(new URL('../assets/trial-request.js', import.meta.url), 'utf8'), {
    window, document, localStorage: storage(), sessionStorage: storage(), URL, URLSearchParams, setTimeout,
    FormData: class { constructor(value) { assert.equal(value, form); } },
    fetch: async () => ({ ok, json: async () => ({}) })
  });
  return { events, form, panel, fallback, status, submit: () => handlers.submit({ preventDefault() {} }) };
}

test('a visitor can submit without choosing a referral source', async () => {
  const app = trial();
  assert.equal(app.fallback.hidden, false);
  assert.equal(app.events.length, 0);
  await app.submit();
  assert.equal(app.status.dataset.state, 'success');
  assert.equal(app.panel.hidden, false);
  assert.equal(app.events.filter(e => e[1] === 'generate_lead').length, 1);
});

test('a rejected request produces no lead', async () => {
  const app = trial({ ok: false });
  await app.submit();
  assert.equal(app.status.dataset.state, 'error');
  assert.equal(app.form.hidden, false);
  assert.equal(app.events.filter(e => e[1] === 'generate_lead').length, 0);
});

test('declining analytics does not prevent a trial enquiry', async () => {
  const app = trial({ consent: false });
  await app.submit();
  assert.equal(app.status.dataset.state, 'success');
  assert.equal(app.events.length, 0);
});
