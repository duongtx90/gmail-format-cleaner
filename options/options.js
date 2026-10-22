(() => {
  'use strict';
  const G = window.GFmt;
  const $ = id => document.getElementById(id);
  const storage = chrome.storage.sync;
  let settings = Object.assign({}, G.DEFAULTS);

  // Điền danh sách cỡ chữ
  for (let px = 11; px <= 20; px++) $('fontSize').add(new Option(px + 'px', String(px)));
  for (let px = 11; px <= 16; px++) $('codeFontSize').add(new Option(px + 'px', String(px)));

  const selects = ['fontFamily', 'fontSize', 'lineHeight', 'codeFontSize'];
  const colors = ['textColor', 'linkColor'];
  const checks = ['autoCleanPaste', 'detectHeadings', 'keepTextColor', 'keepAlignment', 'codeBackground',
    'showToolbarButton', 'autoList', 'autoLink', 'autoPhone'];

  function ensureOption(sel, value) {
    if (![...sel.options].some(o => o.value === String(value))) sel.add(new Option(String(value), String(value)));
  }

  function fill() {
    selects.forEach(k => { ensureOption($(k), settings[k]); $(k).value = String(settings[k]); });
    colors.forEach(k => { $(k).value = settings[k]; });
    checks.forEach(k => { $(k).checked = !!settings[k]; });
    $('paragraphBlank').checked = settings.paragraphSpacing === 'blank';
  }

  function read() {
    const s = {};
    s.fontFamily = $('fontFamily').value;
    s.fontSize = Number($('fontSize').value);
    s.lineHeight = Number($('lineHeight').value);
    s.codeFontSize = Number($('codeFontSize').value);
    colors.forEach(k => { s[k] = $(k).value; });
    checks.forEach(k => { s[k] = $(k).checked; });
    s.paragraphSpacing = $('paragraphBlank').checked ? 'blank' : 'none';
    return s;
  }

  let savedTimer;
  function save() {
    settings = Object.assign({}, G.DEFAULTS, read());
    storage.set(settings, () => {
      $('saved').textContent = 'Đã lưu';
      clearTimeout(savedTimer);
      savedTimer = setTimeout(() => { $('saved').textContent = ''; }, 1500);
    });
    render();
  }

  document.querySelectorAll('select, input').forEach(el => el.addEventListener('change', save));

  $('reset').addEventListener('click', () => {
    settings = Object.assign({}, G.DEFAULTS);
    fill();
    save();
  });

  /* ---------- Dán thử ---------- */
  const raw = $('raw'), result = $('result'), source = $('source');

  // Nếu vừa dán: hiển thị đúng kết quả của luồng "làm sạch khi dán" trong Gmail.
  // Nếu gõ/sửa thêm: hiển thị kết quả của nút Aa (chuẩn hóa cả thư).
  let lastPaste = null;
  const parse = h => new DOMParser().parseFromString(h, 'text/html');

  function render() {
    let nodes = [];
    if (lastPaste) {
      const w = document.createElement('div');
      const st = G.wrapperStyle(settings);
      for (const k in st) w.style.setProperty(k, st[k]);
      w.append(lastPaste.html ? G.cleanHTML(lastPaste.html, document, settings, parse)
                              : G.cleanText(lastPaste.text, document, settings));
      nodes = [w];
    } else {
      const clone = raw.cloneNode(true);
      clone.removeAttribute('id');
      if (G.normalizeEditor(clone, settings)) nodes = [...clone.childNodes];
    }
    result.replaceChildren(...nodes);
    source.textContent = nodes.length ? result.innerHTML.replace(/></g, '>\n<') : '';
  }

  let t;
  raw.addEventListener('paste', e => {
    const dt = e.clipboardData;
    const html = dt && dt.getData('text/html');
    const text = dt && dt.getData('text/plain');
    lastPaste = html ? { html } : (text ? { text } : null);
    // để trình duyệt dán bản gốc vào khung trái
    setTimeout(render, 0);
  });
  raw.addEventListener('input', e => {
    if (e.inputType === 'insertFromPaste') return;
    lastPaste = null;
    clearTimeout(t); t = setTimeout(render, 150);
  });
  $('clear').addEventListener('click', () => { raw.replaceChildren(); lastPaste = null; render(); raw.focus(); });

  storage.get(G.DEFAULTS, v => {
    settings = Object.assign({}, G.DEFAULTS, v);
    fill();
    render();
  });
})();
