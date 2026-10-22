/* Reader-only navigation. Reuses the native permission-filtered page tree;
 * no extra REST requests, copied page bodies or replacement header. */
(function (w,d) {
  'use strict';
  if(w.WCSReaderSidebar)return;
  var host=null,rail=null,created=false,collapsed=false,queued=false,observer=null,frame=0,destroyed=false;
  var decorations=new Map();
  var names=['Insights','Blogs','Credit Approval Control','Credit Information Management','Credit Management Reporting','Deal Closing','Documentation Pledging','EMEA Credit Admin','Loan Management','Regional Operating Manuals'];
  var paths=['M4 4h16v16H4zM8 8h8M8 12h8M8 16h5','M4 4h16v16H4zM8 8h8M8 12h8M8 16h5','M12 3l8 4v6c0 5-8 8-8 8s-8-3-8-8V7zM8 12l3 3 5-6','M4 5h16v14H4zM8 9h8M8 13h4','M4 20V4M4 20h17M8 16v-4M13 16V8M18 16V5','M4 6h16v14H4zM8 6V3h8v3M9 13l2 2 4-4','M6 3h9l4 4v14H6zM14 3v5h5M9 12h7M9 16h7','M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18M3 12h18M12 3c-5 5-5 13 0 18 5-5 5-13 0-18','M3 9l9-6 9 6H3M5 10v8m7-8v8m7-8v8M3 21h18','M3 4h7l2 2 2-2h7v16h-7l-2 1-2-1H3zM12 6v15'];
  function svg(path){return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="'+path+'"/></svg>';}
  function active(){
    if(!w.location)return false;
    if(d.querySelector('#editpageform,#content-editor,body.contenteditor')||/[?&](?:wcsNativeUi=1|pageVersion=|preview=)/.test(w.location.search))return false;
    if(d.getElementById('wcspedia'))return !!d.querySelector('#wcspedia .detail-page');
    return !!d.querySelector('.wcs-native-article') && !!d.body.getAttribute('data-wcs-active-style-flags');
  }
  function position(){
    frame=0;if(!host)return;
    var bottom=12;
    d.querySelectorAll('#header,#navigation,.wcs-header,[data-wcs-header],.aui-header').forEach(function(node){var r=node.getBoundingClientRect();if(r.height>0&&r.height<180&&r.bottom>0)bottom=Math.max(bottom,r.bottom+12);});
    d.body.style.setProperty('--wcs-reader-nav-top',Math.min(bottom,200)+'px');
  }
  function schedulePosition(){if(host&&!frame)frame=w.requestAnimationFrame(position);}
  function mark(node,name,value){
    if(!node)return;
    if(!decorations.has(node))decorations.set(node,new Map());
    var original=decorations.get(node);if(!original.has(name))original.set(name,node.getAttribute(name));
    if(node.getAttribute(name)!==value)node.setAttribute(name,value);
  }
  function pageId(href){try{var url=new URL(href,w.location.href);if(url.origin!==w.location.origin)return '';return (url.hash.match(/^#\/published\/(\d+)/)||[])[1]||url.searchParams.get('pageId')||(url.pathname.match(/\/pages\/(\d+)(?:\/|$)/)||[])[1]||'';}catch(_){return '';}}
  function decorateTree(){
    var current=pageId(w.location.href);
    host.querySelectorAll('a[href]').forEach(function(link){
      if(rail.contains(link))return;
      if(link.matches('.plugin_pagetree_childtoggle'))return;
      var selected=!!current&&pageId(link.href)===current||link.getAttribute('aria-current')==='page'||!!link.closest('.plugin_pagetree_current');
      mark(link,'data-wcs-reader-current',String(selected));
    });
  }
  function decorateBranch(link){
    var li=link.closest('li');if(!li)return;
    mark(link,'data-wcs-reader-collection','');
    var details=link.closest('summary')?.parentElement;
    if(details?.tagName==='DETAILS'){
      mark(details.querySelector('summary'),'data-wcs-reader-chevron','');
      mark(details.querySelector('summary'),'data-wcs-reader-open',String(details.open));
      mark(li,'data-wcs-reader-branch',details.open?'open':'closed');return;
    }
    var toggle=Array.from(li.querySelectorAll('.plugin_pagetree_childtoggle,button[aria-expanded],a[aria-expanded]')).find(function(node){return node!==link&&node.closest('li')===li;});
    if(!toggle)return;
    mark(li,'data-wcs-reader-branch-row','');
    mark(toggle,'data-wcs-reader-chevron','');
    var expanded=toggle.getAttribute('aria-expanded');
    if(expanded===null){
      var classes=toggle.className+' '+(toggle.querySelector('[class]')?.className||'');
      var image=toggle.querySelector('img');
      var state=String(classes)+' '+(image?.getAttribute('src')||'');
      if(/closed|collapsed|plus/.test(state))expanded='false';
      else if(/opened|expanded|minus/.test(state))expanded='true';
      else{var children=Array.from(li.children).find(function(node){return node.matches('ul,.plugin_pagetree_children');});expanded=String(!!children&&!children.hidden&&w.getComputedStyle(children).display!=='none');}
    }
    mark(toggle,'data-wcs-reader-open',expanded);
    mark(toggle,'aria-label',(expanded==='true'?'Collapse ':'Expand ')+link.textContent.trim());
    mark(li,'data-wcs-reader-branch',expanded==='true'?'open':'closed');
  }
  function reset(){
    if(host){host.classList.remove('wcs-reader-navigation');if(created)host.remove();}
    d.querySelectorAll('[data-wcs-reader-main-icon]').forEach(function(el){el.remove();});
    decorations.forEach(function(attrs,node){attrs.forEach(function(value,name){if(value===null)node.removeAttribute(name);else node.setAttribute(name,value);});});decorations.clear();
    rail?.remove();host=null;rail=null;created=false;
    d.body?.removeAttribute('data-wcs-reader-nav');d.body?.style.removeProperty('--wcs-reader-nav-top');
  }
  function refresh(){
    if(destroyed)return;
    if(!d.body||!active()){reset();return;}
    if(host&&!host.isConnected)reset();
    if(!host){
      host=d.querySelector('.ia-fixed-sidebar,.acs-side-bar,#sidebar');
      if(!host){host=d.createElement('aside');host.setAttribute('aria-label','Knowledge navigation');d.body.append(host);created=true;}
      host.classList.add('wcs-reader-navigation');
      rail=d.createElement('div');rail.className='wcs-reader-nav-rail';
      var toggle=d.createElement('button');toggle.type='button';toggle.className='wcs-reader-nav-toggle';
      toggle.innerHTML=svg('M5 3.5h14a1.5 1.5 0 0 1 1.5 1.5v14a1.5 1.5 0 0 1-1.5 1.5H5A1.5 1.5 0 0 1 3.5 19V5A1.5 1.5 0 0 1 5 3.5M9 3.5v17');
      toggle.addEventListener('click',function(){collapsed=!collapsed;refresh();});rail.append(toggle);
      var title=d.createElement('span');title.className='wcs-reader-nav-heading';title.textContent='Knowledge library';rail.append(title);
      var nav=d.createElement('nav');nav.className='wcs-reader-nav-shortcuts';nav.setAttribute('aria-label','Collections');rail.append(nav);
      host.prepend(rail);
    }
    d.body.setAttribute('data-wcs-reader-nav',collapsed?'collapsed':'expanded');
    var toggle=rail.querySelector('button');toggle.setAttribute('aria-expanded',String(!collapsed));toggle.setAttribute('aria-label',collapsed?'Expand knowledge sidebar':'Collapse knowledge sidebar');toggle.title=toggle.getAttribute('aria-label');
    var nav=rail.querySelector('nav'), entries=[];
    host.querySelectorAll('a[href]').forEach(function(link){
      if(rail.contains(link))return;
      var label=link.textContent.trim().replace(/[-_]/g,' '),index=names.findIndex(function(n){return n.toLowerCase()===label.toLowerCase();});
      if(index<0||entries.some(function(e){return e.index===index;}))return;
      try{var url=new URL(link.href,w.location.href);if(url.origin!==w.location.origin)return;}catch(_){return;}
      entries.push({index:index,title:names[index],href:link.href});
      decorateBranch(link);
      if(!link.querySelector('[data-wcs-reader-main-icon]')){var icon=d.createElement('span');icon.setAttribute('data-wcs-reader-main-icon','');icon.innerHTML=svg(paths[index]);link.prepend(icon);}
    });
    if(created){
      var config=w.WCS_CONFIG||{},catalog=w.WCSDiscoveryCatalog||w.WCSData||{};
      (catalog.areas||[]).forEach(function(area){var index=names.findIndex(function(n){return n===area.title;});if(index>=0)entries.push({index:index,title:area.title,href:'#/topic/'+encodeURIComponent(area.id)});});
      entries.unshift({index:0,title:'Insights',href:(config.pages?.insights||'#/insights')});
    }
    var fingerprint=JSON.stringify(entries);
    if(nav.dataset.entries!==fingerprint){nav.dataset.entries=fingerprint;nav.replaceChildren();entries.forEach(function(entry){var a=d.createElement('a');a.href=entry.href;a.title=entry.title;a.setAttribute('aria-label',entry.title);a.innerHTML=svg(paths[entry.index]);var span=d.createElement('span');span.textContent=entry.title;a.append(span);nav.append(a);});}
    decorateTree();
    position();
  }
  function schedule(){if(!queued){queued=true;Promise.resolve().then(function(){queued=false;refresh();});}}
  function start(){
    refresh();if(observer)return;
    observer=new MutationObserver(function(changes){if(changes.some(function(c){
      if(rail?.contains(c.target))return false;
      if(c.type==='attributes')return c.target===d.body&&c.attributeName==='data-wcs-active-style-flags'||!!host?.contains(c.target)&&c.target!==host;
      return Array.from(c.addedNodes).concat(Array.from(c.removedNodes)).some(function(n){return n.nodeType===1&&!n.matches('[data-wcs-reader-main-icon],.wcs-reader-nav-rail');});}))schedule();});
    observer.observe(d.body,{childList:true,subtree:true,attributes:true,attributeFilter:['data-wcs-active-style-flags','open','aria-expanded','aria-current','class','hidden','style','src']});
  }
  function destroy(){destroyed=true;observer?.disconnect();observer=null;reset();d.removeEventListener('DOMContentLoaded',start);w.removeEventListener('hashchange',schedule);w.removeEventListener('resize',schedulePosition);w.removeEventListener('scroll',schedulePosition);if(frame)w.cancelAnimationFrame(frame);}
  w.WCSReaderSidebar={refresh:refresh,destroy:destroy};
  d.addEventListener('DOMContentLoaded',start);w.addEventListener('hashchange',schedule);w.addEventListener('resize',schedulePosition);w.addEventListener('scroll',schedulePosition,{passive:true});
  if(d.body)start();
})(window,document);
