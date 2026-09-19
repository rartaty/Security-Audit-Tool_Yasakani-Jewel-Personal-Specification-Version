'use strict';

/**
 * 🔮 Yasakani Jewel - Security Pre-Filter Scanner (Zero Daemon / Zero Dependency)
 *
 * Git 差分または変更ファイルから「AI 監査が必要な兆候」のみをコンマ秒で検知する。
 * `yasakani scan` から呼ばれるほか、init により各プロジェクトの
 * `.yasakani/scan.js` へコピーされ、git フック・保存時スキャンから直接実行される。
 *
 * 出力方針: クリーン時は完全サイレント。懸念検知時のみ警告を出し exit 1。
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// 識別子の構成単語 (camelCase / snake_case 分割後) と完全一致で照合するキーワード。
// 部分一致 ("author" が "auth" に当たる等) による誤検知を避けるための分類。
const WORD_KEYWORDS = ['secret', 'password', 'passwd', 'token', 'authorization', 'bearer', 'credential'];

// 区切り文字込みで十分に具体的な句。行内の部分一致で照合してよい。
const PHRASE_KEYWORDS = ['api_key', 'apikey', 'api-key', 'private_key', 'privatekey', 'secret_key', 'access_key', 'process.env'];

const PII_LABEL_PATTERN = /(?:^|[^A-Za-z0-9_])(?:氏名|名前|本名|住所|所在地|連絡先|電話番号|携帯番号|メールアドレス|メール|email|e-mail|mail|address|full[_-]?name|real[_-]?name|phone|tel|mobile)\s*[:=：]\s*(["'`])?[^"'`\s,;{}[\]]{2,}/i;
const EMAIL_PATTERN = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i;
const JP_PHONE_PATTERN = /(?:\+81[-\s]?)?(?:0\d{1,4}[-\s]?\d{1,4}[-\s]?\d{3,4}|0[789]0[-\s]?\d{4}[-\s]?\d{4})/;
const JP_POSTAL_PATTERN = /〒?\s*\d{3}-?\d{4}/;
const JP_ADDRESS_PATTERN = /(?:都|道|府|県).{0,30}(?:市|区|町|村).{0,40}(?:丁目|番地|番|号|[0-9０-９]-[0-9０-９])/;

const SCAN_EXTS = ['.js', '.ts', '.py', '.json', '.env', '.yml', '.yaml', '.md', '.mdx'];
const SKIP_DIRS = ['node_modules', '.git', '.claude', '.idea', '.vscode', '.yasakani'];

const PROMPT_INSTRUCTION_PATTERNS = [
  [/^#\s+.*\b(?:system|developer)\s+prompt\b/i, 'AI system/developer prompt 形式の Markdown'],
  [/^#{1,3}\s*(?:Tool Definitions|Identity Preamble|User Context|available_skills|network_configuration|filesystem_configuration)\b/i, 'AI 実行環境・ツール定義らしきセクション'],
  [/\b(?:SYSTEM OVERRIDE|Ignore previous instructions?|ignore (?:all )?(?:previous|prior) (?:instructions|rules)|do not follow (?:previous|prior) instructions)\b/i, 'プロンプトインジェクション指示'],
  [/\{antml:[A-Za-z_]+\}/, 'Claude 内部ブロック風マーカー'],
  [/\/mnt\/skills\/(?:public|private|examples)\//i, '実行環境の skill パスらしき記述'],
  [/\bAllowed Domains:\s*.+/i, 'ネットワーク許可ドメイン設定らしき記述'],
  [/api\.anthropic\.com\/v1\/messages/i, 'Anthropic API 呼び出し例を含むプロンプト断片'],
];

const DEFAULT_PROMPT_POLICY = {
  public_notice: ['prompts/public/**', '**/prompts/public/**'],
  private_block: [
    'prompts/private/**',
    '**/prompts/private/**',
    'private/system-prompt.md',
    'private/**/system-prompt.md',
    '**/private/system-prompt.md',
    '**/private/**/system-prompt.md',
  ],
  system_prompt_block: ['**/*.system-prompt.md'],
  unknown_prompt: 'block',
};

// シャノン・エントロピー (ランダムなシークレット文字列の検知用)
function calculateEntropy(str) {
  const len = str.length;
  if (len === 0) return 0;
  const freq = {};
  for (let i = 0; i < len; i++) freq[str[i]] = (freq[str[i]] || 0) + 1;
  let entropy = 0;
  for (const ch in freq) {
    const p = freq[ch] / len;
    entropy -= p * Math.log2(p);
  }
  return entropy;
}

// 行を識別子の構成単語へ分解する。
// 英数字以外で分割し、さらに camelCase 境界で分割して小文字化する。
// 例: 'const authToken = ...' -> ['const', 'auth', 'token']
function splitToWords(line) {
  const out = [];
  for (const tok of line.split(/[^A-Za-z0-9]+/)) {
    if (!tok) continue;
    for (const part of tok.replace(/([a-z0-9])([A-Z])/g, '$1 $2').split(' ')) {
      if (part) out.push(part.toLowerCase());
    }
  }
  return out;
}

// キーワード検知。
// 「セキュリティ・キーワードが、文字列リテラルと同一行に在る」場合のみ検知する。
// 単なる識別子の行 (`function getToken(){}`) や、リテラル内にだけ語が在る行
// (`console.log("...password...")`) を誤検知しないため、キーワードはリテラル本体を
// 伏せた「コード部分」に対して照合する。ハードコードされた秘密情報の検出が狙い。
function findKeyword(line) {
  const literals = line.match(/(["'`])(.*?)\1/g);
  if (!literals) return null; // 文字列リテラルが無い行はキーワード単独では検知しない
  const code = line.replace(/(["'`])(.*?)\1/g, '$1$1'); // リテラル本体を伏せる
  const lower = code.toLowerCase();
  for (const ph of PHRASE_KEYWORDS) {
    if (lower.includes(ph)) return ph;
  }
  const words = new Set(splitToWords(code));
  for (const kw of WORD_KEYWORDS) {
    if (words.has(kw)) return kw;
  }
  return null;
}

// 高エントロピー文字列 (APIキー等) の検知
function findHighEntropyLiteral(line) {
  const literals = line.match(/(["'`])(.*?)\1/g);
  if (!literals) return null;
  for (const lit of literals) {
    const raw = lit.slice(1, -1);
    if (/\s/.test(raw)) continue;
    if (/[^\x20-\x7E]/.test(raw)) continue;
    if (raw.length >= 16) {
      const e = calculateEntropy(raw);
      if (e > 3.8) {
        return `極めてランダムな文字列 (シークレットの疑い): "${raw.substring(0, 5)}..." (ランダム度 ${e.toFixed(2)})`;
      }
    }
  }
  return null;
}

function maskPiiSample(sample) {
  return sample
    .replace(EMAIL_PATTERN, '[email]')
    .replace(JP_PHONE_PATTERN, '[phone]')
    .replace(JP_POSTAL_PATTERN, '[postal]')
    .replace(JP_ADDRESS_PATTERN, '[address]')
    .replace(/(["'`]).*?\1/g, '$1[value]$1');
}

function findPii(line) {
  const email = line.match(EMAIL_PATTERN);
  if (email) return `個人情報の可能性: メールアドレス ${maskPiiSample(email[0])}`;

  const phone = line.match(JP_PHONE_PATTERN);
  if (phone) return `個人情報の可能性: 電話番号 ${maskPiiSample(phone[0])}`;

  const postal = line.match(JP_POSTAL_PATTERN);
  if (postal) return `個人情報の可能性: 郵便番号 ${maskPiiSample(postal[0])}`;

  const address = line.match(JP_ADDRESS_PATTERN);
  if (address) return `個人情報の可能性: 住所 ${maskPiiSample(address[0])}`;

  const labeled = line.match(PII_LABEL_PATTERN);
  if (labeled) return `個人情報の可能性: ラベル付き個人情報 ${maskPiiSample(labeled[0])}`;

  return null;
}

function isMarkdownFile(file) {
  return ['.md', '.mdx'].includes(path.extname(file || '').toLowerCase());
}

function isEnvFile(file) {
  const base = path.basename(file || '').toLowerCase();
  return base === '.env' || base.startsWith('.env.');
}

function isScannableFile(file) {
  return isEnvFile(file) || SCAN_EXTS.includes(path.extname(file || '').toLowerCase());
}

function stripMarkdownInlineCode(line) {
  return line.replace(/`[^`\n]*`/g, '');
}

function normalizePolicyPath(file) {
  if (!file) return '';
  let p = String(file);
  try {
    const resolved = path.resolve(file);
    const rel = path.relative(process.cwd(), resolved);
    if (rel && !rel.startsWith('..') && !path.isAbsolute(rel)) p = rel;
  } catch (e) {
    // Keep the original path when resolution is not possible.
  }
  return p.replace(/\\/g, '/').replace(/^\.\//, '').toLowerCase();
}

function escapeRegexChar(ch) {
  return /[.+^${}()|[\]\\]/.test(ch) ? `\\${ch}` : ch;
}

function globToRegExp(pattern) {
  const p = String(pattern || '').replace(/\\/g, '/').replace(/^\.\//, '').toLowerCase();
  let out = '^';
  for (let i = 0; i < p.length;) {
    if (p.startsWith('**/', i)) {
      out += '(?:.*/)?';
      i += 3;
    } else if (p.startsWith('/**/', i)) {
      out += '(?:/.*)?/';
      i += 4;
    } else if (p.startsWith('/**', i) && i + 3 === p.length) {
      out += '(?:/.*)?';
      i += 3;
    } else if (p.startsWith('**', i)) {
      out += '.*';
      i += 2;
    } else if (p[i] === '*') {
      out += '[^/]*';
      i++;
    } else if (p[i] === '?') {
      out += '[^/]';
      i++;
    } else {
      out += escapeRegexChar(p[i]);
      i++;
    }
  }
  return new RegExp(out + '$');
}

function matchesAnyPolicyPath(file, patterns) {
  const target = normalizePolicyPath(file);
  return (patterns || []).some(pattern => globToRegExp(pattern).test(target));
}

function arrayOrDefault(value, fallback) {
  return Array.isArray(value) ? value.filter(v => typeof v === 'string' && v.trim()) : fallback;
}

function findPromptPolicyPath(startDir) {
  let dir;
  try { dir = path.resolve(startDir || process.cwd()); }
  catch (e) { return null; }

  while (true) {
    const candidate = path.join(dir, '.yasakani', 'prompt-policy.json');
    if (fs.existsSync(candidate)) return candidate;

    const parent = path.dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

function getPromptPolicyPath() {
  const localPolicyPath = path.join(__dirname, 'prompt-policy.json');
  if (fs.existsSync(localPolicyPath)) return localPolicyPath;
  return findPromptPolicyPath(process.cwd());
}

function loadPromptPolicy() {
  const policyPath = getPromptPolicyPath();
  let raw = null;
  try { raw = policyPath ? JSON.parse(fs.readFileSync(policyPath, 'utf8')) : null; }
  catch (e) { raw = null; }

  if (!raw || typeof raw !== 'object') return DEFAULT_PROMPT_POLICY;
  return {
    public_notice: arrayOrDefault(raw.public_notice || raw.publicNotice, DEFAULT_PROMPT_POLICY.public_notice),
    private_block: arrayOrDefault(raw.private_block || raw.privateBlock, DEFAULT_PROMPT_POLICY.private_block),
    system_prompt_block: arrayOrDefault(raw.system_prompt_block || raw.systemPromptBlock, DEFAULT_PROMPT_POLICY.system_prompt_block),
    unknown_prompt: raw.unknown_prompt === 'notice' || raw.unknownPrompt === 'notice' ? 'notice' : 'block',
  };
}

function findPromptInstructionReason(line, file) {
  if (file && !isMarkdownFile(file)) return null;
  const target = isMarkdownFile(file) ? stripMarkdownInlineCode(line) : line;
  for (const [pattern, reason] of PROMPT_INSTRUCTION_PATTERNS) {
    if (pattern.test(target)) return reason;
  }
  return null;
}

function classifyPromptInstructionRisk(line, file) {
  const reason = findPromptInstructionReason(line, file);
  if (!reason) return null;

  const policy = loadPromptPolicy();
  const displayPath = normalizePolicyPath(file) || '(unknown path)';
  const base = `AI指示書/プロンプト断片の可能性: ${reason}`;

  if (matchesAnyPolicyPath(file, policy.private_block)) {
    return {
      action: 'block',
      category: 'private',
      message: `${base}。private prompt policy に一致 (${displayPath})。非公開前提のため commit 禁止です。`,
    };
  }
  if (matchesAnyPolicyPath(file, policy.public_notice)) {
    return {
      action: 'notice',
      category: 'public',
      message: `${base}。public prompt policy に一致 (${displayPath})。公開サンプル扱いのため通知のみです。秘密情報・内部制約・実運用 tool schema が残っていないか確認してください。`,
    };
  }
  if (matchesAnyPolicyPath(file, policy.system_prompt_block)) {
    return {
      action: 'block',
      category: 'system-prompt',
      message: `${base}。*.system-prompt.md policy に一致 (${displayPath})。実プロンプトの可能性が高いため強警告です。`,
    };
  }

  const unknownMessage = `${base}。未分類の AI prompt Markdown (${displayPath})。これは公開サンプルですか、private 資産ですか、実 system prompt ですか？ 公開サンプルなら prompts/public/、非公開なら prompts/private/、実プロンプトなら *.system-prompt.md に分類してください。`;
  return {
    action: policy.unknown_prompt === 'notice' ? 'notice' : 'block',
    category: 'unclassified',
    message: unknownMessage,
  };
}

function findPromptInstructionRisk(line, file) {
  const classified = classifyPromptInstructionRisk(line, file);
  return classified ? classified.message : null;
}

function isSkippableLine(s) {
  return !s || s.startsWith('//') || s.startsWith('*') || s.startsWith('#');
}

function shouldSkipLine(s, file) {
  return isSkippableLine(s) && !isMarkdownFile(file);
}

// 警告を出力して exit 1。クリーン時はこの関数を呼ばず、サイレントに exit 0 する。
function warn(reason, mode) {
  const tag = mode ? `プレフィルター (${mode})` : 'プレフィルター';
  console.log('\n======================================================');
  console.log(`⚠️  [Yasakani Jewel ${tag}] 警告を検知しました！`);
  console.log(`👉 原因: ${reason}`);
  console.log('======================================================');
  console.log('💡 AI (Claude 等) との対話で、この警告が出たことを伝えてスキャンしてください。\n');
  process.exit(1);
}

// 通知。コミットはブロックしない (exit しない)。監査が推奨されるファイル種別の
// 変更 (依存関係 / Dockerfile / CI ワークフロー等) に使う。
function notice(reason) {
  console.log(`\n🔍 [Yasakani Jewel] ${reason}`);
  console.log('   -> checkmaga での監査、または AI への相談を推奨します。');
}

// Git 差分スキャン。git が使えない場合のみ false を返す (それ以外は process.exit で終了)。
function runGitDiffScan() {
  let diffText = '';
  try {
    diffText = execSync('git diff --cached', { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'ignore'] }).trim();
    if (!diffText) {
      diffText = execSync('git diff', { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'ignore'] }).trim();
    }
  } catch (err) {
    return false; // git 非対応 -> 呼び出し元でファイル監視へ
  }
  if (!diffText) process.exit(0); // 差分ゼロ -> サイレント

  // 監査推奨ファイルの種別検知 (通知のみ・コミットはブロックしない)
  if (/(package\.json|package-lock\.json|yarn\.lock|pnpm-lock\.yaml)/.test(diffText)) {
    notice('依存関係ファイル (package.json / lockfile) の変更を検知 — サプライチェーン監査を推奨。');
  }
  if (/^\+\+\+ .*Dockerfile/m.test(diffText) || /^\+\+\+ .*(docker-)?compose\.ya?ml/m.test(diffText)) {
    notice('Dockerfile / compose の変更を検知 — コンテナ監査 (NIST SP 800-190) を推奨。');
  }
  if (/^\+\+\+ .*\.github[/\\]workflows[/\\]/m.test(diffText)) {
    notice('CI/CD ワークフロー定義の変更を検知 — パイプライン完全性の確認を推奨。');
  }

  // 追加行のスキャン。+++ ヘッダで対象ファイルを追跡し、ロックファイル
  // (整合性ハッシュが高エントロピー誤検知の元) は行スキャンの対象外とする。
  let currentFile = '';
  for (const line of diffText.split('\n')) {
    if (line.startsWith('+++ ')) {
      currentFile = line.slice(4).replace(/^b\//, '');
      continue;
    }
    if (!line.startsWith('+') || line.startsWith('+++')) continue;
    if (/(package-lock\.json|yarn\.lock|pnpm-lock\.yaml)$/.test(currentFile)) continue;
    const clean = line.substring(1).trim();
    if (shouldSkipLine(clean, currentFile)) continue;
    const promptRisk = classifyPromptInstructionRisk(clean, currentFile);
    if (promptRisk && promptRisk.action === 'notice') notice(`${promptRisk.message} (Markdown 指示書/プロンプト監査)。`);
    else if (promptRisk) warn(`${promptRisk.message} (Markdown 指示書/プロンプト監査)。`);
    const pii = findPii(clean);
    if (pii) warn(`${pii} (Git への個人情報混入防止)。`);
    const kw = findKeyword(clean);
    if (kw) warn(`セキュリティキーワード "${kw}" と文字列リテラルの同居を検知 (ハードコードされた秘密情報の疑い)。`);
    const ent = isMarkdownFile(currentFile) ? null : findHighEntropyLiteral(clean);
    if (ent) warn(ent);
  }
  process.exit(0); // クリーン -> サイレント
}

// Git 非対応環境向けのファイル監視スキャン
function runFileScan(args) {
  let files = [];
  if (args.length > 0) {
    files = args.filter(f => {
      try { return isScannableFile(f) && fs.statSync(f).isFile(); }
      catch (e) { return false; }
    });
  } else {
    const now = Date.now();
    const walk = (dir) => {
      let list;
      try { list = fs.readdirSync(dir); } catch (e) { return; }
      for (const name of list) {
        if (SKIP_DIRS.includes(name)) continue;
        const full = path.join(dir, name);
        let st;
        try { st = fs.statSync(full); } catch (e) { continue; }
        if (st.isDirectory()) walk(full);
        else if (isScannableFile(full) && now - st.mtimeMs < 300000) files.push(full);
      }
    };
    walk(process.cwd());
  }
  if (files.length === 0) process.exit(0);

  for (const file of files) {
    let content;
    try { content = fs.readFileSync(file, 'utf-8'); } catch (e) { continue; }
    const base = path.basename(file);
    if (['package.json', 'package-lock.json', 'pnpm-lock.yaml'].includes(base)) {
      notice(`依存関係ファイル "${base}" の変更を検知 — サプライチェーン監査を推奨。`);
      continue; // ロックファイルの整合性ハッシュを誤検知しないよう行スキャンは省略
    }
    const lines = content.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const clean = lines[i].trim();
      if (shouldSkipLine(clean, file)) continue;
      const promptRisk = classifyPromptInstructionRisk(clean, file);
      if (promptRisk && promptRisk.action === 'notice') notice(`ファイル "${base}" ${i + 1} 行目: ${promptRisk.message} (Markdown 指示書/プロンプト監査)。`);
      else if (promptRisk) warn(`ファイル "${base}" ${i + 1} 行目: ${promptRisk.message} (Markdown 指示書/プロンプト監査)。`, 'Gitなしモード');
      const pii = findPii(clean);
      if (pii) warn(`ファイル "${base}" ${i + 1} 行目: ${pii} (Git への個人情報混入防止)。`, 'Gitなしモード');
      const kw = findKeyword(clean);
      if (kw) warn(`ファイル "${base}" ${i + 1} 行目: キーワード "${kw}" と文字列リテラルの同居を検知。`, 'Gitなしモード');
      const ent = isMarkdownFile(file) ? null : findHighEntropyLiteral(clean);
      if (ent) warn(`ファイル "${base}" ${i + 1} 行目: ${ent}`, 'Gitなしモード');
    }
  }
  process.exit(0); // クリーン -> サイレント
}

function run(args) {
  args = args || process.argv.slice(2);
  if (args.length > 0) runFileScan(args);
  const usedGit = runGitDiffScan();
  if (usedGit === false) runFileScan(args);
}

module.exports = { run, findKeyword, findPii, findPromptInstructionRisk, classifyPromptInstructionRisk, findHighEntropyLiteral, splitToWords, calculateEntropy, isScannableFile, findPromptPolicyPath, getPromptPolicyPath };

if (require.main === module) run();
