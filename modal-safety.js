/* Hide navigation only when a dialog is genuinely visible. */
(()=>{'use strict';
 const visible=el=>{if(!el||el.closest('[hidden],[inert]'))return false;const s=getComputedStyle(el);return s.display!=='none'&&s.visibility!=='hidden'&&el.getClientRects().length>0;};
 const update=()=>{
   const open=[...document.querySelectorAll('dialog[open],.schedule-modal,.tournament-backdrop,[aria-modal="true"],.roster-edit-dialog')].some(visible);
   document.documentElement.classList.toggle('sc-modal-active',open);
   if(window.parent!==window)window.parent.postMessage({type:'scoridium:modal-state',open},location.origin);
 };
 new MutationObserver(update).observe(document.documentElement,{subtree:true,childList:true,attributes:true,attributeFilter:['open','hidden','class','style','aria-modal']});
 window.addEventListener('load',update);update();
})();
