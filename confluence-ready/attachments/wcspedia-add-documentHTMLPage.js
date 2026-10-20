/* Shared Confluence header: Add document renderer and startup.
 * Load the matching wcspedia-add-document.js before this file.
 * Own settings are WCS_ADD_DOCUMENT_CONFIG; WCS_CONFIG is never changed.
 * The upload builder replaces the revision token in this maintained source.
 */
(function () {
  'use strict';
  var revision = 'b76b4fbf7a16';
  function placeFloating(host) {
    // Portal out of themed headers: transforms/overflow there can clip fixed controls.
    var header = host.closest('#navHeader,#navBar,[role="banner"],header,#header,.aui-header');
    var frame = null, observer = null, stopped = false;
    host.setAttribute('data-wcs-floating-add', '');
    host.removeAttribute('data-wcs-before-create');
    document.body.append(host);
    function place() {
      frame = null;
      if (stopped || !host.isConnected) return;
      if (!header || !header.isConnected) header = document.querySelector('#navHeader,#navBar') || document.querySelector('[role="banner"],header,#header,.aui-header');
      var bottom = header && header.getClientRects().length ? header.getBoundingClientRect().bottom : 72;
      var height = window.visualViewport ? window.visualViewport.height : window.innerHeight;
      var top = Math.max(12, Math.min(Math.max(0, bottom) + 12, height - 72)) + 'px';
      if (host.style.getPropertyValue('--wcs-add-top') !== top) {
        host.style.setProperty('--wcs-add-top', top);
        window.dispatchEvent(new Event('wcspedia:add-position'));
      }
      if (observer && header && observedHeader !== header) {
        observer.disconnect(); observer.observe(header); observedHeader = header;
      }
    }
    function schedule() { if (!stopped && frame == null) frame = window.requestAnimationFrame(place); }
    var observedHeader = null;
    if (typeof window.ResizeObserver === 'function') observer = new window.ResizeObserver(schedule);
    place();
    window.addEventListener('resize', schedule);
    window.addEventListener('scroll', schedule, {passive:true, capture:true});
    if (window.visualViewport) window.visualViewport.addEventListener('resize', schedule);
    return function () {
      stopped = true;
      if (observer) observer.disconnect();
      if (frame != null) window.cancelAnimationFrame(frame);
      window.removeEventListener('resize', schedule);
      window.removeEventListener('scroll', schedule, true);
      if (window.visualViewport) window.visualViewport.removeEventListener('resize', schedule);
    };
  }
  function start() {
    // Included headers and older page macros can both contain a mount. Own
    // exactly one widget, including when Confluence evaluates this script twice.
    var selector = '[data-wcs-header-add-document],[data-wcs-add-document]';
    var hosts = Array.from(document.querySelectorAll(selector));
    var previous = window.WCSHeaderAddDocumentInstance;
    var host = previous && previous.host.isConnected ? previous.host :
      hosts.find(function (node) { return node.closest('#navHeader,#navBar'); }) ||
      hosts.find(function (node) { return node.hasAttribute('data-wcs-header-add-document'); });
    if (!host) return;
    hosts.forEach(function (duplicate) {
      if (duplicate !== host && !duplicate.contains(host)) duplicate.remove();
    });
    if (previous) {
      if (previous.host === host && previous.revision === revision) return;
      previous.dispose();
    }
    host.setAttribute('data-wcs-header-add-document', '');
    hosts = [host];
    var modules = window.WCSHeaderWidgetModules && window.WCSHeaderWidgetModules.addDocument;
    function error(host, message, code) {
      var button = document.createElement('button');
      button.type = 'button'; button.disabled = true; button.className = 'wcs-add-document-trigger';
      button.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg><span class="wcs-add-document-label">Add document</span>'; button.setAttribute('aria-label', 'Add document'); button.title = message;
      var shell = document.createElement('div'); shell.className = 'wcs-add-document'; shell.append(button);
      host.replaceChildren(shell); host.hidden = false; host.style.removeProperty('display');
      if (host.wcsStopFloating) host.wcsStopFloating();
      host.wcsStopFloating = placeFloating(host);
      host.dataset.wcsAddState = 'error';
      host.dataset.wcsAddMessage = message;
      host.dataset.wcsAddCode = code || 'CONFIGURATION';
      window.console?.warn('[WCSpedia Add document] ' + message);
    }
    function numeric(value, label) {
      if (!/^[1-9]\d*$/.test(String(value == null ? '' : value))) throw new Error('Set ' + label + ' to its numeric Confluence page ID in the header widget HTML.');
      return String(value);
    }
    hosts.forEach(function (host) {
      if (host.dataset.wcsHeaderWidgetStarted) return;
      if (!modules || modules.version !== revision || !modules.AddDocument || !modules.Confluence) {
        error(host, 'Load the matching wcspedia-add-document.js before wcspedia-add-documentHTMLPage.js. Use both files from the same upload package.', 'SCRIPT_PAIR');
        return;
      }
      try {
        var settings = window.WCS_ADD_DOCUMENT_CONFIG;
        if (!settings || settings.mode !== 'confluence') throw new Error('Configure the header widget settings before its two JavaScript files.');
        var context = settings.contextPath == null ? '/confluence' : settings.contextPath;
        if (typeof context !== 'string' || (context && !/^\/(?:[A-Za-z0-9_-]+\/?)*$/.test(context))) throw new Error('Use a plain Confluence context path in the header widget settings.');
        context = context.replace(/\/+$/, '');
        var rootPageId = numeric(settings.rootPageId, 'rootPageId');
        var attachmentPageId = numeric(settings.attachmentPageId, 'attachmentPageId');
        var workspacePageId = numeric(settings.workspacePageId, 'workspacePageId');
        var accessTimeout = settings.accessTimeoutMs == null ? 12000 : settings.accessTimeoutMs;
        if (!Number.isInteger(accessTimeout) || accessTimeout < 1000 || accessTimeout > 30000) throw new Error('Use an accessTimeoutMs between 1000 and 30000 in the header widget settings.');
        var configuration = {
          mode: 'confluence', authoringMode: settings.authoringMode, spaceKey: settings.spaceKey,
          nativePublication: settings.nativePublication, contextPath: context, rootPageId: rootPageId,
          attachmentPageId: attachmentPageId,
          workflowEndpoint: settings.workflowEndpoint || '', workspaceEndpoint: settings.workspaceEndpoint || ''
        };
        // Preserve explicitly configured JSON-host overrides on older installs.
        // New macros need only attachmentPageId; adapter defaults select entitlements.json.
        ['entitlementsPageId', 'entitlementsSource', 'entitlementsFilename'].forEach(function (key) {
          if (settings[key] != null && settings[key] !== '') configuration[key] = settings[key];
        });
        var adapter = modules.Confluence.create(configuration);
        var unavailable = !adapter.info().entitlementsConfigured ? 'Add document needs entitlements.json on the configured attachments page.' :
          !adapter.info().workflowConfigured || !adapter.info().workspaceConfigured ? 'Document creation is not connected.' : '';
        if (host.wcsStopFloating) host.wcsStopFloating();
        var stopPlacement = host.wcsStopFloating = placeFloating(host);
        var handle = modules.AddDocument.mount(host, {
          types: settings.types,
          createUrl: context + '/pages/viewpage.action?pageId=' + encodeURIComponent(workspacePageId) + '#/create',
          unavailableMessage: unavailable,
          accessTimeoutMs: accessTimeout,
          canCreate: async function (request) {
            var access = await adapter.loadAccess({signal: request.signal});
            if (access.creationMessage && !(access.effectivePermissions && access.effectivePermissions['content.create'] === true)) {
              var setupError = new Error(access.creationMessage);
              setupError.code = access.creationCode || 'CREATION_UNAVAILABLE';
              throw setupError;
            }
            return !!(access.effectivePermissions && access.effectivePermissions['content.create'] === true);
          },
          navigate: function (href) {
            // An open WCSpedia editor can retain its existing leave/save guard.
            // Pages without the app simply use the normal native page URL.
            var event = new CustomEvent('wcspedia:navigate', {cancelable: true, detail: {href: href}});
            if (!document.dispatchEvent(event)) return false;
            window.location.assign(href);
            return true;
          }
        });
        var retryTimer = null, retryCount = 0, disposed = false;
        function settle(ready) {
          if (disposed || ready || retryCount >= 1 || !['ACCESS_TIMEOUT', 'SEARCH_TIMEOUT', 'TIMEOUT', 'NETWORK'].includes(host.dataset.wcsAddCode)) return;
          // A transient startup failure must not disable an eligible author's
          // button for the entire visit. Retry once; never retry denied access.
          retryTimer = window.setTimeout(function () {
            retryTimer = null;
            if (disposed || !host.isConnected) return;
            retryCount++;
            handle.update({}).then(settle);
          }, 2000);
        }
        handle.ready.then(settle);
        // Read-only diagnostics and an explicit retry hook for the space owner.
        // A retry always repeats the real entitlement/native permission checks.
        function retry() {
          if (disposed) return;
          if (retryTimer != null) window.clearTimeout(retryTimer);
          retryTimer = null; retryCount = 0;
          handle.update({}).then(settle);
        }
        host.addEventListener('wcspedia:retry-add-document', retry);
        host.dataset.wcsHeaderWidgetStarted = revision;
        function onShow(event) {
          if (!event.persisted || disposed) return;
          stopPlacement = host.wcsStopFloating = placeFloating(host);
          retry();
        }
        function onHide(event) {
          stopPlacement();
          if (retryTimer != null) window.clearTimeout(retryTimer);
          retryTimer = null;
          if (event.persisted) return;
          disposed = true;
          host.removeEventListener('wcspedia:retry-add-document', retry);
          window.removeEventListener('pageshow', onShow);
          window.removeEventListener('pagehide', onHide);
          handle.destroy(); delete host.dataset.wcsHeaderWidgetStarted;
          if (window.WCSHeaderAddDocumentInstance?.host === host) delete window.WCSHeaderAddDocumentInstance;
        }
        window.WCSHeaderAddDocumentInstance = {host: host, revision: revision, dispose: function () { onHide({persisted:false}); }};
        window.addEventListener('pagehide', onHide);
        window.addEventListener('pageshow', onShow);
      } catch (reason) {
        if (stopPlacement) stopPlacement();
        var invalidSource = settings && settings.entitlementsSource != null && settings.entitlementsSource !== 'attachment';
        error(host, invalidSource ? 'Entitlements use the JSON attachment. Remove entitlementsSource or set it to "attachment" in the header widget HTML.' : reason && reason.message || 'The Add document widget is unavailable. Check its header settings.', reason && reason.code);
      }
    });
  }
  // Header macros can run before or after the body has finished parsing.
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, {once: true});
  else start();
})();
