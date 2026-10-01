/* Browser-only, local file adapters. No network or persistent state. */
(function(root){
  'use strict';
  function downloadJSON(value, filename) {
    const blob=new Blob([JSON.stringify(value,null,2)+'\n'],{type:'application/json;charset=utf-8'});
    const url=URL.createObjectURL(blob),a=document.createElement('a');
    a.href=url;a.download=filename;document.body.appendChild(a);
    try {a.click();} finally {a.remove();setTimeout(()=>URL.revokeObjectURL(url),2500);}
  }
  async function copyText(value) {
    if(navigator.clipboard?.writeText){try{await navigator.clipboard.writeText(value);return true;}catch(_){/* File origins may block Clipboard API. */}}
    const area=document.createElement('textarea'),focused=document.activeElement;
    area.value=value;area.style.cssText='position:fixed;left:-9999px;top:0';
    // Keep the fallback inside the active dialog, not in its inert background.
    (document.querySelector('.overlay.show .modal')||document.body).appendChild(area);area.focus();area.select();
    let ok=false;try{ok=document.execCommand('copy');}catch(_){}finally{area.remove();focused?.focus({preventScroll:true});}
    return ok;
  }
  root.LWFiles={downloadJSON,copyText};
})(window);
