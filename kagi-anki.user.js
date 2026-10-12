// ==UserScript==
// @name         Kagi Translate → Anki
// @version      1.0.0
// @description  Add a Kagi Translate dictionary entry to Anki via AnkiConnect (127.0.0.1:8765). Adds a button next to the built-in "Anki" button.
// @author       you
// @license      Unlicense
// @match        https://translate.kagi.com/*
// @run-at       document-idle
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_registerMenuCommand
// @noframes
// ==/UserScript==

(function () {
  'use strict';

  const MODEL_NAME = 'Kagi Dictionary';
  const MODEL_CSS =
    '.card { font-family: Arial, "Microsoft JhengHei", sans-serif; font-size: 18px; ' +
    'line-height: 1.5; text-align: left; color: #111; }';

  const DEFAULTS = {
    endpoint: 'http://127.0.0.1:8765',
    apikey: '',
    deck: '',
    model: MODEL_NAME,
    tags: 'kagi-translate',
  };

  function cfg(key) {
    const v = GM_getValue(key, DEFAULTS[key]);
    return v === undefined || v === null ? DEFAULTS[key] : v;
  }

  async function api(action, params = {}) {
    const endpoint = cfg('endpoint');
    const key = cfg('apikey');
    const payload = { action, version: 6, params };
    if (key) payload.key = key;

    let res;
    try {
      res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    } catch (e) {
      const err = new Error('无法连线 AnkiConnect（' + endpoint + '），请确认 Anki 正在执行');
      err.code = 'NETWORK';
      throw err;
    }

    if (!res.ok) {
      const err = new Error('HTTP ' + res.status);
      err.code = 'HTTP';
      throw err;
    }

    const data = await res.json();
    if (data && data.error) {
      const err = new Error(data.error);
      err.code = 'ANKI';
      throw err;
    }
    return data ? data.result : undefined;
  }

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  function stripComments(root) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_COMMENT);
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach((n) => n.remove());
  }

  function getWord() {
    const pills = document.querySelectorAll('.pronunciation-pill');
    for (const pill of pills) {
      let el = pill;
      while (el && el !== document.body) {
        const h1 = el.querySelector('h1');
        if (h1 && h1.textContent.trim()) return h1.textContent.trim();
        el = el.parentElement;
      }
    }
    const h1 = document.querySelector('h1');
    if (h1 && h1.textContent.trim()) return h1.textContent.trim();
    const q = new URLSearchParams(location.search).get('text');
    return q ? q.trim() : '';
  }

  function getPronunciation() {
    const pill = document.querySelector('.pronunciation-pill');
    if (!pill) return '';
    for (const s of pill.querySelectorAll('span')) {
      if (s.children.length === 0) {
        const t = s.textContent.trim();
        if (t) return t;
      }
    }
    return '';
  }

  function getDefinitions() {
    const out = [];
    for (const id of ['primary-meaning', 'other-meanings']) {
      const sec = document.getElementById(id);
      if (!sec) continue;
      const posTags = Array.from(sec.querySelectorAll('span[class*="8FA4FA"]'));
      const defs = Array.from(sec.querySelectorAll('p[dir="auto"]'));
      const n = Math.min(posTags.length, defs.length);
      for (let i = 0; i < n; i++) {
        out.push({ pos: posTags[i].textContent.trim(), text: defs[i].textContent.trim() });
      }
      if (posTags.length === 0) {
        for (const d of defs) out.push({ pos: '', text: d.textContent.trim() });
      }
    }
    return out;
  }

  function getExamples() {
    const sec = document.getElementById('examples');
    if (!sec) return [];
    const out = [];
    for (const p of sec.querySelectorAll('p[dir="auto"]')) {
      const clone = p.cloneNode(true);
      stripComments(clone);
      for (const s of clone.querySelectorAll('span')) {
        const b = document.createElement('b');
        b.textContent = s.textContent;
        b.style.textDecoration = 'underline';
        s.replaceWith(b);
      }
      const html = clone.innerHTML;
      const idx = html.indexOf('（');
      out.push({
        en: (idx >= 0 ? html.slice(0, idx) : html).trim(),
        zh: idx >= 0 ? html.slice(idx).trim() : '',
      });
    }
    return out;
  }

  function getText(selector) {
    const el = document.querySelector(selector);
    return el ? el.textContent.trim() : '';
  }

  function collect() {
    return {
      word: getWord(),
      pronunciation: getPronunciation(),
      definitions: getDefinitions(),
      examples: getExamples(),
      notes: getText('#notes p'),
      etymology: getText('#etymology p'),
    };
  }

  function buildFront(d) {
    const parts = [];
    parts.push('<div style="font-size:1.6em;font-weight:600">' + esc(d.word) + '</div>');
    if (d.pronunciation) {
      parts.push('<div style="color:#666;margin:2px 0 8px">' + esc(d.pronunciation) + '</div>');
    }
    if (d.examples.length) {
      parts.push('<ol style="margin:0;padding-left:1.3em">');
      for (const x of d.examples) parts.push('<li style="margin:4px 0">' + x.en + '</li>');
      parts.push('</ol>');
    }
    return parts.join('');
  }

  function buildBack(d) {
    const parts = [];
    parts.push('<div style="font-size:1.5em;font-weight:600">' + esc(d.word) + '</div>');
    if (d.pronunciation) {
      parts.push('<div style="color:#666;margin:2px 0 10px">' + esc(d.pronunciation) + '</div>');
    }

    if (d.etymology) {
      parts.push('<h4 style="margin:12px 0 4px;font-size:1em;text-align:left">Etymology</h4>');
      parts.push('<p style="margin:0">' + esc(d.etymology) + '</p>');
    }

    if (d.definitions.length) {
      parts.push('<h4 style="margin:12px 0 4px;font-size:1em;text-align:left">Definitions</h4>');
      parts.push('<ul style="margin:0;padding-left:1.3em">');
      for (const x of d.definitions) {
        parts.push('<li style="margin:4px 0">' + (x.pos ? '<span style="color:#8a8a8f">' + esc(x.pos) + '</span> ' : '') + esc(x.text) + '</li>');
      }
      parts.push('</ul>');
    }

    if (d.examples.length) {
      parts.push('<h4 style="margin:12px 0 4px;font-size:1em;text-align:left">Examples</h4>');
      parts.push('<ol style="margin:0;padding-left:1.3em">');
      for (const x of d.examples) {
        parts.push(
          '<li style="margin:6px 0">' +
            x.en +
            (x.zh ? '<div style="color:#8a8a8f">' + x.zh + '</div>' : '') +
            '</li>'
        );
      }
      parts.push('</ol>');
    }

    if (d.notes) {
      parts.push('<h4 style="margin:12px 0 4px;font-size:1em;text-align:left">Notes</h4>');
      parts.push('<p style="margin:0">' + esc(d.notes) + '</p>');
    }

    return parts.join('');
  }

  function mapFields(names, front, back) {
    const lc = names.map((n) => n.toLowerCase());
    const fi = lc.indexOf('front');
    const bi = lc.indexOf('back');
    const frontName = fi >= 0 ? names[fi] : names[0];
    const backName = bi >= 0 ? names[bi] : names[1] || names[0];

    const fields = {};
    if (backName === frontName) {
      fields[frontName] = front + '<hr>' + back;
    } else {
      fields[frontName] = front;
      fields[backName] = back;
    }
    return fields;
  }

  async function ensureDedicatedModel() {
    const names = await api('modelNames');
    if (names.includes(MODEL_NAME)) return names;
    try {
      await api('createModel', {
        modelName: MODEL_NAME,
        inOrderFields: ['Front', 'Back'],
        cardTemplates: [{ Name: 'Card 1', Front: '{{Front}}', Back: '{{Back}}' }],
        css: MODEL_CSS,
        isCloze: false,
      });
    } catch (e) {
      if (!/already exists/i.test(String((e && e.message) || e))) throw e;
    }
    return names.concat(MODEL_NAME);
  }

  async function addNoteFor(deck, model) {
    const data = collect();
    if (!data.word) {
      toast('找不到單詞，請在字典頁面使用此按鈕', 'error');
      return;
    }

    if (model === MODEL_NAME) {
      try {
        await ensureDedicatedModel();
      } catch (e) {
        toast(String((e && e.message) || e), 'error');
        return;
      }
    }

    let fieldNames;
    try {
      fieldNames = await api('modelFieldNames', { modelName: model });
    } catch (e) {
      if (e && e.code === 'NETWORK') toast(e.message, 'error');
      else toast('找不到 note type：' + model, 'error');
      return;
    }

    const fields = mapFields(fieldNames, buildFront(data), buildBack(data));
    const tags = String(cfg('tags') || '')
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);

    try {
      await api('addNote', {
        note: {
          deckName: deck,
          modelName: model,
          fields,
          tags,
          options: { allowDuplicate: false },
        },
      });
      toast('已加入 Anki：' + deck, 'success');
    } catch (e) {
      const msg = String((e && e.message) || e);
      if (e && e.code === 'NETWORK') {
        toast(msg, 'error');
      } else if (/duplicate/i.test(msg)) {
        toast('此單詞已存在（重複），未加入', 'warn');
      } else if (/deck was not found/i.test(msg)) {
        toast('找不到 deck，請重新選擇', 'warn');
        openPicker(true);
      } else {
        toast('加入失敗：' + msg, 'error');
      }
    }
  }

  function onAddClick(e) {
    if (e.altKey || e.shiftKey) {
      openPicker(false);
      return;
    }
    const deck = cfg('deck');
    const model = cfg('model');
    if (!deck) {
      openPicker(true);
      return;
    }
    addNoteFor(deck, model);
  }

  function openPicker(thenAdd) {
    if (document.getElementById('kagi-anki-picker')) return;
    ensureDedicatedModel()
      .then((models) => Promise.all([api('deckNames'), models]))
      .then(([decks, models]) => renderPicker(decks, models, thenAdd))
      .catch((e) => toast(String((e && e.message) || e), 'error'));
  }

  function renderPicker(decks, models, thenAdd) {
    const savedDeck = cfg('deck');
    const savedModel = cfg('model');

    const overlay = document.createElement('div');
    overlay.id = 'kagi-anki-picker';
    overlay.style.cssText =
      'position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:2147483646;' +
      'display:flex;align-items:center;justify-content:center;';

    const box = document.createElement('div');
    box.style.cssText =
      'background:#fff;color:#111;border-radius:10px;padding:20px;min-width:340px;max-width:90vw;' +
      "box-shadow:0 8px 30px rgba(0,0,0,.3);font:14px/1.5 Arial,'Microsoft JhengHei',sans-serif;";
    box.innerHTML =
      '<h3 style="margin:0 0 14px">加入 Anki</h3>' +
      '<label style="display:block;margin-bottom:10px">Deck' +
      '<select id="kagi-anki-deck" style="display:block;width:100%;padding:6px;margin-top:4px"></select></label>' +
      '<label style="display:block;margin-bottom:16px">Note type' +
      '<select id="kagi-anki-model" style="display:block;width:100%;padding:6px;margin-top:4px"></select></label>' +
      '<div style="display:flex;gap:8px;justify-content:flex-end">' +
      '<button id="kagi-anki-cancel" style="padding:6px 14px;border:1px solid #ccc;background:#f5f5f5;border-radius:6px;cursor:pointer">取消</button>' +
      '<button id="kagi-anki-save" style="padding:6px 14px;border:none;background:#3F8611;color:#fff;border-radius:6px;cursor:pointer">確定</button>' +
      '</div>';

    overlay.appendChild(box);
    document.body.appendChild(overlay);

    const deckSel = box.querySelector('#kagi-anki-deck');
    const modelSel = box.querySelector('#kagi-anki-model');

    for (const d of decks) {
      const o = document.createElement('option');
      o.value = d;
      o.textContent = d;
      if (d === savedDeck) o.selected = true;
      deckSel.appendChild(o);
    }
    for (const m of models) {
      const o = document.createElement('option');
      o.value = m;
      o.textContent = m;
      if (m === savedModel) o.selected = true;
      modelSel.appendChild(o);
    }

    const close = () => overlay.remove();
    overlay.addEventListener('click', (ev) => {
      if (ev.target === overlay) close();
    });
    box.querySelector('#kagi-anki-cancel').addEventListener('click', close);
    box.querySelector('#kagi-anki-save').addEventListener('click', () => {
      const deck = deckSel.value;
      const model = modelSel.value;
      GM_setValue('deck', deck);
      GM_setValue('model', model);
      close();
      if (thenAdd) addNoteFor(deck, model);
    });
  }

  let toastEl = null;
  let toastTimer = null;

  function toast(msg, type) {
    if (!toastEl) {
      toastEl = document.createElement('div');
      toastEl.id = 'kagi-anki-toast';
      document.body.appendChild(toastEl);
    }
    const colors = {
      success: '#3F8611',
      error: '#c62828',
      warn: '#b26a00',
    };
    toastEl.textContent = msg;
    toastEl.style.cssText =
      'position:fixed;right:20px;bottom:20px;z-index:2147483647;max-width:360px;' +
      'padding:10px 16px;border-radius:8px;color:#fff;font:14px/1.4 Arial,sans-serif;' +
      'box-shadow:0 4px 16px rgba(0,0,0,.3);transition:opacity .2s;opacity:1;' +
      'background:' +
      (colors[type] || colors.success) +
      ';';
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      if (toastEl) toastEl.style.opacity = '0';
    }, 2800);
  }

  const PLUS_ICON =
    '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" ' +
    'stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" ' +
    'class="tabler-icon tabler-icon-plus text-primary-600 dark:text-primary-400 group-hover:text-primary ' +
    'transition-colors dark:group-hover:text-white">' +
    '<path d="M12 5l0 14"></path><path d="M5 12l14 0"></path></svg>';

  function makeAddButton(ankiBtn) {
    const wrapper = ankiBtn.parentElement;
    const clone = wrapper.cloneNode(true);
    clone.setAttribute('data-kagi-anki', '1');

    const btn = clone.querySelector('button');
    if (!btn) return null;
    btn.setAttribute('data-kagi-anki', '1');

    const svg = btn.querySelector('svg');
    if (svg) svg.outerHTML = PLUS_ICON;

    const label = btn.querySelector('span');
    if (label) label.textContent = '加入 Anki';

    btn.addEventListener('click', onAddClick);
    return clone;
  }

  function injectButtons() {
    if (!document.body) return;
    const buttons = document.querySelectorAll('button');
    for (const btn of buttons) {
      if (btn.hasAttribute('data-kagi-anki')) continue;
      if (!btn.querySelector('.tabler-icon-cards')) continue;

      const wrapper = btn.parentElement;
      if (!wrapper || !wrapper.parentElement) continue;
      if (wrapper.nextElementSibling && wrapper.nextElementSibling.hasAttribute('data-kagi-anki')) continue;

      const clone = makeAddButton(btn);
      if (clone) wrapper.insertAdjacentElement('afterend', clone);
    }
  }

  let injectTimer = null;
  function scheduleInject() {
    clearTimeout(injectTimer);
    injectTimer = setTimeout(injectButtons, 250);
  }

  GM_registerMenuCommand('设定 Kagi → Anki（Deck / Note type）', () => openPicker(false));
  GM_registerMenuCommand('清除已选的 Deck', () => {
    GM_setValue('deck', '');
    toast('已清除 Deck 选择', 'success');
  });

  const observer = new MutationObserver(scheduleInject);
  observer.observe(document.documentElement, { childList: true, subtree: true });

  injectButtons();
})();
