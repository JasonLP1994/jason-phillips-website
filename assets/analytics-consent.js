(function () {
  'use strict';

  var measurementId = 'G-NHQ8S263EP';
  var storageKey = 'pe-analytics-consent-v1';
  var maxAge = 180 * 24 * 60 * 60 * 1000;
  var choice = null;
  var loaded = false;
  var banner;
  var settings;

  try {
    var saved = JSON.parse(localStorage.getItem(storageKey));
    if (saved && typeof saved.analytics === 'boolean' && typeof saved.time === 'number' && Date.now() - saved.time >= 0 && Date.now() - saved.time < maxAge) {
      choice = saved.analytics;
    }
  } catch (error) { /* Storage can be unavailable in private browsers. */ }

  function injectScript(id, src) {
    if (document.getElementById(id)) return;
    var tag = document.createElement('script');
    tag.id = id;
    tag.defer = true;
    tag.src = src;
    document.head.appendChild(tag);
  }

  function startVercelTelemetry() {
    /* Vercel Web Analytics is first-party and cookie-free. Speed Insights
       records anonymous real-user performance metrics. */
    window.va = window.va || function () {
      (window.vaq = window.vaq || []).push(arguments);
    };
    window.si = window.si || function () {
      (window.siq = window.siq || []).push(arguments);
    };
    injectScript('pe-vercel-analytics', '/_vercel/insights/script.js');
    injectScript('pe-vercel-speed-insights', '/_vercel/speed-insights/script.js');
  }

  function clearAnalyticsCookies() {
    document.cookie.split(';').forEach(function (cookie) {
      var name = cookie.split('=')[0].trim();
      if (!/^_ga(?:_|$)/.test(name)) return;
      var expired = name + '=; Max-Age=0; path=/; SameSite=Lax';
      document.cookie = expired;
      document.cookie = expired + '; domain=' + location.hostname;
      document.cookie = expired + '; domain=phillipsenglish.com';
    });
  }

  function startAnalytics() {
    if (loaded || choice !== true) return;
    loaded = true;
    window['ga-disable-' + measurementId] = false;
    window.dataLayer = window.dataLayer || [];
    window.gtag = function () { window.dataLayer.push(arguments); };
    window.gtag('consent', 'default', {
      analytics_storage: 'granted',
      ad_storage: 'denied',
      ad_user_data: 'denied',
      ad_personalization: 'denied'
    });
    window.gtag('js', new Date());
    window.gtag('config', measurementId, {
      allow_google_signals: false,
      allow_ad_personalization_signals: false,
      send_page_view: true,
      page_location: window.location.href,
      page_title: document.title
    });
    var tag = document.createElement('script');
    tag.id = 'pe-google-analytics';
    tag.async = true;
    tag.src = 'https://www.googletagmanager.com/gtag/js?id=' + measurementId;
    document.head.appendChild(tag);
  }

  function saveChoice(allow) {
    var wasLoaded = loaded;
    choice = allow;
    try {
      localStorage.setItem(storageKey, JSON.stringify({ analytics: allow, time: Date.now() }));
    } catch (error) {}
    if (banner) banner.hidden = true;
    if (settings) settings.focus();

    if (allow) {
      startAnalytics();
    } else {
      window['ga-disable-' + measurementId] = true;
      clearAnalyticsCookies();
      if (wasLoaded) location.reload();
    }
  }

  if (choice !== true) {
    window['ga-disable-' + measurementId] = true;
    clearAnalyticsCookies();
  }

  function buildControls() {
    var css = document.createElement('style');
    css.textContent = '#pe-cookie-banner[hidden]{display:none}#pe-cookie-banner{position:fixed;z-index:9999;left:16px;right:16px;bottom:16px;max-width:860px;margin:auto;padding:22px;background:#0e171e;color:#fff;border:1px solid #81bac4;border-radius:8px;box-shadow:0 8px 35px #0005;font-family:Arial,Helvetica,sans-serif;max-height:75vh;overflow:auto}#pe-cookie-banner h2{font-size:20px;line-height:1.3;margin:0 0 10px}#pe-cookie-banner p{font-size:14px;line-height:1.6;margin:0 0 14px;color:#e0e7eb}#pe-cookie-banner a{color:#a1d7df;text-decoration:underline}#pe-cookie-banner .pe-cookie-actions{display:flex;gap:12px;flex-wrap:wrap}#pe-cookie-banner button{font:700 14px Arial,Helvetica,sans-serif;background:#81bac4;color:#0e171e;border:1px solid #81bac4;border-radius:5px;padding:12px 18px;cursor:pointer;flex:1;min-width:180px}#pe-cookie-banner button:focus-visible,.pe-cookie-settings:focus-visible{outline:3px solid #fff;outline-offset:3px}.pe-cookie-settings{display:block;margin:16px 0 0;border:0;background:transparent;color:inherit;font:inherit;text-decoration:underline;text-underline-offset:4px;cursor:pointer;padding:5px 0}@media(max-width:480px){#pe-cookie-banner{left:10px;right:10px;bottom:10px;padding:18px}#pe-cookie-banner button{min-width:100%}}';
    document.head.appendChild(css);

    banner = document.createElement('section');
    banner.id = 'pe-cookie-banner';
    banner.setAttribute('aria-labelledby', 'pe-cookie-title');
    banner.setAttribute('role', 'region');
    banner.hidden = choice !== null;
    banner.innerHTML = '<h2 id="pe-cookie-title">Your cookie choices</h2><p>With your permission, we use Google Analytics to understand how visitors use Phillips English and improve the website. Google Analytics stays off until you accept. You can reject it and still browse and book lessons. <a href="/privacy.html">Read our privacy policy</a>.</p><div class="pe-cookie-actions"><button type="button" data-choice="reject">Reject Google Analytics</button><button type="button" data-choice="accept">Accept Google Analytics</button></div>';
    banner.querySelector('[data-choice="reject"]').addEventListener('click', function () { saveChoice(false); });
    banner.querySelector('[data-choice="accept"]').addEventListener('click', function () { saveChoice(true); });
    document.body.appendChild(banner);

    settings = document.createElement('button');
    settings.type = 'button';
    settings.className = 'pe-cookie-settings';
    settings.textContent = 'Cookie settings';
    settings.setAttribute('aria-controls', 'pe-cookie-banner');
    settings.addEventListener('click', function () {
      banner.hidden = false;
      banner.querySelector('[data-choice="reject"]').focus();
    });

    var footers = document.querySelectorAll('footer');
    var footer = footers.length ? footers[footers.length - 1] : document.body;
    (footer.querySelector('.wrap') || footer).appendChild(settings);
  }

  function init() {
    startVercelTelemetry();
    if (choice === true) startAnalytics();
    buildControls();
  }

  window.addEventListener('storage', function (event) {
    if (event.key === storageKey) location.reload();
  });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();