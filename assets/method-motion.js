/* Phillips English Method: scroll-driven timeline enhancement.
   Inspired by Phillips Digital motion prompts #035/#039.
   Base markup and content work without JavaScript. */
(function(){
  "use strict";
  function init(){
    var root=document.getElementById("phillips-method");
    if(!root || !root.classList.contains("pe-method--journey"))return;
    var stages=Array.prototype.slice.call(root.querySelectorAll(".pe-method-step"));
    if(!stages.length)return;
    var reduced=window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if(reduced){
      root.style.setProperty("--pe-method-progress","1");
      stages.forEach(function(stage){stage.classList.add("is-current");});
      return;
    }
    var scheduled=false;
    function clamp(num){return Math.max(0,Math.min(1,num));}
    function update(){
      scheduled=false;
      var viewport=window.innerHeight || document.documentElement.clientHeight || 800;
      var targetY=viewport*.59;
      var first=stages[0].querySelector(".pe-method-step-dot").getBoundingClientRect();
      var last=stages[stages.length-1].querySelector(".pe-method-step-dot").getBoundingClientRect();
      var beginning=first.top+first.height/2;
      var finish=last.top+last.height/2;
      var progress=(targetY-beginning)/Math.max(1,finish-beginning);
      root.style.setProperty("--pe-method-progress",clamp(progress).toFixed(4));
      var current=0;
      stages.forEach(function(stage,i){
        var marker=stage.querySelector(".pe-method-step-dot").getBoundingClientRect();
        if(marker.top+marker.height/2<=targetY)current=i;
      });
      stages.forEach(function(stage,i){stage.classList.toggle("is-current",i===current);});
    }
    function schedule(){
      if(scheduled)return;
      scheduled=true;
      window.requestAnimationFrame(update);
    }
    update();
    window.addEventListener("scroll",schedule,{passive:true});
    window.addEventListener("resize",schedule,{passive:true});
    window.addEventListener("pageshow",schedule);
  }
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init);
  else init();
})();
