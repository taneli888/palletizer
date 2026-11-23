/*!
 * 极简 XLSX 读写（离线、无第三方库）
 * - 读取：解析 ZIP（stored / deflate-raw）+ 工作表 XML + 共享字符串
 * - 写入：生成 Excel 可直接打开的 xlsx（stored ZIP + inlineStr）
 * 仅覆盖本工具需要的表格能力：文本、数字、加粗表头、列宽、多工作表。
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.XlsxLite = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var enc = new TextEncoder();
  var dec = new TextDecoder('utf-8');

  function decodeXml(s) {
    return String(s)
      .replace(/&#x([0-9a-fA-F]+);/g, function (_, hex) { return String.fromCodePoint(parseInt(hex, 16)); })
      .replace(/&#(\d+);/g, function (_, d) { return String.fromCodePoint(parseInt(d, 10)); })
      .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"').replace(/&apos;/g, "'")
      .replace(/&amp;/g, '&');
  }
  function escapeXml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&apos;');
  }

  /* ------------------------------- ZIP 读 ------------------------------- */

  function findEOCD(dv) {
    var len = dv.byteLength;
    var start = Math.max(0, len - 66000);
    for (var i = len - 22; i >= start; i--) {
      if (dv.getUint32(i, true) === 0x06054b50) return i;
    }
    return -1;
  }

  function u16(dv, o) { return dv.getUint16(o, true); }
  function u32(dv, o) { return dv.getUint32(o, true); }

  async function inflateRaw(bytes) {
    if (typeof DecompressionStream === 'undefined') {
      throw new Error('当前浏览器不支持解压 xlsx，请使用新版 Chrome / Edge。');
    }
    var ds = new DecompressionStream('deflate-raw');
    var stream = new Blob([bytes]).stream().pipeThrough(ds);
    var buf = await new Response(stream).arrayBuffer();
    return new Uint8Array(buf);
  }

  async function unzip(buffer) {
    var bytes = new Uint8Array(buffer);
    var dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    var eocd = findEOCD(dv);
    if (eocd < 0) throw new Error('不是有效的 xlsx 文件（未找到 ZIP 目录）。');
    var count = u16(dv, eocd + 10);
    var cdOff = u32(dv, eocd + 16);
    var map = {};
    var p = cdOff;
    for (var i = 0; i < count; i++) {
      if (u32(dv, p) !== 0x02014b50) break;
      var method = u16(dv, p + 10);
      var compSize = u32(dv, p + 20);
      var nameLen = u16(dv, p + 28);
      var extraLen = u16(dv, p + 30);
      var commentLen = u16(dv, p + 32);
      var localOff = u32(dv, p + 42);
      var name = dec.decode(bytes.subarray(p + 46, p + 46 + nameLen));
      var localNameLen = u16(dv, localOff + 26);
      var localExtraLen = u16(dv, localOff + 28);
      var dataOff = localOff + 30 + localNameLen + localExtraLen;
      var data = bytes.subarray(dataOff, dataOff + compSize);
      if (method === 0) map[name] = data;
      else if (method === 8) map[name] = await inflateRaw(data);
      else throw new Error('不支持的压缩方式：' + method);
      p += 46 + nameLen + extraLen + commentLen;
    }
    return map;
  }

  function readText(files, path) {
    var b = files[path];
    if (!b) return null;
    var s = dec.decode(b);
    return s.charCodeAt(0) === 0xfeff ? s.slice(1) : s;
  }

  /* ------------------------------ XLSX 读 ------------------------------ */

  function attr(tag, name) {
    var m = new RegExp('\\b' + name + '="([^"]*)"').exec(tag);
    return m ? decodeXml(m[1]) : '';
  }
  function colIndex(ref) {
    var m = /^([A-Z]+)/i.exec(ref || '');
    if (!m) return -1;
    var s = m[1].toUpperCase();
    var n = 0;
    for (var i = 0; i < s.length; i++) n = n * 26 + (s.charCodeAt(i) - 64);
    return n - 1;
  }

  function parseSharedStrings(xml) {
    if (!xml) return [];
    var clean = xml.replace(/<rPh\b[\s\S]*?<\/rPh>/g, '');
    var out = [];
    var re = /<si\b[^>]*>([\s\S]*?)<\/si>/g;
    var m;
    while ((m = re.exec(clean))) {
      var inner = m[1];
      var texts = [];
      var tre = /<t\b[^>]*>([\s\S]*?)<\/t>/g;
      var t;
      while ((t = tre.exec(inner))) texts.push(decodeXml(t[1]));
      out.push(texts.join(''));
    }
    return out;
  }

  function parseSheet(xml, shared) {
    var rows = [];
    var rowRe = /<row\b([^>]*)>([\s\S]*?)<\/row>/g;
    var rm;
    var rowSeq = 0;
    while ((rm = rowRe.exec(xml))) {
      var rowAttr = rm[1];
      var rowBody = rm[2];
      var rNum = parseInt(attr(rowAttr, 'r'), 10);
      if (!rNum || !isFinite(rNum)) rNum = rowSeq + 1;
      rowSeq = rNum;
      var row = [];
      var cellRe = /<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g;
      var cm;
      var colSeq = 0;
      while ((cm = cellRe.exec(rowBody))) {
        var cAttr = cm[1];
        var cBody = cm[2] || '';
        var ref = attr(cAttr, 'r');
        var ci = colIndex(ref);
        if (ci < 0) ci = colSeq;
        colSeq = ci + 1;
        var type = attr(cAttr, 't');
        var value = '';
        if (type === 'inlineStr') {
          var tRe = /<t\b[^>]*>([\s\S]*?)<\/t>/g;
          var tm, parts = [];
          while ((tm = tRe.exec(cBody))) parts.push(decodeXml(tm[1]));
          value = parts.join('');
        } else {
          var vm = /<v\b[^>]*>([\s\S]*?)<\/v>/.exec(cBody);
          var raw = vm ? decodeXml(vm[1]) : '';
          if (type === 's') {
            var idx = parseInt(raw, 10);
            value = shared[idx] != null ? shared[idx] : '';
          } else if (type === 'str' || type === 'e') {
            value = raw;
          } else if (type === 'b') {
            value = raw === '1';
          } else {
            if (raw !== '' && isFinite(Number(raw))) value = Number(raw);
            else value = raw;
          }
        }
        while (row.length < ci) row.push('');
        row[ci] = value;
      }
      while (rows.length < rNum - 1) rows.push([]);
      rows[rNum - 1] = row;
    }
    return rows;
  }

  function normalizeTarget(target) {
    if (!target) return '';
    var t = target.replace(/^\.\//, '');
    if (t.charAt(0) === '/') t = t.slice(1);
    if (t.indexOf('xl/') !== 0 && t.indexOf('worksheets/') === 0) t = 'xl/' + t;
    return t;
  }

  async function readWorkbook(buffer) {
    var bytes = new Uint8Array(buffer);
    if (bytes.length > 4 && bytes[0] === 0xD0 && bytes[1] === 0xCF) {
      throw new Error('这是旧版 .xls 文件，请在 Excel 中另存为 .xlsx 后再导入。');
    }
    var files = await unzip(buffer);
    var wbXml = readText(files, 'xl/workbook.xml');
    if (!wbXml) throw new Error('缺少 xl/workbook.xml，文件可能不是标准 xlsx。');
    var relsXml = readText(files, 'xl/_rels/workbook.xml.rels') || '';
    var relMap = {};
    var relRe = /<Relationship\b([^>]*)\/?>/g;
    var rm;
    while ((rm = relRe.exec(relsXml))) {
      var id = attr(rm[1], 'Id');
      var target = attr(rm[1], 'Target');
      if (id && target) relMap[id] = normalizeTarget(target);
    }
    var shared = parseSharedStrings(readText(files, 'xl/sharedStrings.xml'));
    var sheets = [];
    var sheetRe = /<sheet\b([^>]*)\/?>/g;
    var sm, idx = 0;
    while ((sm = sheetRe.exec(wbXml))) {
      idx++;
      var name = attr(sm[1], 'name') || ('Sheet' + idx);
      var rid = attr(sm[1], 'r:id') || attr(sm[1], 'id');
      var path = relMap[rid] || ('xl/worksheets/sheet' + idx + '.xml');
      var xml = readText(files, path);
      if (!xml) continue;
      sheets.push({ name: name, rows: parseSheet(xml, shared) });
    }
    if (!sheets.length) throw new Error('没有读到任何工作表。');
    return { sheets: sheets };
  }

  /* ------------------------------ ZIP 写 ------------------------------ */

  var CRC_TABLE = (function () {
    var t = new Uint32Array(256);
    for (var n = 0; n < 256; n++) {
      var c = n;
      for (var k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
      t[n] = c >>> 0;
    }
    return t;
  })();

  function crc32(bytes) {
    var c = 0xFFFFFFFF;
    for (var i = 0; i < bytes.length; i++) {
      c = CRC_TABLE[(c ^ bytes[i]) & 0xFF] ^ (c >>> 8);
    }
    return (c ^ 0xFFFFFFFF) >>> 0;
  }

  function dosTimeDate(d) {
    var time = ((d.getHours() & 31) << 11) | ((d.getMinutes() & 63) << 5) | ((d.getSeconds() / 2) & 31);
    var date = (((d.getFullYear() - 1980) & 127) << 9) | (((d.getMonth() + 1) & 15) << 5) | (d.getDate() & 31);
    return { time: time, date: date };
  }

  function zipFiles(entries) {
    var now = new Date();
    var dt = dosTimeDate(now);
    var locals = [];
    var centrals = [];
    var offset = 0;
    for (var i = 0; i < entries.length; i++) {
      var nameBytes = enc.encode(entries[i].name);
      var data = entries[i].data;
      var crc = crc32(data);
      var local = new Uint8Array(30 + nameBytes.length + data.length);
      var lv = new DataView(local.buffer);
      lv.setUint32(0, 0x04034b50, true);
      lv.setUint16(4, 20, true);
      lv.setUint16(6, 0x0800, true);
      lv.setUint16(8, 0, true);
      lv.setUint16(10, dt.time, true);
      lv.setUint16(12, dt.date, true);
      lv.setUint32(14, crc, true);
      lv.setUint32(18, data.length, true);
      lv.setUint32(22, data.length, true);
      lv.setUint16(26, nameBytes.length, true);
      lv.setUint16(28, 0, true);
      local.set(nameBytes, 30);
      local.set(data, 30 + nameBytes.length);
      locals.push(local);

      var central = new Uint8Array(46 + nameBytes.length);
      var cv = new DataView(central.buffer);
      cv.setUint32(0, 0x02014b50, true);
      cv.setUint16(4, 20, true);
      cv.setUint16(6, 20, true);
      cv.setUint16(8, 0x0800, true);
      cv.setUint16(10, 0, true);
      cv.setUint16(12, dt.time, true);
      cv.setUint16(14, dt.date, true);
      cv.setUint32(16, crc, true);
      cv.setUint32(20, data.length, true);
      cv.setUint32(24, data.length, true);
      cv.setUint16(28, nameBytes.length, true);
      cv.setUint16(30, 0, true);
      cv.setUint16(32, 0, true);
      cv.setUint16(34, 0, true);
      cv.setUint16(36, 0, true);
      cv.setUint32(38, 0, true);
      cv.setUint32(42, offset, true);
      central.set(nameBytes, 46);
      centrals.push(central);
      offset += local.length;
    }
    var cdSize = centrals.reduce(function (s, c) { return s + c.length; }, 0);
    var eocd = new Uint8Array(22);
    var ev = new DataView(eocd.buffer);
    ev.setUint32(0, 0x06054b50, true);
    ev.setUint16(8, entries.length, true);
    ev.setUint16(10, entries.length, true);
    ev.setUint32(12, cdSize, true);
    ev.setUint32(16, offset, true);
    var total = offset + cdSize + 22;
    var out = new Uint8Array(total);
    var pos = 0;
    locals.forEach(function (b) { out.set(b, pos); pos += b.length; });
    centrals.forEach(function (b) { out.set(b, pos); pos += b.length; });
    out.set(eocd, pos);
    return out;
  }

  /* ------------------------------ XLSX 写 ------------------------------ */

  function colName(n) {
    var s = '';
    n++;
    while (n > 0) {
      var m = (n - 1) % 26;
      s = String.fromCharCode(65 + m) + s;
      n = Math.floor((n - 1) / 26);
    }
    return s;
  }

  function cellXml(value, ref, style, forceText) {
    var sAttr = style ? ' s="' + style + '"' : '';
    if (value == null || value === '') {
      return '<c r="' + ref + '"' + sAttr + '/>';
    }
    if (typeof value === 'number' && isFinite(value) && !forceText) {
      return '<c r="' + ref + '"' + sAttr + '><v>' + value + '</v></c>';
    }
    return '<c r="' + ref + '"' + sAttr + ' t="inlineStr"><is><t xml:space="preserve">' +
      escapeXml(value) + '</t></is></c>';
  }

  function sheetXml(sheet) {
    var rows = sheet.rows || [];
    var cols = sheet.cols || [];
    var out = ['<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
      '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'];
    if (cols.length) {
      out.push('<cols>');
      cols.forEach(function (w, i) {
        out.push('<col min="' + (i + 1) + '" max="' + (i + 1) + '" width="' + w + '" customWidth="1"/>');
      });
      out.push('</cols>');
    }
    out.push('<sheetData>');
    rows.forEach(function (row, ri) {
      out.push('<row r="' + (ri + 1) + '">');
      row.forEach(function (val, ci) {
        out.push(cellXml(val, colName(ci) + (ri + 1), ri === 0 ? 1 : 0));
      });
      out.push('</row>');
    });
    out.push('</sheetData></worksheet>');
    return out.join('');
  }

  var STYLES_XML = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
    '<fonts count="2"><font><sz val="11"/><name val="等线"/></font>' +
    '<font><b/><sz val="11"/><name val="等线"/></font></fonts>' +
    '<fills count="3"><fill><patternFill patternType="none"/></fill>' +
    '<fill><patternFill patternType="gray125"/></fill>' +
    '<fill><patternFill patternType="solid"><fgColor rgb="FFF6EFE2"/><bgColor indexed="64"/></patternFill></fill></fills>' +
    '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>' +
    '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
    '<cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>' +
    '<xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/></cellXfs>' +
    '<cellStyles count="1"><cellStyle name="常规" xfId="0" builtinId="0"/></cellStyles></styleSheet>';

  function writeWorkbook(book) {
    var sheets = book.sheets || [];
    var entries = [];
    var ct = ['<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
      '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">',
      '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>',
      '<Default Extension="xml" ContentType="application/xml"/>',
      '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>',
      '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>'];
    var wbSheets = [];
    var wbRels = [];
    sheets.forEach(function (sheet, i) {
      var n = i + 1;
      var name = 'sheet' + n + '.xml';
      entries.push({ name: 'xl/worksheets/' + name, data: enc.encode(sheetXml(sheet)) });
      ct.push('<Override PartName="/xl/worksheets/' + name + '" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>');
      wbSheets.push('<sheet name="' + escapeXml(sheet.name || ('Sheet' + n)) + '" sheetId="' + n + '" r:id="rId' + n + '"/>');
      wbRels.push('<Relationship Id="rId' + n + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/' + name + '"/>');
    });
    ct.push('</Types>');
    entries.unshift({ name: '[Content_Types].xml', data: enc.encode(ct.join('')) });
    entries.push({ name: 'xl/styles.xml', data: enc.encode(STYLES_XML) });
    entries.push({ name: 'xl/workbook.xml', data: enc.encode(
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" ' +
      'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
      '<sheets>' + wbSheets.join('') + '</sheets></workbook>') });
    entries.push({ name: 'xl/_rels/workbook.xml.rels', data: enc.encode(
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      wbRels.join('') + '</Relationships>') });
    entries.push({ name: '_rels/.rels', data: enc.encode(
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>' +
      '</Relationships>') });
    return zipFiles(entries);
  }

  /* -------------------------------- CSV -------------------------------- */

  function parseCSV(text) {
    text = String(text).replace(/^\uFEFF/, '');
    var rows = [];
    var row = [];
    var field = '';
    var quoted = false;
    for (var i = 0; i < text.length; i++) {
      var ch = text[i];
      if (quoted) {
        if (ch === '"') {
          if (text[i + 1] === '"') { field += '"'; i++; }
          else quoted = false;
        } else field += ch;
      } else if (ch === '"') quoted = true;
      else if (ch === ',') { row.push(field); field = ''; }
      else if (ch === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
      else if (ch === '\r') { /* skip */ }
      else field += ch;
    }
    if (field !== '' || row.length) { row.push(field); rows.push(row); }
    return rows;
  }

  return {
    readWorkbook: readWorkbook,
    writeWorkbook: writeWorkbook,
    parseCSV: parseCSV,
    _zip: zipFiles,
    _unzip: unzip
  };
});
