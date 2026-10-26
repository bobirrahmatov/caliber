/* Shared WCSpedia loading layer. Based on the Covenants overlay and the
 * progress track in wealth/Old/sampleoverlay.html; no external libraries. */
(function (global) {
  'use strict';
  // A shared Confluence header may load this before the page's full bundle.
  // Keep one API and ID sequence when the same component is included again.
  if (global.WCSLoadingOverlay?.version === 2 && typeof global.WCSLoadingOverlay.create === 'function' && typeof global.WCSLoadingOverlay.skeleton === 'function') return;
  let sequence = 0;
  function create({target, delayMs = 0}) {
    const doc = target.ownerDocument, pending = new Set();
    let overlay, message, bar, before, attributes, overflow, showTimer = null, queuedProgress = null;
    function show(text = 'Loading WCSpedia…') {
      if (!overlay && delayMs > 0) {
        if (showTimer === null) showTimer = global.setTimeout(() => { showTimer = null; display(text); }, delayMs);
        return;
      }
      display(text);
    }
    function display(text) {
      if (!overlay) {
        const id = 'wcs-loading-message-' + (++sequence);
        before = doc.activeElement;
        attributes = {busy:target.getAttribute('aria-busy'), inert:target.getAttribute('inert')};
        overflow = doc.body.style.overflow;
        target.setAttribute('aria-busy', 'true');
        target.setAttribute('inert', '');
        doc.body.style.overflow = 'hidden';
        overlay = doc.createElement('div');
        overlay.className = 'wcs-loading-overlay';
        overlay.setAttribute('role', 'dialog');
        overlay.setAttribute('aria-modal', 'true');
        overlay.setAttribute('aria-labelledby', id);
        overlay.tabIndex = -1;
        overlay.innerHTML = '<div class="wcs-loading-panel"><div class="wcs-loading-logo" role="img" aria-label="Citi"></div>' +
          '<p class="wcs-loading-title">WCSpedia</p>' +
          '<p class="wcs-loading-message" id="' + id + '" role="status" aria-live="polite" aria-atomic="true"></p>' +
          '<div class="wcs-loading-track" role="progressbar" aria-label="Page loading progress"><div class="wcs-loading-fill"></div></div></div>';
        message = overlay.querySelector('.wcs-loading-message');
        bar = overlay.querySelector('.wcs-loading-track');
        doc.body.append(overlay);
        doc.addEventListener('keydown', keepFocus, true);
        overlay.focus({preventScroll:true});
      }
      overlay.classList.add('is-indeterminate');
      bar.removeAttribute('aria-valuenow');
      bar.removeAttribute('aria-valuemin');
      bar.removeAttribute('aria-valuemax');
      message.textContent = text;
      bar.setAttribute('aria-valuetext', text);
      if (queuedProgress) { const step = queuedProgress; queuedProgress = null; progress(...step); }
    }
    function keepFocus(event) {
      if (event.key === 'Tab' && overlay) {
        event.preventDefault();
        event.stopPropagation();
        overlay.focus({preventScroll:true});
      }
    }
    // Progress counts completed loading steps, never fabricated network bytes.
    function progress(completed, total, text) {
      if (!overlay && showTimer !== null) { queuedProgress = [completed, total, text]; return; }
      if (!overlay || !Number.isFinite(completed) || !Number.isFinite(total) || total <= 0) return;
      const value = Math.max(0, Math.min(total, completed));
      overlay.classList.remove('is-indeterminate');
      overlay.style.setProperty('--wcs-loading-progress', (value / total * 100) + '%');
      bar.setAttribute('aria-valuemin', '0');
      bar.setAttribute('aria-valuemax', String(total));
      bar.setAttribute('aria-valuenow', String(value));
      if (text) message.textContent = text;
      bar.setAttribute('aria-valuetext', value + ' of ' + total + ' loading steps complete. ' + message.textContent);
    }
    function adoptTarget(next) {
      if (!next || next === target) return;
      if (overlay) {
        for (const [name, previous] of [['aria-busy', attributes.busy], ['inert', attributes.inert]]) {
          if (previous == null) target.removeAttribute(name); else target.setAttribute(name, previous);
        }
        attributes = {busy:next.getAttribute('aria-busy'), inert:next.getAttribute('inert')};
        next.setAttribute('aria-busy','true');next.setAttribute('inert','');
      }
      target = next;
    }
    function paint() {
      return new Promise(resolve => {
        let settled=false,first,second;
        const done=()=>{if(settled)return;settled=true;global.clearTimeout(timer);global.cancelAnimationFrame(first);global.cancelAnimationFrame(second);resolve();};
        const timer=global.setTimeout(done,100);
        first=global.requestAnimationFrame(()=>{second=global.requestAnimationFrame(done);});
      });
    }
    function hide() {
      queuedProgress = null;
      if (showTimer !== null) { global.clearTimeout(showTimer); showTimer = null; }
      if (!overlay) return;
      const restoreFocus = doc.activeElement === overlay || overlay.contains(doc.activeElement);
      overlay.remove(); overlay = null;
      doc.removeEventListener('keydown', keepFocus, true);
      for (const [name, previous] of [['aria-busy', attributes.busy], ['inert', attributes.inert]]) {
        if (previous == null) target.removeAttribute(name); else target.setAttribute(name, previous);
      }
      if (doc.body.style.overflow === 'hidden') doc.body.style.overflow = overflow;
      if (restoreFocus && before?.isConnected && !before.closest('[inert]')) before.focus({preventScroll:true});
    }
    // Bound read-only startup/refresh waits. A timeout rejects; it never reports
    // success or retries a write whose result could still be uncertain.
    async function wait(promise, {timeoutMs = 60000} = {}) {
      let timer, rejectWait;
      const timeout = new Promise((_, reject) => {
        rejectWait = reject;
        timer = global.setTimeout(() => reject(new Error('Loading took too long. Check your connection, then try again.')), timeoutMs);
      });
      const cancel = () => rejectWait(new Error('Page loading was interrupted.'));
      pending.add(cancel);
      try { return await Promise.race([promise, timeout]); }
      finally { global.clearTimeout(timer); pending.delete(cancel); }
    }
    function destroy() {
      hide();
      for (const cancel of pending) cancel();
      global.removeEventListener('pagehide', destroy);
    }
    global.addEventListener('pagehide', destroy);
    return {show, progress, hide, wait, destroy, adoptTarget, paint};
  }
  function skeleton(label = 'Loading documents…') {
    const safe = String(label).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    return '<div class="wcs-loading-skeleton" role="status"><span class="sr-only">'+safe+'</span><div aria-hidden="true">'+
      Array.from({length:3}, () => '<div class="wcs-skeleton-card"><i></i><i></i><i></i></div>').join('')+'</div></div>';
  }
  global.WCSLoadingOverlay = {create, skeleton, version:2};
})(window);

;
/* Shared early overlay only. Does not initialize the application or its settings. */
(function(w,d){
  'use strict';
  if(w.WCSHeaderLoading)return;
  var script=d.currentScript;
  var allowed=(script?.getAttribute('data-wcs-loading-pages')||'').split(',');
  var id=d.querySelector('meta[name="ajs-page-id"]')?.content||new URL(w.location.href).searchParams.get('pageId')||(w.location.pathname.match(/\/pages\/(\d+)(?:\/|$)/)||[])[1];
  if(!id||!allowed.includes(String(id))||/\/(?:editpage|createpage|resumedraft)\.action$/.test(w.location.pathname)||d.querySelector('#editpageform,#content-editor'))return;
  var loading,claimed=false,expired=false,timer,observer;
  function release(){w.clearTimeout(timer);observer?.disconnect();loading?.destroy();}
  function start(){
    if(!d.body||loading||expired)return;
    loading=w.WCSLoadingOverlay.create({target:d.createElement('div')});
    loading.show('Loading WCSpedia…');
    timer=w.setTimeout(function(){expired=true;release();},60000);
    // A page guard or host attachment error must not remain behind the overlay.
    observer=new MutationObserver(function(){
      if(!claimed&&(d.querySelector('#wcspedia .boot-state[role="alert"]')||/^WCSpedia .*(?:could not load|failed to load|settings are missing|does not match)/i.test(d.getElementById('wcspedia')?.textContent||''))){expired=true;release();}
    });
    observer.observe(d.body,{childList:true,subtree:true});
  }
  w.WCSHeaderLoading={claim:function(root){
    if(claimed||expired)return null;
    start();if(!loading)return null;
    claimed=true;w.clearTimeout(timer);observer?.disconnect();loading.adoptTarget(root);return loading;
  }};
  w.addEventListener('pagehide',release);
  w.addEventListener('pageshow',function(event){if(event.persisted){expired=true;release();}});
  if(d.body)start();else d.addEventListener('DOMContentLoaded',start,{once:true});
})(window,document);
