/* Phillips English trial request + paid-campaign attribution. */
(function () {
  'use strict';

  var attributionKey = 'pe-attribution-v1';
  var attributionFields = ['utm_source','utm_medium','utm_campaign','utm_content','utm_term','gclid','gbraid','wbraid','fbclid'];
  var reportedSourceKey = 'pe-reported-source-v1';
  var reportedSource = '';
  var query = new URLSearchParams(window.location.search);
  var stored = {};

  try { stored = JSON.parse(localStorage.getItem(attributionKey) || '{}') || {}; } catch (error) { stored = {}; }
  try { reportedSource = sessionStorage.getItem(reportedSourceKey) || ''; } catch (error) { reportedSource = ''; }
  if (reportedSource) stored.reported_source = reportedSource;

  attributionFields.forEach(function (key) {
    var value = query.get(key);
    if (value) stored[key] = value.slice(0, 250);
  });
  if (!stored.first_landing_page) stored.first_landing_page = window.location.pathname;
  stored.last_landing_page = window.location.pathname;
  if (!stored.first_referrer && document.referrer) stored.first_referrer = document.referrer.slice(0, 500);
  stored.last_referrer = document.referrer ? document.referrer.slice(0, 500) : (stored.last_referrer || '');
  stored.updated_at = new Date().toISOString();
  try { localStorage.setItem(attributionKey, JSON.stringify(stored)); } catch (error) {}

  function sendEvent(name, params) {
    if (typeof window.gtag === 'function') window.gtag('event', name, params || {});
  }

  function addHidden(form, name, value) {
    if (!value || form.querySelector('input[name="' + name + '"]')) return;
    var field = document.createElement('input');
    field.type = 'hidden';
    field.name = name;
    field.value = String(value).slice(0, 500);
    form.appendChild(field);
  }

  function compactReferrer(value) {
    if (!value) return '';
    try {
      return new URL(value, window.location.origin).hostname.replace(/^www\./, '').slice(0, 120);
    } catch (error) {
      return String(value).slice(0, 120);
    }
  }

  function attributionParams() {
    var params = new URLSearchParams();
    attributionFields.forEach(function (key) {
      if (stored[key]) params.set(key, stored[key]);
    });

    // Cal.com stores standard UTM parameters with the booking. Keep any campaign
    // content already present, then append self-reported source and referrer host
    // so attribution survives even when Google Analytics is not available.
    var contentParts = [];
    if (params.get('utm_content')) contentParts.push(params.get('utm_content'));
    if (reportedSource) contentParts.push('reported_source:' + reportedSource);
    var referrerHost = compactReferrer(stored.first_referrer || stored.last_referrer);
    if (referrerHost) contentParts.push('referrer:' + referrerHost);
    if (contentParts.length) params.set('utm_content', contentParts.join('|'));
    return params;
  }

  function persistReportedSource(value) {
    reportedSource = value || '';
    stored.reported_source = reportedSource;
    stored.reported_source_at = new Date().toISOString();
    try {
      sessionStorage.setItem(reportedSourceKey, reportedSource);
      localStorage.setItem(attributionKey, JSON.stringify(stored));
    } catch (error) {}

    document.querySelectorAll('form[data-trial-request]').forEach(function (form) {
      var field = form.querySelector('input[name="reported_source"]');
      if (!field) {
        field = document.createElement('input');
        field.type = 'hidden';
        field.name = 'reported_source';
        form.appendChild(field);
      }
      field.value = reportedSource;
    });
  }

  function refreshCalendarAttribution() {
    document.querySelectorAll('[data-trial-calendar]').forEach(function (node) {
      var base = node.getAttribute('data-cal-url') || node.getAttribute('href') || node.getAttribute('src');
      if (!base) return;
      try {
        var url = new URL(base, window.location.origin);
        attributionParams().forEach(function (value, key) { url.searchParams.set(key, value); });
        url.searchParams.set('utm_landing_page', window.location.pathname);
        if (stored.first_landing_page) url.searchParams.set('first_landing_page', stored.first_landing_page);
        if (stored.last_landing_page) url.searchParams.set('last_landing_page', stored.last_landing_page);
        if (stored.first_referrer) url.searchParams.set('first_referrer', stored.first_referrer);
        if (stored.last_referrer) url.searchParams.set('last_referrer', stored.last_referrer);
        if (node.tagName === 'IFRAME') node.src = url.toString();
        else if (node.tagName === 'A') node.href = url.toString();
        // The official Cal inline embed receives its initial UTM config below.
      } catch (error) {}
    });
  }

  // Source attribution is optional: never hide the calendar or enquiry fallback.
  document.querySelectorAll('[data-attribution-source]').forEach(function (button) {
    if (reportedSource && button.getAttribute('data-attribution-source') === reportedSource) {
      button.setAttribute('aria-pressed', 'true');
    }
    button.addEventListener('click', function () {
      var value = button.getAttribute('data-attribution-source') || '';
      persistReportedSource(value);
      document.querySelectorAll('[data-attribution-source]').forEach(function (other) {
        other.setAttribute('aria-pressed', other === button ? 'true' : 'false');
      });
      refreshCalendarAttribution();
      sendEvent('trial_source_selected', {
        page_path: window.location.pathname,
        reported_source: value
      });
    });
  });

  refreshCalendarAttribution();

  // Use Cal.com's official inline embed so bookingSuccessfulV2 is delivered to
  // a supported callback. A plain cal.com iframe does not set up the embed SDK.
  // The existing direct booking link remains available if the script is blocked.
  function initialiseOfficialCalEmbed() {
    var target = document.getElementById && document.getElementById('pe-trial-embed');
    if (!target) return;

    (function (C, A, L) {
      var push = function (api, args) { api.q.push(args); };
      var doc = C.document;
      C.Cal = C.Cal || function () {
        var cal = C.Cal, args = arguments;
        if (!cal.loaded) {
          cal.ns = {};
          cal.q = cal.q || [];
          var script = doc.createElement('script');
          script.src = A;
          script.async = true;
          doc.head.appendChild(script);
          cal.loaded = true;
        }
        if (args[0] === L) {
          var api = function () { push(api, arguments); };
          var namespace = args[1];
          api.q = api.q || [];
          if (typeof namespace === 'string') {
            cal.ns[namespace] = cal.ns[namespace] || api;
            push(cal.ns[namespace], args);
            push(cal, ['initNamespace', namespace]);
          } else {
            push(cal, args);
          }
          return;
        }
        push(cal, args);
      };
    })(window, 'https://app.cal.com/embed/embed.js', 'init');

    var config = {};
    attributionParams().forEach(function (value, key) { config[key] = value; });
    config.utm_landing_page = window.location.pathname;

    window.Cal('init', { origin: 'https://cal.com' });
    window.Cal('on', {
      action: 'bookingSuccessfulV2',
      callback: function (event) {
        var detail = event && event.detail;
        if (!detail || detail.type !== 'bookingSuccessfulV2') return;
        handleConfirmedCalBooking({ data: detail.data });
      }
    });
    window.Cal('inline', {
      elementOrSelector: '#pe-trial-embed',
      calLink: 'jason-phillips-u5rvya/free-trial',
      config: config
    });
  }

  initialiseOfficialCalEmbed();

  var bookingIntentSent = false;
  function sendBookingIntent(location) {
    if (bookingIntentSent) return;
    bookingIntentSent = true;
    sendEvent('trial_booking_intent', {
      page_path: window.location.pathname,
      campaign: stored.utm_campaign || '',
      source: stored.utm_source || '',
      medium: stored.utm_medium || '',
      reported_source: reportedSource || '',
      referrer_host: compactReferrer(stored.first_referrer || stored.last_referrer),
      cta_location: location || 'calendar'
    });
  }

  document.addEventListener('click', function (event) {
    var cta = event.target && event.target.closest ? event.target.closest('[data-trial-calendar], [data-campaign-cta]') : null;
    if (!cta) return;
    sendBookingIntent(cta.getAttribute('data-campaign-cta') || 'calendar');
  }, true);

  var confirmedBookingKey = 'pe-confirmed-trial-booking-v1';
  var confirmedBookingIds = Object.create(null);

  function handleConfirmedCalBooking(message) {
    var payload = message && typeof message === 'object' ? (message.data || message.detail || message) : {};
    // Cal's success event can also describe an unconfirmed booking. Count only
    // an accepted, unpaid free-trial booking with a real booking identifier.
    if (!payload || Number(payload.eventTypeId) !== 7383670 ||
        String(payload.status || '').toLowerCase() !== 'accepted' ||
        payload.paymentRequired !== false || typeof payload.uid !== 'string' ||
        !payload.uid.trim()) return;
    var uid = payload.uid;
    var dedupeValue = uid;
    if (confirmedBookingIds[uid]) return;
    confirmedBookingIds[uid] = true;

    try {
      if (sessionStorage.getItem(confirmedBookingKey) === dedupeValue) return;
      sessionStorage.setItem(confirmedBookingKey, dedupeValue);
    } catch (error) {}

    var conversionParams = {
      form_name: 'cal_free_trial',
      lead_type: 'trial_booking',
      booking_provider: 'cal.com',
      page_path: window.location.pathname,
      campaign: stored.utm_campaign || '',
      source: stored.utm_source || '',
      medium: stored.utm_medium || '',
      reported_source: reportedSource || '',
      referrer_host: compactReferrer(stored.first_referrer || stored.last_referrer)
    };
    if (uid) conversionParams.booking_uid = uid;

    // One canonical lead event for both successful Cal.com bookings and
    // the alternative trial request form. This is the event to use as
    // the primary GA4 / Google Ads / Meta conversion signal.
    sendEvent('generate_lead', conversionParams);
    sendEvent('trial_booking_complete', conversionParams);

    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push(Object.assign({ event: 'pe_trial_booking_complete' }, conversionParams));

    // If a Phillips English Meta Pixel is added later, use Meta's standard
    // Lead event for this same confirmed booking without changing the funnel code.
    if (typeof window.fbq === 'function') {
      window.fbq('track', 'Lead', {
        content_name: 'Phillips English free trial',
        content_category: 'trial_booking'
      });
    }
  }

  // Cal.com's embedded booker posts bookingSuccessfulV2 to the parent
  // window after a booking is successfully created. Only accept messages
  // from Cal.com origins and ignore unrelated iframe messages.
  window.addEventListener('message', function (event) {
    if (event.origin !== 'https://cal.com' && event.origin !== 'https://app.cal.com') return;
    var calendar = document.querySelector('#pe-trial-embed iframe') ||
      document.querySelector('iframe[data-trial-calendar]');
    if (!calendar || event.source !== calendar.contentWindow) return;

    var message = event.data;
    if (!message || typeof message !== 'object') return;
    var type = typeof message.type === 'string' ? message.type : '';
    var originator = message.originator ? String(message.originator).toLowerCase() : '';
    if (type !== 'bookingSuccessfulV2') return;
    if (originator && originator.indexOf('cal') === -1) return;

    handleConfirmedCalBooking(message);
  });

  window.addEventListener('blur', function () {
    setTimeout(function () {
      var active = document.activeElement;
      if (!active || active.tagName !== 'IFRAME' || !active.hasAttribute('data-trial-calendar')) return;
      sendEvent('trial_calendar_interaction', {
        page_path: window.location.pathname,
        campaign: stored.utm_campaign || '',
        source: stored.utm_source || '',
        medium: stored.utm_medium || '',
        reported_source: reportedSource || '',
        referrer_host: compactReferrer(stored.first_referrer || stored.last_referrer)
      });
    }, 0);
  });

  document.querySelectorAll('form[data-trial-request]').forEach(function (form) {
    if (!window.fetch || !window.FormData) return;

    attributionFields.forEach(function (key) { addHidden(form, key, stored[key] || query.get(key)); });
    addHidden(form, 'first_landing_page', stored.first_landing_page);
    addHidden(form, 'last_landing_page', stored.last_landing_page);
    addHidden(form, 'first_referrer', stored.first_referrer);
    addHidden(form, 'last_referrer', stored.last_referrer);
    addHidden(form, 'page_url', window.location.href);
    addHidden(form, 'page_path', window.location.pathname);
    addHidden(form, 'reported_source', reportedSource);

    var button = form.querySelector('button[type="submit"]');
    var status = form.parentElement.querySelector('.trial-status') || document.querySelector('.trial-status');
    var successPanel = form.parentElement.querySelector('[data-trial-success]') || document.querySelector('[data-trial-success]');
    if (!button || !status) return;

    var label = button.textContent;
    var pending = false;
    var started = false;

    form.addEventListener('focusin', function () {
      if (started) return;
      started = true;
      sendEvent('trial_form_start', {
        form_name: form.querySelector('[name="enquiry_type"]') ? form.querySelector('[name="enquiry_type"]').value : 'free_trial',
        page_path: window.location.pathname,
        campaign: stored.utm_campaign || '',
        reported_source: reportedSource || ''
      });
    });

    form.addEventListener('submit', async function (event) {
      event.preventDefault();
      if (pending || !form.reportValidity()) return;
      pending = true;
      button.disabled = true;
      button.textContent = 'Sending your request…';
      form.setAttribute('aria-busy', 'true');
      status.dataset.state = 'pending';
      status.textContent = 'Sending your trial request.';

      sendEvent('trial_form_submit', {
        form_name: form.querySelector('[name="enquiry_type"]') ? form.querySelector('[name="enquiry_type"]').value : 'free_trial',
        page_path: window.location.pathname,
        campaign: stored.utm_campaign || '',
        source: stored.utm_source || '',
        medium: stored.utm_medium || '',
        reported_source: reportedSource || '',
        referrer_host: compactReferrer(stored.first_referrer || stored.last_referrer)
      });

      try {
        var response = await fetch(form.action, {
          method: 'POST',
          body: new FormData(form),
          headers: { Accept: 'application/json' }
        });
        var result = await response.json().catch(function () { return {}; });
        if (!response.ok) {
          var message = result.errors && result.errors.map(function (error) { return error.message; }).join(' ');
          throw new Error(message || 'Please check your details and try again.');
        }

        status.dataset.state = 'success';
        status.textContent = 'Thanks — your trial request has been sent successfully.';
        form.hidden = true;
        if (successPanel) successPanel.hidden = false;

        sendEvent('generate_lead', {
          form_name: form.querySelector('[name="enquiry_type"]') ? form.querySelector('[name="enquiry_type"]').value : 'free_trial',
          lead_type: 'trial_request',
          booking_provider: 'formspree',
          page_path: window.location.pathname,
          campaign: stored.utm_campaign || '',
          source: stored.utm_source || '',
          medium: stored.utm_medium || '',
          reported_source: reportedSource || '',
          referrer_host: compactReferrer(stored.first_referrer || stored.last_referrer)
        });
        sendEvent('trial_request_success', {
          page_path: window.location.pathname,
          campaign: stored.utm_campaign || '',
          source: stored.utm_source || '',
          medium: stored.utm_medium || '',
          reported_source: reportedSource || '',
          referrer_host: compactReferrer(stored.first_referrer || stored.last_referrer)
        });
        status.focus();
      } catch (error) {
        status.dataset.state = 'error';
        status.textContent = 'Your request has not been confirmed. ' + (error.message && error.message !== 'Failed to fetch' ? error.message.slice(0, 250) : 'Please try again, or email hello@phillipsenglish.com.');
        status.focus();
      } finally {
        pending = false;
        button.disabled = false;
        button.textContent = label;
        form.removeAttribute('aria-busy');
      }
    });
  });
})();
