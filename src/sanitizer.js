/*
 * Chuẩn hóa định dạng cho Gmail — bộ chuẩn hóa HTML.
 *
 * Không phụ thuộc Chrome API: chạy được trong content script, trang cài đặt
 * và trong Node (jsdom) để kiểm thử.
 *
 * Nguyên tắc: XÓA SẠCH rồi ÁP LẠI.
 *   - Chỉ giữ cấu trúc có nghĩa: đậm, nghiêng, gạch chân, gạch ngang, link,
 *     danh sách, bảng, trích dẫn, code.
 *   - Bỏ mọi style/class/font/bgcolor/color từ nguồn.
 *   - Cỡ chữ: mọi đơn vị (pt, px, em, <font size>) quy về một cỡ chuẩn;
 *     dòng ngắn có cỡ chữ lớn hơn rõ rệt so với thân bài → tiêu đề (chữ đậm).
 *   - Code block: font monospace, giữ thụt lề, nền do chuẩn quyết định.
 *   - Không đụng vào: ảnh, chữ ký, phần thư trích dẫn, chip của Gmail.
 */
(function (global) {
  'use strict';

  const DEFAULTS = {
    fontFamily: 'Arial, Helvetica, sans-serif',
    fontSize: 14,            // px
    textColor: '#222222',
    lineHeight: 1.5,
    linkColor: '#1a73e8',
    paragraphSpacing: 'blank', // 'blank' = chèn 1 dòng trống giữa các đoạn văn dán vào; 'none'
    codeBackground: true,
    codeFontSize: 13,
    detectHeadings: true,
    keepTextColor: false,
    keepAlignment: true,
    autoCleanPaste: true,
    showToolbarButton: true,
    autoList: true,          // dòng bắt đầu bằng -, *, •, 1., a) → danh sách thật
    autoLink: true,          // URL, www., tên miền, email → link
    autoPhone: true,         // số điện thoại Việt Nam, hotline 1800/1900 → link gọi
  };

  const LIST_CSS = { 'margin': '0', 'padding-left': '24px' };

  const MONO_FAMILY = 'Consolas, Menlo, "Courier New", monospace';

  const DROP = new Set(['STYLE', 'SCRIPT', 'META', 'LINK', 'TITLE', 'HEAD', 'XML', 'NOSCRIPT',
    'TEMPLATE', 'IFRAME', 'OBJECT', 'EMBED', 'SVG', 'CANVAS', 'VIDEO', 'AUDIO', 'INPUT',
    'BUTTON', 'SELECT', 'TEXTAREA', 'FORM', 'COLGROUP', 'COL', 'O:SMARTTAGTYPE', 'V:SHAPETYPE']);
  const TO_DIV = new Set(['P', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'SECTION', 'ARTICLE', 'HEADER',
    'FOOTER', 'MAIN', 'ASIDE', 'NAV', 'FIGURE', 'FIGCAPTION', 'ADDRESS', 'CENTER', 'DL', 'DT', 'DD',
    'CAPTION', 'DETAILS', 'SUMMARY']);
  const BLOCK_KEEP = new Set(['DIV', 'UL', 'OL', 'LI', 'TABLE', 'THEAD', 'TBODY', 'TFOOT', 'TR',
    'TD', 'TH', 'BLOCKQUOTE', 'HR']);
  const BLOCKISH = new Set([...TO_DIV, ...BLOCK_KEEP, 'PRE']);
  const BLOCK_SELECTOR = [...BLOCKISH].map(t => t.toLowerCase()).join(',');
  const INLINE_FMT = new Set(['B', 'I', 'U', 'S', 'SPAN', 'CODE', 'SUB', 'SUP']);
  const CODE_TAGS = new Set(['CODE', 'TT', 'KBD', 'SAMP']);
  const HEADING_TAG = /^H[1-6]$/;
  const PRESERVE_CLASS = /\bgmail_(quote|signature|chip|attr|extra)/;
  const FONT_TAG_PX = { 1: 10, 2: 13, 3: 16, 4: 18, 5: 24, 6: 32, 7: 48 };
  const KEYWORD_PX = { 'xx-small': 9, 'x-small': 10, small: 13, medium: 16, large: 18,
    'x-large': 24, 'xx-large': 32, 'xxx-large': 48 };
  const MONO_RE = /monospace|consolas|courier|menlo|monaco|fira ?code|jetbrains|source code|sf mono|roboto mono|lucida console|cascadia|ubuntu mono|dejavu sans mono|andale mono/i;
  const SAFE_HREF = /^(https?:|mailto:|tel:|#)/i;
  const DEFAULT_COLORS = /^(#000|#000000|#222|#222222|black|windowtext|inherit|initial|currentcolor|rgb\(0, ?0, ?0\)|rgb\(34, ?34, ?34\)|rgba\(0, ?0, ?0, ?1\))$/i;

  // Gốc của div sau khi chuyển: 'p' (đoạn văn), 'listp' (đoạn danh sách Word), 'code'
  const ORIGIN = new WeakMap();

  /* ---------------- tiện ích đọc style ---------------- */

  function prop(el, name) {
    const st = el && el.style;
    if (!st || !st.getPropertyValue) return '';
    return (st.getPropertyValue(name) || '').trim().toLowerCase();
  }

  function parseSize(v) {
    if (!v) return null;
    v = String(v).trim().toLowerCase();
    if (KEYWORD_PX[v]) return { abs: KEYWORD_PX[v] };
    if (v === 'smaller') return { rel: 0.83 };
    if (v === 'larger') return { rel: 1.2 };
    const m = /^(-?[\d.]+)\s*(px|pt|em|rem|%|pc|in|cm|mm)?$/.exec(v);
    if (!m) return null;
    const n = parseFloat(m[1]);
    if (!isFinite(n) || n <= 0) return null;
    switch (m[2]) {
      case 'pt': return { abs: n * 4 / 3 };
      case 'pc': return { abs: n * 16 };
      case 'in': return { abs: n * 96 };
      case 'cm': return { abs: n * 37.8 };
      case 'mm': return { abs: n * 3.78 };
      case 'rem': return { abs: n * 16 };
      case 'em': return { rel: n };
      case '%': return { rel: n / 100 };
      default: return { abs: n };
    }
  }

  function ownSize(el) {
    if (el.tagName === 'FONT' && el.hasAttribute('size')) {
      const raw = el.getAttribute('size').trim();
      const n = parseInt(raw, 10);
      if (isNaN(n)) return null;
      const level = /^[+-]/.test(raw) ? 3 + n : n;
      return { abs: FONT_TAG_PX[Math.min(7, Math.max(1, level))] };
    }
    return parseSize(prop(el, 'font-size'));
  }

  // Cỡ chữ hiệu lực (px) của một phần tử, tính dồn từ tổ tiên trong nguồn
  function elSize(el, ctx) {
    if (!el || el === ctx.root || el.nodeType !== 1) return ctx.defaultPx;
    if (ctx.sizeCache.has(el)) return ctx.sizeCache.get(el);
    const parent = elSize(el.parentNode, ctx);
    const own = ownSize(el);
    const v = own ? (own.abs || parent * own.rel) : parent;
    ctx.sizeCache.set(el, v);
    return v;
  }

  function textNodes(root) {
    const out = [];
    const walker = root.ownerDocument.createTreeWalker(root, 4 /* SHOW_TEXT */);
    let n;
    while ((n = walker.nextNode())) {
      const p = n.parentNode;
      if (p && p.nodeType === 1 && DROP.has(p.tagName.toUpperCase())) continue;
      if (n.data.replace(/[\s ​]/g, '') === '') continue;
      out.push(n);
    }
    return out;
  }

  // Cỡ chữ chiếm nhiều ký tự nhất trong vùng
  function inCodeSource(tn, root) {
    for (let el = tn.parentNode; el && el !== root && el.nodeType === 1; el = el.parentNode) {
      if (el.tagName === 'PRE' || CODE_TAGS.has(el.tagName)) return true;
      const ws = prop(el, 'white-space');
      if (ws.startsWith('pre') || ws === 'break-spaces') return true;
    }
    return false;
  }

  function dominantSize(root, ctx) {
    const weights = new Map();
    for (const tn of textNodes(root)) {
      if (inCodeSource(tn, root)) continue;
      const px = Math.round(elSize(tn.parentNode, ctx));
      weights.set(px, (weights.get(px) || 0) + tn.data.trim().length);
    }
    let best = null, bestW = -1;
    for (const [px, w] of weights) if (w > bestW) { best = px; bestW = w; }
    return best;
  }

  function isBold(el, t) {
    const fw = prop(el, 'font-weight');
    if (fw) {
      if (fw === 'bold' || fw === 'bolder') return true;
      if (fw === 'normal' || fw === 'lighter') return false;
      const n = parseInt(fw, 10);
      if (!isNaN(n)) return n >= 600;
    }
    return t === 'B' || t === 'STRONG';
  }
  function isItalic(el, t) {
    const fs = prop(el, 'font-style');
    if (fs) return fs === 'italic' || fs.startsWith('oblique');
    return t === 'I' || t === 'EM';
  }
  function isUnderline(el, t) {
    if (t === 'A') return false;
    const td = prop(el, 'text-decoration-line') || prop(el, 'text-decoration');
    if (td) return td.includes('underline');
    return t === 'U' || t === 'INS';
  }
  function isStrike(el, t) {
    const td = prop(el, 'text-decoration-line') || prop(el, 'text-decoration');
    if (td) return td.includes('line-through');
    return t === 'S' || t === 'STRIKE' || t === 'DEL';
  }
  function isCodeBlock(el, t) {
    if (t === 'PRE') return true;
    if (!(t === 'DIV' || t === 'P' || t === 'BLOCKQUOTE')) return false;
    const ws = prop(el, 'white-space');
    return ws.startsWith('pre') || ws === 'break-spaces';
  }

  function isPreserved(n) {
    return n && n.nodeType === 1 &&
      (n.tagName === 'IMG' || PRESERVE_CLASS.test(n.getAttribute('class') || ''));
  }
  function isBlankText(n) {
    return n.nodeType === 3 && /^[ \t\r\n\f]*$/.test(n.data);
  }
  function isBlockNode(n) {
    return n && n.nodeType === 1 && BLOCKISH.has(n.tagName.toUpperCase());
  }
  function hasVisible(el) {
    if (el.querySelector && el.querySelector('img,table,hr,br')) return true;
    return el.textContent.replace(/[\s ​]/g, '') !== '';
  }
  function isEmptyBlock(n) {
    if (!n || n.nodeType !== 1 || n.tagName !== 'DIV') return false;
    if (ORIGIN.get(n) === 'code' || isPreserved(n)) return false;
    if (n.querySelector('img,table,hr,ul,ol,[class*="gmail_"]')) return false;
    return n.textContent.replace(/[\s ​]/g, '') === '';
  }

  function css(el, map) {
    for (const k in map) if (map[k] !== '' && map[k] != null) el.style.setProperty(k, String(map[k]));
  }

  /* ---------------- code ---------------- */

  function codeLines(el) {
    const lines = [''];
    const push = s => { lines[lines.length - 1] += s; };
    const nl = () => lines.push('');
    (function walk(n, isRoot) {
      if (n.nodeType === 3) {
        n.data.replace(/\r\n?/g, '\n').split('\n').forEach((part, i) => { if (i) nl(); push(part); });
        return;
      }
      if (n.nodeType !== 1) return;
      const t = n.tagName.toUpperCase();
      if (t === 'BR') { nl(); return; }
      if (DROP.has(t)) return;
      const block = !isRoot && BLOCKISH.has(t);
      if (block && lines[lines.length - 1] !== '') nl();
      for (const c of [...n.childNodes]) walk(c, false);
      if (block && lines[lines.length - 1] !== '') nl();
    })(el, true);
    while (lines.length > 1 && lines[lines.length - 1].replace(/ /g, ' ').trim() === '') lines.pop();
    while (lines.length > 1 && lines[0].replace(/ /g, ' ').trim() === '') lines.shift();
    return lines.map(l => l.replace(/ /g, ' ').replace(/\t/g, '    '));
  }

  function encodeSpaces(line) {
    return line
      .replace(/^ +/, m => ' '.repeat(m.length))
      .replace(/ {2,}/g, m => ' '.repeat(m.length));
  }

  function buildCodeBlock(doc, lines, s) {
    const d = doc.createElement('div');
    css(d, {
      'font-family': MONO_FAMILY,
      'font-size': s.codeFontSize + 'px',
      'line-height': '1.45',
      'white-space': 'pre-wrap',
      'color': s.textColor,
    });
    if (s.codeBackground) {
      css(d, { 'background-color': '#f6f8fa', 'border': '1px solid #e1e4e8',
        'border-radius': '4px', 'padding': '8px 10px' });
    }
    lines.forEach((ln, i) => {
      if (i) d.appendChild(doc.createElement('br'));
      if (ln) d.appendChild(doc.createTextNode(encodeSpaces(ln)));
    });
    ORIGIN.set(d, 'code');
    return d;
  }

  function buildInlineCode(doc, nodes, s) {
    const c = doc.createElement('code');
    css(c, { 'font-family': MONO_FAMILY, 'font-size': (s.codeFontSize) + 'px' });
    if (s.codeBackground) css(c, { 'background-color': '#f3f4f6', 'padding': '1px 4px', 'border-radius': '3px' });
    nodes.forEach(n => c.appendChild(n));
    return c;
  }

  /* ---------------- biến đổi chính ---------------- */

  /*
   * mode 'paste'  : nội dung từ Word/Docs/web — tiêu đề thường to hơn thân bài ≥ 25%.
   * mode 'editor' : thư đang soạn — cỡ chữ lộn xộn (12pt, 13px, Large…) là chuyện thường,
   *                 chỉ coi là tiêu đề khi to vượt trội (≥ 1,5 lần và ≥ 20px, ví dụ "Huge").
   */
  function makeCtx(doc, s, root, defaultPx, preserve, mode) {
    const ctx = { doc, s, root, defaultPx, preserve, sizeCache: new Map(),
      headingRatio: mode === 'editor' ? 1.5 : 1.25,
      headingMinPx: mode === 'editor' ? 20 : 0,
      bold: false, italic: false, underline: false, strike: false, inCode: false, inLink: false };
    ctx.bodySize = dominantSize(root, ctx) || defaultPx;
    return ctx;
  }

  function transformChildren(parent, ctx) {
    const out = [];
    const kids = [...parent.childNodes];
    kids.forEach((k, i) => { for (const x of transformNode(k, ctx, kids, i)) out.push(x); });
    return out;
  }

  function transformText(n, ctx, sibs, i) {
    let s = n.data;
    if (!s) return [];
    if (/^[ \t\r\n\f]*$/.test(s)) {
      if (/[\r\n]/.test(s)) {
        const prev = sibs[i - 1], next = sibs[i + 1];
        const blockish = x => !x || (x.nodeType === 1 && (BLOCKISH.has(x.tagName.toUpperCase()) || x.tagName === 'BR'));
        if (blockish(prev) || blockish(next)) return [];
      }
      return [ctx.doc.createTextNode(' ')];
    }
    s = s.replace(/[\r\n\t\f]+/g, ' ').replace(/ {2,}/g, ' ');
    return [ctx.doc.createTextNode(s)];
  }

  function wrapRuns(nodes, tags, doc) {
    const out = [];
    let run = [];
    const flush = () => {
      if (!run.length) return;
      if (run.every(isBlankText)) { out.push(...run); run = []; return; }
      let outer = null, cur = null;
      for (const tg of tags) {
        const e = doc.createElement(tg);
        if (!outer) outer = e; else cur.appendChild(e);
        cur = e;
      }
      run.forEach(x => cur.appendChild(x));
      out.push(outer);
      run = [];
    };
    for (const x of nodes) {
      if (isPreserved(x) || ORIGIN.get(x) === 'code') { flush(); out.push(x); }
      else if (isBlockNode(x)) {
        flush();
        const inner = [...x.childNodes];
        inner.forEach(c => x.removeChild(c));
        wrapRuns(inner, tags, doc).forEach(c => x.appendChild(c));
        out.push(x);
      } else run.push(x);
    }
    flush();
    return out;
  }

  function transformNode(n, ctx, sibs, idx) {
    if (n.nodeType === 3) return transformText(n, ctx, sibs, idx);
    if (n.nodeType !== 1) return [];
    const t = n.tagName.toUpperCase();
    const doc = ctx.doc, s = ctx.s;
    if (DROP.has(t)) return [];
    if (ctx.preserve && isPreserved(n)) return [n];

    // Ký hiệu đầu dòng của danh sách Word (span mso-list:Ignore)
    const raw = n.getAttribute('style') || '';
    if (/mso-list\s*:\s*ignore/i.test(raw)) {
      const txt = (n.textContent || '').replace(/ /g, ' ').trim();
      if (!txt) return [];
      const bullet = /^[·•▪●§o\-]$/.test(txt) ? '• ' : txt + ' ';
      return [doc.createTextNode(bullet)];
    }
    if (/mso-hide\s*:\s*all/i.test(raw) || prop(n, 'display') === 'none') return [];

    if (BLOCKISH.has(t) && isCodeBlock(n, t)) return [buildCodeBlock(doc, codeLines(n), s)];

    const f = { bold: isBold(n, t), italic: isItalic(n, t),
      underline: !ctx.inLink && isUnderline(n, t), strike: isStrike(n, t) };

    let heading = HEADING_TAG.test(t);
    if (!heading && s.detectHeadings && (t === 'P' || t === 'DIV') && !n.querySelector(BLOCK_SELECTOR)) {
      const txt = (n.textContent || '').trim();
      if (txt && txt.length <= 150) {
        const ds = dominantSize(n, ctx);
        if (ds && ds >= ctx.bodySize * ctx.headingRatio && ds >= ctx.headingMinPx) heading = true;
      }
    }
    if (heading) f.bold = true;

    const inlineCode = !BLOCKISH.has(t) && !ctx.inCode &&
      (CODE_TAGS.has(t) || MONO_RE.test(prop(n, 'font-family') || n.getAttribute('face') || ''));

    const childCtx = Object.assign({}, ctx, {
      bold: ctx.bold || f.bold, italic: ctx.italic || f.italic,
      underline: ctx.underline || f.underline, strike: ctx.strike || f.strike,
      inCode: ctx.inCode || inlineCode,
      inLink: ctx.inLink || t === 'A',
    });
    let inner = transformChildren(n, childCtx);

    const tags = [];
    if (f.bold && !ctx.bold) tags.push('b');
    if (f.italic && !ctx.italic) tags.push('i');
    if (f.underline && !ctx.underline) tags.push('u');
    if (f.strike && !ctx.strike) tags.push('s');
    if (tags.length) inner = wrapRuns(inner, tags, doc);

    if (inlineCode) inner = [buildInlineCode(doc, inner, s)];

    if (s.keepTextColor && !BLOCKISH.has(t)) {
      const color = prop(n, 'color') || (t === 'FONT' ? (n.getAttribute('color') || '') : '');
      if (color && !DEFAULT_COLORS.test(color.replace(/\s+/g, ' '))) {
        const sp = doc.createElement('span');
        sp.style.setProperty('color', color);
        inner.forEach(x => sp.appendChild(x));
        inner = [sp];
      }
    }

    const align = () => {
      if (!s.keepAlignment) return '';
      const a = t === 'CENTER' ? 'center' : (prop(n, 'text-align') || (n.getAttribute('align') || '').toLowerCase());
      return a === 'center' || a === 'right' ? a : '';
    };

    if (TO_DIV.has(t) || t === 'DIV') {
      const d = doc.createElement('div');
      const a = align();
      if (a) d.style.setProperty('text-align', a);
      inner.forEach(x => d.appendChild(x));
      if (t === 'P' || HEADING_TAG.test(t)) {
        ORIGIN.set(d, /MsoList/i.test(n.getAttribute('class') || '') ? 'listp' : 'p');
      }
      return [d];
    }

    if (BLOCK_KEEP.has(t)) {
      const e = doc.createElement(t.toLowerCase());
      if (t === 'TD' || t === 'TH') {
        for (const a of ['colspan', 'rowspan']) if (n.hasAttribute(a)) e.setAttribute(a, n.getAttribute(a));
        css(e, { 'border': '1px solid #d0d7de', 'padding': '4px 8px', 'vertical-align': 'top' });
        const a = align();
        if (a) e.style.setProperty('text-align', a);
      } else if (t === 'TABLE') {
        css(e, { 'border-collapse': 'collapse' });
      } else if (t === 'UL' || t === 'OL') {
        css(e, LIST_CSS);
        if (t === 'OL' && n.hasAttribute('start')) e.setAttribute('start', n.getAttribute('start'));
        const lst = prop(n, 'list-style-type') || (n.getAttribute('type') || '');
        if (/alpha|^a$/i.test(lst)) e.style.setProperty('list-style-type', 'lower-alpha');
      } else if (t === 'BLOCKQUOTE') {
        css(e, { 'margin': '0 0 0 0.8ex', 'border-left': '2px solid #ccc', 'padding-left': '1ex' });
      }
      if (t !== 'HR') inner.forEach(x => e.appendChild(x));
      return [e];
    }

    if (t === 'A') {
      const href = (n.getAttribute('href') || '').trim();
      if (href && SAFE_HREF.test(href)) {
        const a = doc.createElement('a');
        a.setAttribute('href', href);
        a.style.setProperty('color', s.linkColor);
        inner.forEach(x => a.appendChild(x));
        return [a];
      }
      return inner;
    }
    if (t === 'BR') return [doc.createElement('br')];
    if (t === 'SUB' || t === 'SUP') {
      const e = doc.createElement(t.toLowerCase());
      inner.forEach(x => e.appendChild(x));
      return [e];
    }
    // SPAN, FONT, B, I, ... : đã chuyển thành cờ định dạng → bóc vỏ
    return inner;
  }

  /* ---------------- dọn dẹp sau biến đổi ---------------- */

  function blankLine(doc) {
    const d = doc.createElement('div');
    d.appendChild(doc.createElement('br'));
    return d;
  }

  function tidy(el, s, isTop) {
    const doc = el.ownerDocument;

    for (const c of [...el.childNodes]) {
      if (c.nodeType === 1 && !isPreserved(c) && ORIGIN.get(c) !== 'code') tidy(c, s, false);
    }

    // Bỏ thẻ định dạng rỗng
    for (const c of [...el.childNodes]) {
      if (c.nodeType === 1 && INLINE_FMT.has(c.tagName) && !hasVisible(c)) c.remove();
    }

    // Bóc các div chỉ dùng để bọc (bên trong toàn là khối)
    for (const c of [...el.childNodes]) {
      if (c.nodeType !== 1 || c.tagName !== 'DIV' || isPreserved(c)) continue;
      if (ORIGIN.get(c) === 'code' || c.getAttribute('style')) continue;
      const kids = [...c.childNodes].filter(k => !isBlankText(k));
      if (!kids.length) { if (!c.childNodes.length) c.remove(); continue; }
      const isBr = k => k.nodeType === 1 && k.tagName === 'BR';
      if (kids.some(k => isBlockNode(k) || isPreserved(k)) &&
          kids.every(k => isBlockNode(k) || isPreserved(k) || isBr(k))) c.replaceWith(...c.childNodes);
    }

    // Ký hiệu đầu dòng kiểu Word đã bị dán thô ("·      Nội dung") → "• Nội dung"
    if (el.tagName === 'DIV' || el.tagName === 'LI') {
      el.normalize();
      const walker = doc.createTreeWalker(el, 4);
      const first = walker.nextNode();
      if (first && el.firstChild && first.parentNode && !el.querySelector(BLOCK_SELECTOR)) {
        first.data = first.data.replace(/^[\s ]*[·•▪●§][\s ]{2,}/, '• ');
      }
    }

    // Trong LI/TD/TH: một div duy nhất thì bóc ra
    if (['LI', 'TD', 'TH'].includes(el.tagName)) {
      const kids = [...el.childNodes].filter(k => !isBlankText(k));
      if (kids.length === 1 && kids[0].tagName === 'DIV' && !kids[0].getAttribute('style') && ORIGIN.get(kids[0]) !== 'code') {
        kids[0].replaceWith(...kids[0].childNodes);
      }
    }

    // Bỏ khoảng trắng lửng giữa các khối
    const all = [...el.childNodes];
    all.forEach((c, i) => {
      if (isBlankText(c) && (isBlockNode(all[i - 1]) || isBlockNode(all[i + 1]) || !all[i - 1] || !all[i + 1])) c.remove();
    });

    // <br> đứng lẻ giữa hai khối = một dòng trống → đổi về dạng chuẩn <div><br></div>
    const seq = [...el.childNodes];
    seq.forEach((c, i) => {
      if (c.nodeType !== 1 || c.tagName !== 'BR') return;
      const prev = seq[i - 1], next = seq[i + 1];
      if (prev && next && isBlockNode(prev) && isBlockNode(next) && !isPreserved(prev) && !isPreserved(next)) {
        c.replaceWith(blankLine(doc));
      }
    });

    // Dòng trống: chuẩn về <div><br></div>, gộp nhiều dòng trống liền nhau thành 1
    let prevEmpty = false, brRun = 0;
    for (const c of [...el.childNodes]) {
      if (isEmptyBlock(c)) {
        if (prevEmpty) { c.remove(); continue; }
        c.removeAttribute('style');
        c.replaceChildren(doc.createElement('br'));
        prevEmpty = true; brRun = 0;
        continue;
      }
      if (c.nodeType === 1 && c.tagName === 'BR') {
        brRun++;
        if (brRun > 2) { c.remove(); continue; }
      } else if (!isBlankText(c)) brRun = 0;
      if (!isBlankText(c)) prevEmpty = false;
    }

    // Khoảng cách đoạn cho nội dung dán từ Word/Docs/web
    if (s.paragraphSpacing === 'blank') {
      const blocks = [...el.childNodes].filter(n => !isBlankText(n));
      for (let i = 1; i < blocks.length; i++) {
        const a = blocks[i - 1], b = blocks[i];
        const aBlock = isBlockNode(a) || isPreserved(a), bBlock = isBlockNode(b) || isPreserved(b);
        if (!aBlock || !bBlock || isEmptyBlock(a) || isEmptyBlock(b)) continue;
        const oa = ORIGIN.get(a), ob = ORIGIN.get(b);
        const need = oa === 'p' || ob === 'p' || ((oa === 'listp') !== (ob === 'listp'));
        if (need) b.before(blankLine(doc));
      }
    }

    if (isTop) {
      const significant = n => !isBlankText(n) && !isEmptyBlock(n) && !(n.nodeType === 1 && n.tagName === 'BR');
      while (el.firstChild && !significant(el.firstChild)) el.firstChild.remove();
      while (el.lastChild && !significant(el.lastChild)) el.lastChild.remove();
      el.normalize();
    }
  }

  /* ---------------- tự nhận dạng: dòng, danh sách, link ---------------- */

  const CONTAINER_SKIP = new Set(['UL', 'OL', 'LI', 'TABLE', 'THEAD', 'TBODY', 'TFOOT', 'TR', 'TD', 'TH', 'PRE']);

  function isCodeOrPreserved(n) {
    return n && n.nodeType === 1 && (isPreserved(n) || ORIGIN.get(n) === 'code');
  }

  /*
   * Đưa nội dung về "mỗi dòng một div": inline + <br> ở cùng cấp → các div.
   * Cách hiển thị không đổi, nhưng nhờ vậy mới nhận dạng được dòng bắt đầu bằng "- ", "1. "…
   */
  function splitLines(container, doc) {
    for (const c of [...container.childNodes]) {
      if (c.nodeType === 1 && !isCodeOrPreserved(c) && !CONTAINER_SKIP.has(c.tagName) && isBlockNode(c)) splitLines(c, doc);
    }
    const kids = [...container.childNodes];
    if (!kids.some(k => k.nodeType === 1 && k.tagName === 'BR')) return;
    if (kids.some(k => isPreserved(k))) return; // khu có chữ ký/trích dẫn: giữ nguyên

    const out = [];
    let run = [];
    const flush = (byBr) => {
      const blank = run.every(isBlankText);
      if (blank && !byBr) { run = []; return; }
      const d = doc.createElement('div');
      if (blank) d.appendChild(doc.createElement('br'));
      else run.forEach(x => d.appendChild(x));
      out.push(d);
      run = [];
    };
    for (const k of kids) {
      if (k.nodeType === 1 && k.tagName === 'BR') flush(true);
      else if (isBlockNode(k) || isCodeOrPreserved(k)) { flush(false); out.push(k); }
      else run.push(k);
    }
    flush(false);

    if (container.tagName === 'DIV' && !container.getAttribute('style') && container.parentNode &&
        !kids.some(isBlockNode)) {
      container.replaceWith(...out);       // div chỉ chứa các dòng → bóc ra
    } else {
      container.replaceChildren(...out);
    }
  }

  const BULLET_RE = /^([-*+•·–—▪●○◦►➢✓✔❖])[ \t ]+(?=\S)/;
  const NUM_RE = /^(\d{1,3})[.)][ \t ]+(?=\S)/;
  const ALPHA_RE = /^([a-z])[.)][ \t ]+(?=\S)/;

  function lineInfo(n) {
    if (!n || n.nodeType !== 1 || n.tagName !== 'DIV' || isCodeOrPreserved(n)) return null;
    if (n.querySelector(BLOCK_SELECTOR)) return null;
    const text = n.textContent;
    const lead = /^[ \t ]*/.exec(text)[0];
    const indentW = [...lead].reduce((w, ch) => w + (ch === '\t' ? 4 : 1), 0);
    const rest = text.slice(lead.length);
    let m;
    if ((m = BULLET_RE.exec(rest))) return { type: 'ul', indent: indentW >= 2 ? 1 : 0, cut: lead.length + m[0].length };
    if ((m = NUM_RE.exec(rest))) return { type: 'ol', num: +m[1], indent: indentW >= 2 ? 1 : 0, cut: lead.length + m[0].length };
    if ((m = ALPHA_RE.exec(rest))) return { type: 'ol', alpha: true, num: m[1].charCodeAt(0) - 96, indent: indentW >= 2 ? 1 : 0, cut: lead.length + m[0].length };
    return null;
  }

  function removeLeadingChars(el, n, doc) {
    const walker = doc.createTreeWalker(el, 4);
    let t;
    while (n > 0 && (t = walker.nextNode())) {
      const len = t.data.length;
      if (len <= n) { n -= len; t.data = ''; }
      else { t.data = t.data.slice(n); n = 0; }
    }
    // dọn thẻ định dạng rỗng còn sót
    for (const e of [...el.querySelectorAll('b,i,u,s,span,code')]) if (!hasVisible(e)) e.remove();
  }

  function makeList(doc, info) {
    const l = doc.createElement(info.type);
    css(l, LIST_CSS);
    if (info.alpha) l.style.setProperty('list-style-type', 'lower-alpha');
    if (info.type === 'ol' && info.num !== 1) l.setAttribute('start', String(info.num));
    return l;
  }

  function buildLists(container, doc) {
    for (const c of [...container.childNodes]) {
      if (c.nodeType === 1 && !isCodeOrPreserved(c) && !CONTAINER_SKIP.has(c.tagName) && isBlockNode(c) &&
          c.querySelector(BLOCK_SELECTOR)) buildLists(c, doc);
    }
    const kids = [...container.childNodes].filter(k => !isBlankText(k));
    let i = 0;
    while (i < kids.length) {
      const head = lineInfo(kids[i]);
      if (!head || head.indent) { i++; continue; }

      // gom các dòng liên tiếp cùng kiểu (cho phép 1 dòng trống chen giữa, cho phép mục thụt vào)
      const run = [];
      const blanks = [];          // [{el, idx}]
      let j = i, expect = head.num, lastRunIdx = i;
      while (j < kids.length) {
        const k = kids[j];
        if (isEmptyBlock(k)) {
          const nx = lineInfo(kids[j + 1]);
          if (nx && (nx.indent || nx.type === head.type)) { blanks.push({ el: k, idx: j }); j++; continue; }
          break;
        }
        const inf = lineInfo(k);
        if (!inf) break;
        if (!inf.indent) {
          if (inf.type !== head.type || !!inf.alpha !== !!head.alpha) break;
          if (inf.type === 'ol' && run.length && inf.num !== expect) break;
          expect = (inf.num || 0) + 1;
        }
        run.push({ el: k, inf });
        lastRunIdx = j;
        j++;
      }
      // dòng trống "mượn" sau mục cuối nhưng không có mục nào theo sau → trả lại
      while (blanks.length && blanks[blanks.length - 1].idx > lastRunIdx) blanks.pop();
      j = lastRunIdx + 1;
      const top = run.filter(r => !r.inf.indent);
      if (head.type === 'ol' && top.length < 2) { i++; continue; } // "1. ..." đứng một mình: không phải danh sách

      const list = makeList(doc, head);
      kids[i].before(list);
      let lastLi = null, sub = null;
      for (const { el, inf } of run) {
        const li = doc.createElement('li');
        li.append(...el.childNodes);
        removeLeadingChars(li, inf.cut, doc);
        el.remove();
        if (inf.indent && lastLi) {
          if (!sub || sub.tagName.toLowerCase() !== inf.type) { sub = makeList(doc, inf); lastLi.appendChild(sub); }
          sub.appendChild(li);
        } else {
          list.appendChild(li);
          lastLi = li;
          sub = null;
        }
      }
      // dòng trống chen giữa các mục → bỏ
      blanks.forEach(b => b.el.remove());
      i = j;
    }
  }

  // Thứ tự quan trọng: email trước (vì chứa tên miền), rồi URL, tên miền, điện thoại
  const LINK_RE = new RegExp([
    '(?<email>[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\\.[A-Za-z0-9-]+)*\\.[A-Za-z]{2,})',
    '(?<url>(?:https?:\\/\\/|www\\.)[^\\s<>"\'`]+)',
    '(?<domain>(?<![@\\w.\\/-])(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\\.)+(?:com|vn|net|org|io|info|biz|edu|gov|asia)(?:\\.vn)?(?![\\w-]|\\.\\w)(?:\\/[^\\s<>"\'`]*)?)',
    '(?<phone>(?<![\\w+.\\/-])(?:\\+84|0084|0)(?:[ .\\-]?\\d){8,10}(?![\\w]))',
    '(?<hotline>(?<![\\w.\\/-])1[89]00(?:[ .\\-]?\\d){4,6}(?![\\w]))',
  ].join('|'), 'gi');

  function trimUrl(u) {
    let out = u.replace(/[.,;:!?…'"”»]+$/, '');
    while (out.endsWith(')') && (out.match(/\(/g) || []).length < (out.match(/\)/g) || []).length) out = out.slice(0, -1);
    return out;
  }

  // Trả về {len, href} của phần đầu dài nhất là số hợp lệ, hoặc null
  function phoneMatch(str, hotline) {
    let digits = '', best = null;
    for (let i = 0; i < str.length; i++) {
      if (!/\d/.test(str[i])) continue;
      digits += str[i];
      if (hotline) {
        if (digits.length === 8 || digits.length === 10) best = { len: i + 1, href: 'tel:' + digits };
        continue;
      }
      let nat = digits;
      if (str.startsWith('+84')) nat = '0' + digits.slice(2);
      else if (str.startsWith('0084')) nat = '0' + digits.slice(4);
      if ((nat.length === 10 && /^0[35789]/.test(nat)) || (nat.length === 11 && /^02/.test(nat))) {
        best = { len: i + 1, href: 'tel:+84' + nat.slice(1) };
      }
    }
    return best;
  }

  function linkParts(text, s) {
    const parts = [];
    let last = 0, found = false, m;
    LINK_RE.lastIndex = 0;
    while ((m = LINK_RE.exec(text))) {
      const g = m.groups;
      let len = m[0].length, href = null;
      if (g.email && s.autoLink) href = 'mailto:' + g.email;
      else if (g.url && s.autoLink) {
        const u = trimUrl(g.url);
        len = u.length;
        if (/^www\.[^.]+\./i.test(u) || /^https?:\/\/[^/\s]+\.[^/\s]+/i.test(u)) href = /^www\./i.test(u) ? 'https://' + u : u;
      } else if (g.domain && s.autoLink) {
        const u = trimUrl(g.domain);
        len = u.length;
        href = 'https://' + u;
      } else if ((g.phone || g.hotline) && s.autoPhone) {
        const pm = phoneMatch(m[0], !!g.hotline);
        if (pm) { len = pm.len; href = pm.href; }
      }
      if (!href) { LINK_RE.lastIndex = m.index + 1; continue; }
      if (m.index > last) parts.push(text.slice(last, m.index));
      parts.push({ text: text.substr(m.index, len), href });
      last = m.index + len;
      LINK_RE.lastIndex = last;
      found = true;
    }
    if (!found) return null;
    if (last < text.length) parts.push(text.slice(last));
    return parts;
  }

  function linkify(root, s, doc) {
    const walker = doc.createTreeWalker(root, 4);
    const nodes = [];
    let t;
    while ((t = walker.nextNode())) nodes.push(t);
    for (const tn of nodes) {
      let skip = false;
      for (let el = tn.parentNode; el && el !== root; el = el.parentNode) {
        if (el.nodeType !== 1) continue;
        if (el.tagName === 'A' || el.tagName === 'CODE' || el.tagName === 'PRE' || isCodeOrPreserved(el)) { skip = true; break; }
      }
      if (skip || !/[@.\d]/.test(tn.data)) continue;
      const parts = linkParts(tn.data, s);
      if (!parts) continue;
      const frag = doc.createDocumentFragment();
      for (const p of parts) {
        if (typeof p === 'string') { frag.appendChild(doc.createTextNode(p)); continue; }
        const a = doc.createElement('a');
        a.setAttribute('href', p.href);
        a.style.setProperty('color', s.linkColor);
        a.textContent = p.text;
        frag.appendChild(a);
      }
      tn.replaceWith(frag);
    }
  }

  function enhance(root, s) {
    const doc = root.ownerDocument;
    if (s.autoList) { splitLines(root, doc); buildLists(root, doc); }
    if (s.autoLink || s.autoPhone) linkify(root, s, doc);
  }

  /* ---------------- API ---------------- */

  function withDefaults(s) { return Object.assign({}, DEFAULTS, s || {}); }

  function wrapperStyle(s) {
    s = withDefaults(s);
    return {
      'font-family': s.fontFamily,
      'font-size': s.fontSize + 'px',
      'color': s.textColor,
      'line-height': String(s.lineHeight),
    };
  }

  function makeWrapper(doc, s) {
    const w = doc.createElement('div');
    css(w, wrapperStyle(s));
    return w;
  }

  /**
   * Làm sạch HTML từ clipboard.
   * @param {string} html
   * @param {Document} doc     tài liệu đích (nơi sẽ chèn)
   * @param {object} settings
   * @param {(html:string)=>Document} parse  hàm parse (tách ra để xử lý Trusted Types)
   * @returns {DocumentFragment}
   */
  function cleanHTML(html, doc, settings, parse) {
    const s = withDefaults(settings);
    const src = parse(html);
    const body = src.body || src.documentElement;
    const ctx = makeCtx(doc, s, body, 16, false, 'paste');
    const tmp = doc.createElement('div');
    transformChildren(body, ctx).forEach(x => tmp.appendChild(x));
    tidy(tmp, s, true);
    enhance(tmp, s);
    return toFragment(tmp, doc);
  }

  /**
   * Dán chữ thuần (Notepad, Zalo, terminal…): mỗi dòng một div, rồi nhận dạng
   * danh sách / link / email / số điện thoại. Giữ khoảng trắng thụt lề.
   */
  function cleanText(text, doc, settings) {
    const s = withDefaults(settings);
    const tmp = doc.createElement('div');
    const lines = String(text).replace(/\r\n?/g, '\n').replace(/\n+$/, '').split('\n');
    let prevBlank = false;
    for (const raw of lines) {
      const line = raw.replace(/\t/g, '    ');
      const d = doc.createElement('div');
      if (!line.trim()) {
        if (prevBlank) continue;
        d.appendChild(doc.createElement('br'));
        prevBlank = true;
      } else {
        d.appendChild(doc.createTextNode(encodeSpaces(line)));
        prevBlank = false;
      }
      tmp.appendChild(d);
    }
    enhance(tmp, s);
    return toFragment(tmp, doc);
  }

  function toFragment(tmp, doc) {
    // Dán một đoạn ngắn (một khối đơn) → chèn liền vào dòng hiện tại
    const kids = [...tmp.childNodes].filter(k => !isBlankText(k));
    if (kids.length === 1 && kids[0].nodeType === 1 && kids[0].tagName === 'DIV' &&
        ORIGIN.get(kids[0]) !== 'code' && !kids[0].getAttribute('style') && !kids[0].querySelector(BLOCK_SELECTOR)) {
      tmp.replaceChildren(...kids[0].childNodes);
    }
    const frag = doc.createDocumentFragment();
    frag.append(...tmp.childNodes);
    return frag;
  }

  /**
   * Chuẩn hóa toàn bộ nội dung một ô soạn thư (contenteditable).
   * Giữ nguyên chữ ký, phần trích dẫn, ảnh, chip của Gmail.
   * @returns {{backup: Node[], lastWrapper: Element|null} | null}  null nếu thư trống
   */
  function normalizeEditor(editor, settings) {
    const s = withDefaults(settings);
    const doc = editor.ownerDocument;
    if (editor.textContent.replace(/[\s ​]/g, '') === '' && !editor.querySelector('img,table')) return null;

    const backup = [...editor.childNodes].map(c => c.cloneNode(true));
    const ctx = makeCtx(doc, s, editor, 13, true, 'editor');
    const tmp = doc.createElement('div');
    transformChildren(editor, ctx).forEach(x => tmp.appendChild(x));
    tidy(tmp, s, true);
    enhance(tmp, s);

    const out = [];
    let wrap = null, lastWrapper = null;
    for (const c of [...tmp.childNodes]) {
      if (isPreserved(c)) { wrap = null; out.push(c); continue; }
      if (!wrap && (isBlankText(c) || (c.nodeType === 1 && c.tagName === 'BR'))) { out.push(c); continue; }
      if (!wrap) { wrap = makeWrapper(doc, s); out.push(wrap); lastWrapper = wrap; }
      wrap.appendChild(c);
    }
    editor.replaceChildren(...out);
    return { backup, lastWrapper };
  }

  const api = { DEFAULTS, cleanHTML, cleanText, normalizeEditor, wrapperStyle, withDefaults, MONO_FAMILY };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  global.GFmt = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
