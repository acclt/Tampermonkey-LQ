// ==UserScript==
// @name         QQ Mail OAuth Auto Allow
// @namespace    http://tampermonkey.net/
// @version      2.0
// @description  Auto check QQ Mail OAuth permissions and click QQ avatar login across QQ cross-origin frames.
// @match        https://wx.mail.qq.com/*
// @match        https://graph.qq.com/oauth2.0/show*
// @match        https://xui.ptlogin2.qq.com/cgi-bin/xlogin*
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(function () {
  'use strict';

  const CHANNEL = 'qqmail-oauth-auto';
  const DEBUG = true;

  function log(...args) {
    if (DEBUG) console.log('[QQMail OAuth]', ...args);
  }

  function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  function isTopPage() {
    return location.hostname === 'wx.mail.qq.com';
  }

  function isGraphFrame() {
    return location.hostname === 'graph.qq.com';
  }

  function isLoginFrame() {
    return location.hostname === 'xui.ptlogin2.qq.com';
  }

  function mouseClick(el) {
    el.scrollIntoView({ block: 'center', inline: 'center' });
    const rect = el.getBoundingClientRect();
    const options = {
      bubbles: true,
      cancelable: true,
      view: window,
      clientX: rect.left + rect.width / 2,
      clientY: rect.top + rect.height / 2,
      button: 0,
    };

    for (const type of ['pointerover', 'mouseover', 'mousemove', 'pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click']) {
      try {
        const EventCtor = type.startsWith('pointer') ? PointerEvent : MouseEvent;
        el.dispatchEvent(new EventCtor(type, options));
      } catch {
        el.dispatchEvent(new MouseEvent(type, options));
      }
    }
  }

  async function waitFor(selector, timeout = 30000) {
    const start = Date.now();
    while (Date.now() - start < timeout) {
      const el = document.querySelector(selector);
      if (el) return el;
      await sleep(250);
    }
    return null;
  }

  function send(type, payload = {}) {
    try {
      window.top.postMessage({ channel: CHANNEL, type, payload }, '*');
    } catch (error) {
      log('postMessage failed:', error);
    }
  }

  async function checkPermissions() {
    const box = await waitFor('input#select_all.checkbox.oauth_checkbox_all, #select_all, input.oauth_checkbox_all');
    if (!box) {
      send('checkboxResult', { ok: false, reason: 'not found', href: location.href });
      return false;
    }

    const before = box.checked;
    if (!box.checked) mouseClick(box);
    await sleep(300);

    if (!box.checked) {
      box.checked = true;
      box.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
      box.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
    }

    send('checkboxResult', { ok: box.checked, before, after: box.checked, href: location.href });
    return box.checked;
  }

  async function clickAvatar() {
    const avatar = await waitFor('span[id^="img_out_"].img_out_focus, span[id^="img_out_"], .img_out_focus, .img_out, img[id^="img_out_"]');
    if (!avatar) {
      send('avatarResult', { ok: false, reason: 'not found', href: location.href });
      return false;
    }

    mouseClick(avatar);
    send('avatarResult', {
      ok: true,
      id: avatar.id || '',
      className: String(avatar.className || ''),
      href: location.href,
    });
    return true;
  }

  if (isTopPage()) {
    window.addEventListener('message', event => {
      if (event.data?.channel !== CHANNEL) return;
      log('message:', event.data.type, event.data.payload || '');
    });
  }

  if (isGraphFrame()) {
    window.addEventListener('message', event => {
      if (event.data?.channel === CHANNEL && event.data.type === 'run') checkPermissions();
    });
    checkPermissions();
  }

  if (isLoginFrame()) {
    window.addEventListener('message', event => {
      if (event.data?.channel === CHANNEL && event.data.type === 'run') {
        setTimeout(clickAvatar, 700);
      }
    });
    setTimeout(clickAvatar, 1200);
  }
})();
