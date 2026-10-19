const $ = (id) => document.getElementById(id);
const paper = $('paper');
const editor = $('editable');
const overlay = $('cropOverlay');
const controls = {
  fontFamily: $('fontFamily'), fontSize: $('fontSize'), lineHeight: $('lineHeight'),
  paragraphGap: $('paragraphGap'), paperSize: $('paperSize'), marginX: $('marginX'),
  marginY: $('marginY'), zoom: $('zoom')
};
const pageSizes = { a4: [210, 297], letter: [215.9, 279.4] };
const defaults = { fontFamily: 'Arial, Helvetica, sans-serif', fontSize: 10.5, lineHeight: 1.25, paragraphGap: 6, paperSize: 'a4', left: 17, right: 17, top: 16, bottom: 16, zoom: .8 };
let settings = { ...defaults };
let cropActive = false;
let currentFile = 'Sample resume';
let updateTimer;
let fitUndo = null;
let importedBaseline = null;
let comparison = null;

function sampleResume() {
  editor.innerHTML = `<h1>Alex Morgan</h1><p>Product Designer &nbsp;·&nbsp; San Francisco, CA &nbsp;·&nbsp; alex.morgan@email.com &nbsp;·&nbsp; (415) 555-0148</p><p>Portfolio: alexmorgan.design &nbsp;·&nbsp; LinkedIn: linkedin.com/in/alexmorgan</p><h2>Profile</h2><p>Product designer with 7+ years of experience turning complex problems into clear, useful digital experiences. Strong in discovery, systems thinking, and shipping thoughtful work with cross-functional teams.</p><h2>Experience</h2><h3>Senior Product Designer · Northstar Labs</h3><p><em>2021 – Present &nbsp; | &nbsp; San Francisco, CA</em></p><ul><li>Led design for a self-serve analytics platform used by 40,000+ customers, improving activation by 28%.</li><li>Built a component library that reduced design and engineering handoff time across four product teams.</li><li>Partnered with research and product to simplify onboarding, increasing completion from 61% to 84%.</li></ul><h3>Product Designer · Frame & Co.</h3><p><em>2018 – 2021 &nbsp; | &nbsp; New York, NY</em></p><ul><li>Designed core collaboration features for a workspace product from early concept through launch.</li><li>Ran interviews and usability studies that shaped the roadmap for a major navigation redesign.</li><li>Created responsive patterns and accessibility standards adopted across the product.</li></ul><h3>UX Designer · Studio Row</h3><p><em>2016 – 2018 &nbsp; | &nbsp; Brooklyn, NY</em></p><ul><li>Produced websites and digital products for clients in education, culture, and retail.</li></ul><h2>Education</h2><p><strong>BFA, Communication Design</strong> · Pratt Institute, 2016</p><h2>Skills</h2><p>Product strategy · Interaction design · Design systems · User research · Prototyping · Figma · HTML & CSS</p>`;
}

function showMessage(message, success = false) {
  const el = $('message');
  el.textContent = message;
  el.classList.toggle('success', success);
}
function valueLabel(key) {
  if (key === 'fontSize') return `${Number(settings.fontSize).toFixed(settings.fontSize % 1 ? 2 : 0).replace(/0$/, '').replace(/\.$/, '')} pt`;
  if (key === 'lineHeight') return Number(settings.lineHeight).toFixed(2).replace(/0$/, '').replace(/\.$/, '');
  if (key === 'paragraphGap') return `${settings.paragraphGap} pt`;
  return `${settings[key]} mm`;
}
function applySettings() {
  const [width, height] = pageSizes[settings.paperSize];
  paper.style.width = `${width}mm`;
  paper.style.height = `${height}mm`;
  paper.style.transform = `scale(${settings.zoom})`;
  $('paperWrap').style.width = `${width * 96 / 25.4 * settings.zoom}px`;
  $('paperWrap').style.height = `${height * 96 / 25.4 * settings.zoom}px`;
  editor.style.fontFamily = settings.fontFamily;
  editor.style.fontSize = `${settings.fontSize}pt`;
  editor.style.lineHeight = settings.lineHeight;
  editor.style.setProperty('--paragraph-gap', `${settings.paragraphGap}pt`);
  for (const edge of ['left', 'right', 'top', 'bottom']) {
    editor.style[edge] = `${settings[edge]}mm`;
    overlay.style[edge] = `${settings[edge]}mm`;
  }
  for (const key of ['fontSize', 'lineHeight', 'paragraphGap']) $(`${key}Value`).textContent = valueLabel(key);
  $('marginXValue').textContent = `${Math.round((settings.left + settings.right) / 2)} mm`;
  $('marginYValue').textContent = `${Math.round((settings.top + settings.bottom) / 2)} mm`;
  document.querySelector('style[data-print-page]')?.remove();
  const printStyle = document.createElement('style');
  printStyle.dataset.printPage = '';
  printStyle.textContent = `@media print { @page { size: ${settings.paperSize === 'a4' ? 'A4' : 'letter'}; margin: ${settings.top}mm ${settings.right}mm ${settings.bottom}mm ${settings.left}mm; } }`;
  document.head.appendChild(printStyle);
  scheduleFitCheck();
}
function syncControls() {
  controls.fontFamily.value = settings.fontFamily;
  controls.fontSize.value = settings.fontSize;
  controls.lineHeight.value = settings.lineHeight;
  controls.paragraphGap.value = settings.paragraphGap;
  controls.paperSize.value = settings.paperSize;
  controls.marginX.value = Math.round((settings.left + settings.right) / 2);
  controls.marginY.value = Math.round((settings.top + settings.bottom) / 2);
  controls.zoom.value = settings.zoom;
}
function fitMetrics() {
  const available = editor.clientHeight;
  const used = editor.scrollHeight;
  const pages = Math.max(1, Math.ceil((used - 2) / Math.max(available, 1)));
  const fits = used <= available + 2;
  const linePixels = parseFloat(getComputedStyle(editor).lineHeight) || 16;
  return { available, used, pages, fits, overflowLines: Math.max(0, Math.ceil((used - available - 2) / linePixels)) };
}
function renderPagePreviews(pages, available) {
  const previews = $('pagePreviews');
  previews.replaceChildren();
  const [width, height] = pageSizes[settings.paperSize];
  const scaledHeight = height * 96 / 25.4 * settings.zoom;
  const gap = 42;
  const shownPages = Math.min(pages, 12);
  $('paperWrap').style.height = `${shownPages * scaledHeight + (shownPages - 1) * gap + (pages > shownPages ? 34 : 0)}px`;
  if (pages === 1) return;

  const fragment = document.createDocumentFragment();
  for (let index = 1; index < shownPages; index++) {
    const top = index * (scaledHeight + gap);
    const label = document.createElement('div');
    label.className = 'page-preview-label';
    label.style.top = `${top - 27}px`;
    label.textContent = `Page ${index + 1} · preview only`;

    const nextPaper = document.createElement('div');
    nextPaper.className = 'paper paper-preview';
    nextPaper.style.cssText = `top:${top}px;width:${width}mm;height:${height}mm;transform:scale(${settings.zoom})`;
    const copy = document.createElement('div');
    copy.className = 'resume-content page-copy';
    copy.style.fontFamily = settings.fontFamily;
    copy.style.fontSize = `${settings.fontSize}pt`;
    copy.style.lineHeight = settings.lineHeight;
    copy.style.setProperty('--paragraph-gap', `${settings.paragraphGap}pt`);
    for (const edge of ['left', 'right', 'top', 'bottom']) copy.style[edge] = `${settings[edge]}mm`;
    const flow = document.createElement('div');
    flow.className = 'page-copy-flow';
    flow.style.transform = `translateY(-${index * available}px)`;
    flow.innerHTML = editor.innerHTML;
    for (const element of flow.querySelectorAll('[id], [contenteditable]')) {
      element.removeAttribute('id');
      element.removeAttribute('contenteditable');
    }
    copy.append(flow);
    nextPaper.append(copy);
    fragment.append(label, nextPaper);
  }
  if (pages > shownPages) {
    const note = document.createElement('div');
    note.className = 'page-preview-limit';
    note.style.top = `${shownPages * scaledHeight + (shownPages - 1) * gap + 8}px`;
    note.textContent = `Showing the first ${shownPages} of about ${pages} pages`;
    fragment.append(note);
  }
  previews.append(fragment);
}
function checkFit(renderPreview = true) {
  editor.style.overflowY = 'auto';
  const { available, used, pages, fits, overflowLines } = fitMetrics();
  $('pageStatus').textContent = fits ? settings.fontSize < 10 ? '1 page · small text' : 'Fits on one page' : `~${pages} pages · ~${overflowLines} lines over`;
  $('pageBadge').classList.toggle('overflow', !fits);
  $('pageBadge').classList.toggle('small-text', fits && settings.fontSize < 10);
  $('fitDetail').textContent = `${settings.paperSize === 'a4' ? 'A4' : 'US Letter'} · ${fits ? '1 page' : `~${pages} pages`} · ${fits ? `${Math.round(used / Math.max(available, 1) * 100)}% filled` : `~${overflowLines} lines over`} · ${valueLabel('fontSize')}`;
  if (!comparison) $('stageHint').textContent = fits ? '✎ Click anywhere on the page to edit your text' : '✎ Scroll inside page 1 to edit overflow; continuation previews appear below';
  if (renderPreview) renderPagePreviews(pages, available);
  return fits;
}
function scheduleFitCheck() { clearTimeout(updateTimer); updateTimer = setTimeout(checkFit, 60); }
function adaptZoom() {
  const maxWidth = $('stageContent').clientWidth - (innerWidth < 700 ? 20 : 64);
  const paperPx = pageSizes[settings.paperSize][0] * 96 / 25.4;
  const selected = Number(controls.zoom.value);
  settings.zoom = Math.min(selected, Math.max(.35, maxWidth / paperPx));
  applySettings();
}
function setFileName(name) {
  currentFile = name;
  $('documentName').innerHTML = '';
  $('documentName').append(document.createTextNode(name + ' '));
  const span = document.createElement('span'); span.textContent = '•'; $('documentName').append(span, document.createTextNode(' Editable'));
  $('uploadTitle').textContent = name;
  $('uploadSub').textContent = 'Click to replace this document';
}
function clearFitUndo() {
  fitUndo = null;
  $('undoFitBtn').disabled = true;
}
function fitChanges(before, after) {
  const changes = [];
  if (before.paragraphGap !== after.paragraphGap) changes.push(`paragraph gap ${before.paragraphGap} → ${after.paragraphGap} pt`);
  if (before.lineHeight !== after.lineHeight) changes.push(`line spacing ${before.lineHeight} → ${after.lineHeight}`);
  if (['left', 'right', 'top', 'bottom'].some(edge => before[edge] !== after[edge])) changes.push(`margins L/R/T/B ${['left', 'right', 'top', 'bottom'].map(edge => Math.round(before[edge])).join('/')} → ${['left', 'right', 'top', 'bottom'].map(edge => Math.round(after[edge])).join('/')} mm`);
  if (before.fontSize !== after.fontSize) changes.push(`body text ${before.fontSize} → ${after.fontSize} pt`);
  return changes;
}
function showImportedBaseline(show) {
  if (show && !importedBaseline) return;
  if (show) {
    comparison = { html: editor.innerHTML, settings: { ...settings } };
    editor.innerHTML = importedBaseline.html;
    settings = { ...importedBaseline.settings, zoom: settings.zoom };
  } else if (comparison) {
    editor.innerHTML = comparison.html;
    settings = comparison.settings;
    comparison = null;
  }
  editor.contentEditable = String(!show);
  for (const control of Object.values(controls)) if (control !== controls.zoom) control.disabled = show;
  for (const id of ['fitBtn', 'undoFitBtn', 'resetBtn', 'cropBtn', 'exportBtn', 'exportWordBtn']) $(id).disabled = show || (id === 'undoFitBtn' && !fitUndo);
  $('compareBtn').setAttribute('aria-pressed', String(show));
  $('compareBtn').textContent = show ? 'Show edited' : 'Before / after';
  $('stageHint').textContent = show ? 'Imported baseline preview — layout may differ from the original Word file' : '✎ Click anywhere on the page to edit your text';
  syncControls(); applySettings();
}
$('compareBtn').addEventListener('click', () => showImportedBaseline(!comparison));

for (const key of ['fontFamily', 'fontSize', 'lineHeight', 'paragraphGap', 'paperSize']) {
  controls[key].addEventListener('input', () => {
    clearFitUndo();
    settings[key] = ['fontSize', 'lineHeight', 'paragraphGap'].includes(key) ? Number(controls[key].value) : controls[key].value;
    if (key === 'paperSize') adaptZoom(); else applySettings();
  });
}
controls.marginX.addEventListener('input', () => { clearFitUndo(); settings.left = settings.right = Number(controls.marginX.value); applySettings(); });
controls.marginY.addEventListener('input', () => { clearFitUndo(); settings.top = settings.bottom = Number(controls.marginY.value); applySettings(); });
controls.zoom.addEventListener('change', adaptZoom);
editor.addEventListener('input', () => { clearFitUndo(); scheduleFitCheck(); });
addEventListener('resize', adaptZoom);

$('fitBtn').addEventListener('click', () => {
  if (checkFit() && settings.fontSize >= 10) { showMessage('Already fits on one readable page.', true); return; }
  const start = { ...settings };
  if (settings.fontSize < 10) { settings.fontSize = 10; applySettings(); }
  const steps = [
    ['paragraphGap', 0, .5], ['lineHeight', 1.12, .01],
    ['margin', 12, 1], ['fontSize', 10, .25]
  ];
  let fits = checkFit();
  for (const [key, minimum, amount] of steps) {
    if (fits) break;
    const current = key === 'margin' ? Math.min(settings.left, settings.right, settings.top, settings.bottom) : settings[key];
    for (let value = current - amount; value >= minimum - .001; value = Math.round((value - amount) * 100) / 100) {
      if (key === 'margin') for (const edge of ['left', 'right', 'top', 'bottom']) settings[edge] = Math.max(minimum, Math.min(start[edge], value));
      else settings[key] = Math.round(value * 100) / 100;
      applySettings();
      if (checkFit(false)) { fits = true; break; }
    }
    if (fits) break;
  }
  const changes = fitChanges(start, settings);
  if (changes.length) { fitUndo = start; $('undoFitBtn').disabled = false; }
  syncControls();
  checkFit();
  const { overflowLines } = fitMetrics();
  $('fitReport').textContent = `${changes.length ? `Changed: ${changes.join('; ')}. ` : 'No safe adjustments remain. '}${fits ? 'Fits on one page.' : `Still ~${overflowLines} lines over. Shorten the text or export a multi-page PDF.`}`;
  showMessage(fits ? 'Fitted to one readable page. Review the changes below.' : 'A readable one-page fit is not possible with these settings. Shorten text or export a multi-page PDF.', fits);
});
$('undoFitBtn').addEventListener('click', () => {
  if (!fitUndo) return;
  settings = fitUndo;
  clearFitUndo(); syncControls(); adaptZoom();
  $('fitReport').textContent = 'Fit changes undone.';
  showMessage('Fit changes undone.', true);
});
$('resetBtn').addEventListener('click', () => { clearFitUndo(); settings = { ...defaults }; syncControls(); adaptZoom(); $('fitReport').textContent = 'Layout settings reset.'; showMessage('Layout settings reset.', true); });
$('cropBtn').addEventListener('click', () => {
  cropActive = !cropActive;
  paper.classList.toggle('crop-active', cropActive);
  $('cropBtn').setAttribute('aria-pressed', String(cropActive));
  showMessage(cropActive ? 'Drag a green handle to adjust the margins. Measurements update above.' : '', true);
});
for (const handle of document.querySelectorAll('.crop-handle')) {
  handle.addEventListener('pointerdown', (event) => {
    event.preventDefault();
    const edge = handle.dataset.edge;
    const start = edge === 'left' || edge === 'right' ? event.clientX : event.clientY;
    const initial = settings[edge];
    handle.setPointerCapture(event.pointerId);
    const move = (e) => {
      const now = edge === 'left' || edge === 'right' ? e.clientX : e.clientY;
      let delta = (now - start) / (96 / 25.4 * settings.zoom);
      if (edge === 'right' || edge === 'bottom') delta *= -1;
      clearFitUndo();
      settings[edge] = Math.max(6, Math.min(45, Math.round((initial + delta) * 10) / 10));
      syncControls(); applySettings();
    };
    const end = () => { handle.removeEventListener('pointermove', move); handle.removeEventListener('pointerup', end); handle.removeEventListener('pointercancel', end); };
    handle.addEventListener('pointermove', move);
    handle.addEventListener('pointerup', end);
    handle.addEventListener('pointercancel', end);
  });
}

$('exportBtn').addEventListener('click', () => {
  const fits = checkFit();
  document.body.classList.toggle('print-multipage', !fits);
  showMessage(fits ? 'In the print dialog, choose “Save as PDF”.' : 'Exporting a multi-page PDF. In the print dialog, choose “Save as PDF” and check page breaks.', true);
  setTimeout(() => print(), 80);
});
addEventListener('afterprint', () => document.body.classList.remove('print-multipage'));

$('exportWordBtn').addEventListener('click', () => {
  try {
    const blob = createResumeDocx(editor, settings);
    const name = currentFile.replace(/[<>:"/\\|?*\x00-\x1f]/g, '-').trim().replace(/[. ]+$/, '') || 'Resume';
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${name}.docx`;
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    showMessage(`Word file downloaded. Check its layout and page count in Word; it may reflow.${editor.querySelector('img') ? ' Images were not included.' : ''}`, true);
  } catch (error) {
    showMessage(error.message || 'The Word file could not be created.');
  }
});

const dropZone = $('dropZone');
dropZone.addEventListener('click', () => $('fileInput').click());
dropZone.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); $('fileInput').click(); } });
dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.classList.add('dragging'); });
dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragging'));
dropZone.addEventListener('drop', (e) => { e.preventDefault(); dropZone.classList.remove('dragging'); if (e.dataTransfer.files[0]) importFile(e.dataTransfer.files[0]); });
$('fileInput').addEventListener('change', (e) => { if (e.target.files[0]) importFile(e.target.files[0]); e.target.value = ''; });

// DOCX is a ZIP container. Read its XML directly so uploads never leave the browser.
async function unzipEntry(buffer, wanted) {
  const view = new DataView(buffer);
  let end = -1;
  for (let i = buffer.byteLength - 22; i >= Math.max(0, buffer.byteLength - 65557); i--) {
    if (view.getUint32(i, true) === 0x06054b50) { end = i; break; }
  }
  if (end < 0) throw new Error('This is not a valid .docx file.');
  const entries = view.getUint16(end + 10, true);
  let offset = view.getUint32(end + 16, true);
  const decoder = new TextDecoder();
  for (let i = 0; i < entries; i++) {
    if (view.getUint32(offset, true) !== 0x02014b50) break;
    const method = view.getUint16(offset + 10, true);
    const size = view.getUint32(offset + 20, true);
    const nameSize = view.getUint16(offset + 28, true);
    const extraSize = view.getUint16(offset + 30, true);
    const commentSize = view.getUint16(offset + 32, true);
    const localOffset = view.getUint32(offset + 42, true);
    const name = decoder.decode(new Uint8Array(buffer, offset + 46, nameSize));
    if (name === wanted) {
      if (view.getUint32(localOffset, true) !== 0x04034b50) throw new Error('The Word file has a damaged ZIP entry.');
      const localName = view.getUint16(localOffset + 26, true);
      const localExtra = view.getUint16(localOffset + 28, true);
      const start = localOffset + 30 + localName + localExtra;
      const bytes = new Uint8Array(buffer, start, size);
      if (method === 0) return decoder.decode(bytes);
      if (method !== 8 || !('DecompressionStream' in window)) throw new Error('This browser cannot read the compression used by this Word file.');
      const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
      return await new Response(stream).text();
    }
    offset += 46 + nameSize + extraSize + commentSize;
  }
  return null;
}
function descendants(el, localName) { return Array.from(el.getElementsByTagName('*')).filter(x => x.localName === localName); }
function child(el, localName) { return Array.from(el?.children || []).find(x => x.localName === localName); }
function attr(el, localName) { return Array.from(el?.attributes || []).find(x => x.localName === localName)?.value; }
function appendInline(source, target, relationships) {
  for (const node of source.children) {
    if (node.localName === 'r') {
      let out = document.createDocumentFragment();
      for (const part of node.children) {
        if (part.localName === 't' || part.localName === 'instrText') out.append(document.createTextNode(part.textContent));
        else if (part.localName === 'tab') out.append(document.createTextNode('    '));
        else if (part.localName === 'br' || part.localName === 'cr') out.append(document.createElement('br'));
      }
      const props = child(node, 'rPr');
      const formats = [['b','strong'], ['i','em'], ['u','u']];
      for (const [wordTag, htmlTag] of formats) {
        const format = child(props, wordTag);
        if (format && attr(format, 'val') !== '0' && attr(format, 'val') !== 'false') {
          const wrap = document.createElement(htmlTag); wrap.append(out); out = wrap;
        }
      }
      target.append(out);
    } else if (node.localName === 'hyperlink') {
      const href = relationships.get(attr(node, 'id'));
      const link = href ? document.createElement('a') : target;
      if (href) { link.href = href; link.rel = 'noopener noreferrer'; }
      appendInline(node, link, relationships);
      if (href) target.append(link);
    } else if (node.localName === 'smartTag' || node.localName === 'sdt' || node.localName === 'ins') {
      appendInline(node, target, relationships);
    }
  }
}
function convertParagraph(source, index, relationships, numbering, allowList = true) {
  const props = child(source, 'pPr');
  const style = attr(child(props, 'pStyle'), 'val') || '';
  const numPr = child(props, 'numPr');
  const numId = attr(child(numPr, 'numId'), 'val');
  const list = allowList && (numPr || /listbullet|listnumber|listparagraph/i.test(style));
  const heading = /heading\s*1|title/i.test(style) ? 'h1' : /heading\s*2|subtitle/i.test(style) ? 'h2' : /heading\s*3/i.test(style) ? 'h3' : list ? 'li' : 'p';
  const element = document.createElement(heading);
  appendInline(source, element, relationships);
  if (heading === 'li') element.dataset.listType = /listnumber/i.test(style) || numbering.get(numId) === 'decimal' ? 'ol' : 'ul';
  if (index === 0 && heading === 'p' && element.textContent.trim().length < 70) {
    const first = document.createElement('h1'); first.append(...element.childNodes); return first;
  }
  return element;
}
function convertTable(source, relationships, numbering) {
  const table = document.createElement('table');
  for (const row of Array.from(source.children).filter(x => x.localName === 'tr')) {
    const tr = document.createElement('tr');
    for (const cell of Array.from(row.children).filter(x => x.localName === 'tc')) {
      const td = document.createElement('td');
      for (const p of Array.from(cell.children).filter(x => x.localName === 'p')) td.append(convertParagraph(p, -1, relationships, numbering, false));
      tr.append(td);
    }
    table.append(tr);
  }
  return table;
}
async function importFile(file) {
  if (comparison) showImportedBaseline(false);
  if (!/\.docx$/i.test(file.name)) { showMessage('Please choose a .docx Word file. Older .doc files need to be saved as .docx first.'); return; }
  if (file.size > 15 * 1024 * 1024) { showMessage('Please choose a Word file smaller than 15 MB.'); return; }
  showMessage('Reading your Word file…', true);
  try {
    const buffer = await file.arrayBuffer();
    const [xml, relsXml, numberingXml] = await Promise.all([
      unzipEntry(buffer, 'word/document.xml'),
      unzipEntry(buffer, 'word/_rels/document.xml.rels'),
      unzipEntry(buffer, 'word/numbering.xml')
    ]);
    if (!xml) throw new Error('This file does not contain a Word document.');
    const doc = new DOMParser().parseFromString(xml, 'application/xml');
    if (doc.querySelector('parsererror')) throw new Error('The Word document XML could not be read.');
    const body = descendants(doc, 'body')[0];
    if (!body) throw new Error('The Word document has no editable body.');
    const relationships = new Map();
    if (relsXml) {
      const rels = new DOMParser().parseFromString(relsXml, 'application/xml');
      for (const rel of descendants(rels, 'Relationship')) {
        const target = rel.getAttribute('Target') || '';
        if (/^(https?:|mailto:)/i.test(target)) relationships.set(rel.getAttribute('Id'), target);
      }
    }
    const numbering = new Map();
    if (numberingXml) {
      const numDoc = new DOMParser().parseFromString(numberingXml, 'application/xml');
      const formats = new Map(descendants(numDoc, 'abstractNum').map(n => [attr(n, 'abstractNumId'), attr(descendants(n, 'numFmt')[0], 'val')]));
      for (const n of descendants(numDoc, 'num')) numbering.set(attr(n, 'numId'), formats.get(attr(child(n, 'abstractNumId'), 'val')));
    }
    const result = document.createDocumentFragment();
    let paragraphIndex = 0;
    let currentList = null;
    for (const item of body.children) {
      if (item.localName === 'p') {
        const converted = convertParagraph(item, paragraphIndex++, relationships, numbering);
        if (converted.localName === 'li') {
          const type = converted.dataset.listType;
          delete converted.dataset.listType;
          if (!currentList || currentList.localName !== type) { currentList = document.createElement(type); result.append(currentList); }
          currentList.append(converted);
        } else { currentList = null; result.append(converted); }
      } else if (item.localName === 'tbl') { currentList = null; result.append(convertTable(item, relationships, numbering)); }
    }
    if (!result.textContent.trim()) throw new Error('No text was found in this Word file.');
    editor.replaceChildren(result);
    setFileName(file.name.replace(/\.docx$/i, ''));
    clearFitUndo();
    importedBaseline = { html: editor.innerHTML, settings: { ...settings } };
    adaptZoom();
    const warnings = [];
    if (descendants(body, 'drawing').length || descendants(body, 'pict').length) warnings.push('images and shapes were not imported');
    if (descendants(body, 'tbl').length) warnings.push('check table widths and columns');
    if (descendants(body, 'hyperlink').length && !editor.querySelector('a')) warnings.push('some links may have lost their targets');
    showMessage(`Imported locally. ${warnings.length ? `Please review: ${warnings.join('; ')}.` : 'Compare with your original Word file before sending.'}`, true);
  } catch (error) { showMessage(error.message || 'This Word file could not be opened.'); }
}

sampleResume();
importedBaseline = { html: editor.innerHTML, settings: { ...settings } };
syncControls();
adaptZoom();
