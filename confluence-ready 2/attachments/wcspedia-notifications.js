/* Shared WCSpedia notifications. Load once from the existing Confluence header. */
(function (global) {
  'use strict';
  if (global.WCSNotifications && global.WCSNotifications.runtime === 'wcspedia-notifications-v1') return;

  const doc = global.document, records = new Map();
  const defaults = {success: 4500, error: 8000, warning: 7000, info: 5000};
  const labels = {success: 'Success', error: 'Error', warning: 'Warning', info: 'Information'};
  const icons = {success: '✓', error: '!', warning: '!', info: 'i'};
  const limit = 4;
  const flashKey = 'wcspedia.notification.nextPage.v1';
  let host = null, stack = null, polite = null, assertive = null, sequence = 0, pendingFlash = null;
  let loadingObserver = null, observedBody, observedRoot;

  function loadingBlocked() {
    const root = doc.getElementById('wcspedia');
    return !!doc.querySelector('.wcs-loading-overlay') || !!(root && (root.getAttribute('aria-busy') === 'true' || root.hasAttribute('inert') || root.querySelector(':scope > .boot-state[role="status"]')));
  }
  function observeLoading() {
    if (!loadingObserver || (observedBody === doc.body && observedRoot === doc.getElementById('wcspedia'))) return;
    observedBody = doc.body;
    observedRoot = doc.getElementById('wcspedia');
    loadingObserver.disconnect();
    // No subtree observation: watch body creation, the loader's body portal,
    // and the app root's own readiness attributes/direct boot-state replacement.
    if (doc.documentElement) loadingObserver.observe(doc.documentElement, {childList: true});
    if (observedBody) loadingObserver.observe(observedBody, {childList: true});
    if (observedRoot) loadingObserver.observe(observedRoot, {childList: true, attributes: true, attributeFilter: ['aria-busy', 'inert']});
  }

  function stopTimer(record) {
    if (record.timer !== null) {
      global.clearTimeout(record.timer);
      record.timer = null;
      record.remaining = Math.max(0, record.remaining - (Date.now() - record.startedAt));
    }
  }
  function startTimer(record) {
    if (record.closing || !record.element || !record.duration || record.pauses.size || doc.hidden || record.timer !== null) return;
    record.startedAt = Date.now();
    record.timer = global.setTimeout(() => { record.timer = null; dismiss(record.id); }, record.remaining);
  }
  function pause(record, reason) { record.pauses.add(reason); stopTimer(record); }
  function resume(record, reason) { record.pauses.delete(reason); startTimer(record); }
  function remove(record) {
    stopTimer(record);
    global.clearTimeout(record.exitTimer);
    global.clearTimeout(record.announceTimer);
    global.clearTimeout(record.announcementCleanup);
    record.announcement?.remove();
    record.element?.remove();
    records.delete(record.id);
    if (host && !records.size) host.hidden = true;
  }
  function dismiss(id, immediate) {
    const record = records.get(String(id));
    if (!record || record.closing) return false;
    record.closing = true;
    stopTimer(record);
    global.clearTimeout(record.announceTimer);
    // Do not strand keyboard focus in a node while it animates out.
    const focused = record.element?.contains(doc.activeElement);
    if (focused) {
      const next = Array.from(records.values()).find(item => item !== record && !item.closing && item.closeButton);
      if (next) next.closeButton.focus({preventScroll: true});
      else if (record.previousFocus?.isConnected && typeof record.previousFocus.focus === 'function') record.previousFocus.focus({preventScroll: true});
    }
    if (immediate || !record.element || global.matchMedia?.('(prefers-reduced-motion: reduce)').matches) remove(record);
    else {
      record.element.classList.add('wcs-notification-leaving');
      record.element.setAttribute('aria-hidden', 'true');
      record.closeButton.tabIndex = -1;
      record.exitTimer = global.setTimeout(() => remove(record), 180);
    }
    return true;
  }
  function announce(record) {
    global.clearTimeout(record.announceTimer);
    global.clearTimeout(record.announcementCleanup);
    record.announcement?.remove();
    // The live regions exist before text is inserted, including for head-loaded scripts.
    record.announceTimer = global.setTimeout(() => {
      record.announceTimer = null;
      if (record.closing || !record.element || record.pauses.has('loading')) return;
      const message = doc.createElement('span');
      message.textContent = labels[record.type] + ': ' + record.message;
      (record.type === 'error' ? assertive : polite).append(message);
      record.announcement = message;
      record.announced = true;
      record.announcementCleanup = global.setTimeout(() => { message.remove(); record.announcement = null; }, 1000);
    }, 20);
  }
  function render(record) {
    if (record.element || record.closing || !stack) return;
    const element = doc.createElement('div');
    element.className = 'wcs-notification wcs-notification-' + record.type;
    element.id = record.id;
    element.dataset.notificationType = record.type;
    element.setAttribute('role', 'group');
    element.setAttribute('aria-labelledby', record.id + '-message');
    const icon = doc.createElement('span');
    icon.className = 'wcs-notification-icon';
    icon.setAttribute('aria-hidden', 'true');
    icon.textContent = icons[record.type];
    const message = doc.createElement('p');
    message.className = 'wcs-notification-message';
    message.id = record.id + '-message';
    message.textContent = record.message;
    const close = doc.createElement('button');
    close.type = 'button';
    close.className = 'wcs-notification-close';
    close.setAttribute('aria-label', 'Dismiss ' + labels[record.type].toLowerCase() + ' notification');
    const cross = doc.createElement('span');
    cross.setAttribute('aria-hidden', 'true');
    cross.textContent = '×';
    close.append(cross);
    close.addEventListener('click', () => dismiss(record.id));
    element.addEventListener('mouseenter', () => pause(record, 'hover'));
    element.addEventListener('mouseleave', () => resume(record, 'hover'));
    element.addEventListener('focusin', () => pause(record, 'focus'));
    element.addEventListener('focusout', event => { if (!element.contains(event.relatedTarget)) resume(record, 'focus'); });
    element.append(icon, message, close);
    record.element = element;
    record.closeButton = close;
    stack.append(element);
    if (loadingBlocked()) record.pauses.add('loading');
    host.hidden = record.pauses.has('loading');
    announce(record);
    startTimer(record);
  }
  function mount() {
    if (!doc.body) return;
    if (!host) {
      host = doc.createElement('div');
      host.id = 'wcs-notifications';
      host.setAttribute('data-wcs-notifications', '');
      host.setAttribute('role', 'region');
      host.setAttribute('aria-label', 'Notifications');
      host.hidden = true;
      stack = doc.createElement('div');
      stack.className = 'wcs-notification-stack';
      polite = doc.createElement('div');
      polite.className = 'wcs-notifications-sr';
      polite.setAttribute('role', 'status');
      polite.setAttribute('aria-live', 'polite');
      polite.setAttribute('aria-relevant', 'additions');
      assertive = doc.createElement('div');
      assertive.className = 'wcs-notifications-sr';
      assertive.setAttribute('role', 'alert');
      assertive.setAttribute('aria-live', 'assertive');
      assertive.setAttribute('aria-relevant', 'additions');
      host.append(stack, polite, assertive);
    }
    // Portal directly to the document body so page overflow and transforms cannot clip it.
    if (host.parentElement !== doc.body) doc.body.append(host);
    records.forEach(render);
  }
  function show(message, options) {
    const text = String(message == null ? '' : message).trim();
    if (!text) return null;
    const settings = options && typeof options === 'object' ? options : {};
    const type = Object.prototype.hasOwnProperty.call(defaults, settings.type) ? settings.type : 'info';
    const duration = settings.duration === 0 ? 0 : Number.isFinite(settings.duration) ? Math.min(60000, Math.max(1000, settings.duration)) : defaults[type];
    const existing = Array.from(records.values()).find(item => !item.closing && item.type === type && item.message === text);
    if (existing) {
      stopTimer(existing);
      existing.duration = duration;
      existing.remaining = duration;
      mount();
      startTimer(existing);
      return existing.id;
    }
    // A quick burst remains bounded. Prefer retiring the oldest notice without keyboard focus.
    while (records.size >= limit) {
      const oldest = Array.from(records.values()).find(item => !item.element?.contains(doc.activeElement)) || records.values().next().value;
      remove(oldest);
    }
    const id = 'wcs-notification-' + (++sequence);
    const record = {id, message: text, type, duration, remaining: duration, timer: null, exitTimer: null, announceTimer: null, announcementCleanup: null, pauses: new Set(), closing: false, previousFocus: doc.activeElement};
    records.set(id, record);
    mount();
    return id;
  }
  function dismissAll() { Array.from(records.values()).forEach(remove); }
  function visibilityChanged() { records.forEach(record => { if (doc.hidden) stopTimer(record); else startTimer(record); }); }
  function syncLoading() {
    observeLoading();
    const blocked = loadingBlocked();
    records.forEach(record => {
      if (blocked) pause(record, 'loading');
      else {
        resume(record, 'loading');
        if (!record.announced && record.element && !record.closing) announce(record);
      }
    });
    if (host) host.hidden = blocked || !records.size;
    if (pendingFlash && !blocked && doc.readyState !== 'loading') {
      const flash = pendingFlash;
      pendingFlash = null;
      show(flash.message, {type: flash.type});
    }
  }
  function destinationURL(destination) {
    if (typeof destination !== 'string' || !destination.trim()) return null;
    try {
      const url = new URL(destination, global.location.href);
      return /^https?:$/.test(url.protocol) && url.origin === global.location.origin && !url.username && !url.password ? url.href : null;
    } catch (_) { return null; }
  }
  function forNextPage(message, options) {
    const settings = options && typeof options === 'object' ? options : {};
    const destination = destinationURL(settings.destination), text = String(message == null ? '' : message).trim();
    if (!destination || !text || text.length > 2000) return false;
    const type = Object.prototype.hasOwnProperty.call(defaults, settings.type) ? settings.type : 'info';
    try {
      // This is transient presentation feedback only; it is never application state or authority.
      global.sessionStorage.setItem(flashKey, JSON.stringify({destination, message: text, type, createdAt: Date.now()}));
      return true;
    } catch (_) { return false; }
  }
  function consumeNextPage() {
    try {
      const value = global.sessionStorage.getItem(flashKey);
      if (!value) return;
      let flash;
      try { flash = JSON.parse(value); } catch (_) { global.sessionStorage.removeItem(flashKey); return; }
      const age = Date.now() - flash?.createdAt;
      const valid = flash && typeof flash.message === 'string' && flash.message.trim() && flash.message.length <= 2000 && Object.prototype.hasOwnProperty.call(defaults, flash.type) && Number.isFinite(flash.createdAt) && age >= 0 && age <= 60000 && destinationURL(flash.destination) === flash.destination;
      if (!valid) { global.sessionStorage.removeItem(flashKey); return; }
      if (flash.destination !== global.location.href) return;
      global.sessionStorage.removeItem(flashKey);
      pendingFlash = flash;
      syncLoading();
    } catch (_) { /* Restricted storage must never stop page initialization. */ }
  }

  const api = {runtime: 'wcspedia-notifications-v1', show, dismiss, dismissAll, forNextPage};
  Object.keys(defaults).forEach(type => { api[type] = (message, options) => show(message, Object.assign({}, options, {type})); });
  global.WCSNotifications = Object.freeze(api);
  doc.addEventListener('visibilitychange', visibilityChanged);
  global.addEventListener('pagehide', () => { pendingFlash = null; dismissAll(); });
  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', () => { mount(); syncLoading(); }, {once: true});
  // The existing loader adds a body portal and marks #wcspedia busy/inert.
  // Observe that contract rather than making page bundles load a second runtime.
  if (typeof global.MutationObserver === 'function' && doc.documentElement) {
    loadingObserver = new global.MutationObserver(syncLoading);
    observeLoading();
  }
  mount();
  // Page bundles can report results before the shared header script has loaded.
  // Drain the shared array once; duplicate script loads return above before replaying it.
  if (Array.isArray(global.WCSNotificationQueue)) {
    const pending = global.WCSNotificationQueue.splice(0);
    pending.forEach(item => { if (item && typeof item === 'object') show(item.message, item.options); });
  }
  consumeNextPage();
})(window);
