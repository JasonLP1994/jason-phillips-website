/* Phillips English trial request + paid-campaign attribution. */
(function () {
  'use strict';

  var attributionKey = 'pe-attribution-v1';
  var attributionFields = ['utm_source','utm_medium','utm_campaign','utm_content','utm_term','gclid','gbraid','wbraid','fbclid'];
  var query = new URLSearchParams(window.location.search);
  var stored = {};

  try { stored = JSON.parse(localStorage.getItem(attributionKey) || '{}') || {}; } catch (error) { stored = {}; }

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

  function attributionParams() {
    var params = new URLSearchParams();
    attributionFields.forEach(function (key) {
      if (stored[key]) params.set(key, stored[key]);
    });
    return params;
  }

  document.querySelectorAll('[data-trial-calendar]').forEach(function (node) {
    var base = node.getAttribute('data-cal-url') || node.getAttribute('href') || node.getAttribute('src');
    if (!base) return;
    try {
      var url = new URL(base, window.location.origin);
      attributionParams().forEach(function (value, key) { url.searchParams.set(key, value); });
      url.searchParams.set('utm_landing_page', window.location.pathname);
      if (node.tagName === 'IFRAME') node.src = url.toString();
      else node.href = url.toString();
    } catch (error) {}
  });

  document.addEventListener('click', function (event) {
    var cta = event.target && event.target.closest ? event.target.closest('[data-trial-calendar], [data-campaign-cta]') : null;
    if (!cta) return;
    sendEvent('trial_booking_intent', {
      page_path: window.location.pathname,
      campaign: stored.utm_campaign || '',
      source: stored.utm_source || '',
      medium: stored.utm_medium || '',
      cta_location: cta.getAttribute('data-campaign-cta') || 'calendar'
    });
  }, true);

  window.addEventListener('blur', function () {
    setTimeout(function () {
      var active = document.activeElement;
      if (!active || active.tagName !== 'IFRAME' || !active.hasAttribute('data-trial-calendar')) return;
      sendEvent('trial_calendar_interaction', {
        page_path: window.location.pathname,
        campaign: stored.utm_campaign || '',
        source: stored.utm_source || ''
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
        campaign: stored.utm_campaign || ''
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
        campaign: stored.utm_campaign || ''
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
          page_path: window.location.pathname,
          campaign: stored.utm_campaign || '',
          source: stored.utm_source || '',
          medium: stored.utm_medium || ''
        });
        sendEvent('trial_request_success', {
          page_path: window.location.pathname,
          campaign: stored.utm_campaign || ''
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