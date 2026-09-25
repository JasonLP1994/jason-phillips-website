/* Phillips English shared site polish */
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

  function addBookingFallback(){
    var frame=document.getElementById('calBookingFrame');
    if(!frame || document.querySelector('.pe-booking-fallback')) return;
    var box=document.createElement('div');
    box.className='pe-booking-fallback';
    box.innerHTML='<strong>Booking calendar</strong><p>If the calendar below does not display correctly on your phone, open the secure booking calendar directly.</p><a target="_blank" rel="noopener">Open secure booking calendar →</a>';
    frame.parentNode.insertBefore(box,frame);
    var link=box.querySelector('a');
    function sync(){ link.href=frame.getAttribute('src') || '#'; }
    sync();
    new MutationObserver(sync).observe(frame,{attributes:true,attributeFilter:['src']});
  }

  function init(){addTranslator();addBookingFallback();}
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',init); else init();
})();
