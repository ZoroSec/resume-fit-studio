// Build a small, valid DOCX in the browser. No resume content is sent to a server.
function createResumeDocx(root, settings) {
  const ns = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
  const escape = (value) => String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
  const twips = (mm) => Math.round(mm * 1440 / 25.4);
  const font = settings.fontFamily.split(',')[0].replace(/["']/g, '').trim();
  const size = Math.round(settings.fontSize * 2);
  const line = Math.round(settings.lineHeight * 240);
  const gap = Math.round(settings.paragraphGap * 20);
  const page = settings.paperSize === 'letter' ? [215.9, 279.4] : [210, 297];
  const contentWidth = twips(page[0] - settings.left - settings.right);

  function run(text, format = {}) {
    if (!text) return '';
    const flags = `${format.bold ? '<w:b/>' : ''}${format.italic ? '<w:i/>' : ''}${format.underline ? '<w:u w:val="single"/>' : ''}`;
    const pointSize = format.size ? `<w:sz w:val="${format.size}"/>` : '';
    return `<w:r>${flags || pointSize ? `<w:rPr>${flags}${pointSize}</w:rPr>` : ''}<w:t xml:space="preserve">${escape(format.uppercase ? text.toUpperCase() : text)}</w:t></w:r>`;
  }
  function inlines(node, format = {}) {
    let xml = '';
    for (const child of node.childNodes || []) {
      if (child.nodeType === 3) { xml += run(child.nodeValue, format); continue; }
      if (child.nodeType !== 1) continue;
      const tag = child.tagName.toLowerCase();
      if (tag === 'br') xml += '<w:r><w:br/></w:r>';
      else if (tag !== 'img') xml += inlines(child, {
        ...format,
        bold: format.bold || tag === 'b' || tag === 'strong',
        italic: format.italic || tag === 'i' || tag === 'em',
        underline: format.underline || tag === 'u'
      });
    }
    return xml;
  }
  function paragraph(node, kind = 'p', prefix = '') {
    const heading = kind === 'h1' || kind === 'h2' || kind === 'h3';
    const after = kind === 'h1' ? Math.round(gap / 2) : kind === 'h2' ? gap : gap;
    const before = kind === 'h2' ? gap * 2 : kind === 'h3' ? gap : 0;
    const indent = kind === 'li' ? '<w:ind w:left="360" w:hanging="180"/>' : '';
    const border = kind === 'h2' ? '<w:pBdr><w:bottom w:val="single" w:sz="4" w:color="A8B5AE"/></w:pBdr>' : '';
    const pPr = `<w:pPr>${heading ? '<w:keepNext/>' : ''}<w:spacing w:before="${before}" w:after="${after}" w:line="${line}" w:lineRule="auto"/>${indent}${border}</w:pPr>`;
    const format = kind === 'h1' ? { bold: true, size: Math.round(size * 2.1) } : kind === 'h2' ? { bold: true, size: Math.round(size * 1.04), uppercase: true } : kind === 'h3' ? { bold: true } : {};
    return `<w:p>${pPr}${prefix ? run(prefix) : ''}${inlines(node, format)}</w:p>`;
  }
  function table(node) {
    const rows = [...node.rows];
    const columns = Math.max(1, ...rows.map(row => row.cells.length));
    const cellWidth = Math.floor(contentWidth / columns);
    const grid = '<w:gridCol w:w="' + cellWidth + '"/>'.repeat(columns);
    const body = rows.map(row => `<w:tr>${[...row.cells].map(cell => {
      const blocks = [...cell.children].filter(child => /^(P|DIV|H1|H2|H3)$/.test(child.tagName));
      const content = blocks.length ? blocks.map(child => paragraph(child, child.tagName.toLowerCase())).join('') : paragraph(cell);
      return `<w:tc><w:tcPr><w:tcW w:w="${cellWidth}" w:type="dxa"/></w:tcPr>${content}</w:tc>`;
    }).join('')}</w:tr>`).join('');
    return `<w:tbl><w:tblPr><w:tblW w:w="${contentWidth}" w:type="dxa"/></w:tblPr><w:tblGrid>${grid}</w:tblGrid>${body}</w:tbl>`;
  }
  let body = '';
  for (const node of root.childNodes) {
    if (node.nodeType === 3) { if (node.nodeValue.trim()) body += paragraph({ childNodes: [node] }); continue; }
    if (node.nodeType !== 1) continue;
    const tag = node.tagName.toLowerCase();
    if (tag === 'ul' || tag === 'ol') {
      [...node.children].filter(child => child.tagName === 'LI').forEach((item, index) => {
        body += paragraph(item, 'li', tag === 'ol' ? `${index + 1}. ` : '• ');
      });
    } else if (tag === 'table') body += table(node);
    else if (tag === 'hr') body += '<w:p><w:pPr><w:pBdr><w:bottom w:val="single" w:sz="4"/></w:pBdr></w:pPr></w:p>';
    else body += paragraph(node, tag);
  }
  const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="${ns}"><w:body>${body}<w:sectPr><w:pgSz w:w="${twips(page[0])}" w:h="${twips(page[1])}"/><w:pgMar w:top="${twips(settings.top)}" w:right="${twips(settings.right)}" w:bottom="${twips(settings.bottom)}" w:left="${twips(settings.left)}" w:header="0" w:footer="0" w:gutter="0"/></w:sectPr></w:body></w:document>`;
  const stylesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:styles xmlns:w="${ns}"><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="${escape(font)}" w:hAnsi="${escape(font)}"/><w:sz w:val="${size}"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="${gap}" w:line="${line}" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style></w:styles>`;
  const files = {
    '[Content_Types].xml': '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/></Types>',
    '_rels/.rels': '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>',
    'word/document.xml': documentXml,
    'word/_rels/document.xml.rels': '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>',
    'word/styles.xml': stylesXml
  };
  return zipStored(files);
}

function zipStored(files) {
  const encoder = new TextEncoder();
  const parts = [];
  const central = [];
  const table = Array.from({ length: 256 }, (_, index) => {
    let value = index;
    for (let bit = 0; bit < 8; bit++) value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    return value >>> 0;
  });
  let offset = 0;
  for (const [name, text] of Object.entries(files)) {
    const path = encoder.encode(name);
    const data = encoder.encode(text);
    let crc = 0xffffffff;
    for (const byte of data) crc = table[(crc ^ byte) & 255] ^ (crc >>> 8);
    crc = (crc ^ 0xffffffff) >>> 0;
    const local = new Uint8Array(30 + path.length);
    const lv = new DataView(local.buffer);
    lv.setUint32(0, 0x04034b50, true); lv.setUint16(4, 20, true); lv.setUint16(6, 0x0800, true);
    lv.setUint16(8, 0, true); lv.setUint16(10, 0, true); lv.setUint16(12, 0x0021, true);
    lv.setUint32(14, crc, true); lv.setUint32(18, data.length, true); lv.setUint32(22, data.length, true);
    lv.setUint16(26, path.length, true); local.set(path, 30);
    parts.push(local, data);
    const record = new Uint8Array(46 + path.length);
    const cv = new DataView(record.buffer);
    cv.setUint32(0, 0x02014b50, true); cv.setUint16(4, 20, true); cv.setUint16(6, 20, true);
    cv.setUint16(8, 0x0800, true); cv.setUint16(12, 0, true); cv.setUint16(14, 0x0021, true);
    cv.setUint32(16, crc, true); cv.setUint32(20, data.length, true); cv.setUint32(24, data.length, true);
    cv.setUint16(28, path.length, true); cv.setUint32(42, offset, true); record.set(path, 46);
    central.push(record);
    offset += local.length + data.length;
  }
  const centralSize = central.reduce((sum, record) => sum + record.length, 0);
  const end = new Uint8Array(22);
  const ev = new DataView(end.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(8, central.length, true); ev.setUint16(10, central.length, true);
  ev.setUint32(12, centralSize, true); ev.setUint32(16, offset, true);
  // shortcut: images and live hyperlinks are omitted; add OOXML relationships if those become part of the editor.
  return new Blob([...parts, ...central, end], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
}
