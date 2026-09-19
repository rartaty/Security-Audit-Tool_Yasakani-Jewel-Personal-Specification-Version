# 🔮 Yasakani Jewel タスクリスト

Yasakani Jewel（npm CLI 配布版）の構築・検証タスクの全体像と完了状況をまとめたチェックリスト。

最終更新: 2026-06-07

---

## ✅ コア配布物（npm パッケージ）

- [x] `package.json` — bin: `yasakani` / `yasakani-jewel`、ゼロ依存、Node >= 16
- [x] `bin/yasakani.js` — CLI ディスパッチャ（`init` / `scan` / `uninstall` / `help`）
- [x] `src/init.js` — 多層インストーラ（層 A: AI 設定ポインタ追記／層 B: git pre-commit／層 C: VS Code 保存時スキャン）
- [x] `src/scan.js` — 自己完結プリフィルタ（init で `.yasakani/scan.js` にコピー）
- [x] `src/uninstall.js` — マーカー区間のみを除去する非破壊アンインストーラ
- [x] `src/jsonc.js` — JSONC（コメント・末尾カンマ・BOM 付き JSON）対応パーサ
- [x] `templates/yasakani-jewel.md` — AI 指示書（システム指示書）
- [x] `templates/yasakanirc` — 3次元ポリシーのデフォルト設定
- [x] `templates/pointer.txt` — 各 AI 設定ファイル末尾に追記するポインタブロック
- [x] `templates/pre-commit` — git フック本体（Yasakani 区間はマーカーで自己管理）
- [x] `README.md` — npm パッケージ README

## ✅ AI 指示書の精緻化（指示書 §1〜§7）

- [x] §1 ハイブリッド原則を明示（決定論スキャナ＋AI＋Human-in-the-Loop）
- [x] §3.1 Indirect Prompt Injection 防御
- [x] §3.2 サプライチェーン汚染対策（タイポスクワッティング / `npm ci`）
- [x] §3.3 暗号・認証ロジック自作の禁止
- [x] §3.4 API 過剰データ返却の排除（DTO 強制）
- [x] §3.5 環境変数スコープ分離
- [x] §3.6 バイパスゾンビ化の防止
- [x] §3.7 コンテナ最小権限化（NIST SP 800-190）
- [x] §3.8 CI/CD パイプライン完全性（SLSA / ビルド改ざん死角）
- [x] §3.9 運用面の死角への助言（FIDO2 / ツール無謬性の否定 / Human-in-the-Loop）
- [x] §7 アウトプット・プロトコルを **6 領域 MECE**（3 レイヤー × 2 状態）に整理
- [x] §7.1 — `checkmaga` 監査レポートの **Markdown ファイル出力**（`checkmaga-reports/`）＋ 全項目網羅列挙テンプレート（監査証跡）
- [x] コマンド定義（`checkmaga` / `whydoubt [ID]` / `incident`）
- [x] AI 誤認バグ防止プロトコル（ファイル名部分一致対策、平仮名 `ちぇくまが` サポート）

## ✅ プリフィルタの改善

- [x] キーワード検知を**語境界マッチ**に変更（`author` → `auth` 等の誤検知を解消）
- [x] 「キーワード ＋ 文字列リテラルが同一行に同居」条件で検知（`function getToken(){}` の誤検知を解消）
- [x] **2 段階の重大度**を導入（⚠️ 警告 = コミット中断 / 🔍 通知 = 非ブロック）
- [x] 依存関係 / `Dockerfile` / CI ワークフロー変更を通知（NIST SP 800-190 等の出典明示）
- [x] Git への個人情報混入防止（メールアドレス・電話番号・郵便番号・住所・ラベル付き氏名/住所等の PII 検知）
- [x] Finding 正規化ユーティリティ（カテゴリ / 重大度 / アクション / 誤検知可能性 / 証跡の標準化）
- [x] 低信頼 Finding を破棄せず、レポートの調査候補として隔離する方針を追加
- [x] レポート末尾に、重複・調査候補・誤検知可能性ラベルの読み方を明記
- [x] Markdown 指示書・プロンプト断片検知（System Prompt / Tool Definitions / network 設定等）
- [x] `yasakani scan <file>` の明示ファイル指定を git リポジトリ内でも直接スキャン
- [x] **2026-06-14**: AI prompt Markdown policy を追加（`prompts/public/**` は通知、`prompts/private/**` / `private/**/system-prompt.md` は commit 禁止、`*.system-prompt.md` は強警告、未分類は分類案内付き停止）
- [x] ロックファイルの整合性ハッシュを行スキャン対象外に（誤発火を遮断）
- [x] クリーン時は完全サイレント（出力なし・exit 0）
- [x] JSONC + BOM 付き `settings.json` のマージ対応
- [x] `code.cmd` / `cursor.cmd` の堅牢な検出と Run on Save 拡張の自動インストール

## ✅ ドキュメント整備

- [x] `README.md` — プロジェクト README（npm CLI 版に全面刷新）
- [x] `yasakani_jewel_specification.md` — システム仕様書
- [x] `yasakani_jewel_capabilities.md` — 防衛能力定義書
- [x] `yasakani_jewel_adr.md` — アーキテクチャ意思決定記録（ADR-001〜007）
- [x] `yasakani_jewel_user_manual.md` — 究極の取扱説明書
- [x] `implementation_plan.md` — 実装計画書（本書と対になる）
- [x] `walkthrough.md` — 検証結果報告書
- [x] 出典文書との整合（`ai_security_guide_personal.md` / `ai_security_redteam_analysis.md` / `ai_security_check_guide.md`）
- [x] 第三者検証用の共有ルール（生レポート・スクショ・差分・`.env` 共有禁止、redacted 版のみ許可）

## ✅ 検証

- [x] 構文チェック（全 JS ファイル `node --check` パス）
- [x] `findKeyword` 単体テスト（10 / 10 合格）
- [x] `findPii` 単体テスト（10 / 10 合格）
- [x] `findings` 単体テスト（正規化 / 重複統合 / 低信頼 report-only の保持）
- [x] `npm run eval` — fixtures 上で blocking TP / TN / FP / FN と notice FP を分離出力
- [x] init E2E（非 git）— `.yasakani/` 配置・AI 設定 5 ファイル生成・`.vscode/settings.json` 生成
- [x] init E2E（git）— `.git/hooks/pre-commit` 設置
- [x] JSONC + BOM 付き既存 `settings.json` のマージ（既存設定・コメント保持）
- [x] git pre-commit による秘密情報コミットの中断（exit 1）
- [x] クリーンコード／旧誤検知ケースのコミット通過（exit 0）
- [x] ファイル種別変更（package.json / Dockerfile）の通知のみ・コミット通過
- [x] `uninstall` による配線除去（ユーザー記述・他フック内容は保持）

## ✅ リポジトリ運用

- [x] `LICENSE` (MIT)
- [x] `CHANGELOG.md` (Keep a Changelog 形式)
- [x] `.gitignore` (Node 標準 + `.yasakani/`)
- [x] GitHub Actions CI (`.github/workflows/test.yml` — Node 16 / 18 / 20 / 22)
- [x] 単体テスト (`test/scan.test.js`, `test/findings.test.js`, `npm test`)
- [x] 評価fixtures (`test/fixtures/`, `npm run eval`)
- [x] `cli/` サブディレクトリをリポジトリルートに平準化 (`npx github:` 対応)
- [x] 免責事項を README.md に明示
- [x] `package.json` の `author` 欄を記入 (`rartaty`)
- [x] GitHub リポジトリへの初回 push (`rartaty/Yasakani-Jewel-master`)

## ✅ 実プロジェクト dogfooding

- [x] **2026-05-25**: `projectBigtester/` で初の `checkmaga` 実機監査を完走
  - 対象: 短期銘柄選定・ハイブリッド取引ロジック 完全設計図（自動取引システム設計）
  - ポリシー: PHASE=`design` / SIZE=`M` / ASSET=`financial` → **L3 最高強度**
  - 結果: ❌ 重大欠陥 6 件 / ⚠️ 警告 7 件 / N/A 9 件 / ✅ 検査済 2 件
  - レポート: `projectBigtester/checkmaga-reports/20260525T231151-checkmaga.md`（295 行）
  - リスクボード: `projectBigtester/risktaskboard.md`（RTB-001〜RTB-013 登録）
  - 確認: §7.1 テンプレート全 7 セクション（メタ情報 / MECE 6 領域 / Gap Defenses 9 項目 / 対象ファイル / 検出リスク / Before/After Diff / メタ詳細 / OSI カバレッジ）すべて生成

## 🚀 残タスク

- [x] **P1: `.env` スキャン漏れ修正** — `isScannableFile()` で `.env` / `.env.*` / 通常拡張子を統一判定し、手動 / 保存時スキャン対象に含めた（risktaskboard: YJ-TB-001）
- [x] **P1: 既存 Run on Save への追記修正** — 既存 `emeraldwalk.runonsave.commands` を保持しつつ Yasakani command を追加し、重複追加を防止（risktaskboard: YJ-TB-002）
- [x] **P1: uninstall の非破壊化** — Yasakani command のみ削除し、ユーザー既存 Run on Save 設定を残す（risktaskboard: YJ-TB-003）
- [x] **P2: macOS/Linux CLI 検出修正** — `spawnSync('command', ['-v'])` 依存をやめ、PATH探索で `code` / `cursor` CLIを検出するよう修正（risktaskboard: YJ-TB-004）
- [x] **P2: prompt policy の root 解決修正** — サブディレクトリ実行でも親方向探索で `.yasakani/prompt-policy.json` を拾う（risktaskboard: YJ-TB-005）
- [x] **P3: eval 指標の表示改善** — `blocking FP` と `notice FP` を分けて出力する（risktaskboard: YJ-TB-006）
- [ ] **フレンドのプロジェクトでの dogfooding** — projectBigtester で 1 回完走済み、フレンド案件はこれから。共有は第三者検証用ルールに従う
- [ ] (後回し) PR への Finding 自動コメント — 公開範囲・通知ノイズ・権限/API リスクを整理してから
- [ ] (後回し) 外部 API / Claude filtering — コード外部送信リスクを避けるため初期版では未導入
- [ ] (後回し) 複雑な hard exclusion / confidence 設定 — 見逃しと設定複雑化のリスクがあるため、測定基盤を先に育てる
- [ ] (任意) npm 名前空きの確認 → `npm publish` で public 公開
- [x] GitHub Actions の SHA pin（指示書 §3.8 自己適用 — `actions/checkout` と `actions/setup-node` を v4 系統のコミット SHA に固定）
