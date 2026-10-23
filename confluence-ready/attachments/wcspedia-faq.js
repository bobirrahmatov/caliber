/* WCSpedia FAQs: page logic and dependencies.
 * Covenants loading order: HTML macro with inline settings, wcspedia-faq.js,
 * then wcspedia-faqHTMLPage.js. No separate configuration attachment.
 * This file alone does not render a page or make data requests.
 */
(function () {
  'use strict';
  const mount = document.getElementById('wcspedia');
  if (!mount) return;
  if (window.WCSPageBoot?.failed) return;
  function failPage(message) {
    if (window.WCSPageBoot) { window.WCSPageBoot.fail(message); return; }
    const box = document.createElement('div');
    box.className = 'boot-state';
    box.setAttribute('role', 'alert');
    box.textContent = message;
    mount.replaceChildren(box);
  }
  if (document.querySelectorAll('[id="wcspedia"]').length !== 1) {
    failPage('This page contains more than one WCSpedia application macro. Keep one matching page macro in the page body; do not place an application macro in navBar.');
    return;
  }
  const configuredRole = window.WCS_CONFIG && window.WCS_CONFIG.pageRole;
  const markedRole = mount.getAttribute('data-wcs-page-role');
  if (configuredRole !== 'faq' || (markedRole && markedRole !== 'faq')) {
    failPage('The WCSpedia JavaScript does not match this HTML macro. Script role: faq; settings role: ' + (configuredRole || 'missing') + '; HTML marker: ' + (markedRole || 'missing') + '. Use wcspedia-faq.html with wcspedia-faq.js and wcspedia-faqHTMLPage.js on the same page.');
    return;
  }
  // Older page fragments do not include this optional DOM marker. Recreate it
  // only after the inline settings agree with this role-specific script. A
  // conflicting marker/configuration or a mismatched pair still fails closed.
  if (!markedRole) mount.setAttribute('data-wcs-page-role', 'faq');

  const modules = window.WCSPageModules = window.WCSPageModules || {};
  if (modules['faq']) return;
  window.WCSDiscoveryCatalog = {"schemaVersion":1,"isDemo":false,"people":[],"areas":[{"id":"credit-approval-control","title":"Credit Approval Control","description":"Approval records, checks and decision evidence.","icon":"shield"},{"id":"credit-information-management","title":"Credit Information Management","description":"Accurate records and clear data ownership.","icon":"database"},{"id":"credit-management-reporting","title":"Credit Management Reporting","description":"Reporting preparation and quality checks.","icon":"chart"},{"id":"deal-closing","title":"Deal Closing","description":"Readiness checks and complete handovers.","icon":"check"},{"id":"documentation-pledging","title":"Documentation & Pledging Team","description":"Document records, pledges and exceptions.","icon":"file"},{"id":"emea-credit-admin","title":"EMEA Credit Admin","description":"Regional administration and team handovers.","icon":"globe"},{"id":"loan-management","title":"Loan Management","description":"Servicing records and lifecycle activities.","icon":"briefcase"},{"id":"regional-operating-manuals","title":"Regional Operating Manuals","description":"Regional guidance and operating knowledge.","icon":"book"}],"types":["Job aid","Procedure","Knowledge sharing","Blog","Training","Reference","Report","Guide","Playbook","Checklist","Template","FAQ"],"documents":[],"taxonomyRevision":1,"taxonomyAudit":[]};
/* Shared WCSpedia loading layer. Based on the Covenants overlay and the
 * progress track in wealth/Old/sampleoverlay.html; no external libraries. */
(function (global) {
  'use strict';
  // A shared Confluence header may load this before the page's full bundle.
  // Keep one API and ID sequence when the same component is included again.
  if (global.WCSLoadingOverlay && typeof global.WCSLoadingOverlay.create === 'function' && typeof global.WCSLoadingOverlay.skeleton === 'function') return;
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
    return {show, progress, hide, wait, destroy};
  }
  function skeleton(label = 'Loading documents…') {
    const safe = String(label).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    return '<div class="wcs-loading-skeleton" role="status"><span class="sr-only">'+safe+'</span><div aria-hidden="true">'+
      Array.from({length:3}, () => '<div class="wcs-skeleton-card"><i></i><i></i><i></i></div>').join('')+'</div></div>';
  }
  global.WCSLoadingOverlay = {create, skeleton};
})(window);

;
/* Shared routes across independently hosted Confluence pages. */
(function (root, factory) {
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.WCSNavigation=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  function roleFor(href){
    if(typeof href!=='string'||!href.startsWith('#/'))return null;
    const [path,query='']=href.slice(1).split('?'),p=new URLSearchParams(query);
    if(path==='/faq')return 'faq';
    if(path==='/insights')return 'insights';
    if(path==='/entitlements')return 'entitlements';
    if(path==='/review'||path.startsWith('/review/')||(path==='/results'&&p.get('view')==='review'))return 'review';
    if(path==='/saved')return 'saved';
    if(path==='/health')return 'mine';
    if(path==='/create'||path.startsWith('/edit/')||path==='/categories'||(path==='/results'&&p.get('view')==='mine'))return 'mine';
    return 'home';
  }
  const pageDefaults={home:'#/',mine:'#/results?view=mine',review:'#/review',saved:'#/saved',entitlements:'#/entitlements',insights:'#/insights',faq:'#/faq'};
  function isDefaultRoute(href,role){
    const expected=pageDefaults[role];if(!expected||typeof href!=='string')return false;
    const [path,query='']=href.split('?'),[defaultPath,defaultQuery='']=expected.split('?');
    if(path!==defaultPath)return false;
    const actual=new URLSearchParams(query),wanted=new URLSearchParams(defaultQuery);
    return actual.size===wanted.size&&Array.from(wanted).every(([key,value])=>actual.get(key)===value);
  }
  function usesCleanDefault(config){
    return config.mode==='confluence'&&!!pageDefaults[config.pageRole]&&!config.documentId&&initialHash(config)===pageDefaults[config.pageRole];
  }
  function routeHash(config,currentHash){
    return currentHash&&currentHash!=='#'?currentHash:initialHash(config);
  }
  function canonicalUrl(config,currentUrl){
    if(!usesCleanDefault(config))return currentUrl;
    try{
      const target=new URL(currentUrl);
      if(!target.hash||isDefaultRoute(target.hash,config.pageRole))target.hash='';
      return target.href;
    }catch(_){return currentUrl;}
  }
  function resolve(href,config,currentUrl){
    if(typeof href==='string'&&/^#\/search(?:\?|$)/.test(href))href='#/?focus=search';
    const role=roleFor(href);
    if(!role||!config.pages||role===(config.pageRole||'home')||!config.pages[role])return href;
    try{
      const current=new URL(currentUrl),target=new URL(config.pages[role],current);
      if(target.origin!==current.origin||!['https:','http:','file:'].includes(target.protocol))return href;
      // The target's native page already identifies its default screen. Keep
      // fragments only for meaningful subroutes, searches and filters.
      target.hash=config.mode==='confluence'&&isDefaultRoute(href,role)?'':href.slice(1);
      return target.href;
    }catch(_){return href;}
  }
  function initialHash(config){
    if(config.pageRole==='faq')return '#/faq';
    if(config.documentId)return '#/document/'+encodeURIComponent(config.documentId);
    if(config.initialView==='insights'||config.pageRole==='insights')return '#/insights';
    if(config.initialView==='saved'||config.pageRole==='saved')return '#/saved';
    if(config.initialView==='mine'||config.pageRole==='mine')return '#/results?view=mine';
    if(config.initialView==='search')return '#/?focus=search';
    if(['results','review'].includes(config.initialView))return '#/'+config.initialView;
    if(config.pageRole==='entitlements')return '#/entitlements';
    if(config.pageRole==='review')return '#/review';
    return '#/';
  }
  function isListRoute(hash){return typeof hash==='string'&&/^#\/(?:$|\?|results(?:\?|$)|review(?:\?|$)|insights(?:\?|$)|saved(?:\?|$)|health(?:\?|$)|topic\/[^?]+(?:\?|$))/.test(hash);}
  function afterDelete(config,hash,previousList){
    const current=routeHash(config,hash);
    if(isListRoute(current))return current;
    const requested=new URLSearchParams(current.split('?')[1]||'').get('returnTo');
    if(isListRoute(requested))return requested;
    if(isListRoute(previousList))return previousList;
    // Remain on the current native host. Never route deletion to another page
    // because of the deleted document's content type.
    const fallback=initialHash({...config,documentId:undefined});
    return isListRoute(fallback)?fallback:'#/results?view=mine';
  }
  return {roleFor,resolve,initialHash,routeHash,canonicalUrl,isListRoute,afterDelete};
});

;
/* Static help: no workspace, entitlement, document or analytics requests. */
(function(global){
  'use strict';
  const entries=[
    ['How do I find a document or browse a business area?', 'Search from the landing page to find documents and Insights articles. Choose Explore documents to filter by business area, content type, topic or updated year. Only content your signed-in Confluence account can access is included.'],
    ['What is Insights, and which content type should I choose?', 'Insights brings together Guides, Blogs, Training and Reports. Use a Guide for procedures, playbooks or checklists; a Blog for updates and stories; Training for learning materials; and a Report for findings or reference information. Choose Job aid for operational instructions that require review and approval.'],
    ['How do I create a document and use a template?', 'Select the floating + button, then choose a content type. In the editor, use the template button for that type and complete the title, summary, topics and content. Available actions depend on your entitlements and native Confluence permissions.'],
    ['Where are my drafts, and how does publishing work?', 'My Workspace contains your documents and their workflow status. Save unfinished work there. Guides, Blogs, Training and Reports publish directly to Insights when you select Publish to Insights. Job aids require a business area and assigned reviewers, then follow the review and manager approval steps. Saving a draft does not publish it.'],
    ['How do I review a Job aid or respond to requested changes?', 'Open Reviewer Workspace for work assigned to you. Read the document and review comments before choosing an available action. Authors can find requested changes in My Workspace, update the document and resubmit it. The audit trail records workflow decisions.'],
    ['How do I save an article for later?', 'Use the save action in the document reader, then open Saved from the header to return to it. Removing a saved item removes your bookmark, not the original document. A saved article may become unavailable if it is deleted or your Confluence access changes.'],
    ['How do I edit, suggest a correction or delete a document?', 'Open your document from My Workspace and use the actions available to you. For someone else’s article, use Suggest an edit when available. Deletion requires the document key and a decision comment; you can copy the key from the confirmation dialog. A successful deletion returns you to your originating list.'],
    ['How are covers, summaries, authors and view counts shown?', 'An uploaded cover takes priority. Insights without a cover use a fallback image assigned consistently to the article. Cards use the document’s summary and author, and display recorded view counts when available. “Views unavailable” means a count could not be retrieved; it does not mean zero views.'],
    ['Why can’t I see a document or use an action?', 'Native Confluence permissions control access to pages and attachments. WCSpedia entitlements control the application actions offered to your account; they do not grant Confluence access. If something is missing, ask your space administrator to check both your native access and your entitlement record.'],
    ['What should I do if loading, search or publishing fails?', 'Keep your editor open if a save or publication fails and read the error before retrying. For loading or search errors, use Try again and check that your Confluence session is still signed in. Newly published articles can take time to appear in native search. If the problem continues, share the page link and error with your space administrator; do not share tokens or cookies.']
  ];
  const escape=value=>String(value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  function mount(root,config){
    const home=global.WCSNavigation.resolve('#/',config,global.location.href);
    const explore=global.WCSNavigation.resolve('#/results',config,global.location.href);
    root.innerHTML='<div class="shell discovery-shell"><div class="discovery workspace-page wcs-faq-page"><section class="press-heading page-panel"><div class="discovery-container"><nav class="breadcrumbs" aria-label="Breadcrumb"><a href="'+escape(home)+'">WCSpedia</a><span aria-hidden="true">›</span><span aria-current="page">FAQs</span></nav><div class="eyebrow">Help &amp; guidance</div><h1>Frequently asked questions</h1><p>Find your way around WCSpedia, from your first search to publishing a document.</p></div></section><div class="discovery-container"><form class="library-workspace-search" role="search"><label for="wcs-faq-search">Search FAQs</label><div class="wcs-faq-search-row"><input id="wcs-faq-search" type="search" maxlength="200" placeholder="Try publishing, saved items or access…" aria-controls="wcs-faq-list" autocomplete="off"><button class="button secondary" type="reset">Clear</button></div></form><p class="library-count" id="wcs-faq-count" role="status"></p><div id="wcs-faq-list">'+entries.map(([q,a],i)=>'<details class="wcs-help-item" open><summary id="wcs-help-q-'+i+'">'+escape(q)+'<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="m6 9 6 6 6-6"/></svg></summary><div role="region" aria-labelledby="wcs-help-q-'+i+'"><p>'+escape(a)+'</p></div></details>').join('')+'</div><p class="wcs-faq-empty" hidden>No matching questions. Try a different word or clear your search.</p><div class="wcs-faq-footer"><p>Ready to find what you need?</p><a class="discovery-text-link" href="'+escape(explore)+'">Explore documents <span aria-hidden="true">→</span></a></div></div></div></div>';
    const input=root.querySelector('#wcs-faq-search'),items=[...root.querySelectorAll('.wcs-help-item')];
    const filter=()=>{
      const words=input.value.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);let visible=0;
      items.forEach((item,i)=>{const matches=words.every(word=>entries[i].join(' ').toLocaleLowerCase().includes(word));item.hidden=!matches;if(matches){visible++;if(words.length)item.open=true;}});
      root.querySelector('#wcs-faq-count').textContent=words.length?visible+' of '+entries.length+' questions':entries.length+' questions';
      root.querySelector('.wcs-faq-empty').hidden=visible!==0;
    };
    input.addEventListener('input',filter);
    root.querySelector('form').addEventListener('submit',event=>event.preventDefault());
    root.querySelector('form').addEventListener('reset',event=>{event.preventDefault();input.value='';items.forEach(item=>item.open=true);filter();input.focus();});
    filter();
  }
  global.WCSFAQ={mount};
})(window);

  modules['faq'] = { version: 'aa083bc91fba' };
})();
