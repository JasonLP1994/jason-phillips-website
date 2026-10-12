/* Phillips English shared site helpers */
(function(){
  function loadContrastStyles(){
    if(document.querySelector('link[href="/assets/contrast-fix.css"]')) return;
    var link=document.createElement('link');
    link.rel='stylesheet';
    link.href='/assets/contrast-fix.css';
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


/* PHILLIPS ENGLISH MOTION SYSTEM */
(function(){
  'use strict';

  var reduced=window.matchMedia('(prefers-reduced-motion: reduce)');
  var finePointer=window.matchMedia('(hover:hover) and (pointer:fine)');

  function buildNavShell(){
    var nav=document.querySelector('nav');
    if(!nav||!nav.parentElement) return;
    var parent=nav.parentElement;
    if(parent.classList.contains('pe-nav-shell')) return;
    if(parent.classList.contains('wrap')){
      var shell=document.createElement('div');
      shell.className='pe-nav-shell';
      parent.parentNode.insertBefore(shell,parent);
      shell.appendChild(parent);
      window.addEventListener('scroll',function(){
        shell.classList.toggle('pe-scrolled',window.scrollY>18);
      },{passive:true});
      shell.classList.toggle('pe-scrolled',window.scrollY>18);
    }
  }

  function buildScrollProgress(){
    if(document.querySelector('.pe-scroll-progress')) return;
    var bar=document.createElement('div');
    bar.className='pe-scroll-progress';
    bar.setAttribute('aria-hidden','true');
    document.body.appendChild(bar);
    function update(){
      var max=document.documentElement.scrollHeight-window.innerHeight;
      var progress=max>0?Math.min(1,Math.max(0,window.scrollY/max)):0;
      bar.style.transform='scaleX('+progress+')';
    }
    update();
    window.addEventListener('scroll',update,{passive:true});
    window.addEventListener('resize',update,{passive:true});
  }

  function buildTicker(){
    if(window.location.pathname!=='/' && !/index\.html$/.test(window.location.pathname)) return;
    if(document.querySelector('.pe-motion-ticker')) return;
    var proof=document.querySelector('.pe-proof');
    if(!proof||!proof.parentNode) return;
    var labels=['Business English','Meetings','Presentations','Interviews','IELTS','Pronunciation','Fluency','Aviation English'];
    function group(){
      return '<div class="pe-motion-ticker-group">'+labels.map(function(label){
        return '<span>'+label+'</span>';
      }).join('')+'</div>';
    }
    var ticker=document.createElement('div');
    ticker.className='pe-motion-ticker';
    ticker.setAttribute('aria-label','Phillips English coaching areas');
    ticker.innerHTML='<div class="pe-motion-ticker-track">'+group()+group()+'</div>';
    proof.parentNode.insertBefore(ticker,proof.nextSibling);
  }

  function markReveals(){
    var selectors=[
      '.pe-section-head',
      '.pe-package-card',
      '.pe-goal-card',
      '.pe-profile-photo',
      '.pe-profile-grid>div:last-child',
      '.pe-review-grid article',
      '.pe-seo-grid>div',
      '.pe-final-inner>*',
      '.pe-proof-grid>div',
      '.pe-trial-offer .wrap>*',
      '.pagehero .wrap>*',
      '.sales-hero .wrap>*',
      '.contact-hero .wrap>*',
      '.career-story .wrap>*',
      '.student-voice .wrap>*',
      '.editorial-proof .wrap>*',
      '.feature',
      '.post-card',
      '.card',
      '.sidebox',
      '.pe-trial-invite .wrap>*',
      '.pe-next-reading .wrap>*'
    ];
    var nodes=[];
    selectors.forEach(function(selector){
      document.querySelectorAll(selector).forEach(function(node){
        if(nodes.indexOf(node)===-1) nodes.push(node);
      });
    });
    nodes.forEach(function(node,index){
      node.classList.add('pe-reveal');
      if(node.matches('.pe-profile-photo,.feature')) node.classList.add('pe-from-left');
      if(node.matches('.pe-profile-grid>div:last-child')) node.classList.add('pe-from-right');
      if(node.matches('.pe-package-card,.pe-goal-card,.pe-review-grid article,.post-card,.card')) node.classList.add('pe-scale-in');
      node.style.setProperty('--pe-reveal-delay',Math.min((index%4)*70,210)+'ms');
    });

    document.querySelectorAll('.pe-section h2,.pagehero h1,.sales-hero h1,.contact-hero h1,.pe-final-cta h2,.pe-trial-invite h2,.pe-next-reading h2').forEach(function(h){
      h.classList.add('pe-heading-focus');
    });

    if(reduced.matches){
      nodes.forEach(function(node){node.classList.add('is-visible');});
      return;
    }
    var observer=new IntersectionObserver(function(entries){
      entries.forEach(function(entry){
        if(entry.isIntersecting){
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        }
      });
    },{rootMargin:'0px 0px -8% 0px',threshold:.08});
    nodes.forEach(function(node){observer.observe(node);});

    document.querySelectorAll('.pe-heading-focus').forEach(function(h){
      var parent=h.closest('.pe-reveal');
      if(!parent) observer.observe(h);
    });
  }

  function enableTilt(){
    var selectors='.pe-package-card,.pe-goal-card,.pe-review-grid article,.post-card,.card,.premium-route,.group-offer,.route-card,.sidebox';
    document.querySelectorAll(selectors).forEach(function(card){
      card.classList.add('pe-motion-card');
      if(reduced.matches||!finePointer.matches) return;
      card.addEventListener('pointermove',function(event){
        var rect=card.getBoundingClientRect();
        var px=(event.clientX-rect.left)/rect.width;
        var py=(event.clientY-rect.top)/rect.height;
        card.style.setProperty('--pe-pointer-x',(px*100)+'%');
        card.style.setProperty('--pe-pointer-y',(py*100)+'%');
        card.style.setProperty('--pe-tilt-x',((px-.5)*4.2)+'deg');
        card.style.setProperty('--pe-tilt-y',((.5-py)*4.2)+'deg');
      });
      card.addEventListener('pointerleave',function(){
        card.style.removeProperty('--pe-tilt-x');
        card.style.removeProperty('--pe-tilt-y');
        card.style.removeProperty('--pe-pointer-x');
        card.style.removeProperty('--pe-pointer-y');
      });
    });
  }

  function enablePageWave(){
    document.addEventListener('click',function(event){
      if(reduced.matches||event.defaultPrevented||event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey) return;
      var link=event.target.closest&&event.target.closest('a[href]');
      if(!link||link.target==='_blank'||link.hasAttribute('download')) return;
      var url;
      try{url=new URL(link.href,window.location.href);}catch(error){return;}
      if(url.origin!==window.location.origin) return;
      if(url.pathname===window.location.pathname&&url.hash){
        var target=document.getElementById(decodeURIComponent(url.hash.slice(1)));
        if(!target) return;
        event.preventDefault();
        if(location.hash!==url.hash) history.pushState(null,'',url.hash);
        target.scrollIntoView({behavior:'smooth',block:'start'});
        target.classList.add('is-visible');
        return;
      }
      if(url.pathname===window.location.pathname&&url.search===window.location.search) return;
      if(!(/\.html?$/i.test(url.pathname)||url.pathname==='/'||url.pathname.endsWith('/'))) return;
      event.preventDefault();
      var wave=document.createElement('div');
      wave.className='pe-link-wave';
      wave.setAttribute('aria-hidden','true');
      var x=event.detail?event.clientX:window.innerWidth/2;
      var y=event.detail?event.clientY:window.innerHeight/2;
      wave.style.setProperty('--pe-wave-x',x+'px');
      wave.style.setProperty('--pe-wave-y',y+'px');
      document.body.appendChild(wave);
      document.body.classList.add('pe-page-leaving');
      requestAnimationFrame(function(){
        requestAnimationFrame(function(){wave.classList.add('is-active');});
      });
      window.setTimeout(function(){window.location.assign(url.href);},600);
    },true);
  }

  function heroEntrance(){
    if(reduced.matches) return;
    var hero=document.querySelector('.pe-home-hero');
    if(!hero) return;
    var items=hero.querySelectorAll('.pe-hero-copy .eyebrow,.pe-hero-copy h1,.pe-hero-copy>p,.pe-actions,.pe-hero-note,.pe-hero-photo');
    items.forEach(function(item,index){
      item.animate([
        {opacity:0,transform:index===items.length-1?'translate3d(28px,0,0) scale(.97)':'translate3d(0,24px,0)'},
        {opacity:1,transform:'none'}
      ],{
        duration:index===items.length-1?900:720,
        delay:90+index*85,
        easing:'cubic-bezier(.16,1,.3,1)',
        fill:'both'
      });
    });
  }

  function initMotion(){
    buildNavShell();
    buildScrollProgress();
    buildTicker();
    markReveals();
    enableTilt();
    enablePageWave();
    heroEntrance();
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',initMotion);
  else initMotion();
})();
