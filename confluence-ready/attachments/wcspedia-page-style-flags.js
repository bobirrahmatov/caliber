/* Shared-header presentation helper. Uses the existing Citi theme's documented style functions.
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
  var interfaceRoot = '#wcspedia';
  var excluded = 'pre, code, textarea, [contenteditable="true"], .mce-content-body, #editor, #content-editor, #macro-browser, .macro-preview, [data-wcs-style-flags-ignore]';
  var editor = '#editpageform, #wysiwygTextarea, #content-editor, body.contenteditor';
  var owned = Object.create(null), applied = Object.create(null), markers = [], observer = null, timer = null;
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
    var requested = Object.create(null), optedOut = false;
    markers.forEach(function (node) {
      var value = node.hasAttribute('data-wcs-style-flags') ? node.getAttribute('data-wcs-style-flags').trim() : '';
      if (value.toLowerCase() === 'none') { optedOut = true; return; }
      var values = value ? value.split(/[\s,]+/) : flags;
      values.forEach(function (flag) { if (flags.indexOf(flag) !== -1) requested[flag] = true; });
    });
    return optedOut ? [] : flags.filter(function (flag) { return requested[flag]; });
  }

  function removeFlags(values) {
    var native = values.filter(function (flag) { return applied[flag]; });
    if (native.length && typeof window.citiStyleRemove === 'function') {
      try { window.citiStyleRemove.apply(window, native); }
      catch (error) { window.console.warn('[WCSpedia styling] Citi style removal failed.', error); }
    }
    values.forEach(function (flag) {
      if (document.body) document.body.classList.remove('citi-' + flag);
      delete owned[flag]; delete applied[flag];
    });
  }
  function release() {
    removeFlags(Object.keys(owned));
    if (document.body) document.body.removeAttribute('data-wcs-active-style-flags');
    markers = [];
  }

  function stopObserving() {
    if (observer) observer.disconnect();
    observer = null;
  }

  function relevantNode(node) {
    if (node.nodeType !== 1) return false;
    var relevant = selector + ', ' + interfaceRoot + ', ' + editor + ', meta[name="ajs-action"]';
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
    if(requested.length) document.body.setAttribute('data-wcs-active-style-flags', requested.join(' '));
    else document.body.removeAttribute('data-wcs-active-style-flags');
    removeFlags(Object.keys(owned).filter(function (flag) { return requested.indexOf(flag) === -1; }));
    var native = [];
    requested.forEach(function (flag) {
      var missing = !document.body.classList.contains('citi-' + flag);
      if (missing) owned[flag] = true;
      if (owned[flag] && (!applied[flag] || missing)) native.push(flag);
    });
    if (native.length && typeof window.citiStyleAdd === 'function') {
      try {
        window.citiStyleAdd.apply(window, native);
        native.forEach(function (flag) { applied[flag] = true; });
      } catch (error) { window.console.warn('[WCSpedia styling] Citi style application failed.', error); }
    }
    // Safe presentation fallback while the shared theme script is loading.
    requested.forEach(function (flag) {
      if (owned[flag] && !document.body.classList.contains('citi-' + flag)) document.body.classList.add('citi-' + flag);
    });
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
