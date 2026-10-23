import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { test } from 'node:test';

function exerciseFormPage(file, { accepted, enquiryType = 'Private English Coaching', analytics = true }) {
  const html = readFileSync(new URL('../' + file, import.meta.url), 'utf8');
  const scripts = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)];
  const formCode = scripts.map(match => match[1]).find(code => code.includes('await fetch(form.action'));
  assert.ok(formCode, file + ' must contain a form submission handler');

  let handler;
  const events = [];
  const button = { disabled: false, textContent: 'Send enquiry' };
  const status = { textContent: '', setAttribute() {} };
  const form = {
    action: 'https://formspree.io/f/example',
    elements: { enquiry_type: { value: enquiryType } },
    querySelector(selector) {
      if (selector.includes('button') || selector.includes('submit')) return button;
      if (selector.includes('.form-status')) return status;
      return null;
    },
    checkValidity: () => true,
    reportValidity() {},
    appendChild() {},
    addEventListener(name, fn) { if (name === 'submit') handler = fn; },
    reset() {},
    scrollIntoView() {},
    classList: { add() {} }
  };
  const document = {
    querySelector: () => form,
    getElementById(id) {
      return id === 'coachingApplication' ? form : id === 'formStatus' ? status : id === 'submitApplication' ? button : null;
    },
    createElement() { return { className: '', setAttribute() {} }; }
  };
  const window = { location: { pathname: '/' + file } };
  if (analytics) window.gtag = (...args) => events.push(args);

  runInNewContext(formCode, {
    document, window,
    fetch: async () => ({ ok: accepted, json: async () => ({ errors: [{ message: 'Rejected' }] }) })
  });

  assert.equal(typeof handler, 'function');
  return {
    events,
    submit: () => handler({ preventDefault() {} })
  };
}

for (const file of ['contact.html', 'group-coaching.html', 'work-with-me.html']) {
  test(file + ': successful submission emits exactly one generate_lead', async () => {
    const app = exerciseFormPage(file, { accepted: true });
    await app.submit();
    assert.equal(app.events.filter(event => event[1] === 'generate_lead').length, 1);
  });

  test(file + ': rejected submission does not create a lead', async () => {
    const app = exerciseFormPage(file, { accepted: false });
    await app.submit();
    assert.equal(app.events.filter(event => event[1] === 'generate_lead').length, 0);
  });

  test(file + ': no analytics consent does not break enquiry submission', async () => {
    const app = exerciseFormPage(file, { accepted: true, analytics: false });
    await app.submit();
    assert.equal(app.events.length, 0);
  });

  test(file + ': avoids guessed conversion on timer/status changes', () => {
    const html = readFileSync(new URL('../' + file, import.meta.url), 'utf8');
    assert.ok(!html.includes('var sent = false;'), 'no broad status-based lead listener');
  });
}

test('contact: existing-client support enquiry is not a new lead', async () => {
  const app = exerciseFormPage('contact.html', { accepted: true, enquiryType: 'Existing client question' });
  await app.submit();
  assert.equal(app.events.filter(event => event[1] === 'generate_lead').length, 0);
  assert.equal(app.events.filter(event => event[1] === 'contact_form_success').length, 1);
});
