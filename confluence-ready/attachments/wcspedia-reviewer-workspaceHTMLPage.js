/* WCSpedia Reviewer workspace: HTML rendering and startup.
 * Load wcspedia-reviewer-workspace.js first, then this file, as with covenantsHTMLPage.js.
 * Uses the settings embedded in this page's HTML macro.
 * Generated from the maintained app.js source; preserves the existing design.
 */
(function () {
  'use strict';
  const mount = document.getElementById('wcspedia');
  if (!mount) return;
  function failPage(message) {
    const box = document.createElement('div');
    box.className = 'boot-state';
    box.setAttribute('role', 'alert');
    box.textContent = message;
    mount.replaceChildren(box);
  }
  if (mount.getAttribute('data-wcs-page-role') !== 'review' || !window.WCS_CONFIG || window.WCS_CONFIG.pageRole !== 'review') {
    failPage('The WCSpedia JavaScript does not match this HTML macro. Use the wcspedia-reviewer-workspace.html settings and its matching JavaScript pair.');
    return;
  }

  if (mount.dataset.wcsPageStarted) return;
  if (!window.WCSPageModules || window.WCSPageModules['review']?.version !== '2c7d496e4f5a') {
    failPage('Load wcspedia-reviewer-workspace.js before wcspedia-reviewer-workspaceHTMLPage.js. Use both files from the same upload package and check their attachment URLs.');
    return;
  }
  mount.dataset.wcsPageStarted = 'review';
  const pageReady = /* WCSpedia: local, content-only prototype. Server enforcement is required in production. */
(async function () {
  'use strict';
  const root = document.getElementById('wcspedia'), workflow = window.WCSWorkflow, governance = window.WCSGovernance, governanceUI = window.WCSGovernanceUI;
  const config = window.WCS_CONFIG || {mode:'embedded'}, live = config.mode === 'confluence';
  if(!root)return;
  // The Confluence host owns page scrolling; never create a second viewport
  // inside the HTML macro or change the existing header's height/overflow.
  root.style.removeProperty('--wcs-available-height');
  const loading=window.WCSLoadingOverlay.create({target:root,delayMs:200});
  let adapter, session;
  function isNativeDiscoveryRoute(){
    const [path,query='']=window.WCSNavigation.routeHash(config,location.hash).slice(1).split('?'),view=new URLSearchParams(query).get('view');
    return path==='/'||path==='/insights'||path==='/search'||path==='/saved'&&config.authoringMode==='confluence-session'||path.startsWith('/topic/')||path==='/results'&&(!view||view==='published');
  }
  function requestedWorkspaceScope(){
    const [path,query='']=window.WCSNavigation.routeHash(config,location.hash).slice(1).split('?'),view=new URLSearchParams(query).get('view');
    if(path==='/create')return 'create';
    const detail=path.match(/^\/(?:edit|review|document|article)\/([^/]+)$/);
    if(detail){try{return 'document:'+decodeURIComponent(detail[1]);}catch(_){return 'all';}}
    if(path==='/review'||path==='/results'&&view==='review')return 'review';
    if(path==='/results'&&view==='mine')return 'mine';
    return 'all';
  }
  function needsWorkspaceSession(){
    if(!live||isNativeDiscoveryRoute())return false;
    if(session.discoveryOnly)return true;
    return !!session.workspaceScope&&session.workspaceScope!=='all'&&session.workspaceScope!==requestedWorkspaceScope();
  }
  // Only the landing screen owns the full-page branded introduction. Other
  // pages keep the header usable and report pending work in their own content.
  function isLandingScreen(){
    return (config.pageRole||'home')==='home'&&window.WCSNavigation.routeHash(config,location.hash).split('?')[0]==='#/';
  }
  function showLoading(message){
    if(isLandingScreen())loading.show(message);
  }
  // A pending landing splash must not follow navigation into another view.
  window.addEventListener('hashchange',()=>{if(!isLandingScreen())loading.hide();});
  showLoading('Loading WCSpedia…');
  root.replaceChildren();
  try {
    if(config.mode==='embedded') session={data:window.WCSData,actorId:'alex',canSubmit:true,mode:'embedded'};
    else { adapter=window.WCSConfluence.create(config); session=await loading.wait(adapter.load({discoveryOnly:live&&isNativeDiscoveryRoute(),workspaceScope:requestedWorkspaceScope()})); }
    if(!session.data || !Array.isArray(session.data.documents)) throw new Error('The knowledge data could not be loaded.');
    loading.progress(1,3,'Loading saved items and content checks…');
  let data=session.data;
  if(session.actor&&!data.people.some(p=>p.id===session.actorId)) data.people.push(session.actor);
  const canWrite=()=>!live||session.canSubmit;
  const canCreate=()=>canWrite()&&permitted('content.create');
  const actionsFor=doc=>canWrite()?workflow.allowedActions(doc,actorId,data.people,permissionContext(doc)).filter(action=>!window.WCSEditorContent.isInsightType(doc.type)||['edit','revise','delete'].includes(action)):[];
  const baseData = clone(data);
  let library=null,libraryStarted=false, exportView=null, editor=null, editorHash='', editorSequence=0, suggestionWidget=null, suggestionInbox=null, chartView=null, chartSummary=null;
  let suggestionTimer=null, suggestionController=null, suggestionSequence=0, childSearchController=null, childSearchSequence=0;
  let landingController=null, landingSequence=0, nativeLanding={status:'idle',areas:{},recent:[]};
  const nativePageLinks=new Map();
  // Reuse only native responses received by this page and this signed-in actor.
  // Nothing is persisted across a reload, tab, identity refresh or mutation.
  const nativeBrowseCache=new Map(),nativeBrowseTTL=30000;
  const nativeLandingMarkup=new WeakMap();
  let nativePrefetch=null,nativePrefetchTimer=null;
  let fullSessionLoading=null,fullSessionError=null,fullSessionErrorScope=null;
  const STORE = 'wcspedia.governed.v4', ACTOR = STORE + '.actor';
  const VIEW_STORE='wcspedia.views.v1',nativeMetricsMode=live&&config.authoringMode==='confluence-session';
  const nativeViewRequested=new Set(),nativeViewLoading=new Set(),nativeViewFailures=new Set();
  let viewCounts=Object.create(null),viewStatus='loading',viewLoadSequence=0,viewGeneration=0,viewTimer=null,viewVisit=null,localViews=null;
  if(!live)try{localViews=window.WCSViewCounts.createLocal({storage:window.localStorage,key:VIEW_STORE,withLock:navigator.locks?(name,task)=>navigator.locks.request(name,task):undefined});}catch(_){viewStatus='unavailable';}
  const typeUI=window.WCSEditorContent;
  const creationTypes=typeUI.CREATE_TYPES;
  let types = data.types || ['Job aid','Procedure','Blog','Training','Knowledge sharing','Reference'];
  const labels = {create:'Draft created',edit:'Content updated',submit:'Submitted for review','request-changes':'Changes requested','complete-review':'Review completed',approve:'Approved & published',revise:'New version started',delete:'Document deleted'};
  const actionLabels = {edit:'Edit draft',submit:'Submit for review','request-changes':'Request changes','complete-review':'Complete review',approve:'Approve & publish',revise:'Edit document',delete:'Delete document'};
  let workflowDialog=null, entitlementView=null, addDocumentWidget=null;
  let localPolicy=clone(data.entitlementPolicy||null);
  let documents = clone(data.documents), actorId = session.actorId || 'alex', modal = null, savedFocus, memoryOnly = false, focusSearchOnRender = false;
  function clone(value) { return JSON.parse(JSON.stringify(value)); }
  function readState() { if(live||memoryOnly)return;try { const state = JSON.parse(localStorage.getItem(STORE)); if (state && [2,3].includes(state.schema) && Array.isArray(state.documents)){documents=state.documents;if(state.schema===3&&Array.isArray(state.areas)){data.areas=state.areas;data.taxonomyRevision=state.taxonomyRevision;data.taxonomyAudit=state.taxonomyAudit||[];}} } catch (_) {} }
  readState();
  try { if (!live && data.people.some(p => p.id === localStorage.getItem(ACTOR))) actorId = localStorage.getItem(ACTOR); } catch (_) {}
  const esc = value => String(value == null ? '' : value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const decodeSegment=value=>{try{return decodeURIComponent(value);}catch(_){return '';}};
  const slug = text => String(text).toLowerCase().replace(/\s+/g,'-');
  const person = id => data.people.find(p => p.id === id) || {name:'Unassigned',initials:'—',role:''};
  const actor = () => person(actorId);
  function signedIdentity(){return live?session.identity:window.WCSEntitlements.identity({type:'known',username:actor().soeid,userKey:actorId,displayName:actor().name});}
  function nativeRights(){if(live)return session.nativePermissions||{};const ops=['read','update','delete'].map(operation=>({operation,targetType:'page'}));return {root:[{operation:'create',targetType:'page'}],entitlements:ops,documents:Object.fromEntries(documents.map(doc=>[doc.id,ops]))};}
  function entitlementPolicy(){return live?session.entitlementPolicy:localPolicy;}
  function permitted(permission,doc){return window.WCSEntitlements.effective(entitlementPolicy(),signedIdentity(),permission,{documentKey:doc?.id,native:nativeRights()});}
  function permissionContext(doc){return {actorId,documentId:doc.id,edit:permitted('content.edit',doc),delete:permitted('content.delete',doc)};}
  function readPolicy(){if(live)return;try{const stored=localStorage.getItem(STORE+'.entitlements');if(stored)localPolicy=window.WCSEntitlements.validatePolicy(JSON.parse(stored));}catch(_){localPolicy=null;}}
  readPolicy();
  async function saveEntitlements(command){
    if(live){refreshSession(await adapter.submitEntitlementCommand(command));return;}
    readPolicy();const next=window.WCSEntitlements.applyCommand(localPolicy,command,{identity:signedIdentity(),native:nativeRights(),now:new Date().toISOString()});
    localStorage.setItem(STORE+'.entitlements',JSON.stringify(next));localPolicy=next;
  }
  function entitlementOptions(){
    const info=live?adapter.info():null;
    return {policy:entitlementPolicy(),identity:signedIdentity(),documents,
      can:permission=>permitted(permission),
      access:live?{configured:session.policyConfigured,source:info.entitlementsSource,pageId:info.entitlementsPageId,filename:info.entitlementsFilename,serviceConnected:info.entitlementServiceConfigured}:null,
      save:saveEntitlements,refresh:render,notify:toast,go,download};
  }
  function mountGlobalTools(){
    // Live pages use the shared header's isolated permission-checked widget.
    // The page-owned mount is exclusively for standalone local previews.
    if(live||config.mountGlobalTools===false)return;
    const host=document.querySelector(config.addDocumentMountSelector||'[data-wcs-add-document]');
    if(!host)return;
    addDocumentWidget?.destroy();
    host.setAttribute('data-wcs-floating-add','');
    document.body.append(host);
    const createUrl=new URL(destination('#/create'),location.href).href;
    addDocumentWidget=window.WCSAddDocument.mount(host,{canCreate:()=>{readPolicy();return canCreate();},types:creationTypes.map(value=>({value,label:typeUI.typeLabel(value)})),createUrl,navigate:href=>{if(root.querySelector('[aria-modal="true"]'))return false;const guarded=editor&&(editor.isDirty()||editor.isBusy());go(href);return !guarded;}});
    const accessLink=document.querySelector('[data-wcs-entitlements-link]');if(accessLink)accessLink.href=destination('#/entitlements');
  }
  const area = id => data.areas.find(a => a.id === id);
  const date = at => at && Number.isFinite(Date.parse(at)) ? new Intl.DateTimeFormat('en-GB',{day:'2-digit',month:'short',year:'numeric',timeZone:'Europe/Warsaw'}).format(new Date(at)) : 'Not yet approved';
  const time = at => !Number.isFinite(Date.parse(at))?'Not recorded':new Intl.DateTimeFormat('en-GB',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit',second:'2-digit',timeZone:'Europe/Warsaw'}).format(new Date(at));
  function icon(name) {
    const paths = {book:'<path d="M12 5v15M3 4h5a4 4 0 0 1 4 2 4 4 0 0 1 4-2h5v15h-5a4 4 0 0 0-4 2 4 4 0 0 0-4-2H3z"/>',file:'<path d="M14 3H5v18h14V8zM14 3v5h5M8 12h8M8 16h6"/>',search:'<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/>',arrow:'<path d="M4 12h16m-6-6 6 6-6 6"/>',chevron:'<path d="m9 5 7 7-7 7"/>',back:'<path d="m15 5-7 7 7 7"/>',plus:'<path d="M12 5v14M5 12h14"/>',check:'<path d="m5 12 4 4L19 6"/>',shield:'<path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6z"/><path d="m8 12 3 3 5-6"/>',database:'<ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v14c0 4 16 4 16 0V5M4 12c0 4 16 4 16 0"/>',chart:'<path d="M4 3v18h17M8 16v-5m5 5V7m5 9V4"/>',globe:'<circle cx="12" cy="12" r="9"/><ellipse cx="12" cy="12" rx="4" ry="9"/><path d="M3 12h18"/>',briefcase:'<rect x="3" y="7" width="18" height="14" rx="2"/><path d="M8 7V3h8v4M3 12c5 4 13 4 18 0M12 12v4"/>',grid:'<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',close:'<path d="m6 6 12 12M6 18 18 6"/>',edit:'<path d="m15 4 5 5M4 20l5-1L21 7l-5-5L4 14z"/>',download:'<path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5"/>',link:'<path d="m10 13 4-4M8 15l-2 2a4 4 0 0 1-5-5l5-5a4 4 0 0 1 5 0m2 2 2-2a4 4 0 0 1 5 5l-5 5a4 4 0 0 1-5 0"/>',users:'<circle cx="9" cy="8" r="3"/><path d="M3 21v-3a6 6 0 0 1 12 0v3M17 5a3 3 0 0 1 0 6m1 4c3 0 4 2 4 6"/>'};
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+(paths[name] || paths.file)+'</svg>';
  }
  function who(id) { const p=person(id); return '<span class="person"><span class="avatar '+(p.role==='Manager'?'manager':'')+'">'+esc(p.initials)+'</span>'+esc(p.name)+'</span>'; }
  const badge = status => '<span class="badge '+slug(status)+'">'+esc(status)+'</span>';
  function route() { const raw = window.WCSNavigation.routeHash(config,location.hash).slice(1), [path,query=''] = raw.split('?'); return {path,params:new URLSearchParams(query)}; }
  function url(path, values={}) { const p = new URLSearchParams(); Object.keys(values).forEach(k=>{if(values[k]!=='' && values[k]!=null)p.set(k,values[k]);}); const safePath=path.split('/').map(segment=>{try{return encodeURIComponent(decodeURIComponent(segment));}catch(_){return encodeURIComponent(segment);}}).join('/');return '#'+safePath+(p.size?'?'+p:''); }
  const docUrl = (id,tab='content',version) => url('/document/'+encodeURIComponent(id),{tab,version});
  function destination(href){return memoryOnly?href:window.WCSNavigation.resolve(href,config,location.href);}
  function go(href) { if(modal?.saving||modal?.reloadRequired)return;const target=destination(href);if(editor&&(editor.isDirty()||editor.isBusy())){editor.requestLeave(target);return;}if(target.startsWith('#')){if(location.hash===target)render();else location.hash=target;}else location.assign(target); }
  document.addEventListener('wcspedia:navigate',event=>{
    if(!root.isConnected||typeof event.detail?.href!=='string')return;
    try{
      const target=new URL(event.detail.href,location.href);
      if(target.origin!==location.origin||target.username||target.password||!['http:','https:','file:'].includes(target.protocol))return;
      event.preventDefault();go(target.href);
    }catch(_){/* Only a valid same-origin header destination participates. */}
  });
  function wirePageLinks(scope=root){scope.querySelectorAll('a[href^="#/"]').forEach(a=>a.setAttribute('href',destination(a.getAttribute('href'))));}
  function canManage(doc) { return !doc.deletedAt&&(!live||session.workspaceLoaded) && (permitted('content.edit',doc)||permitted('content.delete',doc)||[doc.ownerId,doc.authorId,doc.reviewerId,doc.approverId].includes(actorId)); }
  function demoBar() { if(live)return '<div class="connection-bar"><span>'+icon('shield')+' Confluence knowledge library</span><span>'+esc(actor().name)+(canWrite()?'':' · Read only')+'</span></div>';return '<div class="demo-bar"><span class="demo-caption" title="'+esc(data.sampleNotice)+'"><i></i>Interactive prototype · sample people & documents <button class="demo-reset" data-action="reset" title="Restore the sample data and discard local demo changes">Reset demo</button></span><label class="role-switch"><span>Viewing as</span><select id="demo-actor" aria-label="Demo persona">'+data.people.map(p=>'<option value="'+esc(p.id)+'" '+(p.id===actorId?'selected':'')+'>'+esc(p.name)+(p.role==='Reader'?'':' · '+p.role)+'</option>').join('')+'</select></label></div>'; }
  function shell(content) { return '<div class="shell discovery-shell" role="region" aria-label="WCSpedia page content">'+(route().path==='/'||live&&config.showConnectionStatus===false?'':demoBar())+content+'</div><div id="modal-mount"></div>'; }
  function publishedDocs() { return documents.filter(d=>workflow.publishedVersion(d)); }
  function viewDocs(view) {
    if(view==='mine') return documents.filter(d=>d.authorId===actorId || d.ownerId===actorId);
    if(view==='review') return documents.filter(d=>{const v=workflow.currentVersion(d);return d.type==='Job aid' && canManage(d) && (v.status==='In review'&&d.reviewerId===actorId || v.status==='Awaiting approval'&&d.approverId===actorId);});
    return publishedDocs();
  }
  function empty(title,description,label,href) { return '<div class="empty">'+icon('search')+'<h2>'+esc(title)+'</h2><p>'+esc(description)+'</p><a class="button secondary" href="'+esc(href)+'">'+esc(label)+'</a></div>'; }
  function discoveryOptions() {
    const r=route(), p=r.params;
    let view=p.get('view')||'published';
    if(!['published','mine','review'].includes(view))view='published';
    return {query:(p.get('q')||'').slice(0,500),area:r.path.startsWith('/topic/')?decodeSegment(r.path.split('/')[2]):p.get('area')||'',type:types.includes(p.get('type'))?typeUI.groupType(p.get('type')):'',view,tag:p.get('tag')||'',process:p.get('process')||'',region:p.get('region')||'',sort:nativeMetricsMode&&['most-viewed','least-viewed'].includes(p.get('sort'))?'updated':p.get('sort')||'relevance',actorId,people:data.people};
  }
  function discoverRows(options={}) { return window.WCSDiscovery.searchDocuments(documents,Object.assign({view:'published',actorId,people:data.people,areas:data.areas,sort:'updated',viewCounts},options),workflow); }
  function readingLabel(version){const estimate=window.WCSDocumentMetrics.estimate(version);return estimate.minutes?estimate.minutes+' min read':'Reading time unavailable';}
  function viewLabel(key){const count=viewCounts[key];return Number.isSafeInteger(count)&&count>=0?new Intl.NumberFormat('en-GB').format(count)+(live?(nativeMetricsMode?(count===1?' recorded view':' recorded views'):(count===1?' view':' views')):(count===1?' demo view':' demo views')):(nativeMetricsMode?nativeViewLoading.has(key):viewStatus==='loading')?'Loading views…':'Views unavailable';}
  function viewsMarkup(doc){return workflow.publishedVersion(doc)?'<span class="document-view-count" data-document-views="'+esc(doc.id)+'" aria-label="'+esc(viewLabel(doc.id))+'">'+esc(viewLabel(doc.id))+'</span>':'';}
  function readingMarkup(v){return '<span class="document-reading-time" data-tooltip="Estimated from readable content at 200 words per minute, plus time for images.">'+esc(readingLabel(v))+'</span>';}
  function updateViewLabels(){root.querySelectorAll('[data-document-views]').forEach(el=>{const label=viewLabel(el.dataset.documentViews);el.textContent=label;el.setAttribute('aria-label',label);if(nativeMetricsMode)el.title=nativeViewFailures.has(el.dataset.documentViews)?'Recording this visit was not confirmed. The displayed total is the last confirmed count.':'WCSpedia visits recorded by accounts with native page edit permission, deduplicated over 30 minutes. This is not total Confluence traffic.';});}
  async function loadViewCounts(force=true){
    if(nativeMetricsMode){
      const keys=[...new Set([...root.querySelectorAll('[data-document-views]')].map(el=>el.dataset.documentViews))].slice(0,50).filter(key=>!nativeViewLoading.has(key)&&(force||!nativeViewRequested.has(key)));
      if(!keys.length){scheduleDocumentView();return;}
      const generation=viewGeneration;
      keys.forEach(key=>{nativeViewRequested.add(key);nativeViewLoading.add(key);});updateViewLabels();
      try{const counts=await adapter.loadMetrics(keys);if(generation!==viewGeneration)return;for(const key of Object.keys(counts))viewCounts[key]=Math.max(counts[key],viewCounts[key]||0);viewStatus='ready';}
      catch(_){if(generation!==viewGeneration)return;keys.forEach(key=>{delete viewCounts[key];});viewStatus='unavailable';}
      finally{if(generation===viewGeneration){keys.forEach(key=>nativeViewLoading.delete(key));updateViewLabels();scheduleDocumentView();}}
      return;
    }
    const sequence=++viewLoadSequence,generation=viewGeneration;
    try{const counts=live?await adapter.loadMetrics():await localViews.load(documents.filter(d=>!d.deletedAt).map(d=>d.id));if(sequence!==viewLoadSequence||generation!==viewGeneration)return;for(const key of Object.keys(counts))counts[key]=Math.max(counts[key],viewCounts[key]||0);viewCounts=counts;viewStatus='ready';}
    catch(_){if(sequence!==viewLoadSequence||generation!==viewGeneration)return;viewCounts=Object.create(null);viewStatus='unavailable';}
    const r=route();if(!editor&&!modal&&(!live||discoveryOptions().view!=='published')&&(r.path==='/results'||r.path.startsWith('/topic/'))&&['most-viewed','least-viewed'].includes(r.params.get('sort')))render();else{updateViewLabels();scheduleDocumentView();}
  }
  function currentReadableDocument(){
    if(!/^\/(document|article)\//.test(route().path))return null;
    const selected=selectedDocument(),published=selected.doc&&workflow.publishedVersion(selected.doc);
    return selected.tab==='content'&&published&&selected.v?.version===published.version&&selected.v?.revision===published.revision?selected:null;
  }
  function scheduleDocumentView(){
    clearTimeout(viewTimer);viewTimer=null;
    if(document.visibilityState==='hidden'){viewVisit=null;return;}
    const selected=currentReadableDocument();
    if(!selected){viewVisit=null;return;}
    const {doc,v}=selected,key=[actorId,doc.id,v.version,v.revision].join('|');
    if(viewVisit?.key!==key)viewVisit={key,generation:viewGeneration,documentKey:doc.id,version:v.version,revision:v.revision,viewerKey:actorId,requestId:nativeMetricsMode?undefined:crypto.randomUUID(),attempts:0,pending:false,done:false};
    if(document.visibilityState==='hidden'||!nativeMetricsMode&&viewStatus!=='ready'||viewVisit.pending||viewVisit.done||viewVisit.attempts>=(nativeMetricsMode?1:2)||nativeMetricsMode&&!Number.isSafeInteger(viewCounts[doc.id]))return;
    const visit=viewVisit;
    viewTimer=setTimeout(async()=>{
      const current=currentReadableDocument();if(viewVisit!==visit||document.visibilityState==='hidden'||!current||actorId!==visit.viewerKey||current.doc.id!==visit.documentKey||current.v.version!==visit.version||current.v.revision!==visit.revision)return;
      visit.pending=true;visit.attempts++;
      try{
        const result=live?await adapter.recordView({documentKey:visit.documentKey,version:visit.version,revision:visit.revision,requestId:visit.requestId}):await localViews.record({documentKey:visit.documentKey,viewerKey:visit.viewerKey,requestId:visit.requestId});
        visit.done=true;
        if(visit.generation!==viewGeneration||!documents.some(d=>d.id===visit.documentKey&&workflow.publishedVersion(d)))return;
        viewCounts[visit.documentKey]=Math.max(viewCounts[visit.documentKey]||0,result.views);
        // Re-sort a visible results list, but never interrupt an editor/dialog.
        const currentRoute=route();
        if(!editor&&!modal&&(currentRoute.path==='/results'||currentRoute.path.startsWith('/topic/'))&&['most-viewed','least-viewed'].includes(currentRoute.params.get('sort')))render();else updateViewLabels();
      }catch(_){if(nativeMetricsMode&&visit.generation===viewGeneration){nativeViewFailures.add(visit.documentKey);updateViewLabels();}else if(viewVisit===visit&&visit.attempts>=2){delete viewCounts[visit.documentKey];updateViewLabels();}}
      finally{visit.pending=false;if(viewVisit===visit&&!visit.done&&visit.attempts<(nativeMetricsMode?1:2))scheduleDocumentView();}
    },2000);
  }
  function wordmark() {
    const logo=config.brandLogoUrl||(!live?'assets/wcspedia-logo.png':'');
    return '<a class="discovery-brand" href="#/" aria-label="WCSpedia home">'+(logo?'<img class="discovery-brand-logo" src="'+esc(logo)+'" width="112" height="112" alt="" decoding="async">':'')+'<span class="discovery-brand-copy"><span class="discovery-wordmark">WCS<span>pedia</span></span><span class="discovery-brand-motto">Learn. Share. Grow.</span></span></a><div class="discovery-brand-label">Wealth Credit Services knowledge base</div>';
  }
  function discoveryHero(title,intro) {
    return '<section class="discovery-hero page-panel">'+wordmark()+'<h1>'+title+'</h1><p class="discovery-intro">'+intro+'</p>'+bigSearch()+'</section>';
  }
  function bigSearch(query='',mode='global') { return '<div class="discovery-search-wrap"><form class="discovery-search" data-search="'+mode+'" role="search">'+icon('search')+'<label class="sr-only" for="knowledge-query">Search WCSpedia</label><input id="knowledge-query" data-suggest name="q" type="search" autocomplete="off" aria-controls="search-suggestions" aria-describedby="suggestion-status" maxlength="500" placeholder="Find a document…" value="'+esc(query)+'"><button class="discovery-search-clear" type="button" data-clear-search aria-label="Clear search" title="Clear search"'+(query?'':' hidden')+'>'+icon('close')+'</button><span class="wcs-search-spinner" data-search-loading hidden aria-hidden="true"></span><kbd aria-hidden="true">⌘ K</kbd><button class="button" type="submit">Search '+icon('arrow')+'</button></form><div class="discovery-suggestions" id="search-suggestions" aria-label="Suggested documents" hidden></div><span class="sr-only" id="suggestion-status" role="status"></span></div>'; }
  function areaCard(a) {
    const count=live?null:publishedDocs().filter(d=>d.area===a.id).length;
    return '<a class="discovery-area" href="'+url('/topic/'+a.id)+'"><span class="discovery-area-icon">'+icon(a.icon)+'</span><h3>'+esc(a.title)+'</h3><p>'+esc(a.description)+'</p><span class="area-count"'+(live?' data-native-area-count="'+esc(a.id)+'"':'')+'>'+esc(live?nativeAreaCount(a.id):count+' document'+(count!==1?'s':''))+'</span><span class="corner-arrow">'+icon('arrow')+'</span></a>';
  }
  function nativeAreaCount(id) {
    const item=nativeLanding.areas[id],count=item?.total;
    if(!item&&['idle','loading'].includes(nativeLanding.status))return 'Loading documents…';
    if(item?.error)return 'Count unavailable';
    return Number.isSafeInteger(count)&&count>=0?count+' document'+(count===1?'':'s'):'Browse documents';
  }
  function nativeFeaturedCard(item) {
    const type=item.type||'Confluence page',areaName=area(item.category)?.title||'Wealth Credit Services';
    const media='<div class="feature-cover feature-cover-placeholder type-'+slug(type)+'" aria-hidden="true"><span>'+icon(type==='Training'?'book':type==='Blog'?'users':'file')+'</span><i></i><i></i></div>';
    return '<article class="featured-document"><a class="feature-media" tabindex="-1" aria-hidden="true" href="'+esc(item.url)+'">'+media+'</a><div class="feature-body"><div class="feature-area">'+esc(typeUI.typeLabel(type))+' · '+esc(areaName)+'</div><h3><a href="'+esc(item.url)+'">'+esc(item.title)+'</a></h3>'+(item.summary?'<p>'+esc(item.summary)+'</p>':'')+'<div class="feature-bottom"><span>'+(item.updated&&Number.isFinite(Date.parse(item.updated))?'Updated '+date(item.updated):'Update date unavailable')+'</span><a class="circle-link" href="'+esc(item.url)+'" aria-label="Read '+esc(item.title)+'">'+icon('arrow')+'</a></div></div></article>';
  }
  function transientReadFailure(error) {
    return ['NETWORK','TIMEOUT','SEARCH_TIMEOUT'].includes(error?.code)||[408,429,500,502,503,504].includes(error?.status);
  }
  function nativeLandingMessage() {
    if(!nativeLanding.recentReady&&['idle','loading'].includes(nativeLanding.status))return '<p class="quiet-note" role="status">Loading the latest documents…</p>';
    const error=nativeLanding.error||nativeLanding.recentError;
    if(error)return (nativeLanding.recent.length?'<div class="featured-grid">'+nativeLanding.recent.map(nativeFeaturedCard).join('')+'</div>':'')+'<div class="library-unavailable" role="alert"><strong>'+ (nativeLanding.recent.length?'Showing previously loaded documents. Refresh unavailable.':'Latest documents are unavailable')+'</strong><p>'+esc(error.message||'Unable to load child pages from Confluence.')+'</p><button class="button secondary" data-action="retry-native-landing">Try again</button></div>';
    if(!nativeLanding.recentReady)return '<p class="quiet-note">Search or browse a business area to find documents.</p><button class="button secondary" data-action="retry-native-landing">Load latest documents</button>';
    return nativeLanding.recent.length?'<div class="featured-grid">'+nativeLanding.recent.map(nativeFeaturedCard).join('')+'</div>':'<p class="quiet-note" role="status">No documents are available yet. Pages beneath WCSpedia will appear here when you have access to them and Confluence has indexed them.</p>';
  }
  function nativeAreaStatus() {
    if(nativeLanding.status!=='ready'||nativeLanding.error||!nativeLanding.countsError&&!data.areas.some(a=>nativeLanding.areas[a.id]?.error))return '';
    return '<div class="library-unavailable" role="alert"><p>Some business-area document counts could not be loaded. Check the business-area page settings and your access.</p><button class="button secondary" data-action="retry-native-landing">Try again</button></div>';
  }
  function updateNativeLanding() {
    const mount=root.querySelector('#native-landing-documents');if(!mount)return;
    const busy=['idle','loading'].includes(nativeLanding.status);
    root.querySelectorAll('[data-native-area-count]').forEach(node=>{
      const id=node.dataset.nativeAreaCount;node.textContent=nativeAreaCount(id);node.setAttribute('aria-busy',String(busy&&!nativeLanding.areas[id]));
      const message=nativeLanding.areas[id]?.error?.message;
      if(message)node.title=message;else node.removeAttribute('title');
    });
    mount.setAttribute('aria-busy',String(busy&&!nativeLanding.recentReady));
    const markup=nativeLandingMessage();
    if(nativeLandingMarkup.get(mount)!==markup){mount.innerHTML=markup;nativeLandingMarkup.set(mount,markup);}
    const status=root.querySelector('#native-landing-area-status');if(status)status.innerHTML=nativeAreaStatus();
  }
  function cancelNativeLanding(reset=false,pause=false) {
    landingController?.abort();landingController=null;landingSequence++;
    if(reset)nativeLanding={status:'idle',areas:{},recent:[]};
    else if(nativeLanding.status==='loading')nativeLanding={...nativeLanding,status:'ready',at:nativeLanding.at||Date.now()};
    // Typing pauses optional work on this visit. Returning to a landing whose
    // latest list never arrived should resume it instead of retaining a pause.
    if(!reset&&!pause&&nativeLanding.status==='ready'&&!nativeLanding.recentReady&&!nativeLanding.error&&!nativeLanding.recentError)nativeLanding={...nativeLanding,status:'idle'};
  }
  async function loadNativeLanding(force=false) {
    if(!live||!root.querySelector('#native-landing-documents'))return;
    if(!force&&(nativeLanding.status==='loading'||nativeLanding.status==='ready'&&Date.now()-nativeLanding.at<nativeBrowseTTL))return;
    landingController?.abort();const controller=new AbortController(),sequence=++landingSequence;landingController=controller;
    const retained=nativeLanding;
    nativeLanding={status:'loading',areas:retained?.areas||{},recent:retained?.recent||[],recentReady:retained?.recentReady===true,at:retained?.at||Date.now()};updateNativeLanding();
    const warmedAreas=new Set();
    const current=()=>sequence===landingSequence&&!controller.signal.aborted&&!!root.querySelector('#native-landing-documents');
    const accept=(result,complete=false)=>{
      if(!current())return;
      const recentReady=complete||result.recentReady===true;
      const keepRecent=result.recentError&&transientReadFailure(result.recentError);
      nativeLanding={status:complete?'ready':'loading',areas:{...nativeLanding.areas,...result.areas},recent:recentReady&&!keepRecent?result.recent||[]:nativeLanding.recent,recentError:result.recentError,recentReady:recentReady||nativeLanding.recentReady,at:complete?Date.now():nativeLanding.at};
      Object.entries(result.areas||{}).forEach(([areaId,item])=>{
        // Progress snapshots include previously completed areas again. Their
        // cloned rows must not extend the original response's freshness window.
        if(!warmedAreas.has(areaId)&&!item.error&&Array.isArray(item.searchResult?.results)){
          warmedAreas.add(areaId);rememberNativeBrowse({...nativeSearchDefaults(),area:areaId,limit:6,start:0},item.searchResult);
        }
      });
      updateNativeLanding();
    };
    try{
      if(typeof adapter.loadLanding!=='function')throw new Error('Update the landing-page scripts to load native Confluence documents.');
      const result=await adapter.loadLanding({signal:controller.signal,revalidateSession:force,areaIds:data.areas.map(a=>a.id),onUpdate:result=>accept(result,result.complete===true)});
      if(!current())return;
      accept(result,true);
    }catch(error){
      if(!current())return;
      const detail={code:error.code,status:error.status,message:error.message};
      nativeLanding={...(transientReadFailure(error)?nativeLanding:{areas:{},recent:[],recentReady:false}),status:'ready',at:Date.now(),error:detail};
    }finally{
      if(current()){landingController=null;updateNativeLanding();}
    }
  }
  function featuredCard({d,v}) {
    let cover=null;try{if(v.cover)cover=window.WCSEditorContent.validateCover(v.cover);}catch(_){}
    const destination=docUrl(d.id,'content',v.version);
    const media=cover?'<img class="feature-cover" loading="lazy" src="'+esc(cover.src)+'" alt="'+esc(cover.alt)+'">':'<div class="feature-cover feature-cover-placeholder type-'+slug(d.type)+'" aria-hidden="true"><span>'+icon(d.type==='Training'?'book':d.type==='Blog'?'users':'file')+'</span><i></i><i></i></div>';
    return '<article class="featured-document"><a class="feature-media" tabindex="-1" aria-hidden="true" href="'+destination+'">'+media+'</a><div class="feature-body"><div class="feature-area">'+esc(typeUI.typeLabel(d.type))+' · '+esc((v.processes||[])[0]||area(d.area)?.title||'Wealth Credit Services')+'</div><h3><a href="'+destination+'">'+esc(v.title)+'</a></h3><p>'+esc(v.summary)+'</p><div class="feature-metrics">'+readingMarkup(v)+viewsMarkup(d)+'</div><div class="feature-bottom"><span>Approved '+date(v.approvedAt)+'</span><a class="circle-link" href="'+destination+'" aria-label="Read '+esc(v.title)+'">'+icon('arrow')+'</a></div></div></article>';
  }
  function landingFAQ() {
    const entries=[
      ['How do I find the right document?', 'Start with the search bar or choose a business area. Use Insights for guides, blogs, training and reports. Search results respect your Confluence access.'],
      ['Which content type should I choose?', 'Choose Job aid for work instructions that need review and approval. Use Guides for procedures, playbooks and checklists; Blogs for stories and updates; Training for courses and shared lessons; and Reports for reports, templates and reference information.'],
      ['What happens after I create a document?', 'Use the floating + button to open the editor. Job aids are saved as drafts in My Workspace, then submitted to the assigned reviewer and manager. Insights articles publish directly without that approval workflow, subject to your access.'],
      ['Where can I find my drafts and saved articles?', 'My Workspace contains your drafts, submissions and published content. Use the save action on an article to keep it in Saved items for later.'],
      ['How can I suggest a change or leave feedback?', 'Use Suggest an edit to send a proposed correction. Eligible articles also provide helpfulness feedback and a comments section when comments are enabled. Available actions depend on your Confluence permissions.']
    ];
    return '<section class="discovery-section wcs-home-faq" aria-labelledby="wcs-faq-heading"><div class="discovery-section-heading"><div><h2 id="wcs-faq-heading">Frequently asked questions</h2><p>A little help getting started with WCSpedia.</p></div></div>'+entries.map(([question,answer],index)=>'<div class="wcs-faq-item"><h3><button type="button" id="wcs-faq-question-'+index+'" data-action="toggle-faq" aria-expanded="false" aria-controls="wcs-faq-answer-'+index+'">'+esc(question)+icon('plus')+'</button></h3><div class="wcs-faq-answer" id="wcs-faq-answer-'+index+'" role="region" aria-labelledby="wcs-faq-question-'+index+'" aria-hidden="true" inert><div><p>'+esc(answer)+'</p></div></div></div>').join('')+'</section>';
  }
  function home() {
    const featured=live?[]:discoverRows({sort:'updated'}).slice(0,3);
    return '<div class="discovery">'+discoveryHero('A world of knowledge.<br><span>One place to find it.</span>','Your everyday resource for Wealth Credit Services. <br>Find the guidance you need to move forward with confidence.')+'<div class="discovery-container"><section class="discovery-section"><div class="discovery-section-heading"><div><h2>Find your starting point</h2><p>Knowledge organised around the work you do.</p></div><div class="discovery-section-links"><span class="area-total">'+data.areas.length+' business areas</span><a class="discovery-text-link" href="#/insights">Explore Insights '+icon('arrow')+'</a></div></div><div class="discovery-area-grid">'+data.areas.map(areaCard).join('')+'</div>'+(live?'<div id="native-landing-area-status">'+nativeAreaStatus()+'</div>':'')+'</section><section class="discovery-section featured-section"><div class="discovery-section-heading"><div><h2>The latest knowledge, at your fingertips</h2><p>New perspectives, learning, and practical guidance from our teams.</p></div><a class="discovery-text-link" href="'+url('/results',{sort:'updated'})+'">Explore all documents '+icon('arrow')+'</a></div>'+(live?'<div id="native-landing-documents" aria-live="polite" aria-busy="'+['idle','loading'].includes(nativeLanding.status)+'">'+nativeLandingMessage()+'</div>':'<div class="featured-grid">'+featured.map(featuredCard).join('')+'</div>')+'</section>'+landingFAQ()+'</div></div>';
  }
    const insightsTypes=typeUI.INSIGHT_TYPES;
  let insightsView=null,insightsController=null;
  let insightsState=null,insightsLimit=9;
  const insightsCache=new Map();
  function insightsFilter(){const p=route().params;return {type:insightsTypes.includes(p.get('type'))?typeUI.groupType(p.get('type')):'all',topic:p.get('topic')||'',q:p.get('q')||''};}
  function insightsKey(){return JSON.stringify([signedIdentity()?.userKey||'',signedIdentity()?.soeid||'',insightsFilter()]);}
  function localInsights(){return documents.flatMap(doc=>{const version=workflow.publishedVersion(doc);return !doc.deletedAt&&version?[{...version,id:doc.id,type:doc.type,area:doc.area,url:destination(docUrl(doc.id,'content',version.version)),updatedAt:version.sourceMetadata?.updatedAt||version.approvedAt||version.createdAt,author:person(doc.authorId).name}]:[];});}
  function insightsPage(){return '<div id="wcs-insights-content"></div>';}
  function paintInsights(){
    const host=root.querySelector('#wcs-insights-content');if(!host||route().path!=='/insights')return;
    const previousQuery=host.querySelector('#wcs-insights-query'),active=document.activeElement;
    const queryDraft=previousQuery?.value,queryFocused=previousQuery===active;
    const selection=queryFocused?[previousQuery.selectionStart,previousQuery.selectionEnd]:null;
    const focusedId=host.contains(active)?active.id:'';
    const topicFocused=host.contains(active)&&!!active.closest('.wcs-insights-topic-filter');
    insightsView?.destroy();window.WCSUI.destroy(host);
    const state=insightsState||{items:[],loading:live,error:'',next:null};
    host.innerHTML=window.WCSInsights.render({documents:live?state.items:localInsights(),areas:data.areas,baseUrl:location.href,filter:insightsFilter(),types:typeUI.INSIGHT_CHOICES,prefiltered:live,limit:live?Math.max(9,state.items.length):insightsLimit,complete:!live||!state.next,hasMore:live&&!!state.next,loading:!!state.loading,error:state.error||''});
    insightsView=window.WCSInsights.bind(host,{
      onFilter:filter=>{insightsLimit=9;go(url('/insights',{...filter,type:filter.type==='all'?'':filter.type}));},
      onMore:()=>{if(live)loadInsights(true);else{insightsLimit+=9;paintInsights();}},
      onRetry:()=>loadInsights(!!insightsState?.retryAppend)
    });
    window.WCSUI.enhance(host);
    wirePageLinks();
    const nextQuery=host.querySelector('#wcs-insights-query');
    if(previousQuery&&nextQuery){nextQuery.value=queryDraft;if(queryFocused){nextQuery.focus({preventScroll:true});if(selection[0]!=null)try{nextQuery.setSelectionRange(...selection);}catch(_){}}}
    if(!queryFocused&&focusedId){const nextFocus=document.getElementById(focusedId);if(nextFocus&&host.contains(nextFocus))nextFocus.focus({preventScroll:true});}
    if(topicFocused)host.querySelector('.wcs-insights-topic-filter .wcs-ui-select-trigger')?.focus({preventScroll:true});
  }
  function stopInsights(){insightsController?.abort();insightsController=null;insightsView?.destroy();insightsView=null;}
  async function loadInsights(append=false){
    if(!live){paintInsights();return;}
    if(insightsController||route().path!=='/insights')return;
    const key=insightsKey(),cached=insightsCache.get(key);
    if(!append&&cached&&cached.state.items.length&&Date.now()-cached.at<nativeBrowseTTL){insightsState={...cached.state,loading:false,error:''};paintInsights();return;}
    const prior=insightsState?.key===key?insightsState:{key,items:[],next:null};
    if(append&&!prior.next)return;
    const controller=new AbortController();insightsController=controller;
    insightsState={...prior,key,loading:true,error:'',retryAppend:append};paintInsights();
    const filter=insightsFilter();
    try{
      const result=await adapter.searchPages({scope:'tree',insights:true,nativeChildren:filter.type==='all'&&!filter.q&&!filter.topic,types:filter.type==='all'?insightsTypes:typeUI.typeMembers(filter.type),query:filter.q,tag:filter.topic,sort:'updated',limit:9,...(append?{continuation:prior.next}:{start:0}),signal:controller.signal});
      if(controller.signal.aborted||key!==insightsKey()||route().path!=='/insights')return;
      // CQL may match the article body. Never repeat that search against a
      // short excerpt or discard a valid result because it has no summary.
      if(result.results.some(item=>!insightsTypes.includes(item.type)))throw Error('Confluence omitted the Insights content type. Check the article type labels and try again.');
      const covers=new Map(documents.flatMap(doc=>{const published=workflow.publishedVersion(doc),id=doc.publishedConfluencePageId||doc.confluencePageId,version=doc.publishedConfluencePageVersion||doc.confluencePageVersion;return !doc.deletedAt&&published?.cover&&id&&Number.isSafeInteger(version)?[[String(id),{version,cover:published.cover}]]:[];}));
      const byId=new Map((append?prior.items:[]).map(item=>[item.id,item]));
      result.results.forEach(item=>{const known=covers.get(item.id);byId.set(item.id,known&&known.version===item.version?{...item,cover:known.cover}:item);});
      insightsState={key,items:Array.from(byId.values()),next:result.nextContinuation,loading:false,error:'',retryAppend:false};
      insightsCache.set(key,{at:Date.now(),state:insightsState});while(insightsCache.size>12)insightsCache.delete(insightsCache.keys().next().value);
    }catch(error){if(!controller.signal.aborted&&key===insightsKey())insightsState={...prior,key,loading:false,error:error.message||'Insights could not be loaded.',retryAppend:append};}
    finally{if(insightsController===controller){insightsController=null;paintInsights();}}
  }
  function highlight(text,query) {
    const str=String(text),tokens=[...new Set(String(query).toLowerCase().split(/\s+/).filter(Boolean))].sort((a,b)=>b.length-a.length);
    if(!tokens.length)return esc(str);let out='',cursor=0;
    while(cursor<str.length){let next=-1,match='';for(const token of tokens){const i=str.toLowerCase().indexOf(token,cursor);if(i>=0&&(next<0||i<next)){next=i;match=token;}}if(next<0){out+=esc(str.slice(cursor));break;}out+=esc(str.slice(cursor,next))+'<mark>'+esc(str.slice(next,next+match.length))+'</mark>';cursor=next+match.length;}return out;
  }
  function resultCard({d,v},q='') {
    const target=discoveryOptions().view==='mine'&&canManage(d)?url('/review/'+d.id):docUrl(d.id,'content',v.version);
    return '<article class="press-card"><div class="press-card-main"><div class="press-card-kicker"><span>'+esc(typeUI.typeLabel(d.type))+'</span><span>'+esc(d.reference)+'</span>'+(v.status!=='Published'?badge(v.status):'')+'</div><h2><a href="'+target+'">'+highlight(v.title,q)+'</a></h2><p>'+highlight(v.summary,q)+'</p><div class="press-card-meta"><span>'+esc(area(d.area)?.title||'Wealth Credit Services')+'</span><span>'+(v.approvedAt?'Approved '+date(v.approvedAt):'Approval pending')+'</span><span>Owner: '+esc(person(d.ownerId).name)+'</span>'+readingMarkup(v)+viewsMarkup(d)+(library?.tag(d)||'')+'</div></div><a class="press-arrow" href="'+target+'" aria-label="Read '+esc(v.title)+'">'+icon('arrow')+'</a></article>';
  }
  function workspaceTable(rows,mode='mine') {
    return window.WCSWorkspaceTable.render({rows,mode,typeLabel:typeUI.typeLabel,documentHref:({d})=>url('/review/'+d.id),personName:id=>person(id).name,areaName:id=>area(id)?.title||'Wealth Credit Services',statusMarkup:badge,healthMarkup:d=>library?.tag(d)||'',readingMarkup,viewsMarkup,dateLabel:date,
      actionsMarkup:({d,v})=>{
        const allowed=actionsFor(d),editAction=allowed.includes('edit')?'edit':allowed.includes('revise')?'revise':null;
        return '<a class="button secondary compact" href="'+url('/review/'+d.id)+'">'+(mode==='review'?(v.status==='Awaiting approval'?'Review for approval':'Review document'):'Open')+'<span class="sr-only"> '+esc(v.title)+'</span></a>'+(editAction?'<button class="button secondary compact" data-action="'+editAction+'" data-document-id="'+esc(d.id)+'" aria-label="Edit '+esc(v.title)+'">Edit</button>':'')+(allowed.includes('delete')?'<button class="button danger compact" data-action="delete" data-document-id="'+esc(d.id)+'" aria-label="Delete '+esc(v.title)+'">Delete</button>':'');
      },empty:{title:mode==='review'?'You’re all caught up':'No matching documents',description:mode==='review'?'No documents at this stage need your review.':'Try another keyword or remove a filter.'}});
  }
  function resultsPage() {
    const options=discoveryOptions(),r=route(),p=r.params,topic=r.path.startsWith('/topic/')?area(options.area):null;
    if(live&&options.view==='published')return nativeResultsPage(options,topic);
    const status=p.get('status')||'', allRows=discoverRows(options).filter(({v})=>options.view!=='mine'||!status||v.status===status),year=p.get('year')||'',rows=allRows.filter(({v})=>!year||String(new Date(v.approvedAt||v.createdAt).getUTCFullYear())===year);
    const pageSize=6,pages=Math.max(1,Math.ceil(rows.length/pageSize)),page=Math.max(1,Math.min(pages,parseInt(p.get('page'),10)||1));
    const current=rows.slice((page-1)*pageSize,page*pageSize),link=changes=>url('/results',Object.assign({q:options.query,area:options.area,type:options.type,sort:options.sort,view:options.view,year,tag:options.tag,process:options.process,region:options.region,status},changes));
    const filter=(key,label,items,value)=>'<label class="press-filter"><span>'+label+'</span><select aria-label="'+label+'" data-filter="'+key+'"><option value="">All '+label.toLowerCase()+'s</option>'+items.map(i=>'<option value="'+esc(i.value)+'" '+(i.value===value?'selected':'')+'>'+esc(i.label)+'</option>').join('')+'</select></label>';
    const facetRows=discoverRows({view:options.view});
    const years=[...new Set(facetRows.map(({v})=>String(new Date(v.approvedAt||v.createdAt).getUTCFullYear())))].sort().reverse();
    const taxonomyValues=field=>[...new Set(facetRows.flatMap(({v})=>v[field]||[]))].sort().map(value=>({value,label:value}));
    const taxonomyFilters='<details class="taxonomy-filters" '+([options.tag,options.process,options.region].some(Boolean)?'open':'')+'><summary>Topics, processes & regions</summary><div>'+filter('tag','Topic',taxonomyValues('tags'),options.tag)+filter('process','Process',taxonomyValues('processes'),options.process)+filter('region','Region',taxonomyValues('regions'),options.region)+'</div></details>';
    const chips=[options.tag?{key:'tag',text:options.tag}:null,options.process?{key:'process',text:options.process}:null,options.region?{key:'region',text:options.region}:null,options.area?{key:'area',text:area(options.area)?.title||options.area}:null,options.type?{key:'type',text:options.type}:null,year?{key:'year',text:year}:null].filter(Boolean);
    const title=topic?topic.title:options.view==='mine'?'My workspace':options.query?'Search results':'Explore our knowledge';
    return '<div class="discovery '+(options.view==='mine'?'workspace-page':'')+'"><section class="press-heading page-panel"><div class="discovery-container"><nav class="breadcrumbs" aria-label="Breadcrumb"><a href="#/">WCSpedia</a>'+icon('chevron')+'<span>'+esc(topic?'Business area':options.view==='mine'?'My workspace':'Knowledge library')+'</span></nav><div class="results-title-row"><div><div class="eyebrow">'+(topic?'Business area':'Wealth Credit Services')+'</div><h1>'+esc(title)+'</h1><p>'+esc(topic?topic.description:options.view==='mine'?'Your drafts, submissions, and published knowledge.':'Practical guidance. Shared experience. Knowledge that moves us forward.')+'</p></div>'+'</div></div></section><div class="discovery-container">'+(options.view==='mine'?(library?.tabs('documents')||'')+myWorkspaceSummary(link,status):'')+'<div class="press-search-row">'+bigSearch(options.query,'library')+'<div class="press-filters" aria-label="Search filters"><span class="filter-caption">Filter by</span>'+filter('type','Content type',creationTypes.map(t=>({value:t,label:typeUI.typeLabel(t)})),options.type)+filter('area','Business area',data.areas.map(a=>({value:a.id,label:a.title})),options.area)+filter('year','Year',years.map(y=>({value:y,label:y})),year)+'<a class="reset-link" href="'+link({area:'',type:'',year:'',tag:'',process:'',region:'',status:'',page:1})+'">Reset</a></div></div>'+taxonomyFilters+'<section class="press-results" aria-label="Search results"><div class="discovery-results-toolbar"><p role="status"><strong>'+rows.length+'</strong> '+(rows.length===1?'result':'results')+(options.query?' for <strong>“'+esc(options.query)+'”</strong>':'')+'</p><label>Sort by <select aria-label="Sort results" data-filter="sort"><option value="relevance" '+(options.sort==='relevance'?'selected':'')+'>Most relevant</option><option value="updated" '+(['updated','recent'].includes(options.sort)?'selected':'')+'>Latest approved</option><option value="title" '+(options.sort==='title'?'selected':'')+'>Title A–Z</option>'+[['shortest','Shortest read'],['longest','Longest read'],['most-viewed','Most viewed'],['least-viewed','Least viewed']].filter(([value])=>!nativeMetricsMode||!['most-viewed','least-viewed'].includes(value)).map(([value,label])=>'<option value="'+value+'" '+(options.sort===value?'selected':'')+'>'+label+'</option>').join('')+'</select></label></div>'+(['most-viewed','least-viewed'].includes(options.sort)&&viewStatus!=='ready'?'<p class="metrics-status" role="status">'+(viewStatus==='loading'?'Loading view counts…':'View counts are unavailable. Results with no count appear last; their totals are not treated as zero.')+'</p>':'')+(chips.length?'<div class="discovery-chips">'+chips.map(c=>'<a href="'+link({[c.key]:'',page:1})+'" aria-label="Remove '+esc(c.text)+' filter">'+esc(c.text)+icon('close')+'</a>').join('')+'</div>':'')+(rows.length?(options.view==='mine'?workspaceTable(current):'<div class="press-card-list">'+current.map(row=>resultCard(row,options.query)).join('')+'</div>')+'<div class="discovery-pagination"><span>Showing '+((page-1)*pageSize+1)+'–'+Math.min(page*pageSize,rows.length)+' of '+rows.length+'</span>'+window.WCSPagination.render({totalPages:pages,currentPage:page,href:n=>link({page:n}),ariaLabel:'Document pages'})+'</div>':options.view==='mine'?workspaceTable([]):empty('No matching documents','Try another keyword or remove a filter.','Clear search',link({q:'',area:'',type:'',year:'',tag:'',process:'',region:''})))+'</section>'+(options.view==='mine'?'<div data-suggestion-inbox="mine"></div>':'')+'</div></div>';
  }
  function nativeSearchDefaults(){return {scope:'tree',query:'',area:'',type:'',tag:'',process:'',region:'',year:'',sort:'relevance'};}
  function nativeSearchOptions(options=discoveryOptions()) {
    return {scope:'tree',query:String(options.query||'').trim(),area:options.area||'',type:options.type||'',tag:options.tag||'',process:options.process||'',region:options.region||'',year:route().params.get('year')||'',sort:options.sort==='recent'?'updated':['updated','title'].includes(options.sort)?options.sort:'relevance'};
  }
  function nativeBrowseKey(options){
    const identity=session.identity||{};
    return JSON.stringify([identity.userKey||'',identity.soeid||'',actorId,...Object.keys(nativeSearchDefaults()).map(key=>options[key]||''),options.limit||6,options.start||0,options.continuation||null]);
  }
  function cachedNativeBrowse(options){
    const key=nativeBrowseKey(options),entry=nativeBrowseCache.get(key);
    if(!entry)return null;
    if(Date.now()-entry.at>=nativeBrowseTTL){nativeBrowseCache.delete(key);return null;}
    return entry.result;
  }
  function rememberNativeBrowse(options,result){
    if(!result||!Array.isArray(result.results))return;
    const key=nativeBrowseKey(options),existing=nativeBrowseCache.get(key);
    if(existing?.result===result)return;
    nativeBrowseCache.delete(key);nativeBrowseCache.set(key,{at:Date.now(),result});
    while(nativeBrowseCache.size>24)nativeBrowseCache.delete(nativeBrowseCache.keys().next().value);
  }
  function cancelNativePrefetch(){
    clearTimeout(nativePrefetchTimer);nativePrefetchTimer=null;
    nativePrefetch?.controller.abort();nativePrefetch=null;
  }
  function clearNativeBrowse(){
    insightsController?.abort();insightsController=null;insightsCache.clear();insightsState=null;
    adapter.invalidateSearch?.();
    cancelNativePrefetch();nativeBrowseCache.clear();nativePageLinks.clear();cancelNativeLanding(true);
  }
  function libraryNeeded(){
    const path=route().path;
    return !(live&&config.authoringMode==='confluence-session'&&(path==='/create'||path.startsWith('/edit/')||path==='/entitlements'));
  }
  function loadLibrary(reset=false,settings={}){
    if(!library||!libraryNeeded())return Promise.resolve();
    libraryStarted=true;return library.load(reset,{...settings,onBookmarks:()=>{
      if(route().path==='/saved'&&!editor&&!modal&&root.isConnected){
        const field=root.querySelector('[data-library-search="saved"] input[name="q"]');
        const typed=field?.value,focused=field===document.activeElement,selection=field?[field.selectionStart,field.selectionEnd]:null;
        render();
        const restored=root.querySelector('[data-library-search="saved"] input[name="q"]');
        if(restored&&typed!==undefined){restored.value=typed;if(focused){restored.focus({preventScroll:true});if(selection[0]!==null)restored.setSelectionRange(...selection);}}
      }
    }});
  }
  function loadFullSession(){
    if(!needsWorkspaceSession())return;
    const scope=requestedWorkspaceScope();
    if(fullSessionLoading?.scope===scope)return;
    cancelFullSession();
    const pending={controller:new AbortController(),scope};fullSessionLoading=pending;fullSessionError=null;
    Promise.resolve().then(()=>adapter.load({signal:pending.controller.signal,workspaceScope:pending.scope})).then(next=>{
      if(fullSessionLoading!==pending||pending.controller.signal.aborted)return;
      fullSessionLoading=null;refreshSession(next);
      const related=loadLibrary(true);
      if(!isNativeDiscoveryRoute())render();
      // Re-evaluate saved items and health against the newly authorized working
      // documents without replacing a draft or a user's discovery input.
      void related.then(()=>{if(!isNativeDiscoveryRoute()&&!editor&&!modal&&root.isConnected)render();},()=>{});
    },error=>{
      if(fullSessionLoading!==pending||pending.controller.signal.aborted)return;
      fullSessionLoading=null;fullSessionError=error;fullSessionErrorScope=pending.scope;
      if(!isNativeDiscoveryRoute())render();
    });
  }
  function cancelFullSession(){fullSessionLoading?.controller.abort();fullSessionLoading=null;fullSessionError=null;}
  async function fetchNativeBrowse(options,controller){
    const key=nativeBrowseKey(options),pending=nativePrefetch?.key===key?nativePrefetch:null;
    if(pending)nativePrefetch=null;else cancelNativePrefetch();
    // A matching prefetched request becomes the foreground request. Its abort
    // now belongs to that route, so leaving it cannot populate a stale cache.
    const abort=()=>pending?.controller.abort();
    if(pending)controller.signal.addEventListener('abort',abort,{once:true});
    try{
      const result=pending?await pending.promise:await adapter.searchPages({...options,signal:controller.signal});
      if(!controller.signal.aborted)rememberNativeBrowse(options,result);
      return result;
    }finally{controller.signal.removeEventListener('abort',abort);}
  }
  function prefetchNativeLink(event){
    if(!live||editor||modal||childSearchController)return;
    const anchor=event.target.closest?.('a[href]');if(!anchor||!root.contains(anchor))return;
    let target;try{target=new URL(anchor.href,location.href);}catch(_){return;}
    if(target.href.split('#')[0]!==location.href.split('#')[0])return;
    const [path,query='']=target.hash.slice(1).split('?'),params=new URLSearchParams(query);
    if(!(path.startsWith('/topic/')||path==='/results'&&['area','tag','process','region'].some(key=>params.get(key)))||params.get('q')||params.get('view')&&params.get('view')!=='published'||params.has('after')||Number(params.get('page')||1)!==1)return;
    const options={...nativeSearchDefaults(),area:path.startsWith('/topic/')?decodeSegment(path.split('/')[2]):params.get('area')||'',type:params.get('type')||'',tag:params.get('tag')||'',process:params.get('process')||'',region:params.get('region')||'',year:params.get('year')||'',sort:['updated','title'].includes(params.get('sort'))?params.get('sort'):'relevance',limit:6,start:0};
    const key=nativeBrowseKey(options);
    if(cachedNativeBrowse(options)||nativePrefetch?.key===key)return;
    cancelNativePrefetch();
    const start=()=>{
      nativePrefetchTimer=null;
      if(!anchor.isConnected||childSearchController)return;
      const controller=new AbortController(),pending={key,controller,promise:null};nativePrefetch=pending;
      pending.promise=Promise.resolve().then(()=>adapter.searchPages({...options,signal:controller.signal})).then(result=>{
        if(!controller.signal.aborted)rememberNativeBrowse(options,result);
        if(nativePrefetch===pending)nativePrefetch=null;
        return result;
      },error=>{if(nativePrefetch===pending)nativePrefetch=null;throw error;});
      // Speculative work never changes visible state or produces an unhandled
      // rejection. A later real click retries a failed prefetch normally.
      pending.promise.catch(()=>{});
    };
    if(event.type==='focusin')start();else nativePrefetchTimer=setTimeout(start,100);
  }
  function nativeSearchValues(options=nativeSearchOptions()) {
    return {q:options.query,area:options.area,type:options.type,tag:options.tag,process:options.process,region:options.region,year:options.year,sort:options.sort};
  }
  function nativeResultsPage(options,topic) {
    const native=nativeSearchOptions(options),values=nativeSearchValues(native),link=changes=>url('/results',{...values,...changes});
    const filter=(key,label,items,value)=>'<label class="press-filter"><span>'+label+'</span><select aria-label="'+label+'" data-filter="'+key+'"><option value="">All '+label.toLowerCase()+'s</option>'+items.map(item=>'<option value="'+esc(item.value)+'" '+(item.value===value?'selected':'')+'>'+esc(item.label)+'</option>').join('')+'</select></label>';
    const versions=documents.map(doc=>workflow.publishedVersion(doc)).filter(Boolean);
    const years=[...new Set([native.year,...Array.from({length:11},(_,i)=>String(new Date().getUTCFullYear()-i)),...versions.map(v=>String(new Date(v.approvedAt||v.createdAt).getUTCFullYear()))].filter(value=>/^\d{4}$/.test(value)))].sort().reverse();
    const taxonomy=(field,selected)=>[...new Set([selected,...versions.flatMap(v=>v[field]||[])].filter(Boolean))].sort().map(value=>({value,label:value}));
    const chips=[['area',area(native.area)?.title||native.area],['type',native.type],['year',native.year],['tag',native.tag],['process',native.process],['region',native.region]].filter(([,value])=>value);
    return '<div class="discovery"><section class="press-heading page-panel"><div class="discovery-container"><nav class="breadcrumbs" aria-label="Breadcrumb"><a href="#/">WCSpedia</a>'+icon('chevron')+'<span>'+esc(topic?'Business area':'Knowledge library')+'</span></nav><div class="results-title-row"><div><div class="eyebrow">'+(topic?'Business area':'Wealth Credit Services')+'</div><h1>'+esc(topic?topic.title:native.query?'Search results':'Explore our knowledge')+'</h1><p>'+esc(topic?topic.description:'Practical guidance. Shared experience. Knowledge that moves us forward.')+'</p></div></div></div></section><div class="discovery-container"><div class="press-search-row">'+bigSearch(native.query,'library')+'<div class="press-filters" aria-label="Search filters"><span class="filter-caption">Filter by</span>'+filter('type','Content type',creationTypes.map(value=>({value,label:typeUI.typeLabel(value)})),native.type)+filter('area','Business area',data.areas.map(item=>({value:item.id,label:item.title})),native.area)+filter('year','Updated year',years.map(value=>({value,label:value})),native.year)+'<a class="reset-link" href="'+link({area:'',type:'',year:'',tag:'',process:'',region:''})+'">Reset</a></div></div><details class="taxonomy-filters" '+([native.tag,native.process,native.region].some(Boolean)?'open':'')+'><summary>Topics, processes & regions</summary><div>'+filter('tag','Topic',taxonomy('tags',native.tag),native.tag)+filter('process','Process',taxonomy('processes',native.process),native.process)+filter('region','Region',taxonomy('regions',native.region),native.region)+'</div></details><section class="press-results" aria-label="Search results"><div class="discovery-results-toolbar"><p id="native-search-count" role="status">Searching…</p><label>Sort by <select aria-label="Sort results" data-filter="sort">'+[['relevance','Most relevant'],['updated','Last updated'],['title','Title A–Z']].map(([value,label])=>'<option value="'+value+'" '+(native.sort===value?'selected':'')+'>'+label+'</option>').join('')+'</select></label></div>'+(chips.length?'<div class="discovery-chips">'+chips.map(([key,value])=>'<a href="'+link({[key]:''})+'" aria-label="Remove '+esc(value)+' filter">'+esc(value)+icon('close')+'</a>').join('')+'</div>':'')+'<div id="native-search-results" aria-live="polite" aria-busy="true"></div></section></div></div>';
  }
  function nativeResultCard(item,query) {
    return '<article class="press-card"><div class="press-card-main"><div class="press-card-kicker"><span>'+esc(item.type||'Confluence page')+'</span></div><h2><a href="'+esc(item.url)+'">'+highlight(item.title,query)+'</a></h2>'+(item.summary?'<p>'+highlight(item.summary,query)+'</p>':'')+'<div class="press-card-meta">'+(item.category?'<span>'+esc(area(item.category)?.title||item.category)+'</span>':'')+(item.updated?'<span>Updated '+date(item.updated)+'</span>':'')+'</div></div><a class="press-arrow" href="'+esc(item.url)+'" aria-label="Read '+esc(item.title)+'">'+icon('arrow')+'</a></article>';
  }
  async function loadNativeResults() {
    const mount=root.querySelector('#native-search-results'),count=root.querySelector('#native-search-count');if(!mount||!live)return;
    cancelChildSearch();
    const sequence=childSearchSequence,controller=new AbortController();childSearchController=controller;
    const key=location.hash,current=()=>sequence===childSearchSequence&&location.hash===key&&mount.isConnected;
    const options=nativeSearchOptions(),values=nativeSearchValues(options),params=route().params;
    const page=Math.max(1,Math.min(100000,parseInt(params.get('page'),10)||1)),limit=6,queryKey=JSON.stringify(values);
    mount.setAttribute('aria-busy','true');
    mount.innerHTML='';count.textContent='Searching…';setSearchBusy(true);
    const searchButton=root.querySelector('form[data-search] button[type=submit]');
    searchButton?.setAttribute('aria-busy','true');
    try {
      const raw=params.get('after');
      if(raw&&raw.length>16000)throw Error('This search page link is invalid. Start a new search.');
      const continuation=raw?JSON.parse(raw):undefined;
      const request={...options,limit,...(continuation?{continuation}:{start:(page-1)*limit})};
      const cached=cachedNativeBrowse(request);if(cached)cancelNativePrefetch();
      const result=cached||await fetchNativeBrowse(request,controller);
      if(!current())return;
      const items=result.results,first=Number.isSafeInteger(result.start)?result.start:null;
      count.innerHTML=(result.total==null?'Search results':'<strong>'+result.total+'</strong> '+(result.total===1?'result':'results'))+(options.query?' for <strong>“'+esc(options.query)+'”</strong>':'');
      const currentURL=url('/results',{...values,page,after:raw||''});
      nativePageLinks.set(queryKey+'|'+page,currentURL);
      while(nativePageLinks.size>64)nativePageLinks.delete(nativePageLinks.keys().next().value);
      const next=result.nextContinuation?url('/results',{...values,page:page+1,after:JSON.stringify(result.nextContinuation)}):null;
      const previous=page>1?(nativePageLinks.get(queryKey+'|'+(page-1))||url('/results',values)):null;
      const previousLabel=page>2&&!nativePageLinks.has(queryKey+'|'+(page-1))?'First page':'Previous page';
      const control=(href,label,kind,content)=>href?'<a class="wcs-page-control '+kind+'" href="'+esc(href)+'" aria-label="'+label+'">'+content+'</a>':'<span class="wcs-page-control '+kind+'" aria-disabled="true">'+content+'</span>';
      const paging='<div class="discovery-pagination"><span>'+(items.length?(first==null?items.length+' '+(items.length===1?'result':'results')+' on this page':'Showing '+(first+1)+'–'+(first+items.length)+(result.total!=null?' of '+result.total:'')):'No results on this page')+'</span><nav class="wcs-pagination" aria-label="Document pages">'+control(previous,previousLabel,'wcs-page-previous','<span aria-hidden="true">←</span><span class="wcs-page-direction">'+(previousLabel==='First page'?'First':'Previous')+'</span>')+'<ol class="wcs-page-numbers"><li><span class="wcs-page-control is-current" aria-current="page">'+page+'</span></li></ol>'+control(next,'Next page','wcs-page-next','<span class="wcs-page-direction">Next</span><span aria-hidden="true">→</span>')+'</nav></div>';
      mount.innerHTML=(items.length?'<div class="press-card-list">'+items.map(item=>nativeResultCard(item,options.query)).join('')+'</div>':empty('No matching pages','Try another keyword or remove a filter. Only pages you can access are included.','Search all WCSpedia',url('/results')))+(items.length||previous?paging:'');
      wirePageLinks(mount);
    }catch(error){
      if(current()&&!controller.signal.aborted){count.textContent='Search unavailable';mount.innerHTML='<div class="library-unavailable" role="alert"><strong>Unable to search Confluence</strong><p>'+esc(error.message)+'</p><button class="button secondary" data-action="retry-native-search">Try again</button><a class="button secondary" href="'+esc(url('/results',values))+'">Start from the first page</a></div>';wirePageLinks(mount);}
    }finally{if(current()){childSearchController=null;mount.removeAttribute('aria-busy');setSearchBusy(false);searchButton?.removeAttribute('aria-busy');}}
  }
  function myWorkspaceSummary(link,status){
    const rows=discoverRows({view:'mine'}),statuses=['Draft','Changes requested','In review','Awaiting approval','Published'];
    return '<div class="workspace-overview"><div><span>Your documents</span><strong>'+rows.length+'</strong></div><div><span>Ready to work on</span><strong>'+rows.filter(({v})=>['Draft','Changes requested'].includes(v.status)).length+'</strong></div><div><span>With your reviewer</span><strong>'+rows.filter(({v})=>['In review','Awaiting approval'].includes(v.status)).length+'</strong></div><div class="workspace-overview-note">'+icon('shield')+'<p>Every change follows the same review and approval process.</p></div></div><nav class="workspace-status-tabs" aria-label="Document status"><a class="'+(!status?'active':'')+'" '+(!status?'aria-current="page"':'')+' href="'+link({status:'',page:1})+'">All documents <span>'+rows.length+'</span></a>'+statuses.map(value=>'<a class="'+(status===value?'active':'')+'" '+(status===value?'aria-current="page"':'')+' href="'+link({status:value,page:1})+'">'+value+' <span>'+rows.filter(({v})=>v.status===value).length+'</span></a>').join('')+'</nav>';
  }
  function mountPageTools(){
    if(!window.WCSSuggestions)return;
    suggestionWidget=window.WCSSuggestions.mount({root,config,getActor:()=>({...actor(),id:actorId}),getContext:()=>{
      const r=route(),selected=/^\/(document|article|review)\//.test(r.path)?selectedDocument():{};
      return {title:selected.v?.title||root.querySelector('h1')?.textContent||'WCSpedia',url:location.href,documentId:selected.doc?.id,nativePageId:selected.v?.status==='Published'?(selected.doc?.publishedConfluencePageId||selected.doc?.confluencePageId):undefined,version:selected.v?.version,revision:selected.v?.revision,ownerId:selected.doc?.ownerId,reviewerId:selected.doc?.reviewerId,approverId:selected.doc?.approverId};
    },notify:toast,onChange:()=>suggestionInbox?.refresh()});
    const inbox=root.querySelector('[data-suggestion-inbox]');
    if(inbox)suggestionInbox=window.WCSSuggestions.mountInbox(inbox,{service:suggestionWidget.service,getActor:()=>({...actor(),id:actorId}),scope:inbox.dataset.suggestionInbox,notify:toast,onChange:()=>suggestionWidget?.refresh()});
  }
  function setSearchBusy(busy) {
    const form=root.querySelector('form[data-search]'),spinner=form?.querySelector('[data-search-loading]');
    if(spinner)spinner.hidden=!busy;
    const status=root.querySelector('#suggestion-status');if(!busy&&status?.textContent==='Searching WCSpedia…')status.textContent='';
    if(form) { if(busy)form.setAttribute('aria-busy','true');else form.removeAttribute('aria-busy'); }
  }
  function dismissSuggestions() {
    clearTimeout(suggestionTimer);suggestionTimer=null;
    suggestionSequence++;suggestionController?.abort();suggestionController=null;
    const mount=root.querySelector('#search-suggestions'),status=root.querySelector('#suggestion-status');
    if(mount){mount.hidden=true;mount.removeAttribute('aria-busy');}
    if(status)status.textContent='';
    setSearchBusy(!!childSearchController&&!childSearchController.signal.aborted);
  }
  function updateTypedResults(input) {
    const r=route(),params=Object.fromEntries(r.params);
    params.q=input.value.trim();delete params.page;delete params.after;
    // Replace only this view's result region: keep the input, caret, filters,
    // navbar and tools mounted. Typing does not add an entry per keystroke.
    history.replaceState(history.state,'',url(r.path,params));
    const template=document.createElement('template');template.innerHTML=resultsPage();
    const previous=root.querySelector('.press-results'),next=template.content.querySelector('.press-results');
    if(!previous||!next){setSearchBusy(false);return;}
    previous.replaceWith(next);
    const title=root.querySelector('.results-title-row h1'),nextTitle=template.content.querySelector('.results-title-row h1');
    if(title&&nextTitle)title.textContent=nextTitle.textContent;
    const reset=root.querySelector('.reset-link'),nextReset=template.content.querySelector('.reset-link');
    if(reset&&nextReset)reset.setAttribute('href',nextReset.getAttribute('href'));
    wirePageLinks(next);if(reset)wirePageLinks(reset.parentElement);
    if(live&&root.querySelector('#native-search-results'))loadNativeResults();else setSearchBusy(false);
  }
  function scheduleSuggestions(input) {
    dismissSuggestions();
    const path=route().path,results=path==='/results'||path.startsWith('/topic/');
    const query=input.value.trim();
    // A pending or displayed response for the exact current query is sufficient.
    if(results&&query===String(discoveryOptions().query||'').trim()&&!(root.querySelector('#native-search-results')?.getAttribute('aria-busy')==='true'&&!childSearchController))return;
    if(results){
      cancelChildSearch();
      const mount=root.querySelector('#native-search-results'),count=root.querySelector('#native-search-count');
      if(mount){mount.replaceChildren();mount.setAttribute('aria-busy','true');}
      if(count)count.textContent='Searching…';
    }else if(!query)return;
    if(live){
      cancelNativePrefetch();
      if(nativeLanding.status==='loading'){cancelNativeLanding(false,true);updateNativeLanding();}
    }
    setSearchBusy(true);
    const mount=root.querySelector('#search-suggestions'),status=root.querySelector('#suggestion-status');
    if(status)status.textContent='Searching WCSpedia…';
    if(!results&&mount){mount.innerHTML='<div class="wcs-search-progress" role="status">Searching…</div>';mount.setAttribute('aria-busy','true');mount.hidden=false;}
    suggestionTimer=setTimeout(()=>{
      suggestionTimer=null;
      if(!input.isConnected||!root.contains(input))return;
      if(results)updateTypedResults(input);
      else if(document.activeElement===input)showSuggestions(input);
      else dismissSuggestions();
    },150);
  }
  function cancelChildSearch() {
    childSearchSequence++;
    childSearchController?.abort();childSearchController=null;
  }
  function showSuggestions(input) {
    const mount=root.querySelector('#search-suggestions'),q=input.value.trim();if(!mount)return;
    if(!q){dismissSuggestions();return;}
    const options=route().path==='/results'||route().path.startsWith('/topic/')?discoveryOptions():{};
    if(live&&(!options.view||options.view==='published')){showNativeSuggestions(input,options);return;}
    const matches=discoverRows(Object.assign({},options,{query:q,sort:'relevance'})).slice(0,4);
    mount.innerHTML='<div class="suggestions-label">'+(matches.length?'Suggested documents':'Search all knowledge')+'</div>'+matches.map(({d,v})=>'<a href="'+docUrl(d.id,'content',v.version)+'">'+icon('file')+'<span>'+highlight(v.title,q)+'<small>'+esc(area(d.area)?.title)+'</small></span>'+icon('arrow')+'</a>').join('')+'<a class="suggestions-all" href="'+url('/results',{q,view:options.view,area:options.area,type:options.type})+'">Search for “'+esc(q)+'” '+icon('arrow')+'</a>';wirePageLinks(mount);mount.hidden=false;mount.removeAttribute('aria-busy');setSearchBusy(false);root.querySelector('#suggestion-status').textContent=matches.length+' suggested documents. Press the down arrow to explore.';
  }
  async function showNativeSuggestions(input,options) {
    const mount=root.querySelector('#search-suggestions'),status=root.querySelector('#suggestion-status'),query=input.value.trim();
    const controller=new AbortController(),sequence=++suggestionSequence;suggestionController=controller;
    const current=()=>sequence===suggestionSequence&&!controller.signal.aborted&&input.isConnected&&document.activeElement===input&&input.value.trim()===query;
    mount.setAttribute('aria-busy','true');status.textContent='Searching WCSpedia…';
    const native=nativeSearchOptions({...options,query}),request={...native,limit:6,start:0};
    const all='<a class="suggestions-all" href="'+esc(url('/results',nativeSearchValues(native)))+'">Search for “'+esc(query)+'” '+icon('arrow')+'</a>';
    try {
      // Use the results page's exact first-page request so submitting this
      // query can reuse authorized data instead of issuing a second search.
      const result=cachedNativeBrowse(request)||await fetchNativeBrowse(request,controller);
      if(!current())return;
      const matches=result.results.slice(0,4);
      mount.innerHTML='<div class="suggestions-label">'+(matches.length?'Suggested pages':'Search all WCSpedia')+'</div>'+matches.map(item=>'<a href="'+esc(item.url)+'">'+icon('file')+'<span>'+highlight(item.title,query)+(item.category?'<small>'+esc(area(item.category)?.title||item.category)+'</small>':'')+'</span>'+icon('arrow')+'</a>').join('')+all;
      status.textContent=matches.length+' suggested pages. Press the down arrow to explore.';
    }catch(error){
      if(!current()||controller.signal.aborted)return;
      mount.innerHTML='<div class="suggestions-label">Suggestions unavailable</div>'+all;status.textContent='Suggestions are unavailable. Submit your search to try again.';
    }finally{
      if(current()){suggestionController=null;mount.removeAttribute('aria-busy');setSearchBusy(false);wirePageLinks(mount);mount.hidden=false;}
    }
  }
  function selectedDocument() {
    const r=route(), id=decodeSegment(r.path.split('/')[2]||''), doc=documents.find(d=>d.id===id&&!d.deletedAt); if(!doc)return {};
    const managed=canManage(doc), versions=doc.versions.filter(v=>managed||v.status==='Published');
    const v=versions.find(v=>v.version===Number(r.params.get('version'))) || (r.path.startsWith('/review/')&&managed?workflow.currentVersion(doc):null) || workflow.publishedVersion(doc) || (managed?workflow.currentVersion(doc):null);
    let tab=r.params.get('tab')||'content'; if(!['content','approval','versions','audit','health'].includes(tab)||(!managed&&['approval','audit'].includes(tab))||(tab==='approval'&&window.WCSEditorContent.isInsightType(doc.type)))tab='content';
    return {doc,v,tab,managed,versions};
  }
  function meta(label,value,sub='') { return '<dl class="meta-block"><dt>'+label+'</dt><dd>'+value+(sub?'<small>'+esc(sub)+'</small>':'')+'</dd></dl>'; }
  function controls(doc,v) {
    const status=v.status==='Published'&&v.version!==doc.publishedVersion?'Superseded':v.status;
    if(window.WCSEditorContent.isInsightType(doc.type))return '<aside class="control-panel" aria-label="Article details"><div class="control-head"><h2>Article details</h2>'+icon('file')+'</div><div class="control-version">'+badge(status)+'<span>v'+v.version+' · r'+v.revision+'</span></div><div class="control-summary">'+meta('Author',who(doc.authorId))+meta('Destination','Insights')+meta('Published',v.publishedAt||v.approvedAt?date(v.publishedAt||v.approvedAt):'Not published')+'</div><p class="quiet-note">Edits publish directly to Insights.</p><div class="control-history-links"><a class="link" href="'+docUrl(doc.id,'versions',v.version)+'">Version history '+icon('arrow')+'</a>'+(canManage(doc)?'<a class="link" href="'+docUrl(doc.id,'audit',v.version)+'">Full audit trail '+icon('arrow')+'</a>':'')+'</div></aside>';
    return '<aside class="control-panel" aria-label="Document control"><div class="control-head"><h2>Document control</h2>'+icon('shield')+'</div><div class="control-version">'+badge(status)+'<span>v'+v.version+' · r'+v.revision+'</span></div><div class="control-summary">'+meta('Document owner',who(doc.ownerId))+meta('Approved by',v.approvedBy?who(v.approvedBy):'<span>Pending approval</span>',v.approvedBy?'Approved '+date(v.approvedAt):'Assigned to '+person(doc.approverId).name)+meta('Next review'+(v.governance?' · business target':''),v.governance?(v.version===doc.publishedVersion&&library?.report(doc)?.reviewTarget?date(library.report(doc).reviewTarget):v.nextReviewAt?date(v.nextReviewAt):'Set on approval'):(v.nextReviewAt?date(v.nextReviewAt):'Set on approval'))+'</div><details class="control-details"><summary><span class="control-expand-label">More control details</span><span class="control-collapse-label">Fewer control details</span>'+icon('chevron')+'</summary><div class="control-details-body">'+meta('Document key','<code class="document-key">'+esc(doc.id)+'</code>')+meta('Written by',who(doc.authorId))+meta('Reviewed by',v.reviewedBy?who(v.reviewedBy):'<span>Pending review</span>',v.reviewedBy?date(v.reviewedAt):'Assigned to '+person(doc.reviewerId).name)+meta('Effective from',v.effectiveAt?date(v.effectiveAt):'On approval')+'</div></details><div class="control-history-links"><a class="link" href="'+docUrl(doc.id,'versions',v.version)+'">Version history '+icon('arrow')+'</a>'+(canManage(doc)?'<a class="link" href="'+docUrl(doc.id,'audit',v.version)+'">Full audit trail '+icon('arrow')+'</a>':'')+'</div><p class="quiet-note">Control information applies to the version shown.</p></aside>';
  }
  function articleCover(v) {
    let cover=null;try{if(v.cover)cover=window.WCSEditorContent.validateCover(v.cover);}catch(_){}
    return cover?'<figure class="insights-cover"><img src="'+esc(cover.src)+'" alt="'+esc(cover.alt)+'">'+(cover.caption?'<figcaption>'+esc(cover.caption)+'</figcaption>':'')+'</figure>':'<div class="insights-art" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i><i></i><i></i></div>';
  }
  function keyHighlights(v) {
    const bullets=v.sections.flatMap(s=>s.bullets);
    const highlights=v.highlights?.length?v.highlights:bullets.length?bullets.slice(0,3):v.sections.slice(0,3).map(s=>s.paragraphs[0]?.split(/(?<=[.!?])\s/)[0]).filter(Boolean);
    return highlights.length?'<section class="key-highlights"><h2>Key highlights</h2><ul>'+highlights.map(t=>'<li>'+esc(t)+'</li>').join('')+'</ul></section>':'';
  }
  function documentPage() {
    const {doc,v,tab,managed}=selectedDocument();
    if(!doc||!v)return '<div class="discovery-container">'+empty('Document unavailable','This document is not available in your current view.','Back to library','#/')+'</div>';
    if(tab==='approval')return reviewPage();
    const a=area(doc.area),current=workflow.currentVersion(doc),published=workflow.publishedVersion(doc),action=actionsFor(doc).find(a=>['edit','revise'].includes(a));
    let notice='';
    if(managed&&current.version!==v.version&&current.status!=='Published')notice='<div class="version-notice">'+icon('file')+'<span>Version '+current.version+' is '+esc(current.status.toLowerCase())+'. You’re reading the approved version.</span><a class="link" href="'+url('/review/'+doc.id)+'">View working version '+icon('arrow')+'</a></div>';
    else if(v.status!=='Published')notice='<div class="version-notice warning">'+icon('clock')+'<span>Working version. '+(published?'Version '+published.version+' remains published.':'This content is not published to readers.')+'</span></div>';
    else if(published&&v.version!==published.version)notice='<div class="version-notice warning">'+icon('clock')+'<span>Historical version. Version '+published.version+' is current.</span><a class="link" href="'+docUrl(doc.id,'content',published.version)+'">Read current version '+icon('arrow')+'</a></div>';
    const related=window.WCSDiscovery.relatedDocuments(documents,doc,v,workflow,3);
    return '<div class="detail-page insights-page"><div class="discovery-container"><nav class="breadcrumbs" aria-label="Breadcrumb"><a href="#/">WCSpedia</a>'+icon('chevron')+'<a href="'+url('/results',{type:doc.type})+'">'+esc(typeUI.typeLabel(doc.type))+'</a>'+icon('chevron')+'<span>'+esc(doc.reference)+'</span></nav><section class="insights-header"><a class="insights-category" href="'+(doc.area==='insights'?url('/insights'):url('/topic/'+doc.area))+'">'+esc(doc.area==='insights'?'Insights':a?.title||'Wealth Credit Services')+'</a><h1>'+esc(v.title)+'</h1><div class="insights-byline"><span>'+esc(typeUI.typeLabel(doc.type))+'</span><span>•</span><span>'+ (v.publishedAt||v.approvedAt?date(v.publishedAt||v.approvedAt):'Draft · '+date(v.createdAt))+'</span><span>•</span>'+readingMarkup(v)+(workflow.publishedVersion(doc)?'<span>•</span>'+viewsMarkup(doc):'')+'</div></section>'+(tab==='content'?articleCover(v):'')+'<div class="article-utility"><div><div class="wcs-status-group">'+badge(v.status)+governanceUI.tag(v,doc)+(library?.tag(doc)||'')+'</div><span>By '+esc(person(doc.authorId).name)+'</span><span>Version '+v.version+' · revision '+v.revision+'</span></div><div class="heading-actions">'+(library?.bookmarkButton(doc)||'')+'<button class="button secondary compact" data-action="copy">'+icon('link')+'Copy link</button><button class="button secondary compact" data-action="copy-markdown">'+icon('file')+'Copy Markdown</button><button type="button" class="button secondary compact" data-wcs-export aria-haspopup="menu" aria-expanded="false">'+icon('download')+'Download</button>'+(action?'<button class="button secondary compact document-edit-action" data-action="'+action+'">'+icon('edit')+actionLabels[action]+'</button>':'')+(actionsFor(doc).includes('delete')?'<button class="button danger compact document-delete-action" data-action="delete">Delete document</button>':'')+'</div></div>'+notice+'<nav class="tabs" aria-label="Document sections">'+[['content','Article'],['health','Content health'],['versions','Version history'],...(managed?[['audit','Audit trail']]:[])].map(([key,label])=>'<a class="'+(tab===key?'active':'')+'" '+(tab===key?'aria-current="page"':'')+' href="'+docUrl(doc.id,key,v.version)+'">'+label+'</a>').join('')+'</nav><div class="detail-layout"><div class="detail-main">'+({content:()=>contentView(doc,v),versions:()=>versionsView(doc),audit:()=>auditView(doc),health:()=>'<div data-content-health="'+esc(doc.id)+'"></div>'}[tab])()+'</div>'+controls(doc,v)+'</div>'+(tab==='content'&&related.length?'<section class="insights-related"><div class="related-heading"><h2>Keep your knowledge growing.</h2><p>Related training, articles, and practical guidance.</p></div><div class="featured-grid">'+related.map(featuredCard).join('')+'</div></section>':'')+'</div></div>';
  }
  function sections(v) { if(v.bodyMarkdown)return '<div class="markdown-body">'+window.WCSEditorContent.render(v.bodyMarkdown,v)+'</div>';return v.sections.map(s=>'<section class="section" id="section-'+esc(s.id)+'"><h2>'+esc(s.title)+'</h2>'+s.paragraphs.map(p=>'<p>'+esc(p)+'</p>').join('')+(s.bullets.length?'<ul>'+s.bullets.map(b=>'<li>'+esc(b)+'</li>').join('')+'</ul>':'')+'</section>').join(''); }
  function taxonomyView(doc,v) {
    return '<div class="article-taxonomy"><div class="article-tags"><span>Content</span><a href="'+url('/results',{type:doc.type})+'">'+esc(typeUI.typeLabel(doc.type))+'</a><a href="'+(doc.area==='insights'?url('/insights'):url('/topic/'+doc.area))+'">'+esc(doc.area==='insights'?'Insights':area(doc.area)?.title||doc.area)+'</a></div>'+[['tags','Topics','tag'],['processes','Processes','process'],['regions','Regions','region']].map(([key,label,filter])=>(v[key]||[]).length?'<div class="article-tags"><span>'+label+'</span>'+v[key].map(t=>'<a href="'+url('/results',{[filter]:t})+'">'+esc(t)+'</a>').join('')+'</div>':'').join('')+'</div>';
  }
  function attachmentsView(v) {
    let files=[];try{files=window.WCSEditorContent.validateAttachments(v.attachments||[]);}catch(_){}
    return files.length?'<section class="article-attachments"><h2>Attachments & resources</h2><p>Files included with this document version.</p><div>'+files.map(file=>'<a href="'+esc(file.url)+'" download="'+esc(file.name)+'" rel="noopener noreferrer" '+(!file.url.startsWith('data:')?'target="_blank"':'')+'>'+icon('file')+'<span><strong>'+esc(file.name)+'</strong><small>'+esc(file.mimeType||'Document')+(file.size?' · '+(file.size<1048576?Math.ceil(file.size/1024)+' KB':(file.size/1048576).toFixed(1)+' MB'):'')+'</small></span>'+icon('download')+'</a>').join('')+'</div></section>':'';
  }
  function sourceMetadataView(v) {
    if(!v.sourceMetadata)return '';
    const value=window.WCSEditorContent.validateSourceMetadata(v.sourceMetadata);
    const rows=[['Source ID',value.sourceId],['Original created',value.originalCreatedAt||'Not recorded'],['Original updated',value.originalUpdatedAt||'Not recorded'],['Source author',value.sourceAuthor||'Not recorded'],['Source path',value.sourcePath||'Not recorded'],['Imported into WCSpedia',v.sourceImportedAt||'Recorded when saved']];
    return '<details class="document-note"><summary>Original document metadata</summary><dl class="wcs-governance-metadata">'+rows.map(([label,text])=>'<div><dt>'+esc(label)+'</dt><dd>'+esc(text)+'</dd></div>').join('')+'</dl><p>Original source dates are separate from Confluence history and review/approval dates.</p></details>';
  }
  function contentView(doc,v) {
    return '<article class="document-body">'+keyHighlights(v)+'<p class="article-lead">'+esc(v.summary)+'</p>'+sections(v)+attachmentsView(v)+(data.isDemo?'<div class="document-note">Illustrative sample content for prototype review.</div>':'')+taxonomyView(doc,v)+sourceMetadataView(v)+'</article>';
  }
  function reviewQueue() {
    if(actor().role==='Reader')return '<div class="discovery-container">'+empty('Your reading workspace','Review tasks are available to assigned reviewers.','Explore knowledge','#/results')+'</div>';
    const p=route().params,query=(p.get('q')||'').trim(),pending=discoverRows({view:'review',query}).filter(({d})=>d.type==='Job aid'),stage=p.get('stage')||'',rows=pending.filter(({v})=>!stage||v.status===stage),pageSize=10,pages=Math.max(1,Math.ceil(rows.length/pageSize)),page=Math.max(1,Math.min(pages,parseInt(p.get('page'),10)||1)),current=rows.slice((page-1)*pageSize,page*pageSize);
    return '<div class="workspace-page reviewer-workspace"><section class="press-heading page-panel"><div class="discovery-container"><nav class="breadcrumbs"><a href="#/">WCSpedia</a>'+icon('chevron')+'<span>Reviewer workspace</span></nav><h1>Reviewer workspace</h1><p>Documents waiting for your review or approval.</p></div></section><div class="discovery-container review-container"><div class="panel-heading"><div><h2>Pending decisions</h2></div><label class="press-filter"><span>Stage</span><select aria-label="Review stage" data-review-stage><option value="">All pending</option><option value="In review" '+(stage==='In review'?'selected':'')+'>Content review</option><option value="Awaiting approval" '+(stage==='Awaiting approval'?'selected':'')+'>Manager approval</option></select></label></div><form class="wcs-data-table-search" data-review-search><label class="sr-only" for="review-query">Search review queue</label><input id="review-query" name="q" type="search" maxlength="500" placeholder="Search assigned documents" value="'+esc(query)+'"><button class="button" type="submit">Search</button>'+(query?'<a class="link" href="'+url('/review',{stage})+'">Clear</a>':'')+'</form><div class="review-queue">'+workspaceTable(current,'review')+(rows.length?'<div class="discovery-pagination"><span>Showing '+((page-1)*pageSize+1)+'–'+Math.min(page*pageSize,rows.length)+' of '+rows.length+'</span>'+window.WCSPagination.render({totalPages:pages,currentPage:page,href:n=>url('/review',{stage,q:query,page:n}),ariaLabel:'Review pages'})+'</div>':'')+'</div><div class="review-guidance">'+icon('shield')+'<p>Review and approval are separate recorded decisions. Readers see the last approved version.</p></div><div data-suggestion-inbox="review"></div></div></div>';
  }
  function coverDescription(cover){return cover?[(cover.src.startsWith('data:')?'Uploaded image ('+Math.ceil(cover.src.length*.75/1024)+' KB)':cover.src),cover.alt,cover.caption].filter(Boolean).join(' · '):'';}
  function describeMetadata(values){return JSON.stringify(values||[],(key,value)=>typeof value==='string'&&value.startsWith('data:')?'Embedded file ('+Math.ceil(value.length*.75/1024)+' KB)':value);}
  function revisionChanges(doc,v) {
    const previous=doc.versions.find(x=>x.version===v.version-1);
    if(!previous)return '<div class="review-comment"><strong>First version</strong><p>Review the full document before its first publication.</p></div>';
    const fields=[['Title',previous.title,v.title],['Summary',previous.summary,v.summary],['Slug',previous.slug||'',v.slug||''],['Key highlights',(previous.highlights||[]).join('\n'),(v.highlights||[]).join('\n')],['Cover image',coverDescription(previous.cover),coverDescription(v.cover),JSON.stringify(previous.cover||null)!==JSON.stringify(v.cover||null)],...['tags','processes','regions','attachments','assets','governance','sourceMetadata'].map(key=>[key,describeMetadata(previous[key]),describeMetadata(v[key]),JSON.stringify(previous[key]||[])!==JSON.stringify(v[key]||[])]),['Body formatting',previous.bodyMarkdown||'',v.bodyMarkdown||''],...v.sections.map(s=>{const before=previous.sections.find(x=>x.id===s.id);return [s.title,before?[before.title,...before.paragraphs,...before.bullets].join('\n'):'',[s.title,...s.paragraphs,...s.bullets].join('\n')];}),...previous.sections.filter(s=>!v.sections.some(x=>x.id===s.id)).map(s=>[s.title,[s.title,...s.paragraphs,...s.bullets].join('\n'),''])].filter(([,before,after,changed])=>changed||before!==after).map(([label,before,after,changed])=>[label,before,changed&&before===after?after+' · File content replaced; metadata unchanged.':after]);
    return '<details class="revision-comparison"><summary>'+fields.length+' content change'+(fields.length===1?'':'s')+' since version '+previous.version+'</summary>'+fields.map(([title,before,after])=>'<section><h3>'+esc(title)+'</h3><div class="comparison-columns"><div><span>Previous version</span><p>'+esc(before||'Not present')+'</p></div><div><span>Submitted revision</span><p>'+esc(after||'Removed')+'</p></div></div></section>').join('')+'</details>';
  }
  function reviewPage() {
    const {doc,managed}=selectedDocument();
    if(!doc||!managed)return '<div class="discovery-container">'+empty('Review unavailable','This review is available to the document’s assigned team.','Back to knowledge','#/results')+'</div>';
    if(window.WCSEditorContent.isInsightType(doc.type))return documentPage();
    const v=workflow.currentVersion(doc),published=workflow.publishedVersion(doc);
    return '<section class="article-heading review-heading page-panel"><div class="discovery-container"><nav class="breadcrumbs"><a href="#/">WCSpedia</a>'+icon('chevron')+'<a href="#/review">Reviewer workspace</a>'+icon('chevron')+'<span>'+esc(doc.reference)+'</span></nav><div class="doc-kicker"><span>'+esc(typeUI.typeLabel(doc.type))+'</span><span>Version '+v.version+' · revision '+v.revision+'</span>'+badge(v.status)+'</div><h1>'+esc(v.title)+'</h1><p class="article-summary">'+esc(v.summary)+'</p><div class="article-byline"><span>Written by '+esc(person(doc.authorId).name)+'</span><span>Owned by '+esc(person(doc.ownerId).name)+'</span></div></div></section><div class="discovery-container review-container"><div class="version-notice">'+icon('shield')+'<span>'+(published?'Readers currently see approved version '+published.version+'.':'This document will become visible to readers after manager approval.')+'</span>'+(published?'<a class="link" href="'+docUrl(doc.id,'content',published.version)+'">View published '+icon('arrow')+'</a>':'')+'</div><div class="review-layout"><section class="review-content"><div class="panel-heading"><div><h2>'+(['Draft','Changes requested'].includes(v.status)?'Working content':'Submitted content')+'</h2><p>'+esc(v.changeSummary)+'</p></div><a class="discovery-text-link" href="'+docUrl(doc.id,'audit',v.version)+'">Audit trail '+icon('arrow')+'</a></div>'+revisionChanges(doc,v)+governanceUI.summary(doc,v)+'<article class="document-body">'+(v.cover?articleCover(v):'')+(v.highlights?.length?keyHighlights(v):'')+sections(v)+attachmentsView(v)+taxonomyView(doc,v)+'</article></section><aside class="review-decision" aria-label="Review decision">'+approvalView(doc,v)+'</aside></div></div>';
  }
  function approvalView(doc,v) {
    const latest=workflow.currentVersion(doc), actions=v.version===latest.version?actionsFor(doc):[];
    const isReview=v.status==='In review', isApproval=v.status==='Awaiting approval';
    const latestReturn=doc.audit.filter(e=>e.version===v.version&&(e.action==='request-changes'||e.toStatus==='Changes requested')).at(-1);
    const step=(num,title,desc,id,at,done,active)=>'<div class="process-step '+(done?'done':active?'current':'')+'"><div class="process-dot">'+(done?icon('check'):num)+'</div><div class="process-copy"><strong>'+title+(at?'<time>'+date(at)+'</time>':'')+'</strong><p>'+desc+'</p>'+who(id)+'</div></div>';
    const notes={Draft:'Complete the document and submit it to the assigned reviewer.','Changes requested':'Address the review comments, then submit the document again.','In review':'The assigned reviewer checks the content before sending it for approval.','Awaiting approval':'Review is complete. The manager can approve this exact revision and publish it.',Published:'This version completed review and approval. Start a new version to make changes.'};
    return '<div class="panel-heading"><div><h2>Review & approval</h2><p>Separate decisions, recorded against the exact revision.</p></div></div><div class="workflow-box"><div class="process">'+step(1,'Author & submit','Write the content and explain what changed.',doc.authorId,(doc.audit.filter(e=>e.version===v.version&&e.action==='submit').at(-1)?.at||v.createdAt),!['Draft','Changes requested'].includes(v.status),['Draft','Changes requested'].includes(v.status))+step(2,'Review content',v.reviewedAt?'Review completed for revision '+v.reviewedRevision+'.':'Check accuracy, completeness, and supporting evidence.',doc.reviewerId,v.reviewedAt,!!v.reviewedAt,isReview)+step(3,'Approve & publish',v.approvedAt?'Published for readers. Approval recorded separately.':'Manager approval makes this version available to readers.',doc.approverId,v.approvedAt,!!v.approvedAt,isApproval)+'</div></div>'+(v.status==='Changes requested'&&latestReturn?'<div class="review-comment"><strong>'+esc(person(latestReturn.actorId).name)+' requested changes</strong><p>'+esc(latestReturn.comment)+'</p></div>':'')+'<div class="decision-card"><h3>'+esc(v.status==='Published'?'Approved version':v.status==='In review'?'Ready for review':v.status==='Awaiting approval'?'Ready for manager approval':v.status)+'</h3><p>'+notes[v.status]+'</p>'+(actions.length?'<div class="decision-actions">'+actions.map(a=>'<button class="button '+(['request-changes','delete'].includes(a)?'danger':a==='edit'?'secondary':'')+'" data-action="'+a+'">'+icon(a==='edit'?'edit':a==='revise'?'plus':a==='request-changes'?'back':'check')+actionLabels[a]+'</button>').join('')+'</div>':'<p class="quiet-note">'+(v.version!==latest.version?'This historical version is retained for reference.':v.status==='Published'?'This approved version is available to readers.':!canWrite()?'Your account has read-only access to this workflow.':'The next action belongs to '+esc(person(v.status==='In review'?doc.reviewerId:v.status==='Awaiting approval'?doc.approverId:doc.authorId).name)+'.')+'</p>')+'</div><p class="quiet-note">The author cannot review or approve their own document. The same manager may review and approve, as two separate recorded actions.</p>';
  }
  function historyPage(items,pageSize,tab,label) {
    const r=route(),totalPages=Math.max(1,Math.ceil(items.length/pageSize)),requested=Number(r.params.get('historyPage'));
    const page=Math.max(1,Math.min(totalPages,Number.isFinite(requested)?Math.floor(requested)||1:1));
    const start=(page-1)*pageSize,selectedVersion=selectedDocument().v?.version;
    const href=n=>url(r.path,{...Object.fromEntries(r.params),tab,version:selectedVersion,historyPage:n});
    return {items:items.slice(start,start+pageSize),summary:items.length?'<p class="history-summary" role="status">Showing '+(start+1)+'–'+Math.min(start+pageSize,items.length)+' of '+items.length+' '+label+' · Newest first</p>':'',pagination:totalPages>1?'<div class="document-history-pagination">'+window.WCSPagination.render({totalPages,currentPage:page,href,ariaLabel:tab==='versions'?'Version history pages':'Audit history pages'})+'</div>':''};
  }
  function versionsView(doc) {
    const list=doc.versions.filter(v=>canManage(doc)||v.status==='Published').slice().sort((a,b)=>b.version-a.version),page=historyPage(list,6,'versions','versions');
    return '<div class="panel-heading"><div><h2>Version history</h2><p>Published snapshots stay available as the document evolves.</p></div></div>'+page.summary+page.items.map(v=>'<section class="version-card" data-history-version="'+v.version+'"><div class="version-card-top"><div class="version-title">Version '+v.version+' '+badge(v.status==='Published'&&v.version!==doc.publishedVersion?'Superseded':v.status)+'</div><a class="link" href="'+docUrl(doc.id,'content',v.version)+'">Open'+icon('arrow')+'</a></div><p>'+esc(v.changeSummary)+'</p><div class="version-facts"><span>Author <strong>'+esc(person(v.createdBy).name)+'</strong></span><span>Revision <strong>'+v.revision+'</strong></span><span>'+(v.approvedAt?'Approved <strong>'+date(v.approvedAt)+'</strong>':'Created <strong>'+date(v.createdAt)+'</strong>')+'</span></div><details><summary>View version details</summary><div class="snapshot document-body"><h3>'+esc(v.title)+'</h3><p>'+esc(v.summary)+'</p><p>Reviewed by '+(v.reviewedBy?esc(person(v.reviewedBy).name)+' on '+date(v.reviewedAt):window.WCSEditorContent.isInsightType(doc.type)?'Not required':'— pending')+'<br>Approved by '+(v.approvedBy?esc(person(v.approvedBy).name)+' on '+date(v.approvedAt):window.WCSEditorContent.isInsightType(doc.type)?'Not required':'— pending')+'</p>'+(v.cover?articleCover(v):'')+(v.highlights?.length?keyHighlights(v):'')+sections(v)+attachmentsView(v)+taxonomyView(doc,v)+sourceMetadataView(v)+'</div></details></section>').join('')+page.pagination;
  }
  function auditView(doc) {
    const p=route().params, version=p.get('auditVersion')||'', action=p.get('auditAction')||'';
    const events=doc.audit.filter(e=>(!version||e.version===+version)&&(!action||e.action===action)).slice().reverse();
    const actions=[...new Set(doc.audit.map(e=>e.action))],page=historyPage(events,10,'audit','events');
    const value=v=>{const text=typeof v==='object'?JSON.stringify(v,null,2):String(v==null?'—':v);return esc(text.length>3000?text.slice(0,3000)+'\n… Value abbreviated here; the complete value is retained in the audit record.':text);};
    return '<div class="panel-heading"><div><h2>Audit trail</h2><p>Who changed what, when, and why.</p></div></div><div class="audit-toolbar"><div><select aria-label="Filter audit by version" data-audit="auditVersion"><option value="">All versions</option>'+doc.versions.map(v=>'<option value="'+v.version+'" '+(version===String(v.version)?'selected':'')+'>Version '+v.version+'</option>').join('')+'</select> <select aria-label="Filter audit by action" data-audit="auditAction"><option value="">All actions</option>'+actions.map(a=>'<option value="'+esc(a)+'" '+(a===action?'selected':'')+'>'+esc(labels[a]||a)+'</option>').join('')+'</select></div><span class="eyebrow">'+events.length+' events</span></div>'+page.summary+(!events.length?'<p class="history-empty" role="status">No audit events match these filters.</p>':'')+'<ol class="audit-list">'+page.items.map(e=>'<li class="audit-event" data-audit-event="'+esc(e.id)+'"><span class="audit-icon">'+icon(e.toStatus==='Published'?'check':e.action==='edit'?'edit':'clock')+'</span><h3>'+esc(labels[e.action]||e.action)+'<time datetime="'+esc(e.at)+'">'+time(e.at)+'</time></h3><div class="audit-meta"><span>'+esc(person(e.actorId).name)+(e.actorSOEID?' · '+esc(e.actorSOEID):'')+'</span><span>· v'+e.version+' / revision '+e.revision+'</span><span>· '+esc(e.fromStatus||'New')+' → '+esc(e.toStatus)+'</span></div><div class="audit-comment">'+esc(e.comment)+'</div><details><summary>Change details · '+e.changes.length+' fields</summary><p class="quiet-note">Event '+esc(e.id)+' · '+esc(e.at)+'</p><table class="change-table"><thead><tr><th>Field</th><th>Before</th><th>After</th></tr></thead><tbody>'+e.changes.map(c=>'<tr><td>'+esc(c.field)+'</td><td><pre>'+value(c.before)+'</pre></td><td><pre>'+value(c.after)+'</pre></td></tr>').join('')+'</tbody></table></details></li>').join('')+'</ol>'+page.pagination+'<p class="quiet-note">Times shown in Europe/Warsaw. Every event retains the UTC timestamp, editor identity, and exact changes. </p>';
  }
  function download(text,filename,type) {
    const objectUrl=URL.createObjectURL(new Blob([text],{type})),link=document.createElement('a');
    link.href=objectUrl;link.download=filename;link.click();setTimeout(()=>URL.revokeObjectURL(objectUrl),1000);
  }
  async function copyMarkdown(version,doc){
    const value=window.WCSEditorContent.toMarkdown({...version,type:doc?.type,area:doc?.area});
    try {await navigator.clipboard.writeText(value);toast('Markdown copied, including images, tags, and attachments.');}
    catch(_){toast('Clipboard unavailable. Select and copy the Markdown below.',{type:'warning'});window.WCSUI.dialog({title:'Copy Markdown',body:'<p>Select the content below and copy it with Ctrl+C or ⌘C.</p><textarea class="clipboard-fallback" aria-label="Markdown to copy" readonly>'+esc(value)+'</textarea>',onMount(handle){const field=handle.element.querySelector('textarea');field.focus();field.select();}});}
  }
  function refreshSession(next) {clearNativeBrowse();if(nativeMetricsMode){viewGeneration++;clearTimeout(viewTimer);viewVisit=null;viewCounts=Object.create(null);nativeViewRequested.clear();nativeViewLoading.clear();nativeViewFailures.clear();}session=next;data=next.data;documents=clone(data.documents);actorId=next.actorId;types=data.types||types;loadViewCounts();}
  function editorReturn(r,doc) {
    const requested=r.params.get('returnTo')||'';
    return /^#\/(?:document\/|article\/|review(?:\/|\?|$)|results(?:\?|$)|topic\/)/.test(requested)?requested:doc?docUrl(doc.id,'content',workflow.currentVersion(doc).version):url('/results',{view:'mine'});
  }
  function leaveEditor(target) {const r=route(),doc=documents.find(d=>d.id===decodeSegment(r.path.split('/')[2]||'')),fallback=editorReturn(r,doc);editor?.destroy();editor=null;editorHash='';go(target||fallback);}
  function editorPage() {
    const r=route(),id=r.path.startsWith('/edit/')?decodeSegment(r.path.split('/')[2]):null,doc=id?documents.find(d=>d.id===id):null;
    if(live&&config.authoringMode!=='confluence-session'&&(!config.workspaceEndpoint||!config.workflowEndpoint))return '<div class="discovery-container">'+empty('Document workflow is not connected','Ask your WCSpedia administrator to connect the document workflow. Your existing editor and approval process will be available once it is connected.','Back to knowledge','#/results')+'</div>';
    if(!canWrite()||(!id&&!canCreate())||(id&&(!doc||!actionsFor(doc).some(action=>['edit','revise'].includes(action)))))return '<div class="discovery-container">'+empty('Editing unavailable','Your account needs edit entitlement and Confluence edit permission. Submitted revisions stay locked during review.','Back to knowledge','#/results')+'</div>';
    if(editor){editor.destroy();editor=null;}
    const version=doc?workflow.currentVersion(doc):null,expected=doc?{expectedVersion:version.version,expectedRevision:version.revision,expectedAuditLength:doc.audit.length}:null;
    const authorId=actorId,createdId=workflow.newDocumentId(),editingAction=version?.status==='Published'?'revise':'edit',returnTo=editorReturn(r,doc);
    editorHash=location.hash;
    editor=window.WCSEditor.create({document:doc,version,actor:actor(),people:data.people,areas:data.areas,types,existingSlugs:documents.filter(item=>item.id!==doc?.id).flatMap(item=>item.versions.map(snapshot=>snapshot.slug).filter(Boolean)),area:r.params.get('area'),type:types.includes(r.params.get('type'))?r.params.get('type'):types[0],icon,notify:toast,cancel:leaveEditor,returnTo,editingPublished:editingAction==='revise',
      preview(fields){const previewVersion={...fields,sections:window.WCSEditorContent.toSections(fields.bodyMarkdown||'Content preview.')};return '<div class="editor-preview-layout"><div class="editor-preview-note">Reader preview · unpublished draft</div><section class="insights-header"><span class="insights-category">'+esc(fields.area==='insights'?'Insights':area(fields.area)?.title||'Wealth Credit Services')+'</span><h1>'+esc(fields.title||'Your article title')+'</h1><div class="insights-byline">'+esc(fields.type)+' · By '+esc(actor().name)+'</div></section>'+articleCover(previewVersion)+'<article class="document-body editor-preview-body">'+(fields.highlights.length?keyHighlights(previewVersion):'')+'<p class="article-lead">'+esc(fields.summary)+'</p>'+sections(previewVersion)+attachmentsView(previewVersion)+taxonomyView({type:fields.type,area:fields.area},previewVersion)+sourceMetadataView(previewVersion)+'</article></div>';},
      async save(fields){
        if(actorId!==authorId)throw Error('Your active identity changed. Reload before saving.');
        readState();readPolicy();const now=new Date().toISOString();let result,command;
        if(doc){const latest=documents.find(d=>d.id===doc.id);const changes={title:fields.title,summary:fields.summary,slug:fields.slug,bodyMarkdown:fields.bodyMarkdown,highlights:fields.highlights,cover:fields.cover,commentsEnabled:fields.commentsEnabled,tags:fields.tags||[],processes:fields.processes||[],regions:fields.regions||[],assets:fields.assets||[],attachments:fields.attachments||[],...(fields.sourceMetadata?{sourceMetadata:fields.sourceMetadata}:{}),...(fields.governance?{governance:fields.governance}:{})};if(!latest||!canWrite()||!actionsFor(latest).includes(editingAction))throw Error('Your edit permission or the document status changed. Your unsaved content is still in the editor.');result=workflow.transition(latest,editingAction,{...expected,actorId,people:data.people,now,comment:fields.comment,changes,requireGovernance:true,permissionContext:permissionContext(latest),actorSOEID:signedIdentity()?.soeid});command={action:editingAction,docId:doc.id,...expected,changes,comment:fields.comment};}
        else {if(!canCreate())throw Error('You no longer have permission to add documents.');if((!data.areas.some(a=>a.id===fields.area)&&!(window.WCSEditorContent.isDirectPublication(fields)))||!types.includes(fields.type))throw Error('Choose an available content type and business area.');const input={...fields,id:createdId,reference:'WCS-'+({'Job aid':'JA',Procedure:'PR','Knowledge sharing':'KS',Blog:'BL',Training:'TR',Reference:'RF',Report:'RP'}[fields.type]||'DOC')+'-'+createdId.slice(-12).toUpperCase(),ownerId:actorId,authorId:actorId,changeSummary:fields.comment};result=workflow.createDocument(input,{actorId,people:data.people,now,requireGovernance:true,permissionContext:{actorId,documentId:createdId,create:canCreate()},actorSOEID:signedIdentity()?.soeid});command={action:'create',fields:input,comment:fields.comment};}
        let stored=true;
        try{if(live){refreshSession(await adapter.submitAction({...command,expectedAttachmentVersion:session.attachmentVersion}));if(!documents.some(d=>d.id===result.id)){const error=Error('The draft was saved but is no longer visible. Reload the workspace.');error.code='REFRESH_REQUIRED';throw error;}}else{const before=documents,beforeMemoryOnly=memoryOnly,index=documents.findIndex(d=>d.id===result.id);documents=index<0?[...documents,result]:documents.map((item,i)=>i===index?result:item);stored=persist();if(!stored){documents=before;memoryOnly=beforeMemoryOnly;throw Error('The draft could not be saved because browser storage is unavailable or full. Your changes remain in the editor. Copy Markdown to keep a backup, then free storage and try again.');}}}
        catch(error){if(live&&error.code==='UNKNOWN_COMMIT')error.recoverable=true;else if(live&&['REFRESH_REQUIRED','CONFLICT'].includes(error.code))error.reloadRequired=true;throw error;}
        editor.destroy();editor=null;editorHash='';const savedReturn=window.WCSEditorContent.isDirectPublication(result)?'#/insights':doc?(/^#\/(?:document|article)\//.test(returnTo)?docUrl(result.id,'content',workflow.currentVersion(result).version):returnTo):url('/review/'+result.id);const next=destination(savedReturn),notice=stored?(window.WCSEditorContent.isDirectPublication(result)?'Article published to Insights.':'Draft saved · ready to submit for review.'):'Draft saved in memory only. Browser storage is full; export before closing.',noticeType=stored?'success':'warning';if(!next.startsWith('#')){if(!window.WCSNotifications?.forNextPage(notice,{type:noticeType,destination:next}))toast(notice,{type:noticeType});location.assign(next);return;}history.replaceState(null,'',next);render();scrollPageTop();toast(notice,{type:noticeType});
      }
    });
    return editor.html();
  }
  function categoriesPage() {
    if(actor().role!=='Manager'||!canCreate())return '<div class="discovery-container">'+empty('Business area management','Your manager maintains the shared business areas.','Browse knowledge','#/results')+'</div>';
    return '<section class="press-heading page-panel"><div class="discovery-container"><nav class="breadcrumbs"><a href="#/">WCSpedia</a>'+icon('chevron')+'<span>Business areas</span></nav><div class="eyebrow">Organise shared knowledge</div><h1>A place for every team.</h1><p>Manage the business areas used by every content type across WCSpedia.</p></div></section><div class="discovery-container category-layout"><section><div class="panel-heading"><h2>'+data.areas.length+' business areas</h2><span class="quiet-note">Revision '+(data.taxonomyRevision||1)+'</span></div><div class="category-list">'+data.areas.map(a=>'<div>'+icon(a.icon)+'<span><strong>'+esc(a.title)+'</strong><small>'+esc(a.id)+'</small></span><span>'+documents.filter(d=>d.area===a.id).length+' documents</span></div>').join('')+'</div><details class="category-history"><summary>Category change history · '+(data.taxonomyAudit||[]).length+' events</summary>'+((data.taxonomyAudit||[]).slice().reverse().map(e=>'<div><strong>Business area added</strong><p>'+esc(person(e.actorId).name)+' · '+time(e.at)+'</p><p>'+esc(e.comment)+'</p><details><summary>Before and after</summary><pre>'+esc(JSON.stringify(e.changes,null,2))+'</pre></details></div>').join('')||'<p>No category changes have been made.</p>')+'</details></section><form novalidate id="category-form" class="category-form" data-revision="'+(data.taxonomyRevision||1)+'"><h2>Add a business area</h2><p>It will become available when creating content and filtering search results.</p><div id="category-error" class="form-error" role="alert" hidden></div>'+field('category-name','Business area name','','input','required maxlength="80" placeholder="For example, Process Improvement"')+field('category-comment','Reason for adding this area','','textarea','required maxlength="2000"')+'<button class="button" type="submit">Add business area '+icon('plus')+'</button><div class="editor-help">'+icon('shield')+'<p>Manager action. Your name, time, and changes are recorded.</p></div></form></div>';
  }
  async function saveCategory(form) {
    if(form.dataset.saving||actor().role!=='Manager'||!canCreate())return;
    const fields=new FormData(form),name=String(fields.get('category-name')||'').trim();
    const command={action:'add-category',category:{id:window.WCSEditor.slugify(name),name,icon:'folder'},expectedTaxonomyRevision:Number(form.dataset.revision),comment:String(fields.get('category-comment')||'').trim()};
    form.dataset.saving='true';const button=form.querySelector('button');button.disabled=true;button.setAttribute('aria-busy','true');
    try{readState();readPolicy();if(!canCreate())throw Error('You no longer have permission to add business areas.');if(live)refreshSession(await adapter.submitAction({...command,expectedAttachmentVersion:session.attachmentVersion}));else{data=window.WCSConfluence.addCategory({...data,documents},command,{actorId,now:new Date().toISOString()});if(!persist())throw Error('Category added in memory only. Browser storage is unavailable.');}render();toast('Business area added · change recorded.');}
    catch(error){toast(error.message,{type:'error'});const box=form.querySelector('#category-error');box.textContent=error.message;box.hidden=false;if(live&&['UNKNOWN_COMMIT','REFRESH_REQUIRED','CONFLICT'].includes(error.code)){box.insertAdjacentHTML('beforeend','<p>Reload before trying again.</p><button type="button" class="button secondary" data-action="editor-reload">Reload workspace</button>');return;}button.disabled=false;delete form.dataset.saving;}finally{button.removeAttribute('aria-busy');}
  }
  function focusLandingSearch() {
    if(!focusSearchOnRender||root.hasAttribute('inert'))return;
    root.querySelector('.discovery-search input')?.focus();
    focusSearchOnRender=false;
  }
  function render() {
    dismissSuggestions();cancelChildSearch();stopInsights();
    library?.unmount();
    exportView?.destroy();exportView=null;
    entitlementView?.destroy();entitlementView=null;
    suggestionInbox?.destroy();suggestionInbox=null;suggestionWidget?.destroy();suggestionWidget=null;chartView?.destroy();chartView=null;chartSummary=null;
    // Keep old search links usable without maintaining a second landing page.
    if(route().path==='/search'){
      const target=destination('#/?focus=search');
      if(!target.startsWith('#')){location.replace(target);return;}
      history.replaceState(null,'',target);
    }
    const r=route(); let content;
    if(!(r.path==='/'||r.path.startsWith('/topic/')||r.path==='/results'&&(!r.params.get('view')||r.params.get('view')==='published')))cancelNativePrefetch();
    if(r.path==='/'&&r.params.get('focus')==='search'){
      focusSearchOnRender=true;
      r.params.delete('focus');
      history.replaceState(null,'',url('/',Object.fromEntries(r.params)));
    }
    // Dedicated Confluence pages already name their default view. Retain all
    // native query parameters and meaningful fragment filters/subroutes.
    const canonical=window.WCSNavigation.canonicalUrl(config,location.href);
    if(canonical!==location.href)history.replaceState(history.state,'',canonical);
    if(needsWorkspaceSession()){
      if(fullSessionErrorScope!==requestedWorkspaceScope())fullSessionError=null;
      window.WCSUI.destroy(root);
      root.innerHTML=fullSessionError?'<div class="library-unavailable" role="alert"><strong>This page could not load</strong><p>'+esc(fullSessionError.message)+'</p><button class="button secondary" data-action="retry-workspace-session">Try again</button></div>':'';
      if(!fullSessionError)loadFullSession();
      cancelNativeLanding();return;
    }
    if(isNativeDiscoveryRoute())cancelFullSession();
    if(library&&!libraryStarted&&libraryNeeded())void loadLibrary(true).then(()=>{if(!editor&&!modal&&root.isConnected)render();},()=>{});
    if(r.path==='/create'||r.path.startsWith('/edit/'))content=editorPage();
    else if(r.path==='/categories')content=categoriesPage();
    else if(r.path==='/insights')content=insightsPage();
    else if(r.path==='/saved'||r.path==='/health')content=library.workspace(r.path.slice(1),r.params);
    else if(r.path==='/entitlements')content=window.WCSEntitlementsPage.markup(entitlementOptions());
    else if(r.path.startsWith('/document/')||r.path.startsWith('/article/'))content=documentPage();
    else if(r.path==='/results'&&r.params.get('view')==='review')content=reviewQueue();
    else if(r.path==='/results'||r.path.startsWith('/topic/'))content=resultsPage();
    else if(r.path==='/review')content=reviewQueue();
    else if(r.path.startsWith('/review/'))content=reviewPage();
    else content=home();
    window.WCSUI.destroy(root);
    root.innerHTML=shell(content);
    if(editor&&(r.path==='/create'||r.path.startsWith('/edit/')))editor.bind(root.querySelector('.authoring-page'));
    library?.mount(root);window.WCSUI.enhance(root);wirePageLinks();mountBackTop();updateBackTop();
    mountPageTools();mountGlobalTools();if(nativeMetricsMode)loadViewCounts(false);else scheduleDocumentView();
    if(root.querySelector('[data-wcs-export]'))exportView=window.WCSDocumentExportUI.mount(root,{notify:toast,getMarkdown:({version,doc})=>window.WCSEditorContent.toMarkdown({...version,type:doc?.type,area:doc?.area}),getMDX:({version,doc})=>window.WCSEditorContent.toMDX({...version,type:doc.type,area:doc.area,documentId:doc.docKey||doc.id,reference:doc.reference},{baseUrl:location.href}),getMDXTemplate:(_current,{signal})=>window.WCSDocumentExport.loadMDXTemplate(config,{signal,baseUrl:location.href}),getDocument(){const {doc,v}=selectedDocument();if(!doc||!v)return null;const published=workflow.publishedVersion(doc),revisionEvent=(doc.audit||[]).filter(e=>e.version===v.version&&['edit','revise','create'].includes(e.action)).at(-1);return {doc,version:v,people:data.people,areaLabel:area(doc.area)?.title||'Wealth Credit Services',sourceUrl:new URL(destination(docUrl(doc.id,'content',v.version)),location.href).href,isCurrentPublished:published?.version===v.version&&published?.revision===v.revision,revisionAt:revisionEvent?.at,config:config.exports||{}};}});
    if(r.path==='/entitlements'){entitlementView=window.WCSEntitlementsPage.mount(root,entitlementOptions());window.WCSUI.enhance(root);wirePageLinks();}
    if(chartSummary)chartView=window.WCSWorkspaceCharts.mount(root,chartSummary,config.charts||{});
    focusLandingSearch();
    document.title=(r.path.startsWith('/document/')?(selectedDocument().v?.title||'Document')+' · ':'')+'WCSpedia';
    if(root.querySelector('#native-search-results'))loadNativeResults();
    if(root.querySelector('#wcs-insights-content')){insightsState=null;paintInsights();loadInsights();}
    if(root.querySelector('#native-landing-documents'))loadNativeLanding();else cancelNativeLanding();
  }
  function toast(message,options={}) {
    const detail={type:'success',...options};
    if(window.WCSNotifications)return window.WCSNotifications.show(message,detail);
    // The existing global header may finish loading after a page action.
    const pending=window.WCSNotificationQueue=window.WCSNotificationQueue||[];
    pending.push({message,options:detail});if(pending.length>20)pending.shift();
  }
  function persist() { if(live)return false;try {localStorage.setItem(STORE,JSON.stringify({schema:3,documents,areas:data.areas,taxonomyRevision:data.taxonomyRevision||1,taxonomyAudit:data.taxonomyAudit||[]}));memoryOnly=false;return true;}catch(_){memoryOnly=true;return false;} }
  function filterChange(key,value) {
    const r=route(), p=Object.fromEntries(r.params); if(r.path.startsWith('/topic/'))p.area=decodeSegment(r.path.split('/')[2]);
    p[key]=value;if(key!=='page'){p.page=1;delete p.after;}go(url('/results',p));
  }
  function field(id,label,value='',kind='input',attrs='') { return '<div class="form-group"><label for="'+id+'">'+label+'</label>'+(kind==='textarea'?'<textarea id="'+id+'" name="'+id+'" '+attrs+'>'+esc(value)+'</textarea>':'<input id="'+id+'" name="'+id+'" value="'+esc(value)+'" '+attrs+'>')+'</div>'; }
  function openModal(action,documentId) {
    if(action==='new'){if(canCreate())go('#/create');return;}
    if(['edit','revise'].includes(action)){const doc=documentId?documents.find(d=>d.id===documentId&&!d.deletedAt):selectedDocument().doc;readPolicy();if(doc&&actionsFor(doc).includes(action))go(url('/edit/'+doc.id,{returnTo:location.hash}));return;}
    const state=selectedDocument(), doc=documentId?documents.find(d=>d.id===documentId&&!d.deletedAt):state.doc, v=doc?workflow.currentVersion(doc):null;
    if(!canWrite()||!doc||!actionsFor(doc).includes(action))return;
    savedFocus=document.activeElement;
    modal={hash:location.hash,url:location.href,action,docId:doc.id,actorId,expectedVersion:v.version,expectedRevision:v.revision,expectedAuditLength:doc.audit.length};
    const title=actionLabels[action],description=v.title+' · v'+v.version+' / revision '+v.revision;
    const desc={submit:'Send this revision to '+person(doc.reviewerId).name+' for content review. It will remain unavailable to readers until approved.','complete-review':'Confirm you have reviewed this exact revision. This records your review and moves it to manager approval.',approve:'Approve the reviewed revision and publish it now. Any previous approved version remains in the history.','request-changes':'Return this version to the author with clear feedback. It will need review again.',revise:'Create an editable draft from the approved content. The current approved version stays available to readers.',delete:'Delete this entire document from the knowledge library. Its versions and deletion record remain in the restricted audit history.'+(live?' The linked Confluence page will be moved to trash by the service.':' This prototype only changes the local sample data.')};
    let fields='<div class="modal-summary">'+esc(desc[action])+'</div>';
    if(action==='approve'){const next=governance.nextReviewDate(new Date().toISOString());const min=new Date();min.setUTCDate(min.getUTCDate()+1);fields+=field('next-review','Next business review target',next,'input','type="date" required min="'+min.toISOString().slice(0,10)+'" max="'+next+'"')+'<p class="quiet-note">Business best practice: review within 24 calendar months, and sooner when sources, processes or responsibilities change. This does not create a mandatory policy review cycle.</p>';}
    if(action==='submit')fields+=governanceUI.findings(doc,v);
    if(action==='complete-review')fields+=governanceUI.reviewForm(doc,v);
    if(action==='delete')fields+=field('delete-key','Confirm document key','','input','required autocomplete="off" placeholder="'+esc(doc.id)+'"');
    fields+=field('action-comment',action==='revise'?'Change summary':'Decision comment','','textarea','required maxlength="2000" placeholder="Explain this change or decision for the audit trail."');
    workflowDialog=window.WCSUI.dialog({title,body:'<p class="workflow-dialog-description">'+esc(description)+'</p><form id="workflow-form" novalidate><div id="form-error" class="form-error" role="alert" hidden></div>'+fields+'<div class="modal-actions"><button type="button" class="button secondary" data-action="close">Cancel</button><button class="button '+(action==='delete'?'danger':'')+'" type="submit">'+esc(title)+'</button></div></form>',onClose(){if(modal?.saving||modal?.reloadRequired)return false;const refresh=modal?.reloadOnClose;modal=null;workflowDialog=null;if(refresh)queueMicrotask(render);}});
  }
  function closeModal(){if(modal?.saving||modal?.reloadRequired)return;workflowDialog?.close();}
  async function saveAction(form) {
    if(!modal||actorId!==modal.actorId||modal.saving)return;
    const invalid=form.querySelector(':invalid');if(invalid){const box=form.querySelector('#form-error');box.hidden=false;box.textContent=invalid.validationMessage||'Complete the required fields.';toast(box.textContent,{type:'warning'});invalid.focus();return;}
    const f=new FormData(form),text=key=>String(f.get(key)||'').trim(),m=modal;
    m.saving=true;workflowDialog?.setBusy(true);form.querySelectorAll('button').forEach(b=>b.disabled=true);
    try {
      readState();readPolicy();const now=new Date().toISOString();
      const doc=documents.find(d=>d.id===m.docId);if(!doc)throw Error('Document unavailable. Refresh and try again.');
      if(m.action==='delete'&&text('delete-key')!==doc.id)throw Error('Enter the exact document key to confirm deletion.');
      if(!actionsFor(doc).includes(m.action))throw Error('Your permission or this document status changed. Reload before continuing.');
      const options={actorId,people:data.people,now,requireGovernance:true,permissionContext:permissionContext(doc),actorSOEID:signedIdentity()?.soeid,comment:text('action-comment'),expectedVersion:m.expectedVersion,expectedRevision:m.expectedRevision,expectedAuditLength:m.expectedAuditLength};
      if(m.action==='approve'){options.effectiveAt=now;options.nextReviewAt=text('next-review');}
      if(m.action==='complete-review')options.governanceReview=governanceUI.readReview(f,{...workflow.currentVersion(doc),version:m.expectedVersion,revision:m.expectedRevision});
      let result=workflow.transition(doc,m.action,options);
      const command={action:m.action,docId:m.docId,comment:options.comment,expectedVersion:m.expectedVersion,expectedRevision:m.expectedRevision,expectedAuditLength:m.expectedAuditLength,nextReviewAt:options.nextReviewAt,...(options.governanceReview?{governanceReview:options.governanceReview}:{})};
      let persisted=true;
      if(live){session=await (m.action==='delete'?adapter.deleteDocument:adapter.submitAction)(Object.assign(command,{expectedAttachmentVersion:session.attachmentVersion}));data=session.data;documents=clone(data.documents);actorId=session.actorId;result=documents.find(d=>d.id===result.id);if(!result&&m.action!=='delete')throw Error('The action was accepted but this document is no longer visible. Reload the workspace.');}
      else {const index=documents.findIndex(d=>d.id===result.id);documents[index]=result;persisted=persist();}
      m.saving=false;workflowDialog?.setBusy(false);closeModal();history.replaceState(null,'',m.action==='delete'?url('/results'):url('/review/'+result.id));render();loadViewCounts();
      toast(labels[m.action]+(persisted?' · audit event recorded.':' · saved in memory only; browser storage unavailable.'),{type:persisted?'success':'warning'});
    } catch(error) {
      toast(error.message,{type:'error'});m.saving=false;workflowDialog?.setBusy(false);m.reloadOnClose=true;const box=root.querySelector('#form-error');box.hidden=false;box.textContent=error.message;
      if(live&&['UNKNOWN_COMMIT','REFRESH_REQUIRED','CONFLICT'].includes(error.code)){
        m.reloadRequired=true;workflowDialog?.setBusy(true,{pending:false});const reload=document.createElement('button');reload.type='button';reload.className='button secondary';reload.dataset.action='reload-live';reload.textContent='Reload latest content';box.append(document.createElement('br'),reload);
      } else form.querySelectorAll('button').forEach(b=>b.disabled=false);
      box.scrollIntoView({block:'nearest'});
    }
  }
  root.addEventListener('click',async event=>{
    const anchor=event.target.closest('a[href]');
    if(anchor&&!event.metaKey&&!event.ctrlKey&&!event.shiftKey&&!event.altKey&&event.button===0&&!anchor.target&&!anchor.hasAttribute('download')){
      const target=anchor.getAttribute('href');
      if(!target.startsWith('#')&&editor&&(editor.isDirty()||editor.isBusy())){event.preventDefault();editor.requestLeave(target);return;}
      if(modal?.saving||modal?.reloadRequired){event.preventDefault();return;}
    }
    const button=event.target.closest('[data-action]');
    if(button){const action=button.dataset.action;if(action==='toggle-faq'){const expanded=button.getAttribute('aria-expanded')!=='true';button.setAttribute('aria-expanded',String(expanded));const answer=document.getElementById(button.getAttribute('aria-controls'));answer.setAttribute('aria-hidden',String(!expanded));answer.inert=!expanded;return;}if(action==='retry-workspace-session'){fullSessionError=null;render();return;}if(action==='back-top'){scrollPageTop(matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth');root.querySelector('h1')?.setAttribute('tabindex','-1');root.querySelector('h1')?.focus({preventScroll:true});return;}if(action==='copy-markdown'){return window.WCSUI.runButton(button,async()=>{const {v,doc}=selectedDocument();if(v)await copyMarkdown(v,doc);});}if(action==='retry-native-search')return loadNativeResults();if(action==='retry-native-landing')return loadNativeLanding(true);if(action==='reload-live'){if(button.disabled)return;window.WCSUI.buttonBusy(button,true);showLoading('Refreshing your workspace…');try{session=await loading.wait(adapter.load());loading.progress(1,2,'Preparing your workspace…');refreshSession(session);modal.saving=false;modal.reloadRequired=false;workflowDialog?.setBusy(false);closeModal();render();loading.progress(2,2,'Your workspace is ready.');loadViewCounts();toast('Workspace refreshed.');}catch(error){toast(error.message,{type:'error'});}finally{loading.hide();window.WCSUI.buttonBusy(button,false);}return;}if(action==='close')return closeModal();if(action==='editor-reload'){editor?.destroy();editor=null;location.reload();return;}if(action==='reset'&&!live){return window.WCSUI.runButton(button,async()=>{if(editor?.isDirty()){toast('Save or cancel your draft before resetting the demo.',{type:'warning'});return;}data=clone(baseData);types=data.types;documents=clone(data.documents);localPolicy=clone(data.entitlementPolicy);try{localStorage.removeItem(STORE+'.entitlements');localStorage.removeItem('wcspedia.bookmarks.v1');localStorage.removeItem(window.WCSHealthService.STORE);clearTimeout(viewTimer);viewVisit=null;viewGeneration++;viewLoadSequence++;viewCounts=Object.create(null);viewStatus='loading';await localViews?.reset();loadViewCounts();}catch(_){viewStatus='unavailable';}memoryOnly=false;persist();actorId='alex';try{localStorage.setItem(ACTOR,actorId);}catch(_){}history.replaceState(null,'',window.WCSNavigation.initialHash(config));await library?.load(true);render();toast('Sample documents restored.');});}
      if(action==='filters'){const filters=root.querySelector('#discovery-filters');filters.classList.toggle('is-open');button.setAttribute('aria-expanded',filters.classList.contains('is-open'));return;}if(action==='copy'){return window.WCSUI.runButton(button,async()=>{try{const selected=selectedDocument();await navigator.clipboard.writeText(location.href.split('#')[0]+docUrl(selected.doc.id,selected.tab,selected.v.version));toast('Document link copied.');}catch(_){toast('Clipboard unavailable. Copy the document URL from the address bar.',{type:'warning'});}});}

      openModal(action,button.dataset.documentId);return;
    }
    const section=event.target.closest('[data-section]');if(section){document.getElementById('section-'+section.dataset.section)?.scrollIntoView({behavior:'smooth',block:'start'});return;}
    // Pagination uses real links so filters, browser history and modified clicks work.
  });
  root.addEventListener('change',async event=>{
    const target=event.target;
    if(target.id==='demo-actor'&&!live){if(editor?.isDirty()||editor?.isBusy()){target.value=actorId;toast('Save or cancel your draft before switching person.',{type:'warning'});return;}editor?.destroy();editor=null;actorId=target.value;try{localStorage.setItem(ACTOR,actorId);}catch(_){}modal=null;await library?.load(true);render();return;}
    if(target.hasAttribute('data-review-stage'))go(url('/review',{stage:target.value,q:route().params.get('q')||'',page:1}));
    if(target.dataset.filter)filterChange(target.dataset.filter,target.value);
    if(target.dataset.audit){const r=route(),p=Object.fromEntries(r.params);p[target.dataset.audit]=target.value;p.historyPage=1;go(url(r.path,p));}
  });
  // Retain the readable wordmark if an attachment is missing or unavailable.
  root.addEventListener('error',event=>{if(event.target.matches?.('.discovery-brand-logo'))event.target.hidden=true;},true);
  root.addEventListener('click',event=>{
    const clear=event.target.closest('[data-clear-search]');if(!clear)return;
    event.preventDefault();const input=clear.closest('form')?.querySelector('[data-suggest]');if(!input)return;
    input.value='';input.dispatchEvent(new Event('input',{bubbles:true}));input.focus();
  });
  root.addEventListener('input',event=>{if(event.target.hasAttribute('data-suggest')){const clear=event.target.closest('form')?.querySelector('[data-clear-search]');if(clear)clear.hidden=!event.target.value;if(event.isComposing)dismissSuggestions();else scheduleSuggestions(event.target);}});
  root.addEventListener('pointerover',prefetchNativeLink);
  root.addEventListener('focusin',prefetchNativeLink);
  root.addEventListener('pointerout',event=>{const anchor=event.target.closest?.('a[href]');if(anchor&&!anchor.contains(event.relatedTarget)){clearTimeout(nativePrefetchTimer);nativePrefetchTimer=null;}});
  root.addEventListener('compositionstart',event=>{if(event.target.hasAttribute('data-suggest'))dismissSuggestions();});
  root.addEventListener('compositionend',event=>{if(event.target.hasAttribute('data-suggest'))scheduleSuggestions(event.target);});
  root.addEventListener('focusout',()=>{setTimeout(()=>{const wrap=root.querySelector('.discovery-search-wrap');if(wrap&&!wrap.contains(document.activeElement)&&!(route().path==='/results'||route().path.startsWith('/topic/')))dismissSuggestions();},100);});
  root.addEventListener('submit',event=>{event.preventDefault();const form=event.target;if(form.hasAttribute('data-review-search')){go(url('/review',{stage:route().params.get('stage')||'',q:new FormData(form).get('q'),page:1}));return;}if(form.id==='workflow-form')return saveAction(form);if(form.id==='category-form')return saveCategory(form);if(form.dataset.search){dismissSuggestions();const q=new FormData(form).get('q');
    // Repeated Enter/Search clicks should not abort and restart the same first
    // page request. A changed query or returning from pagination still searches.
    const params=route().params;
    if(live&&childSearchController&&!childSearchController.signal.aborted&&root.querySelector('#native-search-results')&&String(q||'').trim()===nativeSearchOptions().query.trim()&&(!params.get('page')||params.get('page')==='1')&&!params.get('after'))return;
    if(form.dataset.search==='global')go(url('/results',{q}));else filterChange('q',q);}});
  document.addEventListener('click',event=>{const link=event.target.closest('[data-wcs-entitlements-link]');if(!link||event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;event.preventDefault();if(root.querySelector('[aria-modal="true"]'))return;go(link.getAttribute('href'));});
  document.addEventListener('keydown',event=>{
    if(modal||root.querySelector('[aria-modal="true"]'))return;
    const suggestions=root.querySelector('#search-suggestions');if(event.key==='Escape'&&suggestions&&!suggestions.hidden){if(suggestions.contains(document.activeElement))root.querySelector('[data-suggest]')?.focus();dismissSuggestions();}if(event.key==='ArrowDown'&&document.activeElement?.hasAttribute('data-suggest')&&suggestions&&!suggestions.hidden){event.preventDefault();suggestions.querySelector('a')?.focus();}
    if((event.metaKey||event.ctrlKey)&&event.key.toLowerCase()==='k'){event.preventDefault();const input=root.querySelector('.discovery-search input, .search-form input');if(input)input.focus();else {focusSearchOnRender=true;go('#/?focus=search');}}
  });
  window.addEventListener('hashchange',()=>{if(modal?.saving||modal?.reloadRequired){history.replaceState(null,'',modal.url||modal.hash);return;}if(modal)closeModal();if(editor&&(editor.isDirty()||editor.isBusy())&&location.hash!==editorHash){const destination=location.hash;history.replaceState(null,'',editorHash);editor.requestLeave(destination);return;}if(editor&&location.hash!==editorHash){editor.destroy();editor=null;}modal=null;render();scrollPageTop();});
  // In-page navigation uses the shared Citi dialog; browser-close prompts are deliberately not registered.
  function pageScroller(){
    for(let node=root.parentElement;node&&node!==document.body&&node!==document.documentElement;node=node.parentElement){
      const overflow=getComputedStyle(node).overflowY;
      if(/^(auto|scroll)$/.test(overflow)&&node.scrollHeight>node.clientHeight)return node;
    }
    return document.scrollingElement||document.documentElement;
  }
  function isDocumentScroller(node){return node===document.scrollingElement||node===document.documentElement||node===document.body;}
  function scrollPageTop(behavior='instant'){
    const pane=pageScroller();
    if(isDocumentScroller(pane))window.scrollTo({top:0,behavior});
    else if(typeof pane.scrollTo==='function')pane.scrollTo({top:0,behavior});
    else pane.scrollTop=0;
    updateBackTop();
  }
  function mountBackTop(){window.WCSScrollTools?.mount();}
  function updateBackTop(){window.WCSScrollTools?.mount()?.refresh();}
  window.addEventListener('storage',event=>{if([STORE,STORE+'.entitlements'].includes(event.key)&&!modal&&!editor){readState();readPolicy();if(!root.querySelector('[aria-modal="true"]')){render();loadViewCounts();}}});
  let lastReadResume=Date.now(),readResume=null;
  function resumeVisibleReads(force=false){
    if(!live||document.visibilityState==='hidden'||editor||modal||readResume||!root.isConnected||root.querySelector('[data-library-action][aria-busy="true"]'))return;
    if(!force&&Date.now()-lastReadResume<nativeBrowseTTL)return;
    const path=route().path;if(path!=='/'&&path!=='/saved')return;
    lastReadResume=Date.now();
    // Refresh only the visible list. Never restart the editor or page splash.
    readResume=Promise.resolve().then(()=>path==='/'?loadNativeLanding(true):loadLibrary(false,{bookmarksOnly:true})).finally(()=>{readResume=null;});
  }
  document.addEventListener('visibilitychange',()=>{scheduleDocumentView();resumeVisibleReads();});
  window.addEventListener('focus',()=>resumeVisibleReads());
  window.addEventListener('online',()=>resumeVisibleReads());
  window.addEventListener('pagehide',()=>{clearTimeout(viewTimer);viewVisit=null;dismissSuggestions();cancelChildSearch();stopInsights();clearNativeBrowse();cancelFullSession();});
  window.addEventListener('pageshow',event=>{
    if(!event.persisted||!live)return;
    if(needsWorkspaceSession()){render();return;}
    // pagehide cancels requests, including ones whose loading state is restored
    // by the browser's back/forward cache. Resume both discovery surfaces.
    if(root.querySelector('#native-search-results'))loadNativeResults();
    if(root.querySelector('#native-landing-documents'))loadNativeLanding();
    if(route().path==='/saved')resumeVisibleReads(true);
    if(root.querySelector('#wcs-insights-content')){loadInsights();}
    if(nativeMetricsMode)scheduleDocumentView();
  });
  window.addEventListener('storage',event=>{if(!live&&event.key===VIEW_STORE){if(event.newValue===null){clearTimeout(viewTimer);viewVisit=null;viewGeneration++;viewCounts=Object.create(null);}loadViewCounts();}});
  if(!location.hash){
    const initial=new URL(location.href);initial.hash=window.WCSNavigation.initialHash(config);
    const canonical=window.WCSNavigation.canonicalUrl(config,initial.href);
    if(canonical!==location.href)history.replaceState(history.state,'',canonical);
  }
  library=window.WCSLibraryWorkflows.create({container:root,config,storage:{getItem:key=>localStorage.getItem(key),setItem:(key,value)=>localStorage.setItem(key,value)},withLock:navigator.locks?(name,task)=>navigator.locks.request(name,task):undefined,publishedVersion:workflow.publishedVersion,url,documentHref:(doc,tab)=>docUrl(doc.id,tab,workflow.publishedVersion(doc)?.version),date,go,notify:toast,refresh:()=>{if(!editor&&!modal)render();},context(){
    readState();readPolicy();
    return {documents,people:data.people,actor:{...actor(),id:actorId},identity:signedIdentity(),canRead:doc=>!!doc&&!doc.deletedAt&&(!live||window.WCSEntitlements.nativeHas(nativeRights().documents[doc.id],'read')),canEdit:doc=>!!doc&&!doc.deletedAt&&permitted('content.edit',doc)};
  }});
  const libraryLoading=loadLibrary(true);
  if(live)render();
  const nativeDiscoveryReady=live&&!!root.querySelector('#native-search-results,#native-landing-documents,#wcs-insights-content');
  if(nativeDiscoveryReady){
    // The authorized page and CQL search are ready to use. Saved items and
    // health checks have their own states and must not keep discovery inert.
    loading.progress(3,3,'Search is ready.');
    loading.hide();
    focusLandingSearch();
    loadViewCounts();
    void loading.wait(libraryLoading).then(()=>{
      // Do not replace an active search, its input, or an open editor/dialog
      // when these independent services finish after navigation.
      if(root.isConnected&&!editor&&!modal&&!root.querySelector('#native-search-results,#native-landing-documents,#wcs-insights-content,[aria-modal="true"]'))render();
    },()=>{
      if(root.isConnected)toast('Saved items and content health could not load. Try again from those pages.',{type:'warning'});
    });
  }else{
    await loading.wait(libraryLoading);
    loading.progress(2,3,'Preparing your page…');
    if(!editor&&!modal&&!root.querySelector('[aria-modal="true"]')&&(!live||!root.querySelector('#native-search-results,#native-landing-documents,#wcs-insights-content')))render();
    loading.progress(3,3,'Your page is ready.');
    loading.hide();
    focusLandingSearch();
    loadViewCounts();
  }
  window.addEventListener('storage',event=>{if(!live&&event.key&&(event.key==='wcspedia.bookmarks.v1'||event.key===window.WCSHealthService.STORE)&&!editor&&!modal&&!root.querySelector('[aria-modal="true"]'))library.load().then(()=>{if(!editor&&!modal&&!root.querySelector('[aria-modal="true"]'))render();});});
  } catch(error) {
    loading.hide();
    const box=document.createElement('div');box.className='boot-state';box.setAttribute('role','alert');
    const title=document.createElement('h1');title.textContent='WCSpedia could not load';title.tabIndex=-1;
    const detail=document.createElement('p');detail.textContent=error.message;
    const retry=document.createElement('button');retry.className='button';retry.textContent='Try again';retry.onclick=()=>location.reload();
    box.append(title,detail,retry);root.replaceChildren(box);title.focus({preventScroll:true});
    if(live&&config.authoringMode==='confluence-session'&&config.pageRole==='entitlements'&&adapter?.inspectEntitlementRecovery&&['CONFLICT','INTEGRITY','ATTACHMENT_NOT_FOUND'].includes(error.code)){
      const section=document.createElement('section'),inspect=document.createElement('button'),status=document.createElement('p'),review=document.createElement('div');
      inspect.type='button';inspect.className='button secondary';inspect.textContent='Review JSON recovery';
      status.setAttribute('role','status');
      const help=document.createElement('p');help.textContent='An editor of the policy attachment page can review the current entitlements.json and reconnect its saved reference. This does not replace the file, reset grants, or clear audit history.';
      section.append(help,inspect,status,review);box.append(section);
      inspect.onclick=async()=>{
        inspect.disabled=true;inspect.setAttribute('aria-busy','true');review.replaceChildren();status.textContent='Checking the current attachment…';
        try{
          const preview=await adapter.inspectEntitlementRecovery();if(!section.isConnected)return;
          const summary=document.createElement('p');summary.textContent='Page '+preview.pageId+' · '+preview.filename+' · attachment '+preview.candidate.id+' · Confluence version '+preview.candidate.version+' · policy revision '+preview.data.revision+' · '+preview.data.records.length+' grants.';
          const details=document.createElement('details'),caption=document.createElement('summary'),code=document.createElement('pre');
          caption.textContent='Review current policy and grants';code.textContent=JSON.stringify(preview.data,null,2);details.append(caption,code);
          const backup=document.createElement('button'),apply=document.createElement('button'),label=document.createElement('label'),confirm=document.createElement('input');
          backup.type=apply.type='button';backup.className='button secondary';backup.textContent='Download recovery backup';
          apply.className='button';apply.textContent='Use reviewed attachment';apply.disabled=true;
          confirm.type='checkbox';label.append(confirm,document.createTextNode(' I reviewed this policy and want to use it.'));
          let downloaded=false;
          function available(){apply.disabled=!(downloaded&&confirm.checked);}
          confirm.onchange=available;
          backup.onclick=()=>{
            try{
              const bytes=new Blob([JSON.stringify({exportedAt:new Date().toISOString(),...preview},null,2)],{type:'application/json'});
              const url=URL.createObjectURL(bytes),link=document.createElement('a');link.href=url;link.download='wcspedia-entitlements-recovery-backup.json';link.hidden=true;document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
              downloaded=true;available();status.textContent='Backup download requested. Keep it before using the reviewed attachment.';
            }catch(problem){status.textContent=problem.message;}
          };
          apply.onclick=async()=>{
            if(!downloaded||!confirm.checked||apply.disabled)return;
            apply.disabled=true;inspect.disabled=true;confirm.disabled=true;apply.setAttribute('aria-busy','true');
            try{await adapter.reconcileEntitlementAttachment();status.textContent='Attachment reference recovered. Select Try again to load Entitlements.';review.replaceChildren();inspect.hidden=true;}
            catch(problem){status.textContent=problem.message+' Review recovery again before another attempt.';review.replaceChildren();inspect.disabled=false;}
            finally{apply.removeAttribute('aria-busy');}
          };
          review.append(summary,details,backup,label,apply);
          status.textContent='Review the grants and download a backup before continuing. Only the saved reference will change.';
        }catch(problem){status.textContent=problem.message;}
        finally{inspect.disabled=false;inspect.removeAttribute('aria-busy');}
      };
    }
  }
})();

  return pageReady;
})();
