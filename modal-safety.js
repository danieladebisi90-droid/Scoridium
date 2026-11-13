/* Scoridium global modal accessibility and bottom navigation collision prevention. */
(()=>{'use strict';
 const update=()=>{
   const open=!!document.querySelector('dialog[open],.schedule-modal.show,.schedule-modal.active,#schedule-modal:not([hidden])[style*="display: flex"],.tournament-backdrop:not([hidden]),[aria-modal="true"]:not([hidden])');
   document.documentElement.classList.toggle('sc-modal-active',open);
   if(window.parent!==window)window.parent.postMessage({type:'scoridium:modal-state',open},location.origin);
 };
 const observer=new MutationObserver(update);
 observer.observe(document.documentElement,{subtree:true,childList:true,attributes:true,attributeFilter:['open','hidden','class','style','aria-modal']});
 update();
})();
