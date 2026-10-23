/* Shared-header presentation helper. Uses native labels/markers and scoped shared CSS.
 * No network requests, saved preferences or permission changes. Shared CSS
 * supplies narrowly scoped native-chrome rules on marked article views.
 * Child documents opt in with the wcs-page-style-v1 native Anchor or an explicit
 * data-wcs-document-page/data-wcs-style-flags marker. App pages never opt in.
 */
(function (window, document) {
  'use strict';
  if (window.WCSPageStyleFlags) return;
  var flags = ['hide-title', 'hide-actions', 'hide-comments', 'hide-footer'];
  var selector = '[data-wcs-document-page][data-wcs-style-flags], span[id$="wcs-page-style-v1"], a[id$="wcs-page-style-v1"], a[name$="wcs-page-style-v1"]';
  var labelSelector = '#labels-section .aui-label, #labels-section .label, #labels-section a';
  var treeSelector = '.ia-fixed-sidebar, .acs-side-bar, #sidebar, .plugin_pagetree';
  var cleanedTitles = new Map();
  var interfaceRoot = '#wcspedia';
  var excluded = 'pre, code, textarea, [contenteditable="true"], .mce-content-body, #editor, #content-editor, #macro-browser, .macro-preview, [data-wcs-style-flags-ignore]';
  var editor = '#editpageform, #wysiwygTextarea, #content-editor, body.contenteditor';
  var markers = [], observer = null, timer = null;
  var booting = false, queued = false, suspended = false, destroyed = false;

  function isPageView() {
    try {
      if (window.top !== window.self) return false;
      var url = new URL(window.location.href), path = url.pathname;
      if (url.searchParams.get('wcsNativeUi') === '1') return false;
      if (!(/\/pages\/viewpage\.action$/.test(path) || /\/display\/[^/]+\/.+/.test(path) || /\/spaces\/[^/]+\/pages\/\d+(?:\/.*)?$/.test(path))) return false;
      if (/\/(?:admin|plugins|preview|editpage|createpage|pagehistory)(?:\/|\.|$)/i.test(path)) return false;
      var blocked = false;
      url.searchParams.forEach(function (value, key) {
        if (/preview/i.test(key) || /^pageVersion$/i.test(key) || /^(?:action|mode)$/i.test(key) && /^(?:edit|create|preview|history)$/i.test(value)) blocked = true;
      });
      if (blocked || document.querySelector(editor)) return false;
      var action = document.querySelector('meta[name="ajs-action"]');
      return !action || action.getAttribute('content') === 'viewpage';
    } catch (_) { return false; }
  }

  function inContent(node) {
    if (node.closest(excluded)) return false;
    return !!node.closest('#main-content, .wiki-content');
  }

  function requestedFlags() {
    // Older installed application macros may still carry the previous generic
    // marker. Even an explicit document marker must not hide their host chrome.
    if (document.querySelector(interfaceRoot)) { markers = []; return []; }
    markers = Array.prototype.filter.call(document.querySelectorAll(selector), inContent);
    var labelNodes = Array.prototype.filter.call(document.querySelectorAll(labelSelector), function (node) { return !node.closest(excluded) && flags.indexOf(node.textContent.trim()) !== -1; });
    var requested = Object.create(null), optedOut = false;
    markers.forEach(function (node) {
      var value = node.hasAttribute('data-wcs-style-flags') ? node.getAttribute('data-wcs-style-flags').trim() : '';
      if (value.toLowerCase() === 'none') { optedOut = true; return; }
      var values = value ? value.split(/[\s,]+/) : flags;
      values.forEach(function (flag) { if (flags.indexOf(flag) !== -1) requested[flag] = true; });
    });
    labelNodes.forEach(function (node) { requested[node.textContent.trim()] = true; });
    markers = markers.concat(labelNodes);
    return optedOut ? [] : flags.filter(function (flag) { return requested[flag]; });
  }

  function restoreTreeTitles() {
    cleanedTitles.forEach(function (value, node) { if (node.isConnected && node.nodeValue === value.clean) node.nodeValue = value.original; });
    cleanedTitles.clear();
  }

  function release() {
    if (document.body) document.body.removeAttribute('data-wcs-active-style-flags');
    restoreTreeTitles();
    markers = [];
  }

  function cleanTreeTitles() {
    // Presentation only: retain the native unique title, href, page ID and all
    // tree controls. Match the generated suffix to that exact link's page ID.
    document.querySelectorAll(treeSelector).forEach(function (tree) {
      tree.querySelectorAll('a[href]').forEach(function (link) {
        try {
          var url = new URL(link.getAttribute('href'), window.location.href);
          if (url.origin !== window.location.origin) return;
          var id = (url.hash.match(/^#\/published\/([1-9]\d*)$/) || [])[1] || url.searchParams.get('pageId') || (url.pathname.match(/\/pages\/(\d+)(?:\/|$)/) || [])[1];
          if (!/^[1-9]\d{0,19}$/.test(id || '')) return;
          var suffix = ' · WCS ' + id, walker = document.createTreeWalker(link, 4), node;
          while ((node = walker.nextNode())) {
            if (node.nodeValue.trimEnd().endsWith(suffix)) {
              var original = node.nodeValue, clean = original.trimEnd().slice(0,-suffix.length);
              cleanedTitles.set(node,{original:original,clean:clean});node.nodeValue = clean;
            }
          }
        } catch (_) { /* Leave unknown native navigation formats unchanged. */ }
      });
    });
  }

  function stopObserving() {
    if (observer) observer.disconnect();
    observer = null;
  }

  function relevantNode(node) {
    if (node.nodeType !== 1) return false;
    var relevant = selector + ', ' + labelSelector + ', ' + treeSelector + ', ' + interfaceRoot + ', ' + editor + ', meta[name="ajs-action"]';
    if (node.closest(treeSelector)) return true;
    return node.matches(relevant) || !!node.querySelector(relevant);
  }

  function observe() {
    if (observer || !window.MutationObserver || !document.documentElement) return;
    observer = new window.MutationObserver(function (changes) {
      var changed = markers.some(function (marker) { return !marker.isConnected; });
      if (!changed) changed = changes.some(function (change) {
        if (change.type === 'attributes') {
          if (change.attributeName === 'class') return change.target === document.body && (markers.length > 0 || document.body.classList.contains('contenteditor') || /(?:^|\s)contenteditor(?:\s|$)/.test(change.oldValue || ''));
          return change.attributeName === 'data-wcs-style-flags' || change.attributeName === 'data-wcs-document-page' ||
            change.target.matches('meta[name="ajs-action"]') ||
            markers.indexOf(change.target) !== -1 || relevantNode(change.target) || change.oldValue === 'wcspedia';
        }
        return Array.prototype.some.call(change.addedNodes, relevantNode) || Array.prototype.some.call(change.removedNodes, relevantNode);
      });
      if (changed && !queued) {
        queued = true;
        Promise.resolve().then(function () { queued = false; refresh(); });
      }
    });
    observer.observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeOldValue: true, attributeFilter: ['data-wcs-style-flags', 'data-wcs-document-page', 'id', 'name', 'content', 'class'] });
  }

  function refresh() {
    if (destroyed || suspended) return [];
    if (!document.body || !isPageView()) {
      release();
      if (!booting) stopObserving();
      return [];
    }
    var requested = requestedFlags();
    // Native URLs remain usable for administrators; the prominent article link
    // opens the very same reader component as My Workspace. No extra requests.
    if (!document.querySelector(interfaceRoot)) {
      var payload = document.querySelector('#main-content script#wcs-published-reader[type="application/json"], .wiki-content script#wcs-published-reader[type="application/json"]');
      if (payload && !document.getElementById('wcs-open-published-reader')) {
        try {
          var data = JSON.parse(payload.textContent), rootId = payload.getAttribute('data-wcs-reader-root');
          var currentId = new URL(window.location.href).searchParams.get('pageId') || (window.location.pathname.match(/\/pages\/(\d+)/) || [])[1] || (document.querySelector('meta[name="ajs-page-id"]') || {}).content;
          if (data.format === 1 && data.pageId === currentId && /^[1-9]\d{0,19}$/.test(rootId)) {
            var context = window.location.pathname.split(/\/(?:spaces|display|pages)\//)[0];
            var link = document.createElement('a');link.id = 'wcs-open-published-reader';link.className = 'wcs-open-published-reader';
            link.href = context + '/pages/viewpage.action?pageId=' + rootId + '#/published/' + data.pageId;
            link.textContent = 'Read article in WCSpedia';
            (document.getElementById('main-content') || payload.closest('.wiki-content')).prepend(link);
          }
        } catch (_) { /* Native body remains readable if its reader metadata is unavailable. */ }
      }
    }
    if(requested.length) document.body.setAttribute('data-wcs-active-style-flags', requested.join(' '));
    else document.body.removeAttribute('data-wcs-active-style-flags');
    if (requested.length) cleanTreeTitles();
    else restoreTreeTitles();
    if (booting || requested.length) observe();
    else stopObserving();
    return requested.slice();
  }

  function start() {
    if (destroyed) return;
    suspended = false;
    if (timer !== null) window.clearTimeout(timer);
    booting = true;
    // Late header/body parsing is supported for five seconds, without polling.
    timer = window.setTimeout(function () { timer = null; booting = false; if (!refresh().length) stopObserving(); }, 5000);
    if (isPageView()) observe();
    refresh();
  }

  function scriptLoaded(event) { if (event.target && event.target.tagName === 'SCRIPT') refresh(); }

  function pause() {
    suspended = true;
    booting = false;
    if (timer !== null) window.clearTimeout(timer);
    timer = null;
    stopObserving();
    release();
  }

  function destroy() {
    if (destroyed) return;
    pause();
    destroyed = true;
    document.removeEventListener('DOMContentLoaded', start);
    document.removeEventListener('load', scriptLoaded, true);
    window.removeEventListener('load', start);
    window.removeEventListener('pageshow', start);
    window.removeEventListener('pagehide', pause);
    window.removeEventListener('popstate', refresh);
  }

  window.WCSPageStyleFlags = Object.freeze({ refresh: refresh, destroy: destroy });
  document.addEventListener('DOMContentLoaded', start);
  document.addEventListener('load', scriptLoaded, true);
  window.addEventListener('load', start);
  window.addEventListener('pageshow', start);
  window.addEventListener('pagehide', pause);
  window.addEventListener('popstate', refresh);
  start();
})(window, document);
