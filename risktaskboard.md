# 📋 Yasakani Jewel Risk Task Board (リスク管理ボード)

> [!NOTE]
> 本ファイルは Yasakani Jewel (AIセキュリティ監査スキル) が検出したリスクを追跡・管理するための自律タスクボードです。
> AI CLI (Claude Code 等) で `/checkmaga` を実行すると、プロジェクト内のセキュリティリスクが自動でスキャンされ、このボードが更新されます。

---

## 🚦 Bypass Status
* **Bypass Status**: `[DESIGN: OFF, STAGING: OFF, PRODUCTION: OFF]`
  *(⚠️注意: バイパスがONになっている場合、実装に進む前に必ずOFFに戻してください)*

---

## 🚨 Active Risks (未解決のリスク)

| ID | 重大度 | 状態 | 検出日 | 対象 | 内容 | 対応方針 |
|---|---|---|---|---|---|---|
| - | - | 未解決の実装リスクなし | 2026-09-19 | - | 現在記録されている YJ-TB-001 から YJ-TB-006 はすべて解決済み。残作業はフレンド環境での dogfooding と公開前の情報管理確認。 | 新たな検出・運用検証で課題が出た場合のみ追加する。 |

---

## 履歴 (解決済みのリスク)

解決されたリスクはここに監査証跡（履歴）として記録され、安全 of 証明となります。
| ID | 重大度 | 状態 | 検出日 | 解決日 | 対象 | 解決内容 | 検証 |
|---|---|---|---|---|---|---|---|
| - | - | 未解決の実装リスクなし | 2026-09-19 | - | 現在記録されている YJ-TB-001 から YJ-TB-006 はすべて解決済み。残作業はフレンド環境での dogfooding と公開前の情報管理確認。 | 新たな検出・運用検証で課題が出た場合のみ追加する。 |
| YJ-TB-001 | P1 | 解決済み | 2026-06-14 | 2026-06-14 | `src/scan.js` | `isScannableFile()` を追加し、`.env` / `.env.*` / 通常拡張子を手動スキャン・保存時スキャンで統一判定するよう修正。 | `npm test`、`npm run eval`、`node bin/yasakani.js scan .tmp/scan-env-check/.env` で検知を確認。 |
| YJ-TB-002 | P1 | 解決済み | 2026-06-14 | 2026-06-14 | `src/init.js` | 既存 `emeraldwalk.runonsave.commands` を保持し、Yasakani command が未登録の場合だけ追加。再実行時の重複追加を防止。 | `test/init-uninstall.test.js` で既存 command 保持・二重追加なしを確認。 |
| YJ-TB-003 | P1 | 解決済み | 2026-06-14 | 2026-06-14 | `src/uninstall.js` | uninstall 時に Yasakani command のみ削除し、ユーザー既存 Run on Save command は残すよう修正。 | `test/init-uninstall.test.js` でユーザー command が残ることを確認。 |
| YJ-TB-004 | P2 | 解決済み | 2026-06-14 | 2026-06-14 | `src/init.js` | macOS/Linux の CLI 検出を `spawnSync('command', ['-v'])` 依存から PATH 探索へ変更。Windows の `.cmd` / `.exe` / `.bat` 検出と既知インストール先探索も維持。 | `node --check src/init.js`、`node test/init-uninstall.test.js`、`npm test` で POSIX/Windows 注入テストを確認。 |
| YJ-TB-005 | P2 | 解決済み | 2026-06-14 | 2026-06-14 | `src/scan.js` | `prompt-policy.json` をコピー後scanner同階層、または `process.cwd()` から親方向に探索して `.yasakani/prompt-policy.json` を読むよう修正。 | `node --check src/scan.js`、`node test/scan.test.js`、`npm test` でサブディレクトリ実行時のroot policy適用を確認。 |
| YJ-TB-006 | P3 | 解決済み | 2026-06-14 | 2026-06-14 | `test/eval-fixtures.js` | fixture評価の出力を blocking metrics と notice metrics に分離し、noticeをblocking FP/FNに混ぜない意味を明確化。READMEの説明も同期。 | `node --check test/eval-fixtures.js`、`npm run eval`、`npm test` で出力と回帰を確認。 |
