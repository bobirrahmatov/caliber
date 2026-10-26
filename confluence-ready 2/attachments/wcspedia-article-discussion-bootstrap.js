/* Shared-header entry: no article/comment requests until the reader nears the bottom. */
(function (global, doc) {
  'use strict';
  if (global.WCSArticleDiscussionBootstrap) return;
  var config = global.WCS_ARTICLE_DISCUSSION_CONFIG, host, observer, view, controller, pending = false, stopped = false;
  var ownsClass = false, bundlePromise, generation = 0;
  function pageId() {
    if (!config || global.top !== global.self || doc.querySelector('#wcspedia, #editpageform, #wysiwygTextarea, #content-editor, body.contenteditor')) return '';
    var url = new URL(global.location.href), action = doc.querySelector('meta[name="ajs-action"]');
    if (url.searchParams.get('wcsNativeUi') === '1' || action && action.content !== 'viewpage') return '';
    var space = doc.querySelector('meta[name="ajs-space-key"]');
    if (space && space.content && space.content !== config.spaceKey) return '';
    if (!(/\/pages\/viewpage\.action$/.test(url.pathname) || /\/display\/[^/]+\/.+/.test(url.pathname) || /\/spaces\/[^/]+\/pages\/\d+(?:\/.*)?$/.test(url.pathname))) return '';
    var blocked = false;
    url.searchParams.forEach(function (value, key) { if (/preview/i.test(key) || /^pageVersion$/i.test(key) || /^(action|mode)$/i.test(key) && /^(edit|create|preview|history)$/i.test(value)) blocked = true; });
    if (blocked) return '';
    var meta = doc.querySelector('meta[name="ajs-page-id"]');
    var id = meta && meta.content || url.searchParams.get('pageId') || (url.pathname.match(/\/pages\/(\d+)(?:\/|$)/) || [])[1] || '';
    var excluded = [config.rootPageId, config.attachmentPageId, config.workingRootPageId, config.insightsPageId].concat(Object.values(config.pageIds || {}), Object.values(config.areaPageIds || {}), config.excludePageIds || []);
    return /^[1-9]\d*$/.test(id) && !excluded.map(String).includes(String(id)) ? String(id) : '';
  }
  function nativeUrl(id) { return (config.contextPath || '/confluence') + '/pages/viewpage.action?pageId=' + encodeURIComponent(id) + '&wcsNativeUi=1#comments-section'; }
  function loadBundle() {
    if (global.WCSArticleComments && global.WCSArticleDiscussion && global.WCSArticleFeedback) return Promise.resolve();
    if (bundlePromise) return bundlePromise;
    bundlePromise = new Promise(function (resolve, reject) {
      var url = new URL(config.bundleUrl, global.location.href), context = config.contextPath || '/confluence';
      if (url.origin !== global.location.origin || url.username || url.password || !url.pathname.startsWith(context + '/download/attachments/')) { reject(new Error('Invalid discussion attachment URL.')); return; }
      var script = doc.createElement('script'), timer;
      function finish(error) { clearTimeout(timer); script.onload = script.onerror = null; if (error) { script.remove(); reject(error); } else resolve(); }
      script.src = url.href; script.async = true;
      script.onload = function () { finish(global.WCSArticleComments && global.WCSArticleDiscussion && global.WCSArticleFeedback ? null : new Error('Incomplete discussion bundle.')); };
      script.onerror = function () { finish(new Error('Discussion could not be loaded.')); };
      timer = setTimeout(function () { finish(new Error('Discussion loading timed out.')); }, 12000);
      doc.head.append(script);
    }).catch(function (error) { bundlePromise = null; throw error; });
    return bundlePromise;
  }
  function fallback(id) {
    host.replaceChildren();
    var message = doc.createElement('p'); message.setAttribute('role', 'status'); message.textContent = 'Comments could not be loaded.';
    var retry = doc.createElement('button'); retry.type = 'button'; retry.className = 'wcs-discussion-load'; retry.textContent = 'Retry loading comments';
    retry.addEventListener('click', function () { activate(id); });
    var link = doc.createElement('a'); link.href = nativeUrl(id); link.textContent = 'Open comments in Confluence';
    host.append(message, retry, link);
  }
  async function activate(id) {
    if (stopped || pending || view || pageId() !== id) return;
    var current = generation, target = host, request = new global.AbortController();
    function active() { return !stopped && current === generation && pageId() === id; }
    pending = true; if (observer) observer.disconnect();
    controller = request;
    target.setAttribute('aria-busy', 'true');
    var load = target.querySelector('.wcs-discussion-load');
    if (load) { load.disabled = true; load.setAttribute('aria-busy', 'true'); load.textContent = 'Loading comments…'; }
    try {
      await loadBundle();
      if (!active()) return;
      var adapter = global.WCSArticleComments.create({contextPath: config.contextPath || '/confluence', rootPageId: config.rootPageId, spaceKey: config.spaceKey, attachmentPageId: config.attachmentPageId, pageIds: config.pageIds, nativePublication: {areaPageIds: config.areaPageIds, workingRootPageId: config.workingRootPageId, insightsPageId: config.insightsPageId, insightsTypes: config.insightsTypes}, search: {excludePageIds: config.excludePageIds || [], excludeAncestorIds: config.excludeAncestorIds || []}});
      var scope = await adapter.resolve(id, {signal: request.signal});
      if (!active()) return;
      if (scope.commentsEnabled === false) {
        target.replaceChildren();var notice = doc.createElement('p');notice.textContent = 'Comments are disabled for this article.';notice.setAttribute('role', 'status');target.append(notice);
        if (!doc.body.classList.contains('wcs-article-discussion-active')) { doc.body.classList.add('wcs-article-discussion-active'); ownsClass = true; }
        return;
      }
      var feedback;
      if (config.authoringMode !== 'confluence-session' && config.feedbackEndpoint) {
        try { feedback = global.WCSArticleFeedback.create({endpoint: config.feedbackEndpoint, contextPath: config.contextPath || '/confluence', rootPageId: config.rootPageId, pageId: id}); } catch (_) { /* Comments remain independent of optional analytics configuration. */ }
      }
      target.replaceChildren();
      view = global.WCSArticleDiscussion.mount(target, {
        pageId: id,
        lazy: false, replies: false, nativeCommentsUrl: nativeUrl(id), feedback: feedback,
        adapter: {
          load: async function (args) { var data = await adapter.list(id, {start: args.cursor || 0, signal: args.signal}); return {comments: data.comments, nextCursor: data.nextStart, canComment: data.canComment, user: data.user}; },
          create: function (args) { return adapter.createComment(id, {text: args.text, signal: args.signal}); }
        },
        onLoaded: function () { if (active() && !doc.body.classList.contains('wcs-article-discussion-active')) { doc.body.classList.add('wcs-article-discussion-active'); ownsClass = true; } }
      });
    } catch (error) {
      if (!active()) return;
      // Failed scope validation must not turn an unrelated native page into an article.
      if (error && ['OUT_OF_SCOPE', 'FORBIDDEN', 'CONFIGURATION'].includes(error.code)) host.remove();
      else if (error && /^COMMENTS_SETTINGS_/.test(error.code || '')) {
        target.replaceChildren();var notice = doc.createElement('p');notice.textContent = error.message;notice.setAttribute('role', 'alert');target.append(notice);
        if (!doc.body.classList.contains('wcs-article-discussion-active')) { doc.body.classList.add('wcs-article-discussion-active'); ownsClass = true; }
      } else fallback(id);
    } finally { if (current === generation) { pending = false; target.removeAttribute('aria-busy'); if(load){load.removeAttribute('aria-busy');load.disabled=false;} } }
  }
  function start() {
    var id = pageId();
    if (stopped || host || !id) return;
    // Prefer the actual page body. Included navigation can contain its own
    // .wiki-content, even when its outer wrapper has no recognizable header ID.
    var content = Array.from(doc.querySelectorAll('#main-content')).find(function (node) { return !node.closest('#navHeader,#navBar,#header,header,.aui-header,[role="banner"],[data-wcs-header-actions]'); });
    if (!content) return;
    host = doc.createElement('div'); host.setAttribute('data-wcs-article-discussion-host', ''); content.append(host);
    // An empty sentinel reserves no visible control in the shared header.
    host.style.minHeight = '1px';
    if (typeof global.IntersectionObserver === 'function') {
      observer = new global.IntersectionObserver(function (entries) { if (entries.some(function (entry) { return entry.isIntersecting; })) activate(id); }, {rootMargin: '300px 0px'});
      observer.observe(host);
    } else activate(id);
  }
  function destroy() {
    stopped = true; generation++; pending = false; if (observer) observer.disconnect(); if (controller) controller.abort(); if (view) view.destroy(); if (host) host.remove();
    if (ownsClass) doc.body.classList.remove('wcs-article-discussion-active'); ownsClass = false;
  }
  global.WCSArticleDiscussionBootstrap = Object.freeze({destroy: destroy});
  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', start, {once: true}); else start();
  global.addEventListener('pagehide', destroy);
  global.addEventListener('pageshow', function (event) { if (event.persisted) { stopped = false; host = view = null; start(); } });
})(window, document);
