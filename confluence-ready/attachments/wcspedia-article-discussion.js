/* Source: article-comments.js */
/* Native Confluence Server/Data Center footer comments. The native REST service
 * owns comment permissions and storage; no document JSON or page body is changed.
 * https://developer.atlassian.com/server/confluence/confluence-rest-api-examples/
 * https://docs.atlassian.com/ConfluenceServer/rest/7.18.3/
 */
(function (root, factory) {
  'use strict';
  if (typeof module === 'object' && module.exports) module.exports = factory(root);
  else root.WCSArticleComments = factory(root);
}(typeof globalThis !== 'undefined' ? globalThis : this, function (root) {
  'use strict';
  var PAGE_SIZE = 20, MAX_TEXT = 10000, MAX_RESPONSE = 1024 * 1024;
  function problem(message, code, outcome) {
    var error = new Error(message); error.code = code || 'INVALID_DATA';
    if (outcome) { error.outcome = outcome; error.retryable = false; }
    return error;
  }
  function object(value) { return value && typeof value === 'object' && !Array.isArray(value); }
  function id(value) { return (typeof value === 'string' || Number.isSafeInteger(value)) && /^[1-9]\d{0,19}$/.test(String(value)) ? String(value) : ''; }
  function escape(value) { return value.replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function clean(value, max) { return typeof value === 'string' ? value.replace(/\u0000/g, '').trim().slice(0, max || 500) : ''; }
  function abort(signal) { if (signal && signal.aborted) { var error = new Error('Request cancelled.'); error.name = 'AbortError'; throw error; } }
  function timestamp(value) { return typeof value === 'string' && Number.isFinite(Date.parse(value)) ? new Date(value).toISOString() : null; }
  function storage(text) {
    if (typeof text !== 'string') throw problem('Enter a comment.', 'VALIDATION');
    text = text.replace(/\r\n?/g, '\n').replace(/\u0000/g, '').trim();
    if (!text || text.length > MAX_TEXT) throw problem('Enter a comment of 1 to 10,000 characters.', 'VALIDATION');
    return { text: text, html: '<p>' + escape(text).replace(/\n/g, '<br />') + '</p>' };
  }
  function create(config, dependencies) {
    config = config || {}; dependencies = dependencies || {};
    var fetcher = dependencies.fetch || (root.fetch && root.fetch.bind(root));
    var location = dependencies.location || root.location, address;
    try { address = new URL(location && (location.href || location.origin)); } catch (_) { throw problem('A Confluence page URL is required.', 'CONFIGURATION'); }
    if (!/^https?:$/.test(address.protocol) || address.username || address.password || typeof fetcher !== 'function') throw problem('Use the signed-in Confluence origin.', 'CONFIGURATION');
    var context = config.contextPath == null ? '/confluence' : config.contextPath;
    if (typeof context !== 'string' || context && !/^\/(?:[A-Za-z0-9_-]+\/?)*$/.test(context)) throw problem('Use a plain Confluence context path.', 'CONFIGURATION');
    context = context.replace(/\/+$/, '');
    if (config.baseUrl != null) {
      var base; try { base = new URL(config.baseUrl, address.origin); } catch (_) { throw problem('Invalid Confluence base URL.', 'CONFIGURATION'); }
      if (base.origin !== address.origin || base.pathname.replace(/\/+$/, '') !== context || base.username || base.password || base.hash || base.search) throw problem('Use this Confluence origin and context.', 'CONFIGURATION');
    }
    var rootId = id(config.rootPageId), spaceKey = clean(config.spaceKey, 255);
    var publication = object(config.nativePublication) ? config.nativePublication : config;
    var insightsId = publication.insightsPageId == null || publication.insightsPageId === '' ? '' : id(publication.insightsPageId);
    if (publication.insightsPageId && !insightsId) throw problem('Configure a numeric Insights parent page ID.', 'CONFIGURATION');
    var areas = object(publication.areaPageIds) ? publication.areaPageIds : {}, areaIds = Object.keys(areas).map(function (key) { return id(areas[key]); });
    if (!rootId || !spaceKey || !areaIds.length || areaIds.some(function (value) { return !value || value === rootId; }) || new Set(areaIds).size !== areaIds.length) throw problem('Configure the WCSpedia root, exact space key and distinct business-area page IDs.', 'CONFIGURATION');
    if (insightsId && [rootId].concat(areaIds).includes(insightsId)) throw problem('Insights must have a distinct parent page ID.', 'CONFIGURATION');
    var excludedPages = new Set([rootId].concat(areaIds, insightsId ? [insightsId] : [])), excludedTrees = new Set();
    function exclude(value, subtree) {
      if (value == null || value === '') return;
      var parsed = id(value); if (!parsed) throw problem('Exclusions require numeric Confluence page IDs.', 'CONFIGURATION');
      excludedPages.add(parsed); if (subtree) excludedTrees.add(parsed);
    }
    exclude(config.attachmentPageId);
    Object.keys(object(config.pageIds) ? config.pageIds : {}).forEach(function (key) { exclude(config.pageIds[key]); });
    exclude(publication.workingRootPageId, true);
    var search = object(config.search) ? config.search : {};
    ['excludePageIds', 'excludeAncestorIds'].forEach(function (key) {
      if (search[key] != null && (!Array.isArray(search[key]) || search[key].length > 100)) throw problem('Use at most 100 excluded pages.', 'CONFIGURATION');
      (search[key] || []).forEach(function (value) { exclude(value, key === 'excludeAncestorIds'); });
    });
    // Existing generated page configuration stores navigation URLs rather than IDs.
    Object.keys(object(config.pages) ? config.pages : {}).forEach(function (key) {
      var url; try { url = new URL(config.pages[key], address); } catch (_) { return; }
      if (url.origin !== address.origin || context && !url.pathname.startsWith(context + '/')) return;
      var match = url.pathname.match(/\/spaces\/[^/]+\/pages\/(\d+)(?:\/|$)/);
      var page = id(url.searchParams.get('pageId')) || match && id(match[1]); if (page) excludedPages.add(page);
    });
    if (insightsId && excludedTrees.has(insightsId) || excludedTrees.has(rootId) || areaIds.some(function (area) { return excludedTrees.has(area); })) throw problem('The working or excluded subtree must be separate from the WCSpedia root and business areas.', 'CONFIGURATION');
    var timeoutMs = config.timeoutMs == null ? 12000 : config.timeoutMs;
    if (!Number.isInteger(timeoutMs) || timeoutMs < 1000 || timeoutMs > 30000) throw problem('Use a timeout between 1,000 and 30,000 milliseconds.', 'CONFIGURATION');
    var clock = dependencies.now || Date.now, Parser = dependencies.DOMParser || root.DOMParser;
    var scopes = new Map(), denied = new Set(), activeWrites = new Set();
    function endpoint(path, query) { var url = new URL(context + '/rest/api' + path, address.origin); if (query) url.search = new URLSearchParams(query).toString(); return url; }
    function pageUrl(pageId, commentId) { return address.origin + context + '/pages/viewpage.action?pageId=' + pageId + (commentId ? '&focusedCommentId=' + commentId + '#comment-' + commentId : ''); }
    function unknown() { return problem('Confluence may have saved your comment. Check the discussion before posting it again.', 'OUTCOME_UNKNOWN', 'unknown'); }
    async function request(url, options) {
      options = options || {}; var writing = options.body !== undefined, signal = options.signal;
      abort(signal);
      var controller = new AbortController(), timedOut = false;
      var onAbort = function () { controller.abort(); };
      if (signal) signal.addEventListener('abort', onAbort, { once: true });
      var timer = setTimeout(function () { timedOut = true; controller.abort(); }, timeoutMs);
      try {
        var response;
        try { response = await fetcher(url.href, { method: writing ? 'POST' : 'GET', credentials: 'same-origin', mode: 'same-origin', redirect: 'error', cache: 'no-store', signal: controller.signal, headers: Object.assign({ Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest' }, writing ? { 'Content-Type': 'application/json' } : {}), body: writing ? JSON.stringify(options.body) : undefined }); }
        catch (error) {
          if (writing) throw unknown();
          abort(signal);
          throw problem(timedOut ? 'Loading comments took too long. Try again.' : 'Confluence could not be reached.', timedOut ? 'TIMEOUT' : 'NETWORK');
        }
        if (!response.ok) {
          if (writing && (response.status >= 500 || response.status === 408)) throw unknown();
          var error = problem(response.status === 401 ? 'Sign in to Confluence to comment.' : response.status === 403 ? 'Confluence does not permit this comment action.' : response.status === 404 ? 'This page or comment is unavailable.' : 'Confluence could not complete this request (' + response.status + ').', response.status === 401 || response.status === 403 ? 'FORBIDDEN' : 'HTTP_ERROR', writing ? 'rejected' : undefined);
          error.status = response.status; throw error;
        }
        var body, value;
        try { body = await response.text(); if (body.length > MAX_RESPONSE) throw new Error('Too large'); value = JSON.parse(body); }
        catch (_) { if (writing) throw unknown(); abort(signal); throw problem('Confluence did not return valid comment data.', 'INVALID_DATA'); }
        if (!writing) abort(signal);
        return value;
      } finally { clearTimeout(timer); if (signal) signal.removeEventListener('abort', onAbort); }
    }
    function user(value) {
      value = object(value) ? value : {};
      var userId = clean(value.userKey || value.username, 255);
      return { id: userId, displayName: clean(value.displayName, 255) || (userId ? 'Confluence user' : 'Anonymous'), authenticated: value.type !== 'anonymous' && value.type !== 'unknown' && !!userId };
    }
    function commentsSetting(page) {
      var body = page.body && page.body.storage && page.body.storage.value;
      if (typeof body !== 'string' || body.length > 800000 || typeof Parser !== 'function') throw problem('The article comment setting could not be verified. Comments are unavailable until the setting can be read.', 'COMMENTS_SETTINGS_UNAVAILABLE');
      // Read only real native Anchor macros, not escaped examples/code/macros.
      // This marker shares the same CAS revision as the approved article content.
      // Native storage can contain HTML named entities and Atlassian template
      // namespaces. Normalize known entities without interpreting article markup.
      var entities = Object.create(null);
      body = body.replace(/&([A-Za-z][A-Za-z0-9]+);/g, function (whole, name) {
        if (/^(amp|lt|gt|quot|apos)$/.test(name)) return whole;
        if (!Object.prototype.hasOwnProperty.call(entities, name)) {
          var decoded = new Parser().parseFromString('<textarea>' + whole + '</textarea>', 'text/html').body.textContent;
          entities[name] = decoded === whole ? whole : Array.from(decoded).map(function (point) { return '&#' + point.codePointAt(0) + ';'; }).join('');
        }
        return entities[name];
      });
      var parsed = new Parser().parseFromString('<root xmlns:ac="urn:ac" xmlns:ri="urn:ri" xmlns:at="urn:at">' + body + '</root>', 'text/xml');
      if (parsed.querySelector('parsererror')) throw problem('The article comment setting is malformed. Comments are unavailable until it is corrected.', 'COMMENTS_SETTINGS_INVALID');
      var markers = [];
      Array.from(parsed.getElementsByTagNameNS('urn:ac', 'structured-macro')).forEach(function (macro) {
        if (macro.getAttributeNS('urn:ac', 'name') !== 'anchor') return;
        Array.from(macro.children).forEach(function (parameter) {
          if (parameter.namespaceURI !== 'urn:ac' || parameter.localName !== 'parameter' || parameter.getAttributeNS('urn:ac', 'name') !== '') return;
          var value = parameter.textContent.trim();
          if (value.indexOf('wcs-comments-') === 0) markers.push(value);
        });
      });
      if (!markers.length) return true; // Pre-setting native pages retain existing discussion behavior.
      if (markers.length !== 1 || !/^wcs-comments-v1-(enabled|disabled)$/.test(markers[0])) throw problem('The article comment setting is malformed or duplicated. Comments are unavailable until it is corrected.', 'COMMENTS_SETTINGS_INVALID');
      return markers[0] === 'wcs-comments-v1-enabled';
    }
    async function resolve(pageId, options) {
      options = options || {}; pageId = id(pageId);
      if (!pageId || excludedPages.has(pageId)) throw problem('Discussion is available on child articles only.', 'OUT_OF_SCOPE');
      abort(options.signal);
      var cached = scopes.get(pageId);
      if (!options.force && cached && clock() - cached.at < 30000) return Object.assign({}, cached.value, { user: Object.assign({}, cached.value.user), canComment: cached.value.canComment && !denied.has(pageId) });
      var results = await Promise.all([
        request(endpoint('/content/' + rootId, { expand: 'space' }), { signal: options.signal }),
        request(endpoint('/content/' + pageId, { expand: 'space,ancestors,operations,body.storage' }), { signal: options.signal }),
        request(endpoint('/user/current'), { signal: options.signal })
      ]);
      abort(options.signal);
      var rootPage = results[0], page = results[1];
      if (!object(rootPage) || id(rootPage.id) !== rootId || rootPage.type !== 'page' || !rootPage.space || rootPage.space.key !== spaceKey || rootPage.status && rootPage.status !== 'current') throw problem('The WCSpedia root does not match the configured space.', 'OUT_OF_SCOPE');
      var ancestors = object(page) && Array.isArray(page.ancestors) ? page.ancestors.map(function (entry) { return id(entry.id); }) : [];
      var rootPosition = ancestors.indexOf(rootId), areaId = '';
      Object.keys(areas).forEach(function (key) { if (ancestors.indexOf(id(areas[key])) > rootPosition && ancestors.indexOf(id(areas[key])) >= 0) areaId = key; });
      if (insightsId && ancestors.indexOf(insightsId) > rootPosition && ancestors.indexOf(insightsId) >= 0) areaId = 'insights';
      if (!object(page) || id(page.id) !== pageId || page.type !== 'page' || page.status !== 'current' || !page.space || page.space.key !== spaceKey || rootPosition < 0 || !areaId || ancestors.some(function (ancestor) { return excludedTrees.has(ancestor); })) throw problem('This page is outside the WCSpedia article tree.', 'OUT_OF_SCOPE');
      var actor = user(results[2]), commentsEnabled = commentsSetting(page);
      // Older Server releases omit comment operations. A signed-in reader may
      // submit a request; the native endpoint always decides whether to accept it.
      // A local UI entitlement is never used to grant native comment permission.
      var explicit = Array.isArray(page.operations) && page.operations.some(function (operation) { return operation.operation === 'create' && operation.targetType === 'comment'; });
      var result = { pageId: pageId, title: clean(page.title), url: pageUrl(pageId), areaId: areaId, spaceKey: spaceKey, commentsEnabled: commentsEnabled, user: actor, canComment: commentsEnabled && actor.authenticated && !denied.has(pageId), permissionKnown: !!explicit };
      if (scopes.size >= 10) scopes.delete(scopes.keys().next().value);
      scopes.set(pageId, { at: clock(), value: result }); return Object.assign({}, result, { user: Object.assign({}, actor) });
    }
    function plain(html) {
      if (typeof html !== 'string' || html.length > 250000 || typeof Parser !== 'function') throw problem('A browser parser is required to read comments.', 'INVALID_DATA');
      var doc = new Parser().parseFromString(html, 'text/html');
      doc.querySelectorAll('script,style,iframe,object,embed,template,noscript,svg,math,form,input,button,textarea,select,[hidden],[aria-hidden="true"]').forEach(function (node) { node.remove(); });
      doc.querySelectorAll('br').forEach(function (node) { node.replaceWith(doc.createTextNode('\n')); });
      doc.querySelectorAll('p,div,li,pre,blockquote,tr,h1,h2,h3,h4,h5,h6').forEach(function (node) { node.appendChild(doc.createTextNode('\n')); });
      return (doc.body.textContent || '').replace(/\u0000/g, '').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
    }
    function normalize(value, pageId, fallback) {
      if (!object(value) || !id(value.id) || value.type !== 'comment' || value.status && value.status !== 'current') throw problem('Confluence returned invalid comment data.', 'INVALID_DATA');
      if (object(value.container) && (id(value.container.id) !== pageId || value.container.type && value.container.type !== 'page')) throw problem('Confluence returned a comment for another page.', 'OUT_OF_SCOPE');
      if (value.extensions && value.extensions.location && value.extensions.location !== 'footer') throw problem('Inline comments are displayed in native Confluence.', 'INVALID_DATA');
      var body = value.body || {}, html = body.view && body.view.value || body.storage && body.storage.value;
      var history = value.history || {}, version = value.version || {}, author = user(history.createdBy || version.by);
      var parent = null;
      (Array.isArray(value.ancestors) ? value.ancestors : []).forEach(function (ancestor) { if (ancestor.type === 'comment' && id(ancestor.id)) parent = id(ancestor.id); });
      return { id: id(value.id), pageId: pageId, text: typeof html === 'string' ? plain(html) : fallback || '', author: { id: author.id, displayName: author.id || author.displayName !== 'Anonymous' ? author.displayName : 'Confluence user' }, createdAt: timestamp(history.createdDate || version.when), updatedAt: timestamp(version.when), url: pageUrl(pageId, id(value.id)), parentId: parent };
    }
    function nextStart(value, pageId, start, count) {
      var link = value._links && value._links.next;
      if (!link) return null;
      if (typeof link !== 'string' || /[\\\u0000-\u0020]/.test(link) || /%(?:2e|2f|5c|25)/i.test(link)) throw problem('Invalid comment pagination.', 'INVALID_DATA');
      var url = new URL(link, address.origin + context + '/');
      var expected = '/rest/api/content/' + pageId + '/child/comment';
      if (url.origin !== address.origin || url.username || url.password || url.hash || (url.pathname !== context + expected && url.pathname !== expected)) throw problem('Invalid comment pagination.', 'INVALID_DATA');
      var raw = url.searchParams.get('start'), next = Number(raw);
      if (!/^\d+$/.test(raw || '') || !Number.isSafeInteger(next) || next <= start || next > start + count || next > 1000000) throw problem('Invalid comment pagination.', 'INVALID_DATA');
      // Only the validated offset is reused. Returned URLs/filters are never fetched.
      return next;
    }
    async function list(pageId, options) {
      options = options || {}; var scope = await resolve(pageId, options); pageId = scope.pageId;
      if (!scope.commentsEnabled) throw problem('Comments are disabled for this article. Existing comments remain in Confluence.', 'COMMENTS_DISABLED');
      var start = options.start == null ? 0 : options.start;
      if (!Number.isSafeInteger(start) || start < 0 || start > 1000000) throw problem('Invalid comment offset.', 'VALIDATION');
      var result = await request(endpoint('/content/' + pageId + '/child/comment', { expand: 'body.view,history,version,ancestors,container', location: 'footer', depth: 'all', start: String(start), limit: String(PAGE_SIZE) }), { signal: options.signal });
      if (!object(result) || !Array.isArray(result.results) || result.results.length > PAGE_SIZE || result.start != null && result.start !== start) throw problem('Confluence returned invalid comments.', 'INVALID_DATA');
      var seen = new Set(), comments = result.results.map(function (value) { var comment = normalize(value, pageId); if (seen.has(comment.id)) throw problem('Duplicate comment data.', 'INVALID_DATA'); seen.add(comment.id); return comment; });
      var total = result.totalSize == null ? result.totalCount : result.totalSize;
      return { comments: comments, start: start, limit: PAGE_SIZE, nextStart: nextStart(result, pageId, start, result.results.length), total: Number.isSafeInteger(total) && total >= start + result.results.length ? total : null, canComment: scope.canComment, user: scope.user };
    }
    async function createComment(pageId, input) {
      input = input || {}; var content;
      try { content = storage(input.text); } catch (error) { error.outcome = 'rejected'; throw error; }
      pageId = id(pageId);
      if (input.parentId != null) throw problem('Reply in native Confluence to keep the existing thread.', 'VALIDATION', 'rejected');
      if (!pageId) throw problem('An article page ID is required.', 'VALIDATION', 'rejected');
      if (activeWrites.has(pageId)) throw problem('A comment is already being sent for this article.', 'BUSY', 'rejected');
      activeWrites.add(pageId);
      var postAttempted = false;
      try {
        var scope = await resolve(pageId, { force: true, signal: input.signal });
        if (!scope.commentsEnabled) throw problem('Comments are disabled for this article. Your text has not been submitted.', 'COMMENTS_DISABLED', 'rejected');
        if (!scope.canComment) throw problem('Sign in with a Confluence account allowed to comment.', 'FORBIDDEN', 'rejected');
        abort(input.signal);
        var result;
        postAttempted = true;
        // Navigation may cancel preflight reads, but cannot safely undo a POST
        // once sent. Keep observing its bounded result rather than claiming an
        // aborted browser request means Confluence did not save the comment.
        try { result = await request(endpoint('/content', { expand: 'body.view,history,version,ancestors,container' }), { body: { type: 'comment', container: { id: pageId, type: 'page' }, body: { storage: { value: content.html, representation: 'storage' } } } }); }
        catch (error) { if (error.code === 'FORBIDDEN') { denied.add(pageId); scopes.delete(pageId); } throw error; }
        // No post retry and no invented author/time. The response confirms the ID.
        try { return normalize(result, pageId, content.text); } catch (_) { throw unknown(); }
      } catch (error) {
        if (!postAttempted && !error.outcome) error.outcome = 'rejected';
        throw error;
      } finally { activeWrites.delete(pageId); }
    }
    function clear() { scopes.clear(); denied.clear(); }
    return Object.freeze({ resolve: resolve, list: list, createComment: createComment, clear: clear });
  }
  return Object.freeze({ create: create, pageSize: PAGE_SIZE, maxTextLength: MAX_TEXT });
}));

;
/* Source: article-feedback-client.js */
/* Native JSON feedback, with the earlier service adapter retained for legacy mode. */
(function (global) {
  'use strict';
  if (global.WCSArticleFeedback) return;
  function nativeClient(options) {
    function error(message, outcome) { var e = new Error(message); e.outcome = outcome || 'unknown'; return e; }
    function integer(value, minimum) { return Number.isSafeInteger(value) && value >= minimum; }
    var expectedRoot = options.rootPageId || options.config && options.config.rootPageId;
    if (!/^[1-9]\d{0,19}$/.test(options.pageId || '') || expectedRoot != null && !/^[1-9]\d{0,19}$/.test(expectedRoot)) throw error('Native feedback requires numeric document and root page IDs.', 'rejected');
    if (!options.engagement && !global.WCSSpaceEngagement) throw error('Load the matching native engagement module.', 'rejected');
    var adapter = options.engagement || global.WCSSpaceEngagement.create(options.config || options), state, writing = false, pending;
    if (!adapter || typeof adapter.load !== 'function' || typeof adapter.vote !== 'function') throw error('The native engagement adapter is unavailable.', 'rejected');
    function validate(value, receipt) {
      if (!value || (!receipt && value.schemaVersion !== 1) || (value.schemaVersion != null && value.schemaVersion !== 1) || value.pageId !== options.pageId || expectedRoot && value.rootPageId != null && value.rootPageId !== expectedRoot || !integer(value.pageVersion, 1) || typeof value.canVote !== 'boolean' || !value.myVote || ![null, 'yes', 'no'].includes(value.myVote.value) || !integer(value.myVote.revision, 0)) throw error('Feedback could not be confirmed.');
      var vote = value.myVote;
      if (vote.value === null ? vote.revision !== 0 || vote.pageVersion !== null : !integer(vote.revision, 1) || !integer(vote.pageVersion, 1) || vote.pageVersion > value.pageVersion) throw error('Feedback could not be confirmed.');
      var unresolved = value.pendingVote;
      if (unresolved != null && (!['yes', 'no'].includes(unresolved.value) || typeof unresolved.requestId !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,159}$/.test(unresolved.requestId) || !integer(unresolved.expectedVoteRevision, 0) || !integer(unresolved.pageVersion, 1) || unresolved.pageVersion > value.pageVersion)) throw error('The pending feedback command could not be confirmed.');
      if (receipt && (value.accepted !== true || value.requestId !== receipt.requestId || vote.value !== receipt.value || vote.pageVersion !== receipt.pageVersion || vote.revision <= receipt.expectedVoteRevision)) throw error('The feedback save receipt could not be confirmed.');
      return value;
    }
    function project(value, receipt) {
      validate(value, receipt);
      // Retain only validated state; an external prime caller cannot mutate the
      // revision or permission used by the next command after this call returns.
      state = {pageVersion: value.pageVersion, canVote: value.canVote, reason: typeof value.reason === 'string' ? value.reason : '', myVote: {value: value.myVote.value, revision: value.myVote.revision, pageVersion: value.myVote.pageVersion}};
      if (receipt) pending = null;
      else if (Object.prototype.hasOwnProperty.call(value, 'pendingVote')) pending = value.pendingVote ? {value: value.pendingVote.value, requestId: value.pendingVote.requestId, expectedVoteRevision: value.pendingVote.expectedVoteRevision, pageVersion: value.pendingVote.pageVersion} : null;
      return {canVote: state.canVote, vote: state.myVote.value, reason: state.reason, source: 'confluence-json', pendingVote: pending ? {value: pending.value} : null};
    }
    function secureId() {
      try { return typeof global.crypto.randomUUID === 'function' ? global.crypto.randomUUID() : Array.from(global.crypto.getRandomValues(new Uint8Array(24))).map(function (value) { return value.toString(16).padStart(2, '0'); }).join(''); }
      catch (_) { throw error('Secure request identifiers are unavailable.', 'rejected'); }
    }
    return Object.freeze({
      prime: function (value) { return project(value); },
      load: async function (args) { return project(await adapter.load(options.pageId, args || {})); },
      save: async function (value, args) {
        if (!state || !state.canVote || writing || !['yes', 'no'].includes(value)) throw error('Load feedback and verify native permission before voting.', 'rejected');
        if (args && args.signal && args.signal.aborted) throw error('Feedback cancelled before saving.', 'rejected');
        if (pending && pending.value !== value) throw error('Resolve the previous feedback save before changing your choice.');
        var retrying = !!pending;
        if (!pending) pending = {value: value, requestId: secureId(), expectedVoteRevision: state.myVote.revision, pageVersion: state.pageVersion};
        var command = pending; writing = true;
        try {
          var result = await adapter.vote(options.pageId, value, Object.assign({}, command, {signal: args && args.signal}));
          var projected = project(result, command); pending = null; return projected;
        } catch (failure) {
          // An invalid/lost confirmation remains unknown; only definite native
          // rejections permit the UI to present an ordinary retry immediately.
          if (!failure.outcome && failure.code && !['UNKNOWN_COMMIT', 'NETWORK', 'TIMEOUT'].includes(failure.code) && failure.name !== 'AbortError') failure.outcome = 'rejected';
          // A rejected retry does not establish the outcome of the earlier
          // request. Only a subsequent native read can release that uncertainty.
          if (retrying) failure.outcome = 'unknown';
          else if (failure.outcome === 'rejected') pending = null;
          throw failure;
        } finally { writing = false; }
      }
    });
  }
  function create(options) {
    options = options || {};
    if (options.authoringMode === 'confluence-session' || options.config && options.config.authoringMode === 'confluence-session') return nativeClient(options);
    var endpoint = new URL(options.endpoint, global.location.href);
    var context = options.contextPath || '/confluence';
    if (endpoint.origin !== global.location.origin || endpoint.username || endpoint.password || !endpoint.pathname.startsWith(context + '/') || endpoint.search || endpoint.hash || !/^[1-9]\d{0,19}$/.test(options.rootPageId) || !/^[1-9]\d{0,19}$/.test(options.pageId)) throw new Error('Feedback requires a same-origin Confluence endpoint and numeric page IDs.');
    var state = null, writing = false;
    function error(message, definite) { var value = new Error(message); value.outcome = definite ? 'rejected' : 'unknown'; return value; }
    function integer(value) { return Number.isSafeInteger(value) && value >= 0; }
    function totals(value) { return value && ['yes', 'no', 'total'].every(function (key) { return integer(value[key]); }) && value.yes + value.no === value.total; }
    function normalize(data, command) {
      if (!data || data.schemaVersion !== 1 || String(data.rootPageId) !== String(options.rootPageId) || String(data.pageId) !== String(options.pageId) || !integer(data.revision) || !data.myVote || !integer(data.myVote.revision) || !integer(data.pageVersion) || data.pageVersion < 1 || ![null, 'yes', 'no'].includes(data.myVote.value) || !totals(data.totals) || !totals(data.currentVersionTotals) || data.currentVersionTotals.total > data.totals.total || (data.myVote.value === null ? data.myVote.pageVersion !== null || data.myVote.revision !== 0 : !integer(data.myVote.pageVersion) || data.myVote.pageVersion < 1 || data.myVote.revision < 1)) throw error('Invalid feedback confirmation.', false);
      if (command && (data.accepted !== true || data.requestId !== command.requestId || data.myVote.value !== command.value || typeof data.changed !== 'boolean')) throw error('Invalid feedback save receipt.', false);
      if (!state || data.revision >= state.revision) state = data;
      return {canVote: true, vote: state.myVote.value, helpful: state.totals.yes, total: state.totals.total};
    }
    async function request(url, init, signal, command) {
      var controller = new global.AbortController(), timeout = setTimeout(function () { controller.abort(); }, 12000);
      function abort() { controller.abort(); }
      if (signal) { if (signal.aborted) abort(); else signal.addEventListener('abort', abort, {once: true}); }
      try {
        var response = await global.fetch(url, Object.assign({credentials: 'same-origin', cache: 'no-store', redirect: 'error', signal: controller.signal}, init));
        if (!response.ok) throw error('Feedback request failed (' + response.status + ').', [400, 401, 403, 404, 409, 413, 422, 429].includes(response.status));
        return normalize(await response.json(), command);
      } finally { clearTimeout(timeout); if (signal) signal.removeEventListener('abort', abort); }
    }
    return Object.freeze({
      load: function (args) {
        var url = new URL(endpoint.href); url.searchParams.set('rootPageId', options.rootPageId); url.searchParams.set('pageId', options.pageId);
        return request(url.href, {}, args && args.signal);
      },
      save: async function (value, args) {
        if (!state || writing || !['yes', 'no'].includes(value)) throw error('Load feedback before voting; only one vote can be saved at a time.', true);
        if (args && args.signal && args.signal.aborted) throw error('Feedback cancelled before saving.', true);
        var requestId;
        try { requestId = typeof global.crypto.randomUUID === 'function' ? global.crypto.randomUUID() : Array.from(global.crypto.getRandomValues(new Uint8Array(24))).map(function (v) { return v.toString(16).padStart(2, '0'); }).join(''); } catch (_) { throw error('Secure request identifiers are unavailable.', true); }
        var command = {rootPageId: options.rootPageId, pageId: options.pageId, pageVersion: state.pageVersion, value: value, expectedVoteRevision: state.myVote.revision, requestId: requestId};
        writing = true;
        try { return await request(endpoint.href, {method: 'POST', headers: {'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest', 'Idempotency-Key': requestId}, body: JSON.stringify(command)}, args && args.signal, command); }
        finally { writing = false; }
      }
    });
  }
  global.WCSArticleFeedback = Object.freeze({create: create});
})(window);

;
/* Source: article-discussion.js */
/* Native article comments: bounded reads and optimistic writes, with no page reload. */
(function (global) {
  'use strict';
  if (global.WCSArticleDiscussion) return;
  var sequence = 0;
  var mounts = new WeakMap();

  function mount(host, options) {
    options = options || {};
    if (!host || !host.ownerDocument || !options.adapter) throw new Error('An article host and comments adapter are required.');
    if (mounts.has(host)) return mounts.get(host);
    var doc = host.ownerDocument, adapter = options.adapter, feedback = options.feedback;
    var discussionPageId = /^[1-9]\d{0,19}$/.test(String(options.pageId || '')) ? String(options.pageId) : '';
    var id = 'wcs-discussion-' + (++sequence), disposed = false, loading = null, observer = null;
    var comments = [], cursor = null, canComment = false, user = {}, pending = null, reply = null, mutationEpoch = 0;
    var voteState = null, voteBusy = false, voteUnknown = false, controllers = new Set();
    function el(tag, className, text) {
      var node = doc.createElement(tag);
      if (className) node.className = className;
      if (text !== undefined) node.textContent = String(text);
      return node;
    }
    function button(text, className, action) {
      var node = el('button', 'wcs-discussion-button' + (className ? ' ' + className : ''), text);
      node.type = 'button';
      if (action) node.addEventListener('click', action);
      return node;
    }
    function reaction(value, text) {
      var node = button('', 'wcs-discussion-reaction', function () { saveVote(value); });
      node.dataset.vote = value; node.setAttribute('aria-label', text); node.setAttribute('aria-pressed', 'false');
      var svg = doc.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('viewBox', '0 0 24 24'); svg.setAttribute('width', '24'); svg.setAttribute('height', '24');
      svg.setAttribute('aria-hidden', 'true'); svg.setAttribute('focusable', 'false');
      svg.setAttribute('fill', 'none'); svg.setAttribute('stroke', 'currentColor'); svg.setAttribute('stroke-width', '1.7');
      svg.setAttribute('stroke-linecap', 'round'); svg.setAttribute('stroke-linejoin', 'round');
      [['circle', {cx:'12', cy:'12', r:'9'}], ['circle', {cx:'8.5', cy:'9.5', r:'.8', fill:'currentColor', stroke:'none'}], ['circle', {cx:'15.5', cy:'9.5', r:'.8', fill:'currentColor', stroke:'none'}], ['path', {d:value === 'yes' ? 'M7.8 13.5c1.2 3.7 7.2 3.7 8.4 0' : 'M7.8 16.2c1.2-3.7 7.2-3.7 8.4 0'}]].forEach(function (part) {
        var shape = doc.createElementNS('http://www.w3.org/2000/svg', part[0]);
        Object.keys(part[1]).forEach(function (name) { shape.setAttribute(name, part[1][name]); }); svg.append(shape);
      });
      node.append(svg, el('span', '', text)); return node;
    }
    function notify(kind, text) {
      if (global.WCSNotifications && typeof global.WCSNotifications[kind] === 'function') global.WCSNotifications[kind](text);
    }
    function controller() { var item = new global.AbortController(); controllers.add(item); return item; }
    function finish(item) { controllers.delete(item); }
    function unknown(error) { return !error || !(error.outcome === 'rejected' || error.definite === true || error.unknownCommit === false); }
    function authorName(value) { return String(value && (value.displayName || value.name) || 'Confluence user'); }
    function initials(value) { return authorName(value).split(/[\s,]+/).filter(Boolean).slice(0, 2).map(function (s) { return s.charAt(0); }).join('').toUpperCase(); }
    function setMessage(text, isError) {
      message.textContent = text || '';
      message.classList.toggle('wcs-discussion-error', !!isError);
      message.setAttribute('role', isError ? 'alert' : 'status');
    }
    function safeURL(value) {
      if (!value) return '';
      try { var url = new URL(value, global.location.href); return url.origin === global.location.origin && /^https?:$/.test(url.protocol) ? url.href : ''; } catch (_) { return ''; }
    }
    var root = el('div', 'wcs-article-discussion');
    root.setAttribute('role', 'region'); root.setAttribute('aria-labelledby', id + '-heading');
    var helpful = el('div', 'wcs-discussion-helpful'); helpful.hidden = true;
    var helpfulLabel = el('span', 'wcs-discussion-helpful-label', 'Was this article helpful?');
    var votes = el('div', 'wcs-discussion-votes'); votes.setAttribute('role', 'group'); votes.setAttribute('aria-label', 'Was this article helpful?');
    var yes = reaction('yes', 'Helpful');
    var no = reaction('no', 'Not helpful');
    var voteMessage = el('span', 'wcs-discussion-vote-status'); voteMessage.setAttribute('role', 'status');
    votes.append(yes, no); helpful.append(helpfulLabel, votes, voteMessage);
    var headingRow = el('div', 'wcs-discussion-heading');
    var heading = el('h2', '', 'Comments'); heading.id = id + '-heading';
    var count = el('span', 'wcs-discussion-count');
    headingRow.append(heading, count, helpful);
    var introduction = el('p', 'wcs-discussion-intro', 'Ask a question or share something useful with your colleagues.');
    var list = el('ol', 'wcs-discussion-list'); list.setAttribute('aria-label', 'Article comments');
    var message = el('p', 'wcs-discussion-message', 'Comments load when you reach this section.'); message.setAttribute('role', 'status');
    var loadButton = button('Load comments', '', function () { load(); });
    var more = button('Load more comments', '', function () { load(true); }); more.hidden = true;
    var form = el('form', 'wcs-discussion-form'); form.hidden = true;
    var label = el('label', 'wcs-discussion-label', 'Add a comment'); label.htmlFor = id + '-text';
    var textarea = el('textarea', 'wcs-discussion-textarea'); textarea.id = id + '-text'; textarea.rows = 4; textarea.maxLength = 10000; textarea.required = true;
    textarea.placeholder = 'Write your comment…'; textarea.setAttribute('aria-describedby', id + '-hint');
    var hint = el('p', 'wcs-discussion-hint', 'Your comment is saved on this Confluence article.'); hint.id = id + '-hint';
    var actions = el('div', 'wcs-discussion-compose-actions');
    var cancel = button('Cancel reply', 'wcs-discussion-quiet', function () { reply = null; syncComposer(); textarea.focus(); }); cancel.hidden = true;
    var submit = button('Post comment', 'wcs-discussion-primary'); submit.type = 'submit';
    actions.append(cancel, submit); form.append(label, textarea, hint, actions);
    root.append(headingRow, introduction, form, list, message, loadButton, more); host.append(root);

    function syncComposer() {
      form.hidden = !canComment && !textarea.value.trim();
      label.textContent = !canComment ? 'Your draft' : reply ? 'Reply to ' + authorName(reply.author) : 'Add a comment';
      cancel.hidden = !reply; cancel.disabled = !!pending || !canComment;
      textarea.readOnly = !!pending || !canComment; submit.hidden = !canComment; submit.disabled = !canComment || !!pending || !textarea.value.trim();
      hint.textContent = canComment ? 'Your comment is saved on this Confluence article.' : 'Posting is unavailable. You can copy this draft and open Confluence comments.';
      submit.setAttribute('aria-busy', String(!!pending && !pending.unknown));
      submit.textContent = pending ? (pending.unknown ? 'Confirmation unavailable' : 'Posting…') : (reply ? 'Post reply' : 'Post comment');
    }
    function commentNode(comment) {
      var item = el('li', 'wcs-discussion-item'); item.dataset.commentId = String(comment.id);
      if (comment.pending) item.classList.add('wcs-discussion-pending');
      if (comment.parentId) item.classList.add('wcs-discussion-reply');
      var avatar = el('span', 'wcs-discussion-avatar', initials(comment.author)); avatar.setAttribute('aria-hidden', 'true');
      var card = el('div', 'wcs-discussion-card');
      var meta = el('div', 'wcs-discussion-meta'); meta.append(el('strong', 'wcs-discussion-author', authorName(comment.author)));
      if (comment.parentId) meta.append(el('span', 'wcs-discussion-reply-label', 'replied'));
      if (comment.pending) meta.append(el('span', 'wcs-discussion-pending-label', comment.unknown ? 'Awaiting confirmation' : 'Posting…'));
      else if (comment.createdAt && Number.isFinite(Date.parse(comment.createdAt))) {
        var date = new Date(comment.createdAt), time = el('time', '', date.toLocaleString(undefined, {dateStyle: 'medium', timeStyle: 'short'}));
        time.dateTime = date.toISOString(); meta.append(time);
      }
      var body = el('div', 'wcs-discussion-body', comment.text || ''); card.append(meta, body);
      if (!comment.pending && canComment && !pending && options.replies === true) {
        var respond = button('Reply', 'wcs-discussion-quiet', function () { reply = comment; syncComposer(); textarea.focus(); });
        card.append(respond);
      }
      item.append(avatar, card); return item;
    }
    function renderList() {
      list.replaceChildren(); comments.forEach(function (comment) { list.append(commentNode(comment)); });
      if (pending) list.append(commentNode(pending));
      count.textContent = comments.length ? String(comments.length) + (cursor !== null ? '+' : '') : '';
      more.hidden = cursor === null; more.disabled = !!loading || !!pending;
    }
    function merge(items, reset) {
      var all = reset ? [] : comments.slice(), seen = new Set(all.map(function (item) { return String(item.id); }));
      (Array.isArray(items) ? items : []).forEach(function (item) {
        if (!item || !item.id || seen.has(String(item.id))) return;
        seen.add(String(item.id)); all.push(item);
      });
      comments = all;
    }
    function externalComment(event) {
      // This event carries a confirmed native write, not an instruction to fetch
      // or change permissions. Keep the composer, pending write and cursor intact.
      var detail=event && event.detail, comment=detail && detail.comment;
      if(disposed || !discussionPageId || !detail || String(detail.pageId)!==discussionPageId || !comment || String(comment.pageId)!==discussionPageId || !/^[1-9]\d{0,19}$/.test(String(comment.id||'')) || typeof comment.text!=='string' || comment.text.length>10000 || comment.pending || comment.parentId || !comment.author || typeof comment.author.id!=='string' || !comment.author.id || comment.author.id.length>255) return;
      if(comments.some(function(item){return String(item.id)===String(comment.id);}))return;
      var received={id:String(comment.id),pageId:discussionPageId,text:comment.text,author:{id:comment.author.id,displayName:String(comment.author.displayName||'Confluence user').slice(0,255)},createdAt:typeof comment.createdAt==='string'&&Number.isFinite(Date.parse(comment.createdAt))?comment.createdAt:null,parentId:null};
      mutationEpoch++;merge([received]);renderList();
    }
    global.addEventListener('wcs:article-comment-created',externalComment);
    async function load(append) {
      if (disposed || loading || (append && pending)) return loading;
      if (observer) { observer.disconnect(); observer = null; }
      var request = controller(), requestEpoch = mutationEpoch;
      loadButton.hidden = !!append; loadButton.disabled = true; loadButton.setAttribute('aria-busy', String(!append)); more.disabled = true; more.setAttribute('aria-busy', String(!!append)); list.setAttribute('aria-busy', 'true'); setMessage('Loading comments…');
      loading = (async function () {
        try {
          var result = await Promise.resolve().then(function () { if (disposed || request.signal.aborted) throw new Error('Read cancelled'); return adapter.load({cursor: append ? cursor : null, signal: request.signal}); });
          if (disposed) return;
          merge(result.comments, !!(!append && !pending && requestEpoch === mutationEpoch)); cursor = result.nextCursor == null ? null : result.nextCursor;
          loadButton.hidden = true; canComment = result.canComment === true; user = result.user || user;
          if (pending && pending.unknown && typeof adapter.reconcile === 'function') {
            var reconciled = await adapter.reconcile(pending, {signal: request.signal});
            if (disposed) return;
            if (reconciled && reconciled.id) { merge([reconciled]); pending = null; textarea.value = ''; reply = null; notify('success', 'Comment posted.'); }
          }
          setMessage(comments.length || pending ? '' : 'No comments yet. Start the conversation.');
          if (!canComment && !pending) setMessage('Commenting is unavailable for this account on this article.');
          if (typeof options.onLoaded === 'function') { try { options.onLoaded(result); } catch (_) { /* Host decoration cannot turn a successful read into an error. */ } }
        } catch (error) {
          if (disposed || request.signal.aborted) return;
          setMessage('Comments could not be loaded. Please try again.', true); nativeLink(); loadButton.textContent = 'Retry loading comments'; loadButton.hidden = false;
        } finally {
          finish(request); loading = null; more.removeAttribute('aria-busy'); loadButton.removeAttribute('aria-busy'); loadButton.disabled = false;
          if (!disposed) { list.removeAttribute('aria-busy'); renderList(); syncComposer(); if (pending && pending.unknown) unknownMessage(); }
        }
      })();
      if (!append && feedback && !voteState) loadFeedback();
      return loading;
    }
    function nativeLink() {
      var url = safeURL(options.nativeCommentsUrl);
      if (url) { var link = el('a', 'wcs-discussion-native-link', 'Open Confluence comments'); link.href = url; link.target = '_blank'; link.rel = 'noopener'; message.append(doc.createTextNode(' '), link); }
    }
    function unknownMessage() {
      setMessage('Confluence may have saved your comment, but confirmation was interrupted. Check the comments before posting it again.', true);
      nativeLink();
      loadButton.textContent = 'Check comments'; loadButton.hidden = false;
    }
    form.addEventListener('submit', async function (event) {
      event.preventDefault();
      var text = textarea.value.trim();
      if (disposed || pending || !canComment || !text) return;
      mutationEpoch++;
      pending = {id: 'pending-' + Date.now(), text: text, author: user, createdAt: new Date().toISOString(), parentId: reply && reply.id || null, pending: true};
      var request = controller(), sending = pending;
      renderList(); syncComposer(); setMessage('Posting your comment…');
      try {
        var result = await adapter.create({text: text, parentId: sending.parentId, signal: request.signal});
        if (disposed) return;
        if (!result || !result.id) throw new Error('Missing save confirmation');
        merge([result]); pending = null; textarea.value = ''; reply = null; setMessage('Comment posted.'); notify('success', 'Comment posted.');
      } catch (error) {
        if (disposed) return;
        if (unknown(error)) { pending.unknown = true; unknownMessage(); notify('warning', 'Comment confirmation was interrupted. Check before posting again.'); }
        else {
          pending = null;
          if (error.code === 'COMMENTS_DISABLED' || error.code === 'SETTINGS_INVALID' || error.code === 'SETTINGS_UNAVAILABLE') { canComment = false; setMessage(error.code === 'COMMENTS_DISABLED' ? 'Comments are disabled for this article. Your draft is still available to copy.' : 'Comment settings could not be verified. Your draft is still available to copy.', true); }
          else if (error.code === 'FORBIDDEN' || error.status === 401 || error.status === 403) { canComment = false; setMessage('Confluence did not allow this comment. Your draft is still available to copy.', true); nativeLink(); }
          else setMessage('Your comment was not posted. Your draft is still here; you can try again.', true);
          notify('error', 'Comment was not posted. Your draft has been kept.');
        }
      } finally { finish(request); if (!disposed) { renderList(); syncComposer(); } }
    });
    textarea.addEventListener('input', syncComposer);
    function renderVote() {
      helpful.hidden = !voteState || voteState.canVote !== true;
      yes.setAttribute('aria-pressed', String(!!voteState && voteState.vote === 'yes'));
      no.setAttribute('aria-pressed', String(!!voteState && voteState.vote === 'no'));
      yes.disabled = no.disabled = voteBusy || voteUnknown;
      yes.setAttribute('aria-busy', String(voteBusy && voteState?.vote === 'yes'));
      no.setAttribute('aria-busy', String(voteBusy && voteState?.vote === 'no'));
    }
    async function loadFeedback() {
      if (!feedback || typeof feedback.load !== 'function' || disposed) return;
      var request = controller();
      try { var result = await feedback.load({signal: request.signal}); if (!disposed) { voteState = result; renderVote(); } } catch (_) { /* Feedback availability never blocks comments or reading. */ }
      finally { finish(request); }
    }
    async function saveVote(value) {
      if (disposed || voteBusy || voteUnknown || !feedback || !voteState || voteState.canVote !== true || voteState.vote === value) return;
      var before = voteState, request = controller(); voteBusy = true; voteState = Object.assign({}, before, {vote: value}); renderVote(); voteMessage.textContent = 'Saving…';
      try {
        var result = await feedback.save(value, {signal: request.signal});
        if (disposed) return;
        if (!result || result.vote !== value) throw new Error('Missing feedback confirmation');
        voteState = result; voteMessage.textContent = 'Thank you for your feedback.'; notify('success', 'Feedback saved.');
      } catch (error) {
        if (disposed) return;
        voteState = before;
        if (unknown(error)) { voteUnknown = true; voteMessage.textContent = 'Confirmation was interrupted. Check back before voting again.'; notify('warning', 'Feedback could not be confirmed.'); }
        else { voteMessage.textContent = 'Feedback was not saved. Please try again.'; notify('error', 'Feedback was not saved.'); loadFeedback(); }
      } finally { finish(request); voteBusy = false; if (!disposed) renderVote(); }
    }
    function destroy() {
      if (disposed) return;
      disposed = true; global.removeEventListener('wcs:article-comment-created',externalComment); if (observer) observer.disconnect(); controllers.forEach(function (request) { request.abort(); }); controllers.clear(); root.remove(); mounts.delete(host);
    }
    var api = Object.freeze({load: function () { return load(); }, destroy: destroy}); mounts.set(host, api);
    if (options.lazy !== false && typeof global.IntersectionObserver === 'function') {
      observer = new global.IntersectionObserver(function (entries) { if (entries.some(function (entry) { return entry.isIntersecting; })) load(); }, {rootMargin: '300px 0px'});
      observer.observe(root);
    } else if (options.lazy === false) load();
    return api;
  }
  global.WCSArticleDiscussion = Object.freeze({mount: mount});
})(window);
