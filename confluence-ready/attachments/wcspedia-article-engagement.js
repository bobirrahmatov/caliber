/* Source: space-storage.js */
/* Native-session storage for the configured WCSpedia space. Normal JSON reads
 * select the latest attachment by filename. A CAS content-property pending
 * reservation serializes cooperating writers; native page bodies, attachments
 * and properties are NOT one transaction. Unknown uploads are reconciled, never
 * blindly repeated. Native Confluence permissions remain authoritative.
 * REST: /content/{id}/property (version CAS), /content/{id}/child/attachment. */
(function (root, factory) {
  'use strict';
  var api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.WCSSpaceStorage = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (root) {
  'use strict';
  var MAX_BYTES = 10000000, MAX_PROPERTY_BYTES = 32000;
  function object(v) { return v && typeof v === 'object' && !Array.isArray(v); }
  function integer(v, min) { return Number.isSafeInteger(v) && v >= (min == null ? 0 : min); }
  function id(v) { return typeof v === 'string' && /^[1-9]\d*$/.test(v); }
  function fail(message, code, status) { var e = new Error(message); e.code = code || 'INVALID_DATA'; if (status) e.status = status; throw e; }
  function checkAbort(signal) { if (signal && signal.aborted) { var e = new Error('The request was cancelled.'); e.name = 'AbortError'; throw e; } }
  function clone(value) { return JSON.parse(JSON.stringify(value)); }
  function canonical(value) { return Array.isArray(value) ? value.map(canonical) : object(value) ? Object.fromEntries(Object.keys(value).sort().map(function (key) { return [key, canonical(value[key])]; })) : value; }
  function same(a, b) { return JSON.stringify(canonical(a)) === JSON.stringify(canonical(b)); }
  function jsonBytes(value, limit) {
    var text;
    try { text = JSON.stringify(value); } catch (_) { fail('Use serializable JSON data.', 'INVALID_DATA'); }
    if (text === undefined) fail('Use serializable JSON data.', 'INVALID_DATA');
    var bytes = new TextEncoder().encode(text);
    if (bytes.byteLength > limit) fail('The JSON exceeds the ' + (limit === MAX_BYTES ? '10 MB (10,000,000 byte) attachment' : '32 KB content-property') + ' limit.', 'ATTACHMENT_TOO_LARGE');
    return { text: text, bytes: bytes };
  }
  function create(config, dependencies) {
    config = config || {}; dependencies = dependencies || {};
    var fetcher = dependencies.fetch || root.fetch, crypto = dependencies.crypto || root.crypto, timeoutMs = config.requestTimeoutMs == null ? 12000 : config.requestTimeoutMs;
    if (!integer(timeoutMs, 1) || timeoutMs > 60000) fail('Configure a request timeout between 1 and 60000 milliseconds.', 'CONFIGURATION');
    var writeTimeoutMs=config.writeTimeoutMs==null?60000:config.writeTimeoutMs;
    if(!integer(writeTimeoutMs,1)||writeTimeoutMs>120000)fail('Configure a write timeout between 1 and 120000 milliseconds.','CONFIGURATION');
    var origin = dependencies.origin || root.location && root.location.origin;
    var base;
    try { base = new URL(config.baseUrl || (config.contextPath || '/confluence'), origin); } catch (_) { fail('Configure a same-origin Confluence URL.', 'CONFIGURATION'); }
    var context = base.pathname.replace(/\/$/, '');
    if (!origin || base.origin !== origin || base.protocol !== 'https:' || base.username || base.password || base.search || base.hash || !/^\/(?:[A-Za-z0-9_-]+(?:\/[A-Za-z0-9_-]+)*)?$/.test(context || '/') || typeof fetcher !== 'function' || !crypto || !crypto.subtle || typeof crypto.getRandomValues !== 'function') fail('Use the signed-in HTTPS Confluence origin with Web Crypto and fetch.', 'CONFIGURATION');
    var spaceKey = config.spaceKey, roots = [config.rootPageId].concat(config.extraRootPageIds || []), allowed = config.allowedPageIds || [], protectedIds = config.protectedPageIds || [], storageIds = config.storagePageIds || [];
    if (typeof spaceKey !== 'string' || !spaceKey.trim() || !Array.isArray(roots) || !roots.length || roots.some(function (v) { return !id(v); }) || !Array.isArray(allowed) || !Array.isArray(protectedIds) || !Array.isArray(storageIds) || allowed.concat(protectedIds, storageIds).some(function (v) { return !id(v); }) || config.authorize != null && typeof config.authorize !== 'function') fail('Configure the exact space key, roots and permitted page IDs.', 'CONFIGURATION');
    var rootSet = new Set(roots), allowedSet = new Set(allowed), protectedSet = new Set(protectedIds), storageSet = new Set(storageIds);
    async function digest(bytes) { var hash = await crypto.subtle.digest('SHA-256', bytes); return Array.from(new Uint8Array(hash), function (v) { return v.toString(16).padStart(2, '0'); }).join(''); }
    function token() { var bytes = new Uint8Array(16); crypto.getRandomValues(bytes); return Array.from(bytes, function (v) { return v.toString(16).padStart(2, '0'); }).join(''); }
    function route(path) {
      if (typeof path !== 'string' || !path.startsWith('/') || path.startsWith('//') || /[\\\r\n#]/.test(path)) fail('Use a native Confluence path on this origin.', 'SCOPE');
      var full = context && path.startsWith(context + '/') ? path : context + path;
      var url = new URL(full, origin), rawPath = full.split('?')[0];
      if (url.origin !== origin || url.pathname !== rawPath || /%(?:2e|2f|5c)/i.test(rawPath) || !(url.pathname.startsWith(context + '/rest/api/') || url.pathname.startsWith(context + '/download/attachments/'))) fail('The request escaped the configured Confluence context.', 'SCOPE');
      return url;
    }
    async function bounded(response, signal, maxBytes) {
      maxBytes = maxBytes || MAX_BYTES;
      var length = response.headers && response.headers.get('content-length');
      if (length != null && /^\d+$/.test(length) && Number(length) > maxBytes) { try { await response.body.cancel(); } catch (_) {} fail('The Confluence response exceeds its size limit.', 'ATTACHMENT_TOO_LARGE'); }
      if (response.body && typeof response.body.getReader === 'function') {
        var reader = response.body.getReader(), parts = [], size = 0;
        var cancel = function () { reader.cancel().catch(function () {}); };
        signal.addEventListener('abort', cancel, { once: true });
        try {
          while (true) { checkAbort(signal); var part = await reader.read(); checkAbort(signal); if (part.done) break; size += part.value.byteLength; if (size > maxBytes) { try { await reader.cancel(); } catch (_) {} fail('The Confluence response exceeds its size limit.', 'ATTACHMENT_TOO_LARGE'); } parts.push(part.value); }
        } finally { signal.removeEventListener('abort', cancel); reader.releaseLock(); }
        var bytes = new Uint8Array(size), offset = 0; parts.forEach(function (part) { bytes.set(part, offset); offset += part.byteLength; }); return bytes;
      }
      var fallback = new Uint8Array(await response.arrayBuffer());
      if (fallback.byteLength > maxBytes) fail('The Confluence response exceeds its size limit.', 'ATTACHMENT_TOO_LARGE');
      return fallback;
    }
    async function transport(path, init) {
      init = init || {}; var url = route(path), method = (init.method || 'GET').toUpperCase(), mutation = !['GET', 'HEAD'].includes(method);
      checkAbort(init.signal);
      var headers = new Headers(init.headers || {});
      if (['authorization', 'cookie', 'proxy-authorization'].some(function (key) { return headers.has(key); })) fail('Use the current Confluence session; do not supply credentials.', 'CONFIGURATION');
      headers.set('Accept', 'application/json'); if (mutation) headers.set('X-Requested-With', 'XMLHttpRequest');
      var response, rejection, controller = new AbortController(), timer, onAbort;
      var stopped = new Promise(function (_, reject) {
        function stop(external) {
          if (rejection) { reject(rejection); controller.abort(); return; }
          var error = new Error(mutation ? 'Confluence has not confirmed '+method+' '+url.pathname+'. Use Check save to recover this same request; do not start another document.' : external ? 'The request was cancelled.' : 'Confluence took too long to respond. Try again.');
          if (mutation) error.code = 'UNKNOWN_COMMIT'; else if (external) error.name = 'AbortError'; else error.code = 'TIMEOUT';
          reject(error); controller.abort();
        }
        timer = setTimeout(function () { stop(false); }, mutation ? writeTimeoutMs : timeoutMs);
        onAbort = function () { stop(true); };
        if (init.signal) init.signal.addEventListener('abort', onAbort, { once: true });
      });
      async function perform() {
      try { response = await fetcher(url.href, Object.assign({}, init, { headers: headers, method: method, credentials: 'same-origin', redirect: 'error', cache: 'no-store', signal: controller.signal })); }
      catch (error) { if (!mutation && error.name === 'AbortError') throw error; fail(mutation ? 'The native write outcome is unknown. Preserve the request ID and reload to reconcile it.' : 'Confluence could not be reached.', mutation ? 'UNKNOWN_COMMIT' : 'NETWORK'); }
      if (!response.ok) {
        var codes = { 401: 'AUTH_REQUIRED', 403: 'FORBIDDEN', 404: 'NOT_FOUND', 409: 'CONFLICT', 413: 'ATTACHMENT_TOO_LARGE' };
        var code = codes[response.status] || (mutation && response.status >= 500 ? 'UNKNOWN_COMMIT' : 'CONFLUENCE_HTTP');
        rejection = new Error(response.status === 413 ? 'Confluence rejected this upload. Each attachment must be at most 10 MB; the host may impose a smaller limit.' : 'Confluence returned HTTP ' + response.status + ' for ' + method + ' ' + url.pathname + '.');
        rejection.code = code; rejection.status = response.status;
        // A short structured validation reason is useful; HTML proxy/login
        // pages, stack traces and full responses must not become UI content.
        if (response.status === 400 && /\bapplication\/(?:[a-z0-9.-]+\+)?json\b/i.test(response.headers.get('content-type') || '')) {
          try {
            var problem = JSON.parse(new TextDecoder('utf-8', {fatal:true}).decode(await bounded(response, controller.signal, 8192)));
            var messages = [problem && problem.message].concat(problem && Array.isArray(problem.errorMessages) ? problem.errorMessages.slice(0,3) : []);
            var detail = messages.filter(function(v){return typeof v === 'string' && !/[<>]/.test(v);}).join(' ').replace(/[\u0000-\u001f\u007f]/g,' ').replace(/\s+/g,' ').trim().slice(0,500);
            if (detail) rejection.message += ' Server: ' + detail;
          } catch (_) { /* Keep the original HTTP status if diagnostics are unavailable. */ }
        } else { try { await response.body.cancel(); } catch (_) {} }
        throw rejection;
      }
      if (response.status === 204 || method === 'HEAD') return null;
      try {
        var bytes = await bounded(response, controller.signal);
        if (init.responseType === 'bytes') return bytes;
        return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
      } catch (error) {
        if (!mutation && (error.code || error.name === 'AbortError')) throw error;
        fail(mutation ? 'Confluence did not return a readable write confirmation. Reconcile the original request.' : 'Confluence did not return valid UTF-8 JSON.', mutation ? 'UNKNOWN_COMMIT' : 'INVALID_RESPONSE');
      }
      }
      try { return await Promise.race([perform(), stopped]); }
      finally { clearTimeout(timer); if (init.signal) init.signal.removeEventListener('abort', onAbort); }
    }
    async function page(pageId, expand, options) {
      if (object(expand)) { options = expand; expand = ''; } options = options || {};
      if (!id(pageId) || expand != null && (typeof expand !== 'string' || !/^[A-Za-z0-9.,]*$/.test(expand))) fail('Use a numeric page ID and native expansion names.', 'CONFIGURATION');
      var expansions = Array.from(new Set(['space', 'ancestors', 'operations', 'version'].concat((expand || '').split(',')).filter(Boolean))).join(',');
      var result = await transport('/rest/api/content/' + pageId + '?expand=' + encodeURIComponent(expansions), { signal: options.signal });
      checkAbort(options.signal);
      if (!object(result) || String(result.id) !== pageId || result.type !== 'page' || result.status != null && result.status !== 'current' || !result.space || result.space.key !== spaceKey || !Array.isArray(result.ancestors) || result.ancestors.some(function (ancestor) { return !object(ancestor) || !id(String(ancestor.id)); })) fail('The page is not a current page in the configured WCSpedia space.', 'SCOPE');
      if (!rootSet.has(pageId) && !allowedSet.has(pageId) && !result.ancestors.some(function (ancestor) { return rootSet.has(String(ancestor.id)); })) fail('The page is outside the configured WCSpedia roots.', 'SCOPE');
      return result;
    }
    async function writable(pageId, action, options, requireUpdate) {
      // A dedicated JSON host can remain protected from page body/deletion
      // operations while explicitly accepting its managed property/file pair.
      if (protectedSet.has(pageId) && !(storageSet.has(pageId) && ['json.write', 'property.write'].includes(action))) fail('This page is protected from WCSpedia storage writes.', 'FORBIDDEN');
      var nativePage = await page(pageId, '', options);
      if (requireUpdate && (!Array.isArray(nativePage.operations) || !nativePage.operations.some(function (op) { return op.operation === 'update' && op.targetType === 'page'; }))) fail('Native Confluence edit permission is required for this storage page.', 'FORBIDDEN');
      if (config.authorize && await config.authorize({ action: action, pageId: pageId, page: clone(nativePage) }) !== true) fail('The configured WCSpedia policy does not permit this write.', 'FORBIDDEN');
      return nativePage;
    }
    async function request(path, init) {
      init = init || {}; var method = (init.method || 'GET').toUpperCase();
      if (!['GET', 'HEAD'].includes(method)) {
        if (init.body && typeof init.body.entries === 'function') {
          for (var entry of init.body.entries()) { var part = entry[1]; if (part && typeof part.arrayBuffer === 'function' && (!integer(part.size) || part.size > MAX_BYTES)) fail('Each native attachment must be at most 10 MB (10,000,000 bytes).', 'ATTACHMENT_TOO_LARGE'); }
        }
        var url = route(path), relative = url.pathname.slice(context.length), match = /^\/rest\/api\/content\/([1-9]\d*)(?:\/|$)/.exec(relative);
        if (match) {
          await writable(match[1], 'native.' + method.toLowerCase(), { signal: init.signal }, false);
          // Validate the destination too: an in-scope source page must not be
          // used to move content into another space or an unrelated subtree.
          if (method === 'PUT' && relative === '/rest/api/content/' + match[1]) {
            var update; try { update = typeof init.body === 'string' ? JSON.parse(init.body) : null; } catch (_) {}
            if (!object(update) || update.id != null && String(update.id) !== match[1] || update.type != null && update.type !== 'page' || update.space && update.space.key !== spaceKey) fail('Native page updates must stay in the configured WCSpedia space.', 'SCOPE');
            if (update.ancestors != null) {
              if (!Array.isArray(update.ancestors) || !update.ancestors.length || update.ancestors.some(function (ancestor) { return !object(ancestor) || !id(String(ancestor.id)); })) fail('Page moves need a verified WCSpedia parent.', 'SCOPE');
              await page(String(update.ancestors[update.ancestors.length - 1].id), '', { signal: init.signal });
            }
          }
          if (/\/move(?:\/|$)/.test(relative)) fail('Use a versioned native page update with a verified destination.', 'SCOPE');
        }
        else if (relative === '/rest/api/content' && method === 'POST') {
          var body; try { body = typeof init.body === 'string' ? JSON.parse(init.body) : null; } catch (_) {}
          var parent = body && body.type === 'comment' ? body.container && String(body.container.id) : body && body.type === 'page' && body.ancestors && body.ancestors.length ? String(body.ancestors[body.ancestors.length - 1].id) : null;
          if (!id(parent) || body.type === 'page' && (!body.space || body.space.key !== spaceKey)) fail('Native content must target a verified WCSpedia parent and space.', 'SCOPE');
          await writable(parent, 'native.create-' + body.type, { signal: init.signal }, false);
        } else if (config.allowSpacePermissionSync === true && method === 'PUT' && relative.startsWith('/rest/api/space/'+encodeURIComponent(spaceKey)+'/permissions/user/') && /^\/rest\/api\/space\/[^/]+\/permissions\/user\/[^/]+\/(grant|revoke)$/.test(relative)) {
          var grants;try {grants=JSON.parse(init.body);}catch(_){}
          if(!Array.isArray(grants)||!grants.length||grants.length>5||grants.some(function(g){return !g||Object.keys(g).sort().join(',')!=='operationKey,targetType'||!['space:read','space:restrict','page:create','page:delete','attachment:create'].includes(g.targetType+':'+g.operationKey);}))fail('Only supported WCSpedia native access grants can be synchronized.','SCOPE');
        } else fail('This storage helper does not mutate unrelated Confluence resources.', 'SCOPE');
      }
      return transport(path, init);
    }
    async function user(options) { return transport('/rest/api/user/current', options || {}); }
    function keyCheck(key) { if (typeof key !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(key)) fail('Use a safe content-property key.', 'CONFIGURATION'); }
    function validateProperty(value, pageId, key) {
      if (!object(value) || value.key !== key || !id(String(value.id)) || !object(value.version) || !integer(value.version.number, 1) || !Object.prototype.hasOwnProperty.call(value, 'value') || value.content && String(value.content.id) !== pageId) fail('Confluence returned an invalid content property.', 'INVALID_RESPONSE');
      return value;
    }
    async function getProperty(pageId, key, options) {
      try { return validateProperty(await transport('/rest/api/content/' + pageId + '/property/' + encodeURIComponent(key) + '?expand=version', options || {}), pageId, key); }
      catch (error) { if (error.status === 404) return null; throw error; }
    }
    async function findProperty(pageId, key, options) {
      // A missing JSON pointer is normal on first installation. The collection
      // returns an empty result without the misleading /property/{key} 404.
      // Do not treat an unavailable collection/API as an absent property.
      var start = 0, seen = new Set();
      while (start < 1000) {
        var result = await transport('/rest/api/content/' + pageId + '/property?expand=version&limit=100&start=' + start, options || {});
        if (!object(result) || !Array.isArray(result.results) || result.results.length > 100) fail('Confluence did not return a valid metadata collection.', 'INVALID_RESPONSE');
        var found = null;
        result.results.forEach(function (item) {
          if (!object(item) || typeof item.key !== 'string' || seen.has(item.key)) fail('Confluence metadata pagination repeated or returned an invalid key.', 'INVALID_RESPONSE');
          seen.add(item.key);
          if (item.key === key) found = validateProperty(item, pageId, key);
        });
        if (found) return found;
        if (!(result._links && result._links.next)) return null;
        if (!result.results.length) fail('Confluence metadata pagination did not advance.', 'INVALID_RESPONSE');
        start += result.results.length;
      }
      fail('The metadata lookup exceeded its safe page limit.', 'PROPERTY_LIMIT');
    }
    async function property(pageId, key, options) { keyCheck(key); await page(pageId, '', options); return options && options.optional === true ? findProperty(pageId, key, { signal: options.signal }) : getProperty(pageId, key, options); }
    async function putProperty(pageId, key, value, expectedVersion, options) {
      options = options || {}; keyCheck(key); var encoded = jsonBytes(value, MAX_PROPERTY_BYTES);
      if (expectedVersion !== null && !integer(expectedVersion, 1)) fail('Use null to create a property or its current CAS version to update it.', 'CONFIGURATION');
      await writable(pageId, 'property.write', options, true);
      var previous = await getProperty(pageId, key, options), nextVersion = expectedVersion === null ? 1 : expectedVersion + 1;
      if ((previous ? previous.version.number : null) !== expectedVersion) fail('The content property changed. Reload before writing.', 'CONFLICT');
      var payload = { key: key, value: JSON.parse(encoded.text), version: { number: nextVersion } };
      if (previous) payload.id = previous.id;
      try {
        var result = validateProperty(await transport('/rest/api/content/' + pageId + '/property' + (previous ? '/' + encodeURIComponent(key) : ''), { method: previous ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload), signal: options.signal }), pageId, key);
        if (result.version.number !== nextVersion || !same(result.value, payload.value) || previous && result.id !== previous.id) fail('The property write was not confirmed.', 'UNKNOWN_COMMIT');
        return result;
      } catch (error) {
        if (error.code !== 'UNKNOWN_COMMIT' && error.code !== 'CONFLICT') throw error;
        // A lost CAS reply may be confirmed, but no PUT/POST is repeated.
        var found; try { found = await getProperty(pageId, key, {}); } catch (_) { throw error; }
        if (found && found.version.number === nextVersion && same(found.value, payload.value) && (!previous || found.id === previous.id)) return found;
        throw error;
      }
    }
    function fileCheck(filename) { if (typeof filename !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._-]{0,155}\.json$/.test(filename)) fail('Use a safe JSON attachment filename.', 'CONFIGURATION'); }
    async function metadata(pageId, filename, options) {
      var result = await transport('/rest/api/content/' + pageId + '/child/attachment?filename=' + encodeURIComponent(filename) + '&expand=version,container&limit=2', options || {});
      if (!object(result) || !Array.isArray(result.results) || result.results.length > 1 || result._links && result._links.next) fail('The JSON attachment name is missing or ambiguous.', 'INVALID_ATTACHMENT');
      if (!result.results.length) return null;
      var item = result.results[0];
      if (!object(item) || !id(String(item.id)) || item.type !== 'attachment' || item.title !== filename || !item.version || !integer(item.version.number, 1) || !item.container || String(item.container.id) !== pageId || item.container.type !== 'page') fail('The attachment identity, filename or parent did not match.', 'INVALID_ATTACHMENT');
      return { id: String(item.id), version: item.version.number };
    }
    async function bytesAt(pageId, filename, version, options) { return transport('/download/attachments/' + pageId + '/' + encodeURIComponent(filename) + '?api=v2' + (version == null ? '' : '&version=' + version), Object.assign({}, options, { responseType: 'bytes' })); }
    function attachmentCheck(value) { return object(value) && id(value.id) && integer(value.version, 1) && /^[a-f0-9]{64}$/.test(value.sha256) && integer(value.bytes) && value.bytes <= MAX_BYTES; }
    function validatePointer(value, pageId, filename) {
      if (!object(value) || Object.keys(value).some(function (name) { return !['schemaVersion', 'pageId', 'filename', 'attachment', 'lastWrite', 'pending'].includes(name); }) || value.schemaVersion !== 1 || value.pageId !== pageId || value.filename !== filename || value.attachment !== null && !attachmentCheck(value.attachment) || value.lastWrite !== null && !object(value.lastWrite) || value.pending !== null && !object(value.pending)) fail('The JSON pointer does not match this page and attachment.', 'INVALID_POINTER');
      if (value.pending) {
        var p = value.pending;
        if (typeof p.requestId !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,159}$/.test(p.requestId) || !/^[a-f0-9]{64}$/.test(p.sha256) || !integer(p.bytes) || p.bytes > MAX_BYTES || !integer(p.expectedRevision) || !integer(p.expectedAttachmentVersion) || !integer(p.nativeVersion) || p.attachmentId !== null && !id(p.attachmentId) || typeof p.actor !== 'string' || !p.actor || !/^[a-f0-9]{32}$/.test(p.token)) fail('The pending JSON write is invalid.', 'INVALID_POINTER');
        if (p.expectedAttachmentVersion !== (value.attachment ? value.attachment.version : 0) || p.nativeVersion !== p.expectedAttachmentVersion || p.attachmentId !== (value.attachment ? value.attachment.id : null)) fail('The pending JSON baseline is inconsistent.', 'INVALID_POINTER');
      }
      if (value.lastWrite && (typeof value.lastWrite.requestId !== 'string' || !/^[a-f0-9]{64}$/.test(value.lastWrite.sha256) || !integer(value.lastWrite.expectedRevision) || !integer(value.lastWrite.expectedAttachmentVersion) || typeof value.lastWrite.actor !== 'string')) fail('The JSON commit receipt is invalid.', 'INVALID_POINTER');
      return value;
    }
    async function snapshot(pageId, filename, key, options) {
      var reads = await Promise.all([findProperty(pageId, key, options), metadata(pageId, filename, options)]);
      var prop = reads[0], pointer = prop ? validatePointer(prop.value, pageId, filename) : null, native = reads[1];
      // A pending managed upload is not yet authoritative. Retain its known
      // baseline for the original-request reconciliation protocol only.
      var pending = pointer && pointer.pending, selected = pending ? pointer.attachment : native;
      if (pointer && pointer.attachment && !native) fail('The JSON attachment ' + filename + ' is missing on page ' + pageId + '. Restore or upload it before continuing.', 'ATTACHMENT_NOT_FOUND');
      if (pending && selected && (native.id !== selected.id || native.version < selected.version)) fail('The attachment changed during an unfinished save. Reconcile the original request before continuing.', 'CONFLICT');
      var bytes = selected ? await bytesAt(pageId, filename, pending ? selected.version : null, options) : null, hash = bytes ? await digest(bytes) : null, data = null;
      var committed = pointer && pointer.attachment;
      if (bytes) { try { data = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)); } catch (_) { fail('The attachment must contain valid UTF-8 JSON.', 'INVALID_JSON'); } }
      var verified = await Promise.all([prop ? getProperty(pageId, key, options) : findProperty(pageId, key, options), metadata(pageId, filename, options)]);
      var fresh = verified[0];
      if ((fresh ? fresh.version.number : 0) !== (prop ? prop.version.number : 0) || fresh && (fresh.id !== prop.id || !same(fresh.value, prop.value))) fail('The JSON pointer changed while loading. Reload it.', 'CONFLICT');
      if (!same(verified[1], native)) fail('The live JSON attachment changed while loading.', 'CONFLICT');
      if (committed && selected && committed.id === selected.id && committed.version === selected.version && (hash !== committed.sha256 || bytes.byteLength !== committed.bytes)) fail('The JSON failed its SHA-256 check for the same native attachment revision.', 'INTEGRITY');
      return { data: data, revision: prop ? prop.version.number : 0, attachmentId: selected ? selected.id : null, attachmentVersion: selected ? selected.version : 0, pointer: pointer, propertyId: prop ? prop.id : null, native: native, baseline: selected ? { id: selected.id, version: selected.version, sha256: hash, bytes: bytes.byteLength } : null };
    }
    function fingerprint(result) { return result.baseline ? result.baseline.id + ':' + result.baseline.version + ':' + result.baseline.sha256 : null; }
    function exposed(result) { return { data: result.data, revision: result.revision, attachmentId: result.attachmentId, attachmentVersion: result.attachmentVersion, fingerprint:fingerprint(result), pointer: result.pointer }; }
    async function readJSON(pageId, filename, pointerKey, options) { fileCheck(filename); keyCheck(pointerKey); await page(pageId, '', options); return exposed(await snapshot(pageId, filename, pointerKey, options || {})); }
    // Optional administrative inspection. Ordinary manual replacements no
    // longer need pointer repair before they can be read.
    async function inspectJSON(pageId, filename, pointerKey, options) {
      options = options || {}; fileCheck(filename); keyCheck(pointerKey);
      var nativePage = await page(pageId, '', options);
      var pair = await Promise.all([findProperty(pageId, pointerKey, options), metadata(pageId, filename, options)]);
      var prop = pair[0], candidate = pair[1], pointer = prop ? validatePointer(prop.value, pageId, filename) : null;
      if (pointer && pointer.pending) fail('A JSON save is pending. Recover its original request before adopting another attachment.', 'WRITE_PENDING');
      if (!candidate) fail('Upload or restore ' + filename + ' on page ' + pageId + ' before reviewing recovery.', 'ATTACHMENT_NOT_FOUND');
      var bytes = await bytesAt(pageId, filename, candidate.version, options), hash = await digest(bytes), data;
      try { data = JSON.parse(new TextDecoder('utf-8', {fatal:true}).decode(bytes)); }
      catch (_) { fail(filename + ' must contain valid UTF-8 JSON.', 'INVALID_JSON'); }
      var after = await Promise.all([findProperty(pageId, pointerKey, options), metadata(pageId, filename, options)]);
      if (!same(after[0], prop) || !same(after[1], candidate)) fail('The JSON changed during recovery preview. Inspect it again.', 'CONFLICT');
      return {pageId:pageId, filename:filename, key:pointerKey, property:prop, candidate:{id:candidate.id,version:candidate.version,sha256:hash,bytes:bytes.byteLength}, data:data,
        canRepair:Array.isArray(nativePage.operations) && nativePage.operations.some(function(op){return op.operation==='update'&&op.targetType==='page';})};
    }
    async function reconcileJSON(preview, options) {
      options = options || {};
      if (!object(preview) || !object(preview.candidate)) fail('Inspect the attachment before recovery.', 'CONFIGURATION');
      var pageId = preview.pageId, filename = preview.filename, pointerKey = preview.key;
      fileCheck(filename); keyCheck(pointerKey);
      await writable(pageId, 'json.write', options, true);
      var current = await inspectJSON(pageId, filename, pointerKey, options);
      if (!same(current.property, preview.property) || !same(current.candidate, preview.candidate)) fail('The attachment or its saved reference changed. Inspect it again before recovery.', 'CONFLICT');
      var who = await user(options), actor = who && who.type === 'known' && (who.userKey ? 'key:' + who.userKey : who.accountId ? 'account:' + who.accountId : who.username ? 'user:' + who.username.toUpperCase() : null);
      if (!actor) fail('A signed-in native Confluence account is required.', 'AUTH_REQUIRED');
      var requestId = options.requestId;
      if (typeof requestId !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,159}$/.test(requestId)) fail('Provide a recovery request ID.', 'CONFIGURATION');
      var next = {schemaVersion:1,pageId:pageId,filename:filename,attachment:current.candidate,pending:null,
        lastWrite:{requestId:requestId,sha256:current.candidate.sha256,actor:actor,
          expectedRevision:current.property ? current.property.version.number : 0,expectedAttachmentVersion:current.candidate.version}};
      // CAS protects cooperating writers. The caller's recovery backup includes
      // the old reference. No attachment upload or policy/history edit occurs.
      await putProperty(pageId, pointerKey, next, current.property ? current.property.version.number : null, options);
      var result = await snapshot(pageId, filename, pointerKey, options);
      if (!result.pointer || !same(result.pointer, next)) fail('Recovery changed before confirmation. Inspect again; do not repeat the write automatically.', 'CONFLICT');
      return exposed(result);
    }
    async function writeJSON(pageId, filename, pointerKey, data, options) {
      options = options || {}; fileCheck(filename); keyCheck(pointerKey);
      var encoded = jsonBytes(data, MAX_BYTES), hash = await digest(encoded.bytes), requestId = options.requestId;
      if (!integer(options.expectedRevision) || !integer(options.expectedAttachmentVersion) || typeof requestId !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,159}$/.test(requestId)) fail('Provide the original request ID and expected JSON/native revisions.', 'CONFIGURATION');
      await writable(pageId, 'json.write', options, true);
      var currentUser = await user({ signal: options.signal }), actor = currentUser && currentUser.type === 'known' && (currentUser.userKey ? 'key:' + currentUser.userKey : currentUser.accountId ? 'account:' + currentUser.accountId : currentUser.username ? 'user:' + currentUser.username.toUpperCase() : null);
      if (!actor) fail('A signed-in native Confluence account is required.', 'AUTH_REQUIRED');
      var before = await snapshot(pageId, filename, pointerKey, options), pointer = before.pointer;
      function matches(receipt) { return receipt && receipt.requestId === requestId && receipt.sha256 === hash && receipt.actor === actor && receipt.expectedRevision === options.expectedRevision && receipt.expectedAttachmentVersion === options.expectedAttachmentVersion; }
      if (pointer && pointer.lastWrite && pointer.lastWrite.requestId === requestId) {
        if (!matches(pointer.lastWrite) || !same(before.baseline, pointer.attachment)) fail('This request ID was already used or its attachment has since changed. Reload the latest JSON.', 'CONFLICT');
        return exposed(before);
      }
      var pending = pointer && pointer.pending, reservation, ownsUpload = false;
      if (pending) { if (!matches(pending)) fail('An earlier JSON write requires reconciliation using its original request ID.', 'WRITE_PENDING'); reservation = { id: before.propertyId, version: { number: before.revision }, value: pointer }; }
      else {
        if (before.revision !== options.expectedRevision || before.attachmentVersion !== options.expectedAttachmentVersion) fail('The JSON changed. Reload before saving.', 'CONFLICT');
        if (options.expectedFingerprint !== undefined) {
          if (options.expectedFingerprint !== fingerprint(before)) fail('The JSON file was replaced or changed. Reload before saving.', 'CONFLICT');
        } else if (pointer && !same(pointer.attachment, before.baseline)) {
          fail('Reload the latest attachment with its fingerprint before saving a manual replacement.', 'CONFLICT');
        }
        pending = { requestId: requestId, sha256: hash, bytes: encoded.bytes.byteLength, actor: actor, expectedRevision: options.expectedRevision, expectedAttachmentVersion: options.expectedAttachmentVersion, nativeVersion: before.native ? before.native.version : 0, attachmentId: before.native ? before.native.id : null, token: token() };
        pointer = { schemaVersion: 1, pageId: pageId, filename: filename, attachment: before.baseline, lastWrite: pointer ? pointer.lastWrite : null, pending: pending };
        reservation = await putProperty(pageId, pointerKey, pointer, before.revision || null, options); ownsUpload = true;
      }
      if (ownsUpload) {
        // Recheck the existing native file after winning the property CAS. A
        // native/manual upload is not allowed to become an unnoticed baseline.
        var preUpload = await metadata(pageId, filename, options);
        if ((preUpload ? preUpload.id : null) !== pending.attachmentId || (preUpload ? preUpload.version : 0) !== pending.nativeVersion) fail('The native attachment changed before upload. Reconcile the reserved write.', 'CONFLICT');
        var Form = dependencies.FormData || root.FormData, BlobType = dependencies.Blob || root.Blob;
        if (!Form || !BlobType) fail('This browser cannot upload native attachments.', 'CONFIGURATION');
        var form = new Form(); form.append('file', new BlobType([encoded.bytes], { type: 'application/json' }), filename); form.append('comment', 'WCSpedia JSON ' + requestId + '; SHA-256 ' + hash); form.append('minorEdit', 'false');
        try {
          await transport('/rest/api/content/' + pageId + '/child/attachment' + (pending.attachmentId ? '/' + pending.attachmentId + '/data' : ''), { method: 'POST', headers: { 'X-Atlassian-Token': 'nocheck' }, body: form, signal: options.signal });
        } catch (error) {
          if (error.code !== 'UNKNOWN_COMMIT') {
            // Definite rejections may release this reservation, but never erase
            // another writer's property version or a committed native upload.
            if ([400, 401, 403, 404, 413].includes(error.status)) { try { await putProperty(pageId, pointerKey, Object.assign({}, pointer, { pending: null }), reservation.version.number, {}); } catch (_) {} }
            throw error;
          }
          // Continue with read-only reconciliation of the exact expected bytes.
        }
      }
      var uploaded = await metadata(pageId, filename, {});
      if (!uploaded || uploaded.version === pending.nativeVersion && uploaded.id === pending.attachmentId) fail('The attachment upload is not confirmed yet. Retry only this original request ID to reconcile it; no duplicate upload was sent.', 'UNKNOWN_COMMIT');
      if (uploaded.version !== pending.nativeVersion + 1 || pending.attachmentId && uploaded.id !== pending.attachmentId) fail('The native attachment diverged from this reserved write. Inspect its version history.', 'CONFLICT');
      var confirmedBytes = await bytesAt(pageId, filename, uploaded.version, {});
      if (confirmedBytes.byteLength !== pending.bytes || await digest(confirmedBytes) !== hash) fail('The uploaded attachment does not match this request. No JSON pointer was committed.', 'INTEGRITY');
      var committed = { schemaVersion: 1, pageId: pageId, filename: filename, attachment: { id: uploaded.id, version: uploaded.version, sha256: hash, bytes: confirmedBytes.byteLength }, lastWrite: { requestId: requestId, sha256: hash, actor: actor, expectedRevision: options.expectedRevision, expectedAttachmentVersion: options.expectedAttachmentVersion }, pending: null };
      try { await putProperty(pageId, pointerKey, committed, reservation.version.number, {}); }
      catch (error) {
        if (error.code !== 'CONFLICT' && error.code !== 'UNKNOWN_COMMIT') throw error;
        var found = await getProperty(pageId, pointerKey, {});
        if (!found || !same(found.value, committed)) throw error;
      }
      var finalState = await snapshot(pageId, filename, pointerKey, {});
      if (!finalState.pointer || !matches(finalState.pointer.lastWrite) || !same(finalState.baseline, committed.attachment)) fail('Another JSON change committed before this confirmation was read. Reload the current state.', 'CONFLICT');
      return exposed(finalState);
    }
    return Object.freeze({ request: request, page: page, user: user, property: property, putProperty: putProperty, readJSON: readJSON, writeJSON: writeJSON, inspectJSON:inspectJSON, reconcileJSON:reconcileJSON, maxBytes: MAX_BYTES });
  }
  return Object.freeze({ create: create, MAX_BYTES: MAX_BYTES, MAX_PROPERTY_BYTES: MAX_PROPERTY_BYTES });
});

;
/* Source: space-engagement.js */
/* Space-only helpfulness and recorded views. Native Confluence update permission
 * is required for JSON property writes. These cooperative measurements are not
 * full server analytics or tamper-proof ballots. Article loading reads two known
 * properties; only an explicit analytics export enumerates votes. */
(function (root, factory) {
  'use strict';
  var api = factory(root, typeof module === 'object' && module.exports ? require('./space-storage.js') : root.WCSSpaceStorage);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.WCSSpaceEngagement = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (root, Storage) {
  'use strict';
  var VOTE_PREFIX = 'wcspedia-helpfulness-v1-', VIEW_KEY = 'wcspedia-recorded-views-v1';
  var WINDOW_MS = 30 * 60 * 1000, MAX_ACTIVE = 180, MAX_BYTES = 32000, PAGE_SIZE = 50;
  var COVERAGE = Object.freeze({ scope: 'wcspedia-published-articles', actors: 'signed-in-users-with-native-page-update', viewDefinition: 'one-successfully-recorded-visit-per-account-per-30-minutes', completeConfluenceTraffic: false, ballotOwnership: 'cooperative-native-editors-can-edit-properties', consistency: 'non-atomic-export', activeViewCapacity: MAX_ACTIVE });
  function object(v) { return v && typeof v === 'object' && !Array.isArray(v); }
  function integer(v, min) { return Number.isSafeInteger(v) && v >= (min == null ? 0 : min); }
  function id(v) { return typeof v === 'string' && /^[1-9]\d{0,19}$/.test(v); }
  function fail(code, message) { var e = new Error(message); e.code = code; e.outcome = code === 'UNKNOWN_COMMIT' ? 'unknown' : 'rejected'; throw e; }
  function abort(signal) { if (signal && signal.aborted) { var e = new Error('Engagement request cancelled.'); e.name = 'AbortError'; throw e; } }
  function clone(v) { return JSON.parse(JSON.stringify(v)); }
  function size(v) { if (new TextEncoder().encode(JSON.stringify(v)).byteLength > MAX_BYTES) fail('CAPACITY', 'The document engagement JSON exceeds its 32 KB property limit.'); }
  function requestId(v) { return typeof v === 'string' && /^[A-Za-z0-9][A-Za-z0-9._:-]{0,159}$/.test(v); }
  function timestamp(v) { return typeof v === 'string' && Number.isFinite(Date.parse(v)) && new Date(v).toISOString() === v; }
  function validateProperty(prop, pageId, key) {
    if (!object(prop) || prop.key !== key || !id(String(prop.id)) || !object(prop.version) || !integer(prop.version.number, 1) || !object(prop.value) || prop.content && String(prop.content.id) !== pageId) fail('INVALID_DATA', 'Confluence returned malformed engagement metadata.');
    size(prop.value); return prop;
  }
  function voteData(prop, pageId, key) {
    if (!prop) return null;
    var v = validateProperty(prop, pageId, key).value;
    if (v.schemaVersion !== 1 || v.pageId !== pageId || !['yes', 'no'].includes(v.value) || !integer(v.pageVersion, 1) || !timestamp(v.updatedAt) || !requestId(v.requestId)) fail('INVALID_DATA', 'The saved helpfulness JSON is invalid.');
    return v;
  }
  function viewData(prop, pageId) {
    if (!prop) return { schemaVersion: 1, pageId: pageId, count: 0, lastRecordedAt: null, active: {} };
    var v = validateProperty(prop, pageId, VIEW_KEY).value;
    if (v.schemaVersion !== 1 || v.pageId !== pageId || !integer(v.count) || !object(v.active) || Object.keys(v.active).length > MAX_ACTIVE || v.count < Object.keys(v.active).length || (v.count === 0 ? v.lastRecordedAt !== null : !timestamp(v.lastRecordedAt))) fail('INVALID_DATA', 'The saved recorded-view JSON is invalid.');
    Object.keys(v.active).forEach(function (key) { var e = v.active[key]; if (!/^[a-f0-9]{64}$/.test(key) || !object(e) || !integer(e.at) || !/^wcsview-\d{1,16}-[a-f0-9]{32}$/.test(e.requestId || '') || Number(e.requestId.split('-')[1]) !== e.at) fail('INVALID_DATA', 'The saved recorded-view deduplication JSON is invalid.'); });
    return v;
  }
  function create(config, dependencies) {
    config = config || {}; dependencies = dependencies || {};
    var publication = object(config.nativePublication) ? config.nativePublication : config;
    var rootId = config.rootPageId || config.pageIds && config.pageIds.home, space = config.spaceKey;
    var parents = Object.values(publication.areaPageIds || config.areaPageIds || {});
    var insights = config.insightsPageId || publication.insightsPageId; if (insights) parents.push(insights);
    if (!id(rootId) || typeof space !== 'string' || !space.trim() || space !== space.trim() || !parents.length || parents.length > 50 || parents.some(function (v) { return !id(v) || v === rootId; }) || new Set(parents).size !== parents.length) fail('CONFIGURATION', 'Configure the exact WCSpedia root, space and article parent page IDs.');
    var excluded = new Set([rootId].concat(parents)), excludedTrees = new Set();
    function exclude(v, tree) { if (v == null || v === '') return; if (!id(v)) fail('CONFIGURATION', 'Use numeric excluded page IDs.'); excluded.add(v); if (tree) excludedTrees.add(v); }
    exclude(config.attachmentPageId); Object.values(config.pageIds || {}).forEach(function (v) { exclude(v); });
    exclude(publication.workingRootPageId || config.workingRootPageId, true);
    var search = config.search || {};
    ['excludePageIds', 'excludeAncestorIds'].forEach(function (key) { if (search[key] != null && (!Array.isArray(search[key]) || search[key].length > 100)) fail('CONFIGURATION', 'Invalid engagement page exclusions.'); (search[key] || []).forEach(function (v) { exclude(v, key === 'excludeAncestorIds'); }); });
    if (excludedTrees.has(rootId) || parents.some(function (v) { return excludedTrees.has(v); })) fail('CONFIGURATION', 'Working pages must be separate from published article parents.');
    var store = dependencies.storage || Storage && Storage.create(Object.assign({}, config, { rootPageId: rootId, spaceKey: space, extraRootPageIds: [], allowedPageIds: [], protectedPageIds: Array.from(excluded), authorize: function (write) { verifyPage(write.page, write.pageId); return true; } }), dependencies);
    if (!store || typeof store.page !== 'function' || typeof store.request !== 'function') fail('CONFIGURATION', 'Native Confluence storage is required.');
    var crypto = dependencies.crypto || root.crypto, now = dependencies.now || Date.now, pendingViews = new Map(), pendingVotes = new Map();
    var maxProperties = config.maxEngagementProperties == null ? 100000 : config.maxEngagementProperties;
    if (!integer(maxProperties, 1) || maxProperties > 100000) fail('CONFIGURATION', 'Invalid engagement property export limit.');
    function clock() { var n = now(); if (!integer(n)) fail('INVALID_DATA', 'The browser clock is invalid.'); return n; }
    function verifyPage(p, pageId) {
      var ancestors = p && p.ancestors;
      if (!object(p) || String(p.id) !== pageId || p.type !== 'page' || p.status !== 'current' || !p.space || p.space.key !== space || !Array.isArray(ancestors) || ancestors.some(function (a) { return !object(a) || !id(String(a.id)); }) || !p.version || !integer(p.version.number, 1)) fail('OUT_OF_SCOPE', 'Engagement requires a current WCSpedia article.');
      var ids = ancestors.map(function (a) { return String(a.id); }), rootIndex = ids.indexOf(rootId);
      if (excluded.has(pageId) || rootIndex < 0 || ids.some(function (v) { return excludedTrees.has(v); }) || !parents.some(function (v) { return ids.indexOf(v) > rootIndex; })) fail('OUT_OF_SCOPE', 'Engagement is limited to published business-area and Insights child articles.');
      return p;
    }
    async function page(pageId, options) {
      if (!id(pageId)) fail('CONFIGURATION', 'Use a numeric document page ID.');
      abort(options && options.signal);
      return verifyPage(await store.page(pageId, '', options || {}), pageId);
    }
    async function identity(pageId, options) {
      if (!crypto || !crypto.subtle || !crypto.getRandomValues || typeof store.user !== 'function') fail('CONFIGURATION', 'Signed-in native identity and Web Crypto are required.');
      var u = await store.user(options || {}), actor = u && u.type === 'known' && (u.userKey ? 'key:' + u.userKey : u.accountId ? 'account:' + u.accountId : u.username ? 'user:' + u.username.toUpperCase() : null);
      if (!actor) return null;
      var digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(space + ':' + rootId + ':' + pageId + ':' + actor));
      return Array.from(new Uint8Array(digest), function (v) { return v.toString(16).padStart(2, '0'); }).join('');
    }
    function canUpdate(p) { return Array.isArray(p.operations) && p.operations.some(function (v) { return v.operation === 'update' && v.targetType === 'page'; }); }
    async function property(pageId, key, options) {
      try { return validateProperty(await store.request('/rest/api/content/' + pageId + '/property/' + key + '?expand=version', options || {}), pageId, key); }
      catch (error) { if (error.status === 404 || error.code === 'NOT_FOUND') return null; throw error; }
    }
    function result(p, actor, prop, views) {
      var v = actor ? voteData(prop, String(p.id), VOTE_PREFIX + actor) : null, allowed = !!actor && canUpdate(p);
      return { schemaVersion: 1, rootPageId: rootId, pageId: String(p.id), pageVersion: p.version.number, canVote: allowed, canRecord: allowed, reason: !actor ? 'Sign in to record helpfulness and views.' : allowed ? '' : 'Native Confluence page edit permission is required to record helpfulness and views.', myVote: { value: v ? v.value : null, revision: prop ? prop.version.number : 0, pageVersion: v ? v.pageVersion : null }, totals: null, views: { source: 'confluence-content-properties', status: 'available', recordedViews: views.count, windowMinutes: 30, lastRecordedAt: views.lastRecordedAt }, coverage: clone(COVERAGE) };
    }
    async function loadViews(pageId, options) {
      options = options || {};
      await page(pageId, options); // Same scope and access verification as the reader.
      var views = viewData(await property(pageId, VIEW_KEY, options), pageId);
      return {pageId:String(pageId),views:{recordedViews:views.count}};
    }
    async function load(pageId, options) {
      options = options || {};
      var pair = await Promise.all([page(pageId, options), identity(pageId, options)]), p = pair[0], actor = pair[1];
      var props = await Promise.all([actor ? property(pageId, VOTE_PREFIX + actor, options) : null, property(pageId, VIEW_KEY, options)]);
      var snapshot = result(p, actor, props[0], viewData(props[1], pageId)), pendingKey = pageId + ':' + actor, pending = actor && pendingVotes.get(pendingKey);
      if (pending && props[0] && ((props[0].value.requestId === pending.requestId && props[0].value.value === pending.value) || integer(pending.expected) && props[0].version.number > pending.expected)) pendingVotes.delete(pendingKey);
      pending = actor && pendingVotes.get(pendingKey);
      // An absent or unchanged property does not prove an in-flight write failed.
      // Keep its immutable command available for an explicit, idempotent retry.
      snapshot.pendingVote = pending ? { value: pending.value, requestId: pending.requestId, expectedVoteRevision: pending.expected, pageVersion: pending.pageVersion } : null;
      return snapshot;
    }
    function random() { if (!crypto || typeof crypto.getRandomValues !== 'function') fail('CONFIGURATION', 'Secure request identifiers are unavailable.'); return Array.from(crypto.getRandomValues(new Uint8Array(16)), function (v) { return v.toString(16).padStart(2, '0'); }).join(''); }
    async function writable(pageId, options) {
      var pair = await Promise.all([page(pageId, options), identity(pageId, options)]);
      if (!pair[1]) fail('AUTH_REQUIRED', 'Sign in to record helpfulness and views.');
      if (!canUpdate(pair[0])) fail('FORBIDDEN', 'Native Confluence page edit permission is required to record helpfulness and views.');
      if (typeof store.putProperty !== 'function') fail('CONFIGURATION', 'Native engagement writes are unavailable.');
      return pair;
    }
    async function vote(pageId, value, options) {
      options = options || {}; if (!['yes', 'no'].includes(value)) fail('INVALID_DATA', 'Choose a helpful or unhelpful vote.');
      var pair = await writable(pageId, options), p = pair[0], actor = pair[1], key = VOTE_PREFIX + actor;
      var pendingKey = pageId + ':' + actor, command = pendingVotes.get(pendingKey), wasPending = !!command;
      if (command && command.value !== value) fail('UNKNOWN_COMMIT', 'Reconcile the previous helpfulness vote before changing your choice.');
      if (!command && options.pageVersion != null && options.pageVersion !== p.version.number) fail('CONFLICT', 'The article changed since helpfulness was loaded. Reload before voting.');
      if (!command) { command = { requestId: options.requestId || 'wcsvote-' + random(), value: value, pageVersion: p.version.number, expected: options.expectedVoteRevision }; if (!requestId(command.requestId)) fail('CONFIGURATION', 'Use a valid helpfulness request ID.'); pendingVotes.set(pendingKey, command); }
      var before, data, saved;
      try { before = await property(pageId, key, options); data = voteData(before, pageId, key); }
      catch (error) { if (!wasPending) pendingVotes.delete(pendingKey); throw error; }
      if (data && data.requestId === command.requestId) {
        if (data.value !== command.value) { pendingVotes.delete(pendingKey); fail('CONFLICT', 'This request ID was used for another vote.'); } saved = before;
      } else {
        if (command.expected == null) command.expected = before ? before.version.number : 0;
        if (!integer(command.expected) || command.expected !== (before ? before.version.number : 0)) { pendingVotes.delete(pendingKey); fail('CONFLICT', 'Your helpfulness vote changed in another tab. Reload before voting.'); }
        var next = { schemaVersion: 1, pageId: pageId, value: value, pageVersion: command.pageVersion, updatedAt: new Date(clock()).toISOString(), requestId: command.requestId };
        try { saved = await store.putProperty(pageId, key, next, before ? before.version.number : null, options); voteData(saved, pageId, key); }
        catch (error) {
          if (error.code !== 'UNKNOWN_COMMIT') { pendingVotes.delete(pendingKey); throw error; }
          try { saved = await property(pageId, key, {}); var receipt = voteData(saved, pageId, key); if (!receipt || receipt.requestId !== command.requestId || receipt.value !== value) throw error; }
          catch (_) { throw error; }
        }
      }
      pendingVotes.delete(pendingKey);
      return { accepted: true, requestId: command.requestId, pageId: pageId, pageVersion: p.version.number, canVote: true, myVote: { value: value, revision: saved.version.number, pageVersion: saved.value.pageVersion }, totals: null, coverage: clone(COVERAGE) };
    }
    async function recordView(pageId, options) {
      options = options || {}; var pair = await writable(pageId, options), actor = pair[1], pendingKey = pageId + ':' + actor;
      var command = pendingViews.get(pendingKey), nowMs = clock();
      if (!command) {
        var rid = options.requestId || 'wcsview-' + nowMs + '-' + random(), match = /^wcsview-(\d{1,16})-([a-f0-9]{32})$/.exec(rid);
        if (!match) fail('CONFIGURATION', 'Use the original timestamped WCSpedia view request ID.');
        command = { requestId: rid, at: Number(match[1]) }; pendingViews.set(pendingKey, command);
      }
      if (command.at > nowMs + 60000 || nowMs - command.at >= WINDOW_MS) { pendingViews.delete(pendingKey); fail('EXPIRED', 'This view request expired; it was not counted again. Reload to record a new visit.'); }
      for (var attempt = 0; attempt < 5; attempt++) {
        nowMs = clock();
        if (nowMs - command.at >= WINDOW_MS) { pendingViews.delete(pendingKey); fail('EXPIRED', 'This view request expired; it was not counted again.'); }
        abort(options.signal); var before = await property(pageId, VIEW_KEY, options), data = viewData(before, pageId), mine = data.active[actor];
        if (mine && mine.at > command.at - WINDOW_MS) { pendingViews.delete(pendingKey); return { recorded: mine.requestId === command.requestId, deduplicated: mine.requestId !== command.requestId, requestId: command.requestId, views: data.count, counted: mine.requestId === command.requestId, recordedViews: data.count, lastRecordedAt: data.lastRecordedAt, windowMinutes: 30, coverage: clone(COVERAGE) }; }
        var next = clone(data); Object.keys(next.active).forEach(function (key) { if (next.active[key].at <= nowMs - WINDOW_MS) delete next.active[key]; });
        if (Object.keys(next.active).length >= MAX_ACTIVE && !next.active[actor]) { pendingViews.delete(pendingKey); fail('CAPACITY', 'This document reached its active recorded-view limit. This visit was not counted; try again after 30 minutes.'); }
        if (!integer(data.count + 1)) fail('CAPACITY', 'The recorded-view counter reached its safe limit.');
        next.count++; next.active[actor] = { at: command.at, requestId: command.requestId }; next.lastRecordedAt = new Date(Math.max(command.at, Date.parse(data.lastRecordedAt) || 0)).toISOString(); size(next);
        try {
          var written = await store.putProperty(pageId, VIEW_KEY, next, before ? before.version.number : null, options), confirmed = viewData(written, pageId);
          if (!confirmed.active[actor] || confirmed.active[actor].requestId !== command.requestId) fail('UNKNOWN_COMMIT', 'The view write was not confirmed. Retry the original request.');
          pendingViews.delete(pendingKey); return { recorded: true, deduplicated: false, requestId: command.requestId, views: confirmed.count, counted: true, recordedViews: confirmed.count, lastRecordedAt: confirmed.lastRecordedAt, windowMinutes: 30, coverage: clone(COVERAGE) };
        } catch (error) {
          if (error.code === 'CONFLICT') continue;
          if (error.code === 'UNKNOWN_COMMIT') {
            try { var checked = viewData(await property(pageId, VIEW_KEY, {}), pageId), entry = checked.active[actor]; if (entry && entry.requestId === command.requestId) { pendingViews.delete(pendingKey); return { recorded: true, deduplicated: false, requestId: command.requestId, views: checked.count, counted: true, recordedViews: checked.count, lastRecordedAt: checked.lastRecordedAt, windowMinutes: 30, coverage: clone(COVERAGE) }; } } catch (_) {}
          } else pendingViews.delete(pendingKey);
          throw error;
        }
      }
      pendingViews.delete(pendingKey); fail('CONFLICT', 'Recorded views changed repeatedly. This visit was not confirmed; retry.');
    }
    async function exportDocument(pageId, options) {
      options = options || {}; var p = await page(pageId, options), start = 0, seen = new Set(), votes = { yes: 0, no: 0, total: 0 }, versions = {}, view = null;
      if (options.pageVersion != null && options.pageVersion !== p.version.number) fail('CONFLICT', 'The article changed during analytics collection.');
      do {
        abort(options.signal);
        var path = '/rest/api/content/' + pageId + '/property', batch = await store.request(path + '?expand=version&limit=' + PAGE_SIZE + '&start=' + start, { signal: options.signal });
        if (!object(batch) || !Array.isArray(batch.results) || batch.results.length > PAGE_SIZE || !object(batch._links) || batch.start != null && batch.start !== start || batch.size != null && batch.size !== batch.results.length) fail('INVALID_DATA', 'Invalid engagement analytics pagination.');
        batch.results.forEach(function (prop) {
          if (!object(prop) || typeof prop.key !== 'string' || seen.has(prop.key)) fail('INCOMPLETE', 'Engagement properties changed during analytics collection.');
          seen.add(prop.key); if (seen.size > maxProperties) fail('LIMIT', 'This document exceeded the engagement analytics property limit.');
          if (prop.key === VIEW_KEY) view = viewData(prop, pageId);
          else if (prop.key.startsWith(VOTE_PREFIX)) {
            if (!/^[a-f0-9]{64}$/.test(prop.key.slice(VOTE_PREFIX.length))) fail('INVALID_DATA', 'Malformed helpfulness property key.');
            var value = voteData(prop, pageId, prop.key); if (value.pageVersion > p.version.number) fail('INVALID_DATA', 'Helpfulness refers to a future article version.');
            votes[value.value]++; votes.total++;
            var tally = versions[value.pageVersion] || (versions[value.pageVersion] = { pageVersion: value.pageVersion, yes: 0, no: 0, total: 0 }); tally[value.value]++; tally.total++;
          }
        });
        var count = batch.results.length, next = batch._links.next, total = batch.totalSize == null ? batch.totalCount : batch.totalSize;
        if (total != null && (!integer(total) || total < start + count)) fail('INVALID_DATA', 'Invalid engagement analytics totals.');
        if (!next) { if (total != null && total > start + count) fail('INCOMPLETE', 'Not all engagement properties were returned.'); start = null; }
        else {
          if (!count || typeof next !== 'string' || /[\\\u0000-\u0020]/.test(next) || /%(?:2e|2f|5c|25)/i.test(next)) fail('INVALID_DATA', 'Invalid engagement continuation link.');
          var url; try { url = new URL(next, dependencies.origin || root.location && root.location.origin || 'https://confluence.invalid'); } catch (_) { fail('INVALID_DATA', 'Invalid engagement continuation URL.'); }
          var raw = url.searchParams.get('start'), expectedOrigin = dependencies.origin || root.location && root.location.origin;
          if (expectedOrigin && url.origin !== expectedOrigin) fail('INVALID_DATA', 'Engagement pagination escaped the Confluence origin.');
          if (!/^\d+$/.test(raw || '') || url.searchParams.getAll('start').length !== 1 || Number(raw) !== start + count || url.hash || url.username || url.password || ![path, (config.contextPath == null ? '/confluence' : config.contextPath).replace(/\/$/, '') + path].includes(url.pathname)) fail('INVALID_DATA', 'Invalid engagement continuation offset.');
          // Only the validated offset is reused. Never follow supplied URLs.
          start = Number(raw);
        }
      } while (start !== null);
      view = view || viewData(null, pageId);
      var current = versions[p.version.number] || { yes: 0, no: 0, total: 0 };
      return { schemaVersion: 1, pageId: pageId, pageVersion: p.version.number, observedAt: new Date(clock()).toISOString(), helpfulness: Object.assign({ source: 'confluence-content-properties', status: 'available' }, votes, { currentVersionTotals: { yes: current.yes, no: current.no, total: current.total }, byPageVersion: Object.keys(versions).map(Number).sort(function (a, b) { return a - b; }).map(function (v) { return versions[v]; }) }), views: { source: 'confluence-content-properties', status: 'available', recordedViews: view.count, windowMinutes: 30, lastRecordedAt: view.lastRecordedAt }, coverage: clone(COVERAGE) };
    }
    return Object.freeze({ load: load, loadViews: loadViews, vote: vote, recordView: recordView, exportDocument: exportDocument });
  }
  return Object.freeze({ create: create, votePrefix: VOTE_PREFIX, viewKey: VIEW_KEY, coverage: COVERAGE });
});

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
/* Source: article-engagement-bootstrap.js */
/* Native article engagement. Deferred, scoped and independent of comment loading. */
(function (global, doc) {
  'use strict';
  if (global.WCSArticleEngagementBootstrap) return;
  var settings = global.WCS_ARTICLE_DISCUSSION_CONFIG, timer, request, host, stopped = false, generation = 0, started = false;
  var voteAction = '', voteBusy = false, voteUnknown = false, pendingVoteValue = null, feedback, state, engagement, voteNotice, counter, yes, no, check, retry;
  function candidate() {
    if (!settings || settings.authoringMode !== 'confluence-session' || global.top !== global.self || doc.querySelector('#wcspedia, #editpageform, #wysiwygTextarea, #content-editor, body.contenteditor')) return '';
    var url = new URL(global.location.href), action = doc.querySelector('meta[name="ajs-action"]'), space = doc.querySelector('meta[name="ajs-space-key"]');
    if (url.searchParams.get('wcsNativeUi') === '1' || action && action.content !== 'viewpage' || space && space.content !== settings.spaceKey) return '';
    if (!(/\/pages\/viewpage\.action$/.test(url.pathname) || /\/display\/[^/]+\/.+/.test(url.pathname) || /\/spaces\/[^/]+\/pages\/\d+(?:\/.*)?$/.test(url.pathname))) return '';
    var blocked = false;
    url.searchParams.forEach(function (value, key) { if (/preview/i.test(key) || /^pageVersion$/i.test(key) || /^(action|mode)$/i.test(key) && /^(edit|create|preview|history)$/i.test(value)) blocked = true; });
    if (blocked) return '';
    var meta = doc.querySelector('meta[name="ajs-page-id"]'), id = meta && meta.content || url.searchParams.get('pageId') || (url.pathname.match(/\/pages\/(\d+)(?:\/|$)/) || [])[1] || '';
    var excluded = [settings.rootPageId, settings.attachmentPageId, settings.workingRootPageId, settings.insightsPageId].concat(Object.values(settings.pageIds || {}), Object.values(settings.areaPageIds || {}), settings.excludePageIds || []);
    return /^[1-9]\d*$/.test(id) && !excluded.map(String).includes(String(id)) ? String(id) : '';
  }
  function config() {
    return Object.assign({}, settings, {mode: 'confluence', nativePublication: {areaPageIds: settings.areaPageIds, workingRootPageId: settings.workingRootPageId, insightsPageId: settings.insightsPageId}, search: {excludePageIds: settings.excludePageIds || [], excludeAncestorIds: settings.excludeAncestorIds || []}});
  }
  function el(tag, cls, text) { var node = doc.createElement(tag); if (cls) node.className = cls; if (text) node.textContent = text; return node; }
  function notify(type, text) { if (global.WCSNotifications && global.WCSNotifications[type]) global.WCSNotifications[type](text); }
  function button(value, label) {
    var b = el('button', 'wcs-discussion-button wcs-discussion-reaction'); b.type = 'button'; b.dataset.vote = value; b.setAttribute('aria-label', label);
    var svg = doc.createElementNS('http://www.w3.org/2000/svg', 'svg');
    [['viewBox','0 0 24 24'],['width','24'],['height','24'],['aria-hidden','true'],['fill','none'],['stroke','currentColor'],['stroke-width','1.7'],['stroke-linecap','round']].forEach(function (attr) { svg.setAttribute(attr[0], attr[1]); });
    [['circle',{cx:'12',cy:'12',r:'9'}],['circle',{cx:'8.5',cy:'9.5',r:'.8',fill:'currentColor',stroke:'none'}],['circle',{cx:'15.5',cy:'9.5',r:'.8',fill:'currentColor',stroke:'none'}],['path',{d:value==='yes'?'M7.8 13.5c1.2 3.7 7.2 3.7 8.4 0':'M7.8 16.2c1.2-3.7 7.2-3.7 8.4 0'}]].forEach(function (part) {
      var shape = doc.createElementNS('http://www.w3.org/2000/svg', part[0]); Object.keys(part[1]).forEach(function (key) { shape.setAttribute(key, part[1][key]); }); svg.append(shape);
    });
    b.append(svg, el('span', '', label)); b.addEventListener('click', function () { saveVote(value); }); return b;
  }
  function renderVote() {
    yes.disabled = no.disabled = voteBusy || voteUnknown || !state || !state.canVote;
    yes.setAttribute('aria-pressed', String(!!state && state.vote === 'yes')); no.setAttribute('aria-pressed', String(!!state && state.vote === 'no'));
    check.hidden = !voteUnknown;
    check.disabled = voteBusy;
    yes.setAttribute('aria-busy', String(voteBusy && voteAction === 'save' && state?.vote === 'yes'));
    no.setAttribute('aria-busy', String(voteBusy && voteAction === 'save' && state?.vote === 'no'));
    check.setAttribute('aria-busy', String(voteBusy && voteAction === 'check'));
    retry.setAttribute('aria-busy', String(voteBusy && voteAction === 'retry'));
    retry.hidden = !voteUnknown || !pendingVoteValue;
    retry.disabled = voteBusy || !state || !state.canVote;
  }
  function renderCount(value) {
    if (Number.isSafeInteger(value) && value >= 0) counter.textContent = new Intl.NumberFormat('en-GB').format(value) + (value === 1 ? ' recorded view' : ' recorded views');
    else counter.textContent = 'Recorded views unavailable';
  }
  async function saveVote(value, retrying) {
    if (stopped || voteBusy || !state || !state.canVote || (voteUnknown ? !retrying || value !== pendingVoteValue : retrying || state.vote === value)) return;
    var before = state, current = generation; voteBusy = true; voteAction = retrying ? 'retry' : 'save'; state = Object.assign({}, state, {vote:value}); renderVote(); voteNotice.textContent = 'Saving…';
    try {
      var result = await feedback.save(value, {signal:request.signal}); if (stopped || current !== generation) return;
      state = result; voteUnknown = false; pendingVoteValue = null; voteNotice.textContent = 'Thank you. Your feedback is saved.'; notify('success','Feedback saved.');
    } catch (error) {
      if (stopped || current !== generation) return; state = before;
      voteUnknown = retrying || error.outcome !== 'rejected'; pendingVoteValue = voteUnknown ? value : null;
      voteNotice.textContent = voteUnknown ? 'The save could not be confirmed. Check saved feedback or retry the original vote.' : (error.message || 'Feedback was not saved. Please try again.');
      notify(voteUnknown ? 'warning' : 'error', voteNotice.textContent);
    } finally { if (current === generation) { voteBusy = false; if (!stopped) renderVote(); } }
  }
  async function checkVote() {
    if (voteBusy || stopped) return;
    var current = generation; voteBusy = true; voteAction = 'check'; renderVote();
    try {
      var result = await feedback.load({signal:request.signal}); if (stopped || current !== generation) return; state = result;
      voteUnknown = !!state.pendingVote; pendingVoteValue = voteUnknown ? state.pendingVote.value : null;
      voteNotice.textContent = voteUnknown ? 'The original vote is still unconfirmed. Check again or retry that same vote.' : state.canVote ? 'Saved feedback checked.' : state.reason;
    }
    catch (_) { if (!stopped && current === generation) voteNotice.textContent = 'Saved feedback could not be checked. Try again when connected.'; }
    finally { if (current === generation) { voteBusy = false; if (!stopped) renderVote(); } }
  }
  function mount(data) {
    var content = Array.from(doc.querySelectorAll('#main-content,.wiki-content')).find(function (node) { return !node.closest('#navHeader,#navBar,#header,header,.aui-header,[role="banner"],[data-wcs-header-actions]'); }); if (!content) return false;
    host = el('div','wcs-article-discussion wcs-article-engagement'); host.dataset.wcsArticleEngagement = ''; host.setAttribute('role','region'); host.setAttribute('aria-label','Article feedback and recorded views');
    var row = el('div','wcs-article-engagement-row'); counter = el('span','wcs-article-recorded-views');
    counter.title = 'Successful WCSpedia recordings by signed-in users with native metadata-write permission; one per account per 30 minutes. This is not Confluence’s total page traffic.';
    renderCount(data.views && data.views.recordedViews); row.append(counter);
    var helpful = el('div','wcs-discussion-helpful'); helpful.append(el('span','wcs-discussion-helpful-label','Was this article helpful?'));
    var votes = el('div','wcs-discussion-votes'); votes.setAttribute('role','group'); votes.setAttribute('aria-label','Was this article helpful?');
    yes = button('yes','Helpful'); no = button('no','Not helpful'); votes.append(yes,no); helpful.append(votes);
    voteNotice = el('span','wcs-discussion-vote-status'); voteNotice.setAttribute('role','status');
    if (!data.canVote) voteNotice.textContent = data.reason || 'Native Confluence edit permission is required to save feedback.';
    helpful.append(voteNotice); check = el('button','wcs-discussion-button','Check saved feedback'); check.type = 'button'; check.hidden = true; check.addEventListener('click',checkVote); helpful.append(check);
    retry = el('button','wcs-discussion-button','Retry original vote'); retry.type = 'button'; retry.hidden = true; retry.addEventListener('click',function () { saveVote(pendingVoteValue,true); }); helpful.append(retry);
    row.append(helpful); host.append(row);
    var discussion = content.querySelector('[data-wcs-article-discussion-host]'); if (discussion) content.insertBefore(host,discussion); else content.append(host);
    return true;
  }
  async function start() {
    var id = candidate(); if (started || stopped || !id || doc.visibilityState === 'hidden') return;
    started = true; var current = generation; request = new global.AbortController();
    function active() { return !stopped && generation === current && candidate() === id; }
    try {
      engagement = global.WCSSpaceEngagement.create(config());
      var data = await engagement.load(id,{signal:request.signal}); if (!active()) return;
      // A tab hidden during the read must still qualify for a fresh visible
      // visit later. Do not mount or record while it is hidden.
      if (doc.visibilityState === 'hidden') { started = false; return; }
      feedback = global.WCSArticleFeedback.create({authoringMode:'confluence-session',config:config(),pageId:id,engagement:engagement});
      // Validate and prime the adapter without a second metadata fetch.
      state = feedback.prime ? feedback.prime(data) : await feedback.load({signal:request.signal});
      voteUnknown = !!state.pendingVote; pendingVoteValue = voteUnknown ? state.pendingVote.value : null;
      if (!active() || !mount(data)) return; renderVote();
      if (voteUnknown) voteNotice.textContent = 'The original vote is still unconfirmed. Check again or retry that same vote.';
      if (data.canRecord && doc.visibilityState !== 'hidden') {
        try { var result = await engagement.recordView(id,{signal:request.signal}); if (active()) renderCount(result.recordedViews); }
        catch (error) { if (active()) { counter.title = 'This visit was not confirmed: ' + error.message; counter.textContent += ' · recording unavailable'; } }
      }
    } catch (error) {
      if (!active() || error.name === 'AbortError' || ['SCOPE','OUT_OF_SCOPE','FORBIDDEN','CONFIGURATION','NOT_FOUND'].includes(error.code)) return;
      var content = Array.from(doc.querySelectorAll('#main-content,.wiki-content')).find(function (node) { return !node.closest('#navHeader,#navBar,#header,header,.aui-header,[role="banner"],[data-wcs-header-actions]'); });
      if (content) { host = el('div','wcs-engagement-unavailable','Article feedback and recorded views are temporarily unavailable.'); host.setAttribute('role','status'); content.append(host); }
    }
  }
  function schedule() { clearTimeout(timer); if (!stopped && !started && candidate() && doc.visibilityState !== 'hidden') timer = setTimeout(start,2000); }
  function destroy() { stopped = true; generation++; clearTimeout(timer); if (request) request.abort(); if (host) host.remove(); host = null; }
  global.WCSArticleEngagementBootstrap = Object.freeze({destroy:destroy});
  doc.addEventListener('visibilitychange',schedule);
  global.addEventListener('pagehide',destroy);
  global.addEventListener('pageshow',function (event) { if (event.persisted) { stopped = started = voteBusy = voteUnknown = false; state = null; pendingVoteValue = null; schedule(); } });
  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded',schedule,{once:true}); else schedule();
})(window,document);
