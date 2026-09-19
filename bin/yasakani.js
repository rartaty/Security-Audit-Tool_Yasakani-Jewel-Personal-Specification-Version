#!/usr/bin/env node
'use strict';

/**
 * 🔮 Yasakani Jewel - CLI エントリポイント
 *   npx yasakani-jewel <command>
 */

const path = require('path');

const HELP = `
🔮 Yasakani Jewel - AI-Native Security Companion

使い方:
  npx yasakani-jewel init        プロジェクトに監査レイヤーを配線
  npx yasakani-jewel scan [file] 手動スキャン (git 差分 / 指定ファイル)
  npx yasakani-jewel uninstall   配線を除去
  npx yasakani-jewel help        このヘルプ

init が自動配線するもの:
  - .yasakani/ に指示書・設定・スキャナを配置
  - CLAUDE.md / GEMINI.md / AGENTS.md / .cursorrules /
    .github/copilot-instructions.md にポインタを追記 (既存内容は保持)
  - git pre-commit フック (git リポジトリの場合)
  - VS Code / Cursor の保存時スキャン設定

配線後は AI チャットで「checkmaga」と入力すると監査が起動します。
`;

function main() {
  const cmd = (process.argv[2] || 'help').toLowerCase();
  const rest = process.argv.slice(3);

  switch (cmd) {
    case 'init':
      require(path.join(__dirname, '..', 'src', 'init')).run(rest);
      break;
    case 'scan':
      require(path.join(__dirname, '..', 'src', 'scan')).run(rest);
      break;
    case 'uninstall':
      require(path.join(__dirname, '..', 'src', 'uninstall')).run(rest);
      break;
    case 'help':
    case '--help':
    case '-h':
      console.log(HELP);
      break;
    default:
      console.error(`[Yasakani Jewel] 不明なコマンド: ${cmd}`);
      console.log(HELP);
      process.exit(1);
  }
}

main();
