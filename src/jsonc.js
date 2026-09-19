'use strict';

/**
 * JSONC (コメント・末尾カンマ付き JSON) を標準 JSON 文字列へ変換する。
 * VS Code の settings.json はコメント付きが一般的なため、JSON.parse の前段で使う。
 * 文字列リテラル内の "//" や "/*" はコメントと誤認しないよう保護する。
 */
function stripJsonComments(input) {
  // 先頭 BOM を除去 (JSON.parse は BOM を受け付けないため)
  if (input.charCodeAt(0) === 0xFEFF) input = input.slice(1);
  let out = '';
  let inStr = false;
  let strCh = '';
  let inLine = false;
  let inBlock = false;

  for (let i = 0; i < input.length; i++) {
    const c = input[i];
    const n = input[i + 1];

    if (inLine) {
      if (c === '\n') { inLine = false; out += c; }
      continue;
    }
    if (inBlock) {
      if (c === '*' && n === '/') { inBlock = false; i++; }
      continue;
    }
    if (inStr) {
      out += c;
      if (c === '\\') { out += (n || ''); i++; }
      else if (c === strCh) { inStr = false; }
      continue;
    }
    if (c === '"' || c === "'") { inStr = true; strCh = c; out += c; continue; }
    if (c === '/' && n === '/') { inLine = true; i++; continue; }
    if (c === '/' && n === '*') { inBlock = true; i++; continue; }
    out += c;
  }

  // 末尾カンマ ( , } / , ] ) を除去
  return out.replace(/,(\s*[}\]])/g, '$1');
}

module.exports = { stripJsonComments };
