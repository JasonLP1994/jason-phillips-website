import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { test } from 'node:test';

const source = readFileSync(new URL('../assets/trial-request.js', import.meta.url), 'utf8');
function harness({ consent = true, brokenStorage = false, nativeEmbed = false } = {}) {
  const events = [], listeners = {}, callbacks = {}, calCalls = [], frame = { contentWindow: {} };
  const values = new Map();
  const storage = { getItem: k => values.get(k) || null, setItem(k, v) { if (brokenStorage) throw Error('disabled'); values.set(k, v); } };
  const document = { referrer: '', querySelectorAll: () => [], querySelector: () => frame, addEventListener() {} };
  if (nativeEmbed) document.getElementById = () => ({ tagName: 'DIV' });
  const window = { location: { search: '', pathname: '/free-trial.html', origin: 'https://www.phillipsenglish.com' }, addEventListener: (name, fn) => { listeners[name] = fn; } };
  if (nativeEmbed) window.Cal = function (method, options) {
    calCalls.push([method, options]);
    if (method === 'on') callbacks[options.action] = options.callback;
  };
  if (consent) window.gtag = (...args) => events.push(args);
  runInNewContext(source, { window, document, localStorage: storage, sessionStorage: storage, URL, URLSearchParams, setTimeout });
  const payload = { uid: 'test-booking-uid', eventTypeId: 7383670, status: 'ACCEPTED', paymentRequired: false };
  return { events, calCalls, sendNative(data = {}, type = 'bookingSuccessfulV2') {
    const payload = { uid: 'test-booking-uid', eventTypeId: 7383670, status: 'ACCEPTED', paymentRequired: false };
    if (!callbacks.bookingSuccessfulV2) throw Error('Missing Cal.com official embed callback');
    callbacks.bookingSuccessfulV2({ detail: { type, data: { ...payload, ...data } } });
  }, send(data = {}, type = 'bookingSuccessfulV2', overrides = {}) {
    listeners.message({ origin: 'https://cal.com', source: frame.contentWindow, data: { type, originator: 'CAL', data: { ...payload, ...data } }, ...overrides });
  } };
}
test('one accepted free-trial booking produces one completion and one lead', () => {
  const app = harness(); app.send(); app.send();
  assert.deepEqual(app.events.map(x => x[1]), ['generate_lead', 'trial_booking_complete']);
});
test('pending, paid, unrelated and unidentified bookings do not convert', () => {
  for (const data of [{ status: 'PENDING' }, { status: undefined }, { paymentRequired: true }, { eventTypeId: 7327877 }, { uid: '' }]) {
    const app = harness(); app.send(data); assert.equal(app.events.length, 0);
  }
});
test('clicks, dry runs, reschedules and untrusted messages do not convert', () => {
  const app = harness();
  for (const type of ['trial_booking_intent', 'dryRunBookingSuccessfulV2', 'rescheduleBookingSuccessfulV2', 'prefixbookingSuccessfulV2']) app.send({}, type);
  app.send({}, undefined, { origin: 'https://untrusted.example' });
  app.send({}, undefined, { source: {} });
  assert.equal(app.events.length, 0);
});
test('deduplication still works without session storage', () => {
  const app = harness({ brokenStorage: true }); app.send(); app.send();
  assert.equal(app.events.filter(x => x[1] === 'trial_booking_complete').length, 1);
});
test('no Google Analytics event is sent when analytics is off', () => {
  const app = harness({ consent: false }); app.send(); assert.equal(app.events.length, 0);
});

test('official Cal inline embed installs listener and only tracks accepted free-trial bookings', () => {
  const app = harness({ nativeEmbed: true });
  assert.equal(app.calCalls.filter(x => x[0] === 'inline').length, 1);
  assert.equal(app.calCalls.find(x => x[0] === 'inline')[1].calLink, 'jason-phillips-u5rvya/free-trial');
  app.sendNative({ status: 'PENDING', uid: 'not-accepted' });
  app.sendNative({ eventTypeId: 7327877, uid: 'digital-event' });
  app.sendNative({ paymentRequired: true, uid: 'paid-booking' });
  assert.equal(app.events.length, 0);
  app.sendNative();
  app.sendNative();
  assert.deepEqual(app.events.map(x => x[1]), ['generate_lead', 'trial_booking_complete']);
});

test('official Cal event listener does not bypass analytics consent', () => {
  const app = harness({ nativeEmbed: true, consent: false });
  app.sendNative();
  assert.equal(app.events.length, 0);
});

test('free trial page mounts the Cal inline SDK instead of a bare iframe', () => {
  const html = readFileSync(new URL('../free-trial.html', import.meta.url), 'utf8');
  assert.match(html, /id="pe-trial-embed"/);
  assert.doesNotMatch(html, /<iframe data-trial-calendar/);
  assert.match(source, /action: 'bookingSuccessfulV2'/);
});
