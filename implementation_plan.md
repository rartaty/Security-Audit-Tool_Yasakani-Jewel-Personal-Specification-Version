# Yasakani Jewel (AI-Native Security Companion) 実装計画書

Yasakani Jewel の現行版（npm CLI 配布）の実装計画。

最終更新: 2026-05-24

---

## 1. 目的と前提

`ai_security_guide_personal.md` ／ `ai_security_redteam_analysis.md` ／ `ai_security_check_guide.md` で示された「個人開発者でも国家方針水準のセキュリティを AI で実践する」（Project YATA-Shield / NIST SP 800 シリーズ / 経産省ガイドライン）という方針を、専属チームを持たない個人開発者の実環境に **コスト・負荷・手間ゼロに近い形で** 配備する。

### 1.1 設計原則

- **常駐デーモンなし** — 監視プロセスを置かず、フック／保存イベント／手動のオンデマンド実行のみ。
- **3次元動的ポリシー** — 開発フェーズ × 規模 × アセット重要度で監査強度を動的に引き算。
- **ハイブリッド（決定論 × 確率論）** — 決定論的プリフィルタ（`scan.js`）が「兆候」を検知し、確率論的な AI（Claude 等）が意味論的な監査と修正提案を担う。最終承認は人間が行う（Human-in-the-Loop）。
- **非破壊** — `CLAUDE.md` 等の既存 AI 設定はマーカー付きブロックの追記のみで侵害しない。
- **クロスプラットフォーム** — `.bat` / PowerShell を排し、Node.js のみで動作。

---

## 2. 配布アーキテクチャ

### 2.1 npm パッケージ `yasakani-jewel`

| 構成要素 | 役割 |
| :--- | :--- |
| `bin/yasakani.js` | CLI エントリ（`init` / `scan` / `uninstall` / `help`）|
| `src/init.js` | 多層インストーラ |
| `src/scan.js` | 自己完結プリフィルタ（`init` で `.yasakani/scan.js` にコピー）|
| `src/uninstall.js` | 配線除去 |
| `src/jsonc.js` | JSONC / BOM 対応パーサ |
| `templates/` | 指示書・設定・ポインタ・pre-commit |

導入は単一コマンド `npx yasakani-jewel init`。Node.js 16+ のみを要求し、外部 npm 依存はゼロ。

### 2.2 多層トリガー

| 層 | トリガー | 配線対象 | 前提 |
| :--- | :--- | :--- | :--- |
| A. AIチャット連携 | `checkmaga` 等の入力 | `CLAUDE.md` / `GEMINI.md` / `AGENTS.md` / `.cursorrules` / `.github/copilot-instructions.md` にポインタ追記 | なし |
| B. git pre-commit | `git commit` | `.git/hooks/pre-commit` | git リポジトリ |
| C. 保存時スキャン | Ctrl+S | `.vscode/settings.json` ＋ Run on Save 拡張 | VS Code / Cursor |
| D. 手動 | `yasakani scan` 実行 | なし | なし |

非 git プロジェクトでは層 B のみ非対応。VS Code / Cursor 以外のエディタでは層 C 非対応。**層 A と D はあらゆる環境で動作する保証線**。

### 2.3 プロジェクトに残るフットプリント

```
[プロジェクトルート]
 ├── .yasakani/
 │    ├── yasakani-jewel.md   AI 指示書
 │    ├── .yasakanirc         3次元ポリシー設定
 │    └── scan.js             プリフィルタ
 ├── CLAUDE.md 等              ポインタブロック追記（既存内容は保持）
 ├── .git/hooks/pre-commit    （git の場合）
 └── .vscode/settings.json    （VS Code / Cursor の場合）
```

---

## 3. AI 監査ロジック（指示書）

### 3.1 3次元動的ポリシー

| 軸 | 値 |
| :--- | :--- |
| `DEVELOPMENT_PHASE` | `design` / `staging` / `production` |
| `PROJECT_SIZE` | `S` / `M` / `L` |
| `ASSET_TYPE` | `normal` / `pii` / `financial` |

`.yasakani/.yasakanirc` で宣言。AI は値に応じて監査項目を引き算する。

### 3.2 Gap Defenses（指示書 §3.1〜3.10）

出典文書 — 特に `ai_security_redteam_analysis.md` の 4 死角と `ai_security_guide_personal.md` の NIST SP 800-190 等 — を基盤に計 10 項目を定義。

| # | 項目 | 主な出典 |
| :--- | :--- | :--- |
| 3.1 | Indirect Prompt Injection 防御 | redteam §1 |
| 3.2 | サプライチェーン汚染（Mini Shai-Hulud） | redteam §5 / personal §2.3 |
| 3.3 | 暗号・認証ロジック自作の禁止 | personal §2.3 |
| 3.4 | API 過剰データ返却の排除 | personal §2.1 |
| 3.5 | 環境変数スコープ分離 | personal §2.2 |
| 3.6 | バイパスゾンビ化の防止 | 本ツール独自 |
| 3.7 | コンテナ最小権限化（NIST SP 800-190） | personal §2.2 |
| 3.8 | CI/CD パイプライン完全性（SLSA） | redteam §2 |
| 3.9 | 運用面の死角（認証情報・ツール無謬性） | redteam §3 / §4 |
| 3.10 | Git への個人情報混入防止（PII Leak） | personal / check guide |

### 3.3 MECE 6 領域監査フレームワーク

`checkmaga` の詳細レポートは出典ガイド本来の MECE（3 レイヤー × 2 状態）に従う。

| | 静的（デプロイ前） | 動的（稼働時） |
| :--- | :--- | :--- |
| アプリ層 | OWASP Top10 / BOLA-IDOR / SSDF [NIST SP 800-218] | スマートファジング |
| インフラ層 | IaC / Dockerfile / IAM 最小特権 [NIST SP 800-190] | ログ相関 [NIST SP 800-92] |
| サプライチェーン＆重要情報層 | SBOM / タイポスクワッティング / CUI [SP 800-161 / 57] | プロンプトインジェクション防御・共有公表 [経産省] |

### 3.4 監査レポート出力（`checkmaga` 実行時）

手動強制監査または節目監査の実行時、AI は必ず以下を生成する。

- **保存先**: `checkmaga-reports/YYYYMMDDTHHMMSS-checkmaga.md`（プロジェクトルート相対）
- **管理方針**: **ローカル監査証跡のみ**（`.gitignore` 対象。git 管理外がデフォルト）
- **記載原則**: 検出された懸念だけでなく、検査した **全項目を網羅列挙**（`✅ 検査済 — 問題なし` / `⚠️ 警告` / `❌ 重大` / `N/A — <理由>` のいずれかで必ず埋める。空欄禁止）
- **必須セクション**: メタ情報 → MECE 6 領域 → Gap Defenses 10 項目 → 対象ファイル → 検出リスク → 調査候補（低信頼・非ブロック） → Before/After Diff → メタ詳細
- **低信頼 Finding**: false negative を避けるため破棄しない。PR コメント・外部 API フィルタリング・複雑な hard exclusion は初期版では行わず、ローカルレポート内に隔離して証跡化する。
- **出力方針の明記**: レポート末尾に、重複して見える記載・検出段階の重複許容・調査候補の意味・誤検知可能性ラベルの限界・外部送信しない方針を説明する。
- **最終セクション必須**: **OSI 参照モデル別カバレッジ宣言** を必ず付し、本ツールでカバーできない領域（L1〜L4 / 物理 / 人的 / AI 自身の堅牢性 / 外部監査効力 等）を率直に開示する
- **チャット側出力**: レポートファイルへのリンクと検出リスクの Before/After Diff のみ（重複出力なし）

詳細テンプレートは AI 指示書 §7.1 を参照。

---

## 4. プリフィルタ仕様

### 4.1 検知ロジック

- **ハードコード秘密の検知**: キーワード（`password` / `token` / `secret` / `authorization` / `bearer` / `credential` 等）を**語境界マッチ**（camelCase / snake_case 分解後の単語一致）で照合し、**かつ同一行に文字列リテラルが在る**場合のみ警告。`function getToken(){}` のような正当な識別子では誤発火しない。
- **句キーワード**: `api_key` / `apikey` / `private_key` / `secret_key` / `process.env` 等は行内部分一致。
- **高エントロピー文字列**: 16 文字以上 / エントロピー 3.8 超の文字列リテラルを検知。
- **Markdown 指示書・プロンプト断片検知**: `.md` / `.mdx` の `System Prompt`、`Tool Definitions`、`network_configuration`、`filesystem_configuration`、`Ignore previous instructions`、`{antml:...}` 等を警告。Markdown では通常文書の高エントロピー誤検知を避けるため、汎用エントロピー検知を抑制する。`.yasakani/prompt-policy.json` で `prompts/public/**` は通知、`prompts/private/**` / `private/**/system-prompt.md` は commit 禁止、`*.system-prompt.md` は強警告、未分類は分類案内付き停止にする。
- **ロックファイル除外**: `package-lock.json` 等の整合性ハッシュは行スキャン対象外（誤発火の元を遮断）。

### 4.2 2 段階の重大度

| 種類 | exit | 用途 |
| :--- | :--- | :--- |
| ⚠️ 警告 | 1（コミット中断） | ハードコードされた秘密情報の疑い |
| 🔍 通知 | 0（中断せず） | 依存関係 / `Dockerfile` / CI ワークフロー等の監査推奨ファイルの変更 |

クリーン時は完全サイレント（出力なし・exit 0）。

---

## 5. 検証計画

| ケース | 期待動作 |
| :--- | :--- |
| クリーンなコード | 出力なし・exit 0 |
| `getToken() {}` / `tokenize()` / `authorName` | 旧版で誤発火していたが現行では検知せず通過 |
| `const password = "hunter2value"` | ⚠️ 警告・コミット中断 |
| `# Claude Fable 5 — System Prompt` | ⚠️ 警告・Markdown 指示書/プロンプト監査を促す |
| `package.json` の変更 | 🔍 通知のみ・コミット通過 |
| `package-lock.json`（sha512 ハッシュ） | 🔍 通知のみ・通過（誤発火なし） |
| `Dockerfile` の変更 | 🔍 通知のみ・通過 |
| 非 git プロジェクトでの init | 層 B をスキップし、層 A / C / D を配線 |
| JSONC + BOM 付き既存 `settings.json` | コメント・既存設定を保持してマージ |
| `uninstall` | マーカー区間とユーザー追加分のみ除去 |

検証結果の詳細は [walkthrough.md](walkthrough.md) を参照。

---

## 6. 配布フェーズ

| # | フェーズ | 状態 | 対応 |
| :--- | :--- | :--- | :--- |
| 1 | ローカル検証 | ✅ 完了 | `node bin/yasakani.js init` をスクラッチで実行・全層配線確認 |
| 2 | `package.json` の `author` 記入 | ✅ 完了 | `"author": "rartaty"` |
| 3 | LICENSE / CHANGELOG / CI / 単体テスト整備 | ✅ 完了 | `LICENSE` (MIT) / `CHANGELOG.md` / `.github/workflows/test.yml` / `test/scan.test.js` |
| 4 | GitHub リポジトリへの push | ✅ 完了 | <https://github.com/rartaty/Yasakani-Jewel-master> |
| 5 | GitHub 経由インストールの実機検証 | ✅ 完了 | `npx github:rartaty/Yasakani-Jewel-master init`（スクラッチで 7 秒完走） |
| 6 | **実プロジェクトでの価値検証（dogfooding）** | ⏳ 進行中 | フレンドのプロジェクトで運用 → フィードバック収集 |
| 7 | （任意）npm 名前空き確認 → `npm publish` | ⏸ 保留 | public 配布が必要になった時点で実施 |
| 8 | （任意）GitHub Actions の SHA pin | ⏸ 保留 | 指示書 §3.8 の自己適用 |
