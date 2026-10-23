/* Reader-only styling of Confluence's own sidebar. Never creates navigation,
 * moves tree controls, replaces collapse handlers or fetches a second tree. */
(function (w,d) {
  'use strict';
  if(w.WCSReaderSidebar)return;
  var host=null,observer=null,queued=false,destroyed=false,revealOwned=false;
  var links=new Map(),checks=new Map(),pending=[],running=0,generation=0,controllers=new Set(),leafMarkers=new Set();
  function config(){
    var c=w.WCS_ARTICLE_DISCUSSION_CONFIG||w.WCS_ADD_DOCUMENT_CONFIG||{};
    var root=String(c.rootPageId||''),context=c.contextPath||'/confluence';
    if(!/^[1-9]\d*$/.test(root)||!c.spaceKey||!/^\/(?:[\w-]+\/?)*$/.test(context))return null;
    return {menus:Object.assign({},c.areaPageIds||{},c.pageIds||{},{insights:c.insightsPageId||c.nativePublication?.insightsPageId,working:c.workingRootPageId||c.nativePublication?.workingRootPageId}),root:root,context:context.replace(/\/$/,''),space:c.spaceKey,
      excluded:[root,c.workingRootPageId,c.nativePublication?.workingRootPageId,c.insightsPageId,c.nativePublication?.insightsPageId,c.workspacePageId].concat(Object.values(c.pageIds||{}),Object.values(c.areaPageIds||{})).filter(Boolean).map(String),
      working:String(c.workingRootPageId||c.nativePublication?.workingRootPageId||'')};
  }
  function pageId(href){
    try{var u=new URL(href,w.location.href);if(u.origin!==w.location.origin||u.hash)return null;
      if(/\/pages\/viewpage\.action$/.test(u.pathname))return /^[1-9]\d*$/.test(u.searchParams.get('pageId')||'')?u.searchParams.get('pageId'):null;
      return (u.pathname.match(/\/spaces\/[^/]+\/pages\/([1-9]\d*)(?:\/|$)/)||[])[1]||null;
    }catch(_){return null;}
  }
  var iconPaths={
    insights:'M4 4h16v16H4z M8 8h8 M8 12h8 M8 16h4',
    'credit-approval-control':'M12 3l8 4v5c0 5-8 9-8 9S4 17 4 12V7z M8 12l3 3 5-6',
    'credit-information-management':'M3 5h18v14H3z M7 9h10 M7 13h4',
    'credit-management-reporting':'M4 3v18h17 M8 17v-5 M13 17V7 M18 17V4',
    'deal-closing':'M8 5V3h8v2 M5 5h14v16H5z M8 13l3 3 5-6',
    'documentation-pledging':'M6 3h8l4 4v14H6z M14 3v5h4 M9 12h6 M9 16h6',
    'emea-credit-admin':'M3 12h18 M12 3c-5 5-5 13 0 18 M12 3c5 5 5 13 0 18 M21 12a9 9 0 1 1-18 0 9 9 0 1 1 18 0',
    'loan-management':'M3 9l9-6 9 6z M5 11v8 M10 11v8 M14 11v8 M19 11v8 M3 21h18',
    'regional-operating-manuals':'M12 5C8 2 3 4 3 4v16s5-2 9 1c4-3 9-1 9-1V4s-5-2-9 1v16',
    mine:'M3 7h18v14H3z M8 7V3h8v4 M3 12h18 M10 12v3h4v-3',
    review:'M12 8a3 3 0 1 1-6 0 3 3 0 1 1 6 0 M3 21v-3a6 6 0 0 1 9-5 M15 17l2 2 4-5',
    saved:'M6 3h12v18l-6-4-6 4z',
    entitlements:'M5 10h14v11H5z M8 10V7a4 4 0 0 1 8 0v3 M12 14v3',
    working:'M3 7V5h6l2 2h10v13H3z M9 13h6 M12 10v6',
    home:'M3 11l9-8 9 8 M6 9v12h12V9 M10 21v-7h4v7'
  };
  function nativeId(a){
    var id=pageId(a.getAttribute('href'));if(id)return id;
    try{var u=new URL(a.getAttribute('href'),w.location.href);if(u.origin!==w.location.origin||u.hash||!u.pathname.includes('/display/'))return null;
      return (a.closest('.plugin_pagetree_children_span')?.id.match(/^childrenspan([1-9]\d*)-/)||[])[1]||null;
    }catch(_){return null;}
  }
  function cleanTitle(a,id,record){
    // Only the generated suffix for this exact page ID; never change stored titles.
    var walker=d.createTreeWalker(a,4),nodes=[],node;
    while((node=walker.nextNode()))nodes.push(node);
    var suffix=new RegExp('\\s*[·]\\s*WCS\\s+'+id+'\\s*$');
    for(var i=nodes.length-1;i>=0;i--){node=nodes[i];if(!node.nodeValue.trim())continue;
      var clean=node.nodeValue.replace(suffix,'');if(clean!==node.nodeValue&&clean.trim()){
        record.title={node:node,original:node.nodeValue,clean:clean};node.nodeValue=clean;
      }break;
    }
  }
  function markLeaves(){
    host.querySelectorAll('.plugin_pagetree_childtoggle_container').forEach(function(marker){
      var leaf=!marker.querySelector('a,button,[role=button],[data-type=toggle]');
      marker.classList.toggle('wcs-native-leaf-marker',leaf);if(leaf)leafMarkers.add(marker);else leafMarkers.delete(marker);
    });
  }
  function pump(){
    while(running<3&&pending.length){var task=pending.shift();running++;task().finally(function(){running--;pump();});}
  }
  function verified(id,c){
    var key=c.root+':'+c.space+':'+id;
    if(checks.has(key))return checks.get(key);
    var promise=new Promise(function(resolve){pending.push(async function(){
      if(destroyed||!active()){resolve(false);return;}
      var controller=new AbortController(),timer=w.setTimeout(function(){controller.abort();},6000);controllers.add(controller);
      try{
        var response=await w.fetch(c.context+'/rest/api/content/'+id+'?expand=space,ancestors,metadata.labels',{credentials:'same-origin',headers:{Accept:'application/json'},signal:controller.signal});
        if(!response.ok){resolve(false);return;}
        var page=await response.json(),ancestors=(page.ancestors||[]).map(function(a){return String(a.id);}),labels=((page.metadata||{}).labels||{}).results||[];
        resolve(String(page.id)===id&&page.type==='page'&&page.status==='current'&&page.space?.key===c.space&&ancestors.includes(c.root)&&!ancestors.includes(c.working)&&['wcs-published','wcs-reader'].every(function(name){return labels.some(function(l){return l.name===name;});}));
      }catch(_){resolve(false);}finally{w.clearTimeout(timer);controllers.delete(controller);}
    });});
    checks.set(key,promise);pump();return promise;
  }
  function enhance(){
    var c=config(),epoch=generation;markLeaves();
    host.querySelectorAll('a[href]').forEach(function(a){
      if(links.has(a)||a.matches('[role=button],[aria-expanded],.plugin_pagetree_childtoggle,[data-type=toggle]')||a.closest('.acs-side-bar-footer'))return;
      var original=a.getAttribute('href'),id=nativeId(a);if(!id)return;
      var icon=d.createElementNS('http://www.w3.org/2000/svg','svg');icon.setAttribute('viewBox','0 0 24 24');icon.setAttribute('width','16');icon.setAttribute('height','16');icon.setAttribute('aria-hidden','true');icon.setAttribute('focusable','false');icon.setAttribute('class','wcs-native-page-icon');
      var path=d.createElementNS(icon.namespaceURI,'path');var menu=c&&Object.keys(c.menus).find(function(key){return String(c.menus[key])===id;});path.setAttribute('d',iconPaths[menu]||(c&&c.excluded.includes(id)?iconPaths.working:iconPaths['documentation-pledging']));icon.append(path);a.prepend(icon);
      var record={original:original,rewritten:null,icon:icon};links.set(a,record);a.setAttribute('data-wcs-native-page-link','');
      if(c&&c.excluded.includes(id))return;cleanTitle(a,id,record);if(!c)return;
      verified(id,c).then(function(ok){
        if(!ok||destroyed||epoch!==generation||!active()||!host?.contains(a)||a.getAttribute('href')!==original)return;
        record.rewritten=c.context+'/pages/viewpage.action?pageId='+c.root+'#/published/'+id;
        a.setAttribute('href',record.rewritten);
      });
    });
  }
  function active(){
    if(!w.location||w.top!==w.self)return false;
    if(d.querySelector('#editpageform,#content-editor,body.contenteditor')||/[?&](?:wcsNativeUi=1|pageVersion=|preview=)/.test(w.location.search))return false;
    if(d.getElementById('wcspedia'))return !!d.querySelector('#wcspedia .detail-page');
    return !!d.querySelector('#main-content .wcs-native-article,.wiki-content .wcs-native-article')&&!!d.body.getAttribute('data-wcs-active-style-flags');
  }
  function reset(){
    generation++;controllers.forEach(function(c){c.abort();});checks.clear();
    links.forEach(function(record,a){if(record.rewritten&&a.getAttribute('href')===record.rewritten)a.setAttribute('href',record.original);if(record.title&&record.title.node.nodeValue===record.title.clean)record.title.node.nodeValue=record.title.original;record.icon.remove();a.removeAttribute('data-wcs-native-page-link');});links.clear();
    leafMarkers.forEach(function(marker){marker.classList.remove('wcs-native-leaf-marker');});leafMarkers.clear();
    if(host)host.classList.remove('wcs-reader-navigation');
    host=null;d.body?.removeAttribute('data-wcs-reader-nav');
    if(revealOwned){revealOwned=false;d.body.classList.add('citi-hide-sidebar');}
  }
  function refresh(){
    if(destroyed||!d.body)return;
    if(!active()){reset();return;}
    var native=d.querySelector('.ia-fixed-sidebar,.acs-side-bar,#sidebar');
    if(!native){reset();return;} // No native tree means no sidebar; never synthesize one.
    if(host!==native){if(host)reset();host=native;}
    host.classList.add('wcs-reader-navigation');
    d.body.setAttribute('data-wcs-reader-nav','native');
    // Let the theme restore its own sidebar/content layout. Native collapsed
    // classes and preferences remain entirely under Confluence's control.
    if(d.body.classList.contains('citi-hide-sidebar')){revealOwned=true;d.body.classList.remove('citi-hide-sidebar');}
    enhance();
  }
  function schedule(){if(!queued){queued=true;Promise.resolve().then(function(){queued=false;refresh();});}}
  function start(){
    refresh();if(observer||!d.body)return;
    observer=new MutationObserver(function(changes){
      if(changes.some(function(c){
        if(c.type==='attributes')return c.target===d.body&&((c.attributeName==='data-wcs-active-style-flags')||(active()&&d.body.classList.contains('citi-hide-sidebar')));
        return Array.from(c.addedNodes).concat(Array.from(c.removedNodes)).some(function(n){return n.nodeType===1;});
      }))schedule();
    });
    observer.observe(d.body,{childList:true,subtree:true,attributes:true,attributeFilter:['data-wcs-active-style-flags','class']});
  }
  function destroy(){destroyed=true;observer?.disconnect();observer=null;reset();d.removeEventListener('DOMContentLoaded',start);w.removeEventListener('hashchange',schedule);}
  w.WCSReaderSidebar={refresh:refresh,destroy:destroy};
  d.addEventListener('DOMContentLoaded',start);w.addEventListener('hashchange',schedule);
  if(d.body)start();
})(window,document);
