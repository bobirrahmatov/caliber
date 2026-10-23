/* Reader-only styling of Confluence's own sidebar. Never creates navigation,
 * moves tree controls, replaces collapse handlers or fetches a second tree. */
(function (w,d) {
  'use strict';
  if(w.WCSReaderSidebar)return;
  var host=null,observer=null,queued=false,destroyed=false,revealOwned=false;
  function active(){
    if(!w.location||w.top!==w.self)return false;
    if(d.querySelector('#editpageform,#content-editor,body.contenteditor')||/[?&](?:wcsNativeUi=1|pageVersion=|preview=)/.test(w.location.search))return false;
    if(d.getElementById('wcspedia'))return !!d.querySelector('#wcspedia .detail-page');
    return !!d.querySelector('#main-content .wcs-native-article,.wiki-content .wcs-native-article')&&!!d.body.getAttribute('data-wcs-active-style-flags');
  }
  function reset(){
    if(host)host.classList.remove('wcs-reader-navigation');
    host=null;d.body?.removeAttribute('data-wcs-reader-nav');
    if(revealOwned){revealOwned=false;d.body.classList.add('citi-hide-sidebar');}
  }
  function refresh(){
    if(destroyed||!d.body)return;
    if(!active()){reset();return;}
    var native=d.querySelector('.ia-fixed-sidebar,.acs-side-bar,#sidebar');
    if(!native){reset();return;} // No native tree means no sidebar; never synthesize one.
    if(host!==native){if(host)host.classList.remove('wcs-reader-navigation');host=native;}
    host.classList.add('wcs-reader-navigation');
    d.body.setAttribute('data-wcs-reader-nav','native');
    // Let the theme restore its own sidebar/content layout. Native collapsed
    // classes and preferences remain entirely under Confluence's control.
    if(d.body.classList.contains('citi-hide-sidebar')){revealOwned=true;d.body.classList.remove('citi-hide-sidebar');}
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
