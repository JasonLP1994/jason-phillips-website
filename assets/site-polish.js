/* Phillips English shared site helpers */
(function(){
  function loadContrastStyles(){
    if(document.querySelector('link[href="assets/contrast-fix.css"]')) return;
    var link=document.createElement('link');
    link.rel='stylesheet';
    link.href='assets/contrast-fix.css';
    document.head.appendChild(link);
  }

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

  function rgb(value){
    var m=(value||'').match(/rgba?\((\d+)[, ]+\s*(\d+)[, ]+\s*(\d+)/i);
    return m ? [Number(m[1]),Number(m[2]),Number(m[3])] : null;
  }

  function luminance(c){
    return c.map(function(v){
      v/=255;
      return v<=.03928?v/12.92:Math.pow((v+.055)/1.055,2.4);
    }).reduce(function(sum,v,i){return sum+v*[.2126,.7152,.0722][i];},0);
  }

  function contrast(a,b){
    var l1=luminance(a),l2=luminance(b);
    return (Math.max(l1,l2)+.05)/(Math.min(l1,l2)+.05);
  }

  function effectiveBackground(el){
    var node=el;
    while(node && node!==document.documentElement){
      var value=getComputedStyle(node).backgroundColor;
      var parsed=rgb(value);
      if(parsed && value!=='transparent' && !/rgba\([^)]*,\s*0(?:\.0+)?\)/i.test(value)) return parsed;
      node=node.parentElement;
    }
    return [18,24,32];
  }

  function hasDirectText(el){
    for(var i=0;i<el.childNodes.length;i++){
      if(el.childNodes[i].nodeType===3 && el.childNodes[i].nodeValue.trim()) return true;
    }
    return false;
  }

  function enforceReadableContrast(){
    var selector='h1,h2,h3,h4,h5,h6,p,li,span,strong,b,small,a,label,blockquote,div';
    document.querySelectorAll(selector).forEach(function(el){
      if(!hasDirectText(el)) return;
      if(el.closest('.button,.navcta,.btn,button,input,select,textarea')) return;
      var bg=effectiveBackground(el);
      var fg=rgb(getComputedStyle(el).color);
      if(!fg) return;
      var bgLum=luminance(bg);
      var ratio=contrast(bg,fg);
      if(bgLum<.24 && ratio<4.8){
        el.style.setProperty('color','#f7f8f6','important');
      }else if(bgLum>.62 && ratio<4.8){
        el.style.setProperty('color','#0b2132','important');
      }
    });
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
      setTimeout(enforceReadableContrast,150);
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

  function init(){
    loadContrastStyles();
    addTranslator();
    addContrastFixes();
    addGroupBooking();
    enforceReadableContrast();
    setTimeout(enforceReadableContrast,400);
    setTimeout(enforceReadableContrast,1400);
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',init); else init();
  window.addEventListener('load',enforceReadableContrast);
})();
