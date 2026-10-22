/*
 * Chuẩn hóa định dạng cho Gmail — content script.
 *  - Nút chuẩn hóa (icon con lăn sơn) trên thanh công cụ của mỗi cửa sổ soạn thư → chuẩn hóa toàn bộ thư
 *  - Phím tắt Alt+Shift+F khi đang gõ trong ô soạn thư
 *  - Tự làm sạch định dạng khi dán (Ctrl+V); Ctrl+Shift+V vẫn dán chữ thuần như cũ
 *  - Hoàn tác ngay trên thông báo
 */
(() => {
  'use strict';
  if (window.__gfmtLoaded) return;
  window.__gfmtLoaded = true;

  const G = window.GFmt;
  let settings = Object.assign({}, G.DEFAULTS);

  const EDITOR_SEL = 'div[contenteditable="true"][g_editable="true"], div.editable[contenteditable="true"][role="textbox"]';

  /* ---------- Trusted Types ----------
   * Gmail bật Trusted Types cho trang, nhưng content script chạy trong isolated world nên
   * thường không bị áp. Chỉ khi parse bị chặn mới thử tạo policy (tránh sinh báo cáo vi phạm CSP). */
  let ttPolicy;
  function parseHTML(html) {
    try {
      return new DOMParser().parseFromString(html, 'text/html');
    } catch (err) {
      if (ttPolicy === undefined) {
        ttPolicy = null;
        try { ttPolicy = window.trustedTypes.createPolicy('gmail-format-ext', { createHTML: s => s }); } catch (_) {}
      }
      if (!ttPolicy) throw err;
      return new DOMParser().parseFromString(ttPolicy.createHTML(html), 'text/html');
    }
  }

  /* ---------- tiện ích ---------- */
  function editorOf(node) {
    const el = node && (node.nodeType === 1 ? node : node.parentElement);
    return el && el.closest ? el.closest(EDITOR_SEL) : null;
  }
  function composeBar(editor) {
    let el = editor;
    for (let i = 0; i < 30 && el; i++) {
      el = el.parentElement;
      if (!el) break;
      const bar = el.querySelector('tr.btC');
      if (bar) return bar;
    }
    return null;
  }
  function editorNear(btn) {
    let el = btn;
    for (let i = 0; i < 30 && el; i++) {
      el = el.parentElement;
      if (!el) break;
      const ed = el.querySelector(EDITOR_SEL);
      if (ed) return ed;
    }
    return null;
  }
  function fireInput(editor) {
    editor.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertReplacementText' }));
  }
  function caretToEnd(node) {
    if (!node) return;
    const sel = window.getSelection();
    const r = document.createRange();
    r.selectNodeContents(node);
    r.collapse(false);
    sel.removeAllRanges();
    sel.addRange(r);
  }

  /* ---------- thông báo nhỏ (Shadow DOM để không dính CSS của Gmail) ---------- */
  let toastHost = null, toastTimer = null, toastUndoable = false;
  function toast(msg, action, ms) {
    if (!toastHost) {
      toastHost = document.createElement('div');
      toastHost.style.cssText = 'position:fixed;left:24px;bottom:24px;z-index:2147483647;';
      const root = toastHost.attachShadow({ mode: 'open' });
      // Dựng bằng DOM API (không dùng innerHTML vì Gmail bật Trusted Types)
      const style = document.createElement('style');
      style.textContent = `
        .box{display:flex;align-items:center;gap:16px;background:#323232;color:#fff;
          font:14px/20px Roboto,Arial,sans-serif;padding:12px 16px;border-radius:6px;
          box-shadow:0 3px 8px rgba(0,0,0,.3);max-width:520px}
        button{background:none;border:0;color:#8ab4f8;font:500 14px Roboto,Arial,sans-serif;
          cursor:pointer;padding:4px 6px;border-radius:4px}
        button:hover{background:rgba(138,180,248,.12)}
        .x{color:#bbb;font-size:18px;line-height:1;padding:2px 6px}`;
      const box = document.createElement('div');
      box.className = 'box';
      root.append(style, box);
    }
    if (!toastHost.isConnected) document.body.appendChild(toastHost);
    const box = toastHost.shadowRoot.querySelector('.box');
    box.replaceChildren();
    const text = document.createElement('span');
    text.textContent = msg;
    box.appendChild(text);
    toastUndoable = !!action;
    if (action) {
      const b = document.createElement('button');
      b.textContent = action.label;
      b.addEventListener('mousedown', e => e.preventDefault());
      b.addEventListener('click', () => { hideToast(); action.fn(); });
      box.appendChild(b);
    }
    const x = document.createElement('button');
    x.className = 'x';
    x.textContent = '×';
    x.title = 'Đóng';
    x.addEventListener('click', hideToast);
    box.appendChild(x);
    toastHost.style.display = '';
    clearTimeout(toastTimer);
    toastTimer = setTimeout(hideToast, ms || 8000);
  }
  function hideToast() {
    clearTimeout(toastTimer);
    toastUndoable = false;
    if (toastHost) toastHost.style.display = 'none';
  }
  // Người dùng gõ tiếp → nút hoàn tác hết hiệu lực (tránh mất phần vừa gõ)
  window.addEventListener('input', e => {
    if (e.isTrusted && toastUndoable && editorOf(e.target)) hideToast();
  }, true);

  /* ---------- chuẩn hóa cả thư ---------- */
  function normalize(editor) {
    try {
      const res = G.normalizeEditor(editor, settings);
      if (!res) { toast('Thư đang trống, không có gì để chuẩn hóa.', null, 3000); return; }
      fireInput(editor);
      editor.focus();
      caretToEnd(res.lastWrapper);
      toast('Đã chuẩn hóa định dạng thư.', {
        label: 'Hoàn tác',
        fn: () => { editor.replaceChildren(...res.backup); fireInput(editor); editor.focus(); },
      });
    } catch (err) {
      console.error('[Chuẩn hóa định dạng]', err);
      toast('Không chuẩn hóa được: ' + err.message, null, 6000);
    }
  }

  /* ---------- nút trên thanh công cụ soạn thư ---------- */
  // Icon "format paint" (Material Icons, Apache 2.0) — dựng bằng DOM API vì Trusted Types
  function paintIcon() {
    const NS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('aria-hidden', 'true');
    const path = document.createElementNS(NS, 'path');
    path.setAttribute('d', 'M18 4V3c0-.55-.45-1-1-1H5c-.55 0-1 .45-1 1v4c0 .55.45 1 1 1h12c.55 0 1-.45 1-1V6h1v4H9v11c0 .55.45 1 1 1h2c.55 0 1-.45 1-1v-9h8V4h-3z');
    svg.appendChild(path);
    return svg;
  }

  function makeButton() {
    const btn = document.createElement('div');
    btn.className = 'gfmt-btn';
    btn.setAttribute('role', 'button');
    btn.setAttribute('tabindex', '0');
    btn.setAttribute('aria-label', 'Chuẩn hóa định dạng');
    btn.setAttribute('data-tooltip', 'Chuẩn hóa định dạng (Alt+Shift+F)');
    btn.title = 'Chuẩn hóa định dạng thư (Alt+Shift+F)';
    btn.appendChild(paintIcon());
    const run = () => { const ed = editorNear(btn); if (ed) normalize(ed); };
    btn.addEventListener('mousedown', e => e.preventDefault()); // giữ con trỏ trong ô soạn
    btn.addEventListener('click', run);
    btn.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); run(); } });
    return btn;
  }
  function ensureButton(editor) {
    if (!settings.showToolbarButton) return;
    const bar = composeBar(editor);
    if (!bar || bar.querySelector('.gfmt-td') || bar.hasAttribute('data-gfmt-skip')) return;
    const td = document.createElement('td');
    td.className = 'gfmt-td';
    td.appendChild(makeButton());
    const first = bar.firstElementChild;
    if (first && first.nextSibling) bar.insertBefore(td, first.nextSibling);
    else bar.appendChild(td);
    requestAnimationFrame(() => guardOverlap(bar, td));
  }

  // Phòng khi Gmail đổi bố cục: nếu nút vẫn chồng lên nút khác thì dời ra cuối thanh,
  // vẫn chồng nữa thì gỡ nút (phím tắt Alt+Shift+F vẫn dùng được).
  function overlaps(bar, btn) {
    const b = btn.getBoundingClientRect();
    if (!b.width) return false;
    return [...bar.querySelectorAll('[role="button"], [data-tooltip]')].some(o => {
      if (o === btn || btn.contains(o) || o.contains(btn)) return false;
      const r = o.getBoundingClientRect();
      if (!r.width || !r.height) return false;
      return !(r.right <= b.left + 1 || r.left >= b.right - 1 || r.bottom <= b.top + 1 || r.top >= b.bottom - 1);
    });
  }
  function guardOverlap(bar, td) {
    const btn = td.querySelector('.gfmt-btn');
    if (!btn || !td.isConnected || !overlaps(bar, btn)) return;
    bar.appendChild(td);
    requestAnimationFrame(() => {
      if (td.isConnected && overlaps(bar, btn)) {
        td.remove();
        bar.setAttribute('data-gfmt-skip', '1');
        console.warn('[Chuẩn hóa định dạng] Không tìm được chỗ trống trên thanh công cụ; dùng Alt+Shift+F.');
      }
    });
  }

  function scan() {
    document.querySelectorAll(EDITOR_SEL).forEach(ensureButton);
  }
  let pending = false;
  new MutationObserver(() => {
    if (pending) return;
    pending = true;
    setTimeout(() => { pending = false; scan(); }, 300);
  }).observe(document.documentElement, { childList: true, subtree: true });

  const storage = (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync) || null;
  if (storage) {
    storage.get(G.DEFAULTS, v => { settings = Object.assign({}, G.DEFAULTS, v); scan(); });
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== 'sync') return;
      for (const k in changes) settings[k] = changes[k].newValue;
      if ('showToolbarButton' in changes && !settings.showToolbarButton) {
        document.querySelectorAll('.gfmt-td').forEach(n => n.remove());
      }
      scan();
    });
  }
  scan();

  /* ---------- phím tắt ---------- */
  let plainPasteAt = 0;
  window.addEventListener('keydown', e => {
    const mod = e.ctrlKey || e.metaKey;
    if (mod && e.shiftKey && e.code === 'KeyV') plainPasteAt = Date.now();
    if (e.altKey && e.shiftKey && !mod && e.code === 'KeyF') {
      const ed = editorOf(document.activeElement);
      if (ed) { e.preventDefault(); e.stopPropagation(); normalize(ed); }
    }
  }, true);

  /* ---------- làm sạch khi dán ---------- */
  window.addEventListener('paste', e => {
    if (!settings.autoCleanPaste) return;
    const editor = editorOf(e.target);
    if (!editor) return;
    if (Date.now() - plainPasteAt < 1000) return;           // Ctrl+Shift+V: để Gmail dán chữ thuần
    const dt = e.clipboardData;
    if (!dt) return;
    const html = dt.getData('text/html');
    const plain = dt.getData('text/plain');
    if (!html && !plain) return;
    if (html && /<img[\s>]/i.test(html)) {                  // có ảnh: để Gmail tự tải ảnh lên
      setTimeout(() => toast('Nội dung dán có ảnh nên được giữ nguyên. Bấm nút chuẩn hóa để làm sạch định dạng.', null, 5000), 50);
      return;
    }
    const sel = window.getSelection();
    if (!sel.rangeCount) return;
    const range = sel.getRangeAt(0);
    if (!editor.contains(range.commonAncestorContainer)) return;

    let frag;
    try {
      if (html) frag = G.cleanHTML(html, document, settings, parseHTML);
      else {
        // Chữ thuần: chỉ can thiệp khi nhận dạng được danh sách / link / email / SĐT
        frag = G.cleanText(plain, document, settings);
        if (!frag.querySelector('a, ul, ol')) return;
      }
    } catch (err) { console.warn('[Chuẩn hóa định dạng] bỏ qua, để Gmail dán:', err); return; }

    e.preventDefault();
    e.stopImmediatePropagation();

    range.deleteContents();
    const inserted = [...frag.childNodes];
    if (!inserted.length) return;
    range.insertNode(frag);
    const after = document.createRange();
    after.setStartAfter(inserted[inserted.length - 1]);
    after.collapse(true);
    sel.removeAllRanges();
    sel.addRange(after);
    fireInput(editor);

    toast(html ? 'Đã làm sạch định dạng khi dán.' : 'Đã nhận dạng danh sách, link, số điện thoại.', {
      label: 'Dán nguyên bản',
      fn: () => {
        if (!inserted.every(n => n.isConnected)) return;
        const r = document.createRange();
        r.setStartBefore(inserted[0]);
        r.collapse(true);
        inserted.forEach(n => n.remove());
        if (!html) {
          const f = document.createDocumentFragment();
          plain.replace(/\r\n?/g, '\n').split('\n').forEach((ln, i) => {
            if (i) f.appendChild(document.createElement('br'));
            f.appendChild(document.createTextNode(ln));
          });
          r.insertNode(f);
          fireInput(editor);
          return;
        }
        const raw = parseHTML(html).body;
        raw.querySelectorAll('script,style,meta,link,iframe,object,embed').forEach(n => n.remove());
        raw.querySelectorAll('*').forEach(el => {
          for (const a of [...el.attributes]) {
            if (/^on/i.test(a.name) || /^\s*javascript:/i.test(a.value)) el.removeAttribute(a.name);
          }
        });
        const f = document.createDocumentFragment();
        [...raw.childNodes].forEach(n => f.appendChild(document.importNode(n, true)));
        r.insertNode(f);
        fireInput(editor);
      },
    }, 5000);
  }, true);
})();
