/* Confirm free trial requests without leaving Phillips English. */
(function () {
  'use strict';
  var form = document.querySelector('form[data-trial-request]');
  if (!form || !window.fetch || !window.FormData) return;
  var button = form.querySelector('button[type="submit"]');
  var status = document.querySelector('.trial-status');
  if (!button || !status) return;
  var label = button.textContent;
  var pending = false;
  var query = new URLSearchParams(window.location.search);
  ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content'].forEach(function (key) {
    var value = query.get(key);
    if (!value) return;
    var field = document.createElement('input');
    field.type = 'hidden';
    field.name = key;
    field.value = value.slice(0, 120);
    form.appendChild(field);
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
      status.textContent = 'Thanks, your trial request has been sent. I’ll email you to agree a time. Your lesson is confirmed once we’ve agreed it together.';
      form.hidden = true;
      if (typeof window.gtag === 'function') {
        window.gtag('event', 'generate_lead', {
          form_name: 'free_trial',
          lead_type: 'trial_request',
          page_path: window.location.pathname
        });
      }
      status.focus();
    } catch (error) {
      status.dataset.state = 'error';
      status.textContent = 'Your request has not been confirmed. ' + (error.message && error.message !== 'Failed to fetch' ? error.message.slice(0, 250) : 'Please try again, or use the Contact page to get in touch.');
      status.focus();
    } finally {
      pending = false;
      button.disabled = false;
      button.textContent = label;
      form.removeAttribute('aria-busy');
    }
  });
})();
