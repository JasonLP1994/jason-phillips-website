/* Phillips English shared site helpers */
(function(){
  function addTranslator(){
    if(document.querySelector('.pe-translate')) return;
    var wrap=document.createElement('div');
    wrap.className='pe-translate';
    wrap.innerHTML='<label for="peLanguage">Translate page</label><select id="peLanguage" aria-label="Translate this page"><option value="">Translate</option><option value="es">Español</option><option value="fr">Français</option><option value="de">Deutsch</option><option value="it">Italiano</option><option value="pt">Português</option><option value="pl">Polski</option><option value="ru">Русский</option><option value="uk">Українська</option><option value="tr">Türkçe</option><option value="ar">العربية</option><option value="zh-CN">中文</option><option value="ja">日本語</option><option value="ko">한국어</option><option value="vi">Tiếng Việt</option></select>';
    document.body.appendChild(wrap);
    wrap.querySelector('select').addEventListener('change',function(){
      if(!this.value) return;
      var translated='https://translate.google.com/translate?sl=en&tl='+encodeURIComponent(this.value)+'&u='+encodeURIComponent(window.location.href);
      window.location.href=translated;
    });
  }

  function addContrastFixes(){
    if(document.getElementById('pe-runtime-contrast')) return;
    var style=document.createElement('style');
    style.id='pe-runtime-contrast';
    style.textContent='\n.contact-card.featured,.contact-card.featured h1,.contact-card.featured h2,.contact-card.featured h3,.contact-card.featured strong,.contact-card.featured li,.contact-card.featured .email,.contact-card.featured .email a{color:#fff!important}.contact-card.featured p,.contact-card.featured .label{color:#d6e0e5!important}.contact-card.featured a{color:#fff!important}\n';
    document.head.appendChild(style);
  }

  function addGroupBooking(){
    if(!/group-coaching\.html(?:$|[?#])/.test(window.location.pathname+window.location.search+window.location.hash) && !document.querySelector('.group-offers')) return;

    var urls={
      private:'https://cal.com/jason-phillips-u5rvya/private-group-coaching',
      team:'https://cal.com/jason-phillips-u5rvya/professional-team-coaching'
    };
    var titles={
      private:'Private Small Group',
      team:'Professional Team Coaching'
    };
    var descriptions={
      private:'For 2–4 learners. Choose an available time below and complete the booking without leaving Phillips English.',
      team:'For professional teams. Choose an available time below and complete the booking without leaving Phillips English.'
    };
    var summaries={
      private:'Private Small Group · from £90 / 60 minutes',
      team:'Professional Team Coaching · from £120 / 60 minutes'
    };

    var section=document.getElementById('group-booking');
    if(!section){
      var enquiry=document.getElementById('group-enquiry') || document.querySelector('.group-enquiry');
      if(!enquiry) return;
      section=document.createElement('section');
      section.className='group-booking';
      section.id='group-booking';
      section.innerHTML='\
<div class="wrap">\
  <div class="group-booking-head">\
    <div><div class="eyebrow">Book group coaching</div><h2 id="groupBookingTitle">Private Small Group</h2><p id="groupBookingText">For 2–4 learners. Choose an available time below and complete the booking without leaving Phillips English.</p></div>\
  </div>\
  <div class="group-book-tabs" role="tablist" aria-label="Choose group coaching type">\
    <button class="group-book-tab active" data-group-service="private" type="button">Private Small Group · from £90</button>\
    <button class="group-book-tab" data-group-service="team" type="button">Professional Team · from £120</button>\
  </div>\
  <div class="group-book-summary"><span>Selected option</span><strong id="groupBookingSummary">Private Small Group · from £90 / 60 minutes</strong><p>Choose your time in the live calendar below. Booking and payment stay inside this website.</p></div>\
  <div class="group-calendar-shell"><iframe id="groupCalFrame" title="Group coaching booking calendar" src="https://cal.com/jason-phillips-u5rvya/private-group-coaching" loading="lazy" allow="payment *"></iframe></div>\
  <p class="group-book-helper">For a bespoke 8–12 week goal-based programme, use the enquiry form below so I can quote accurately for your group.</p>\
</div>';
      enquiry.parentNode.insertBefore(section,enquiry);
    }

    var frame=document.getElementById('groupCalFrame');
    var title=document.getElementById('groupBookingTitle');
    var text=document.getElementById('groupBookingText');
    var summary=document.getElementById('groupBookingSummary');

    function select(service,scroll){
      if(!urls[service]) service='private';
      document.querySelectorAll('[data-group-service]').forEach(function(el){
        if(el.classList.contains('group-book-tab')) el.classList.toggle('active',el.getAttribute('data-group-service')===service);
      });
      if(frame && frame.getAttribute('src')!==urls[service]) frame.setAttribute('src',urls[service]);
      if(title) title.textContent=titles[service];
      if(text) text.textContent=descriptions[service];
      if(summary) summary.textContent=summaries[service];
      if(scroll && section) section.scrollIntoView({behavior:'smooth',block:'start'});
    }

    document.querySelectorAll('.group-book-btn').forEach(function(btn){
      if(btn.dataset.peBound) return;
      btn.dataset.peBound='1';
      btn.addEventListener('click',function(){select(btn.getAttribute('data-group-service'),true);});
    });
    document.querySelectorAll('.group-book-tab').forEach(function(tab){
      if(tab.dataset.peBound) return;
      tab.dataset.peBound='1';
      tab.addEventListener('click',function(){select(tab.getAttribute('data-group-service'),false);});
    });

    var requested=new URLSearchParams(window.location.search).get('group');
    select(requested==='team'?'team':'private',false);
  }

  function init(){addTranslator();addContrastFixes();addGroupBooking();}
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',init); else init();
})();
