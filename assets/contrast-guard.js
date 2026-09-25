/* Phillips English automatic contrast guard */
(function(){
  function rgb(value){
    var m=(value||'').match(/rgba?\((\d+)[, ]+\s*(\d+)[, ]+\s*(\d+)/i);
    return m ? [Number(m[1]),Number(m[2]),Number(m[3])] : null;
  }
  function luminance(c){
    return c.map(function(v){v/=255;return v<=.03928?v/12.92:Math.pow((v+.055)/1.055,2.4);})
      .reduce(function(sum,v,i){return sum+v*[.2126,.7152,.0722][i];},0);
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
  function fixContrast(){
    var selector='h1,h2,h3,h4,h5,h6,p,li,span,strong,b,small,a,label,blockquote,div';
    document.querySelectorAll(selector).forEach(function(el){
      if(!hasDirectText(el)) return;
      if(el.closest('.button,.navcta,.btn,button,input,select,textarea')) return;
      var bg=effectiveBackground(el);
      var fg=rgb(getComputedStyle(el).color);
      if(!fg) return;
      if(luminance(bg)<.24 && contrast(bg,fg)<4.8){
        el.style.setProperty('color','#f7f8f6','important');
      }
    });
  }
  function run(){
    fixContrast();
    setTimeout(fixContrast,400);
    setTimeout(fixContrast,1400);
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',run); else run();
  window.addEventListener('load',fixContrast);
})();
