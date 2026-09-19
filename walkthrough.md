# 🔮 Yasakani Jewel - 開発完了 ＆ 検証結果報告書 (Walkthrough)

Yasakani Jewel（npm CLI 配布版）の完成時点における成果物の一覧と検証結果。

最終更新: 2026-05-24

---

## 1. 成果物

### 1.1 npm パッケージ `yasakani-jewel`

ゼロ依存・Node.js 16+ で動作する `yasakani-jewel` パッケージ。リポジトリルートが直接 npm パッケージとなっており、`npx github:rartaty/Yasakani-Jewel-master init` でそのまま利用できる（npm 公開後は `npx yasakani-jewel init` の **1 コマンド**）。

| ファイル | 内容 |
| :--- | :--- |
| [package.json](package.json) | パッケージ定義（bin: `yasakani` / `yasakani-jewel`）|
| [bin/yasakani.js](bin/yasakani.js) | CLI ディスパッチャ（`init` / `scan` / `uninstall` / `help`）|
| [src/init.js](src/init.js) | 多層インストーラ（層 A: AI 設定 / 層 B: git フック / 層 C: VS Code）|
| [src/scan.js](src/scan.js) | 自己完結プリフィルタ（init で `.yasakani/scan.js` に配置）|
| [src/uninstall.js](src/uninstall.js) | 配線除去（マーカー区間のみ・非破壊）|
| [src/jsonc.js](src/jsonc.js) | JSONC（コメント・末尾カンマ・BOM 付き JSON）対応パーサ |
| [templates/yasakani-jewel.md](templates/yasakani-jewel.md) | AI 指示書本体（システム指示書）|
| [templates/yasakanirc](templates/yasakanirc) | 3次元ポリシーのデフォルト設定 |
| [templates/pointer.txt](templates/pointer.txt) | AI 設定への追記ポインタブロック |
| [templates/pre-commit](templates/pre-commit) | git フック本体 |
| [LICENSE](LICENSE) | MIT ライセンス |

### 1.2 プロジェクト・ドキュメント

| 文書 | 内容 |
| :--- | :--- |
| [README.md](README.md) | プロジェクト README（クイックスタート・コマンド・防御範囲） |
| [yasakani_jewel_specification.md](yasakani_jewel_specification.md) | システム仕様書（配布方式・3次元ポリシー・9項目の Gap Defenses） |
| [yasakani_jewel_capabilities.md](yasakani_jewel_capabilities.md) | 防衛能力定義書（防げること／できること） |
| [yasakani_jewel_adr.md](yasakani_jewel_adr.md) | ADR-001〜006（ハイブリッド設計／npm CLI 配布／2段階重大度 ほか） |
| [yasakani_jewel_user_manual.md](yasakani_jewel_user_manual.md) | 究極の取扱説明書 |
| [implementation_plan.md](implementation_plan.md) | 実装計画書 |
| [task.md](task.md) | 完了タスクリスト |

### 1.3 検証資産

| 場所 | 内容 |
| :--- | :--- |
| `test-environment/` | あえて脆弱性を仕込んだダミーコード（API 露出・タイポスクワッティング・暗号自作・Docker root 実行 等） |

### 1.4 リポジトリ運用ファイル

| ファイル | 内容 |
| :--- | :--- |
| [CHANGELOG.md](CHANGELOG.md) | リリース履歴（Keep a Changelog 形式） |
| [.gitignore](.gitignore) | Node 標準 + `.yasakani/` |
| [.github/workflows/test.yml](.github/workflows/test.yml) | GitHub Actions CI（Node 16 / 18 / 20 / 22 で `npm test`） |
| [test/scan.test.js](test/scan.test.js) | `findKeyword` の単体テスト |

---

## 2. 検証結果

すべてスクラッチ環境で実機検証済み。

### 2.1 構文チェック

CLI の全 JavaScript ファイル（`bin/yasakani.js` / `src/{init,scan,uninstall,jsonc}.js`）について `node --check` で**構文エラーなし**を確認。

### 2.2 プリフィルタ単体テスト（9 / 9 合格）

`findKeyword` の挙動を 9 ケースで検証し、すべて期待通り。

| 入力 | 期待 | 結果 |
| :--- | :--- | :--- |
| `function getToken() { return 1; }` | 検知せず | ✅ |
| `console.log("type your password here")` | 検知せず | ✅ |
| `const tokenizer = new Tokenizer()` | 検知せず | ✅ |
| `const v = process.env.FOO;` | 検知せず | ✅ |
| `const authorName = "Jane";` | 検知せず | ✅ |
| `const password = "hunter2value";` | `password` | ✅ |
| `const API_KEY = "sk-abc";` | `api_key` | ✅ |
| `const authToken = "abc12345";` | `token` | ✅ |
| `process.env.KEY \|\| "backup-secret"` | `process.env` | ✅ |

### 2.3 init 統合検証（非 git）

非 git のスクラッチプロジェクトで `init` を実行：

- `.yasakani/{yasakani-jewel.md, .yasakanirc, scan.js}` を配置 ✅
- `CLAUDE.md` / `GEMINI.md` / `AGENTS.md` / `.cursorrules` / `.github/copilot-instructions.md` を作成（既存があれば追記） ✅
- `.vscode/settings.json` の生成 ✅
- Run on Save 拡張の自動インストール（`code.cmd` 検出）✅
- 層 B（git フック）は git リポジトリでないため適切にスキップ ✅

### 2.4 JSONC + BOM 既存 `settings.json` のマージ

コメント・末尾カンマ・BOM を含む既存 `settings.json` を事前配置して `init` を実行：

- `emeraldwalk.runonsave` キーの追加 ✅
- 既存設定（`editor.fontSize` 等）の値の保持 ✅
- 既存コメントの保持 ✅
- 全体が有効な JSON として再パース可能 ✅

### 2.5 git 統合検証

git のスクラッチ環境で各種コミットを試行：

| ケース | exit | 期待 | 結果 |
| :--- | :--- | :--- | :--- |
| `function getToken() { ... }` のみ | 0 | 通過 | ✅ |
| `function tokenize() / authorName` のみ | 0 | 通過（旧版は誤発火） | ✅ |
| `const password = "P@ssw0rd-hardcoded-123";` | 1 | コミット中断 | ✅ |
| `package.json` の変更 | 0 | 通知のみ・通過 | ✅ |
| `package-lock.json`（sha512 ハッシュ） | 0 | 通過（ハッシュ誤発火なし） | ✅ |
| `Dockerfile` の変更 | 0 | 通知のみ・通過 | ✅ |

### 2.6 uninstall 検証

`uninstall` 実行で：

- 5 つの AI 設定ファイルのポインタブロックを除去（純粋にポインタしか含まなければファイル削除、ユーザー記述があれば保持） ✅
- `.git/hooks/pre-commit` のマーカー区間のみ除去（他のフック内容があれば保持） ✅
- `.vscode/settings.json` から `emeraldwalk.runonsave` キーのみ除去 ✅
- `.yasakani/` ディレクトリの削除 ✅
- `risktaskboard.md` は監査証跡として保持（明示削除なし） ✅

---

## 3. アーキテクチャ上の到達点

- **クロスプラットフォーム化**: `.bat` / PowerShell を全廃し、Node.js のみで動作（Windows / Mac / Linux 共通）。
- **配布の単純化**: フォルダコピー＋複数手順 → `npx yasakani-jewel init` の **1 コマンド**。手で配置するファイルゼロ。
- **Gap Defenses の拡張**: 初期版 6 項目 → **9 項目**（コンテナ・CI/CD・運用面を追加）。出典文書（redteam analysis / personal guide / check guide）と整合。
- **検知精度の向上**: 部分一致による誤発火（`author` → `auth`、`tokenize` → `token`）を解消し、「キーワード ＋ リテラル同居」で **ハードコード秘密に的を絞る**。
- **2 段階重大度**: ファイル種別変更は通知（非ブロック）、秘密情報のみコミット中断。フックの実用性を確保。
- **MECE フレームワークの正規化**: `checkmaga` 詳細レポートを出典ガイド本来の 3 レイヤー × 2 状態（6 領域）に整理。

---

## 4. 公開前の残タスク

1. `package.json` の `author` 欄を記入
2. npm の名前空きを確認（`yasakani-jewel`）
3. `npm publish`
4. 公開後、未関与のプロジェクトで `npx yasakani-jewel init` の挙動確認

公開後は、誰でも 1 コマンドで導入できる状態となる。
