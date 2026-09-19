'use strict';

/**
 * 🔮 Yasakani Jewel - uninstall コマンド
 *
 * init が配線したものを除去する。マーカー区間のみを取り除き、
 * ユーザー自身の記述は保持する。
 */

const fs = require('fs');
const path = require('path');
const { stripJsonComments } = require('./jsonc');

const MARKER_START = '<!-- >>> YASAKANI JEWEL v1';
const MARKER_END = 'YASAKANI JEWEL v1 <<< -->';
const HOOK_MARKER_START = '# >>> YASAKANI JEWEL v1 (pre-commit) >>>';
const HOOK_MARKER_END = '# <<< YASAKANI JEWEL v1 (pre-commit) <<<';

const AI_TARGETS = [
  'CLAUDE.md',
  'GEMINI.md',
  'AGENTS.md',
  '.cursorrules',
  path.join('.github', 'copilot-instructions.md'),
];

function isYasakaniRunOnSaveCommand(command) {
  return Boolean(command && typeof command.cmd === 'string' && command.cmd.includes('.yasakani/scan.js'));
}

function removeYasakaniRunOnSave(runOnSave) {
  if (!runOnSave || typeof runOnSave !== 'object' || Array.isArray(runOnSave)) return runOnSave;
  if (!Array.isArray(runOnSave.commands)) return runOnSave;
  return Object.assign({}, runOnSave, {
    commands: runOnSave.commands.filter(command => !isYasakaniRunOnSaveCommand(command)),
  });
}

function shouldKeepRunOnSave(runOnSave) {
  if (!runOnSave || typeof runOnSave !== 'object' || Array.isArray(runOnSave)) return false;
  if (Array.isArray(runOnSave.commands) && runOnSave.commands.length > 0) return true;
  return Object.keys(runOnSave).some(key => key !== 'commands');
}

function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
function removeBlock(text, startMark, endMark) {
  const re = new RegExp('(\\r?\\n)*' + escapeRe(startMark) + '[\\s\\S]*?' + escapeRe(endMark) + '[^\\r\\n]*', 'g');
  return text.replace(re, '');
}
function readSafe(p) {
  try { return fs.readFileSync(p, 'utf8'); }
  catch (e) { return null; }
}

function run() {
  const root = process.cwd();
  console.log('\n🔮 Yasakani Jewel - uninstall');
  console.log(`対象プロジェクト: ${root}\n`);

  // 層A: AI ツール設定のポインタ除去
  console.log('[層A] AI ツール設定のポインタ除去');
  for (const rel of AI_TARGETS) {
    const p = path.join(root, rel);
    const txt = readSafe(p);
    if (txt === null || !txt.includes(MARKER_START)) continue;
    const cleaned = removeBlock(txt, MARKER_START, MARKER_END);
    if (cleaned.trim().length === 0) {
      fs.unlinkSync(p);
      console.log(`  [ファイル削除] ${rel}`);
    } else {
      fs.writeFileSync(p, cleaned.replace(/\s+$/, '') + '\n');
      console.log(`  [ブロック除去] ${rel}`);
    }
  }

  // 層B: git pre-commit フック
  console.log('[層B] git pre-commit フック除去');
  const hookPath = path.join(root, '.git', 'hooks', 'pre-commit');
  const hook = readSafe(hookPath);
  if (hook !== null && hook.includes(HOOK_MARKER_START)) {
    const cleaned = removeBlock(hook, HOOK_MARKER_START, HOOK_MARKER_END);
    if (cleaned.trim() === '' || cleaned.trim() === '#!/bin/sh') {
      fs.unlinkSync(hookPath);
      console.log('  [ファイル削除] .git/hooks/pre-commit');
    } else {
      fs.writeFileSync(hookPath, cleaned.replace(/\s+$/, '') + '\n');
      console.log('  [ブロック除去] .git/hooks/pre-commit');
    }
  }

  // 層C: .vscode/settings.json の設定除去
  console.log('[層C] .vscode/settings.json の設定除去');
  const settingsPath = path.join(root, '.vscode', 'settings.json');
  const raw = readSafe(settingsPath);
  if (raw !== null) {
    try {
      const parsed = JSON.parse(stripJsonComments(raw));
      if (Object.prototype.hasOwnProperty.call(parsed, 'emeraldwalk.runonsave')) {
        const nextRunOnSave = removeYasakaniRunOnSave(parsed['emeraldwalk.runonsave']);
        if (shouldKeepRunOnSave(nextRunOnSave)) {
          parsed['emeraldwalk.runonsave'] = nextRunOnSave;
        } else {
          delete parsed['emeraldwalk.runonsave'];
        }
        fs.writeFileSync(settingsPath, JSON.stringify(parsed, null, 2) + '\n');
        console.log('  [設定除去] .vscode/settings.json');
      }
    } catch (e) {
      console.log('  [警告] settings.json を解釈できず。emeraldwalk.runonsave を手動で削除してください。');
    }
  }

  // .yasakani/ ディレクトリ
  const yasDir = path.join(root, '.yasakani');
  try {
    fs.rmSync(yasDir, { recursive: true, force: true });
    console.log('  [削除] .yasakani/');
  } catch (e) { /* 無ければ無視 */ }

  console.log('\n✅ アンインストール完了。risktaskboard.md は監査証跡として残しています。\n');
}

module.exports = { run, removeYasakaniRunOnSave, shouldKeepRunOnSave };
