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
  printStyle.textContent = `@media print { @page { size: ${settings.paperSize === 'a4' ? 'A4' : 'letter'}; margin: 0; } }`;
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
function checkFit() {
  const available = editor.clientHeight;
  const used = editor.scrollHeight;
  const pages = Math.max(1, Math.ceil((used - 2) / Math.max(available, 1)));
  const fits = used <= available + 2;
  $('pageStatus').textContent = fits ? 'Fits on one page' : `Overflows to ~${pages} pages`;
  $('pageBadge').classList.toggle('overflow', !fits);
  $('fitDetail').textContent = `${settings.paperSize === 'a4' ? 'A4' : 'US Letter'} · ${fits ? '1 page' : `~${pages} pages`} · ${Math.round(used / Math.max(available, 1) * 100)}% filled`;
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

for (const key of ['fontFamily', 'fontSize', 'lineHeight', 'paragraphGap', 'paperSize']) {
  controls[key].addEventListener('input', () => {
    settings[key] = ['fontSize', 'lineHeight', 'paragraphGap'].includes(key) ? Number(controls[key].value) : controls[key].value;
    if (key === 'paperSize') adaptZoom(); else applySettings();
  });
}
controls.marginX.addEventListener('input', () => { settings.left = settings.right = Number(controls.marginX.value); applySettings(); });
controls.marginY.addEventListener('input', () => { settings.top = settings.bottom = Number(controls.marginY.value); applySettings(); });
controls.zoom.addEventListener('change', adaptZoom);
editor.addEventListener('input', scheduleFitCheck);
addEventListener('resize', adaptZoom);

$('fitBtn').addEventListener('click', async () => {
  if (checkFit()) { showMessage('Already fits on one page.', true); return; }
  const start = { ...settings };
  for (let step = 1; step <= 100; step++) {
    settings.fontSize = Math.max(8.5, Math.round((start.fontSize - step * .08) * 4) / 4);
    settings.lineHeight = Math.max(1.06, Math.round((start.lineHeight - step * .004) * 100) / 100);
    settings.paragraphGap = Math.max(0, Math.round((start.paragraphGap - step * .09) * 2) / 2);
    for (const edge of ['left', 'right', 'top', 'bottom']) settings[edge] = Math.max(7, Math.round((start[edge] - step * .14) * 10) / 10);
    applySettings();
    if (checkFit()) { syncControls(); showMessage('Fitted to one page. You can still fine tune every setting.', true); return; }
  }
  syncControls();
  showMessage('This resume is still too long at the smallest readable settings. Edit or shorten the text to finish fitting.');
});
$('resetBtn').addEventListener('click', () => { settings = { ...defaults }; syncControls(); adaptZoom(); showMessage('Layout settings reset.', true); });
$('cropBtn').addEventListener('click', () => {
  cropActive = !cropActive;
  paper.classList.toggle('crop-active', cropActive);
  $('cropBtn').setAttribute('aria-pressed', String(cropActive));
  showMessage(cropActive ? 'Drag a green handle to adjust the usable page area.' : '', true);
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
  checkFit();
  if ($('pageBadge').classList.contains('overflow')) {
    showMessage('The page still overflows. Use “Fit to one page” or shorten the text before exporting.');
    return;
  }
  showMessage('In the print dialog, choose “Save as PDF”.', true);
  setTimeout(() => print(), 80);
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
function appendInline(source, target) {
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
    } else if (node.localName === 'hyperlink' || node.localName === 'smartTag' || node.localName === 'sdt' || node.localName === 'ins') {
      appendInline(node, target);
    }
  }
}
function convertParagraph(source, index, allowList = true) {
  const props = child(source, 'pPr');
  const style = attr(child(props, 'pStyle'), 'val') || '';
  const heading = /heading\s*1|title/i.test(style) ? 'h1' : /heading\s*2|subtitle/i.test(style) ? 'h2' : /heading\s*3/i.test(style) ? 'h3' : allowList && child(props, 'numPr') ? 'li' : 'p';
  const element = document.createElement(heading);
  appendInline(source, element);
  if (index === 0 && heading === 'p' && element.textContent.trim().length < 70) {
    const first = document.createElement('h1'); first.append(...element.childNodes); return first;
  }
  return element;
}
function convertTable(source) {
  const table = document.createElement('table');
  for (const row of Array.from(source.children).filter(x => x.localName === 'tr')) {
    const tr = document.createElement('tr');
    for (const cell of Array.from(row.children).filter(x => x.localName === 'tc')) {
      const td = document.createElement('td');
      for (const p of Array.from(cell.children).filter(x => x.localName === 'p')) td.append(convertParagraph(p, -1, false));
      tr.append(td);
    }
    table.append(tr);
  }
  return table;
}
async function importFile(file) {
  if (!/\.docx$/i.test(file.name)) { showMessage('Please choose a .docx Word file. Older .doc files need to be saved as .docx first.'); return; }
  if (file.size > 15 * 1024 * 1024) { showMessage('Please choose a Word file smaller than 15 MB.'); return; }
  showMessage('Reading your Word file…', true);
  try {
    const xml = await unzipEntry(await file.arrayBuffer(), 'word/document.xml');
    if (!xml) throw new Error('This file does not contain a Word document.');
    const doc = new DOMParser().parseFromString(xml, 'application/xml');
    if (doc.querySelector('parsererror')) throw new Error('The Word document XML could not be read.');
    const body = descendants(doc, 'body')[0];
    if (!body) throw new Error('The Word document has no editable body.');
    const result = document.createDocumentFragment();
    let paragraphIndex = 0;
    let currentList = null;
    for (const item of body.children) {
      if (item.localName === 'p') {
        const converted = convertParagraph(item, paragraphIndex++);
        if (converted.localName === 'li') {
          if (!currentList) { currentList = document.createElement('ul'); result.append(currentList); }
          currentList.append(converted);
        } else { currentList = null; result.append(converted); }
      } else if (item.localName === 'tbl') { currentList = null; result.append(convertTable(item)); }
    }
    if (!result.textContent.trim()) throw new Error('No text was found in this Word file.');
    editor.replaceChildren(result);
    setFileName(file.name.replace(/\.docx$/i, ''));
    adaptZoom();
    showMessage('Imported locally. Check columns, graphics, and special formatting before exporting.', true);
  } catch (error) { showMessage(error.message || 'This Word file could not be opened.'); }
}

sampleResume();
syncControls();
adaptZoom();
