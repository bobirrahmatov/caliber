/* Load once from the space's navBar. Prevent accidental file-drop uploads;
 * this is a UI guard, not a replacement for native attachment permissions.
 */
(function (global) {
  'use strict';
  if (global.WCSFileDropGuard) return;
  var doc = global.document;
  if (!doc) return;
  var lastNotice = -Infinity;

  function active() {
    var config = global.WCS_FILE_DROP_CONFIG || {};
    if (config.enabled === false || !config.spaceKey) return false;
    var key = '', meta = doc.querySelector('meta[name="ajs-space-key"]');
    if (meta) key = meta.content;
    if (!key && global.AJS && global.AJS.Meta && typeof global.AJS.Meta.get === 'function') {
      try { key = global.AJS.Meta.get('space-key') || ''; } catch (_) { /* Use native URL below. */ }
    }
    if (!key) {
      var url = new URL(global.location.href);
      var match = url.pathname.match(/\/(?:spaces|display)\/([^/]+)(?:\/|$)/);
      try { key = match ? decodeURIComponent(match[1]) : url.searchParams.get('spaceKey') || ''; }
      catch (_) { return false; }
    }
    // Read current space on each gesture, including after host navigation.
    // Never assume another space is WCSpedia just because it included navBar.
    return String(key) === String(config.spaceKey);
  }

  function containsFiles(transfer) {
    if (!transfer) return false;
    // files is often empty before drop because browsers protect dragged data.
    return Array.from(transfer.types || []).some(function (type) { return type === 'Files'; }) ||
      Array.from(transfer.items || []).some(function (item) { return item.kind === 'file'; }) ||
      !!(transfer.files && transfer.files.length);
  }

  function blockFileDrop(event) {
    if (!containsFiles(event.dataTransfer) || !active()) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    try { event.dataTransfer.dropEffect = 'none'; } catch (_) { /* Some hosts expose a read-only transfer. */ }
    if (event.type !== 'drop' || Date.now() - lastNotice < 3000) return;
    lastNotice = Date.now();
    if (global.WCSNotifications && typeof global.WCSNotifications.show === 'function') {
      try {
        global.WCSNotifications.show('File drag-and-drop is disabled in WCSpedia. Use the upload button to choose a file.', {type: 'info'});
      } catch (_) { /* A notification failure must not allow an upload. */ }
    }
  }

  // Window capture runs before document/element upload handlers. No requests,
  // timers, DOM observers or access checks are needed for this helper.
  ['dragenter', 'dragover', 'drop'].forEach(function (type) {
    global.addEventListener(type, blockFileDrop, {capture: true, passive: false});
  });
  global.WCSFileDropGuard = Object.freeze({isActive: active});
})(window);
