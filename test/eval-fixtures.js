'use strict';

const fs = require('fs');
const path = require('path');
const scan = require('../src/scan');

const root = path.join(__dirname, 'fixtures');
const sets = [
  { dir: 'true-positive', expected: true },
  { dir: 'false-positive', expected: false },
];

function walk(dir) {
  const out = [];
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) out.push(...walk(full));
    else out.push(full);
  }
  return out.sort();
}

function detectLine(line, file) {
  const promptRisk = scan.classifyPromptInstructionRisk(line, file);
  if (promptRisk) return { rule: 'prompt', action: promptRisk.action, detail: promptRisk.message };
  const pii = scan.findPii(line);
  if (pii) return { rule: 'pii', detail: pii };
  const keyword = scan.findKeyword(line);
  if (keyword) return { rule: 'keyword', detail: keyword };
  const entropy = path.extname(file).toLowerCase() === '.md' ? null : scan.findHighEntropyLiteral(line);
  if (entropy) return { rule: 'entropy', detail: entropy };
  return null;
}

function detectFile(file) {
  const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const found = detectLine(lines[i].trim(), file);
    if (found) return { ...found, line: i + 1 };
  }
  return null;
}

const results = [];
for (const set of sets) {
  const base = path.join(root, set.dir);
  for (const file of walk(base)) {
    const detection = detectFile(file);
    const blockingDetected = Boolean(detection && detection.action !== 'notice');
    const noticeDetected = Boolean(detection && detection.action === 'notice');
    results.push({
      file: path.relative(root, file).replace(/\\/g, '/'),
      expected: set.expected,
      blockingDetected,
      noticeDetected,
      detection,
    });
  }
}

let blockingTp = 0;
let blockingTn = 0;
let blockingFp = 0;
let blockingFn = 0;
let noticeTruePositives = 0;
let noticeFalsePositives = 0;

for (const result of results) {
  if (result.expected && result.blockingDetected) blockingTp++;
  else if (!result.expected && !result.blockingDetected) blockingTn++;
  else if (!result.expected && result.blockingDetected) blockingFp++;
  else blockingFn++;

  if (result.expected && result.noticeDetected) noticeTruePositives++;
  else if (!result.expected && result.noticeDetected) noticeFalsePositives++;
}

const expectedPositiveCount = results.filter(result => result.expected).length;
const expectedNegativeCount = results.length - expectedPositiveCount;
const blockingFalsePositiveRate = expectedNegativeCount === 0 ? 0 : blockingFp / expectedNegativeCount;
const blockingFalseNegativeRate = expectedPositiveCount === 0 ? 0 : blockingFn / expectedPositiveCount;
const noticeFalsePositiveRate = expectedNegativeCount === 0 ? 0 : noticeFalsePositives / expectedNegativeCount;

console.log('Yasakani Jewel fixture evaluation');
console.log('blocking metrics');
console.log(`  true positives : ${blockingTp}`);
console.log(`  true negatives : ${blockingTn}`);
console.log(`  false positives: ${blockingFp}`);
console.log(`  false negatives: ${blockingFn}`);
console.log(`  FP rate        : ${(blockingFalsePositiveRate * 100).toFixed(2)}%`);
console.log(`  FN rate        : ${(blockingFalseNegativeRate * 100).toFixed(2)}%`);
console.log('notice metrics (non-blocking)');
console.log(`  true positives : ${noticeTruePositives}`);
console.log(`  false positives: ${noticeFalsePositives}`);
console.log(`  FP rate        : ${(noticeFalsePositiveRate * 100).toFixed(2)}%`);

for (const result of results) {
  const status = result.expected === result.blockingDetected ? 'OK ' : 'NG ';
  const action = result.detection && result.detection.action ? `:${result.detection.action}` : '';
  const detail = result.detection ? `${result.detection.rule}${action} line ${result.detection.line}` : 'none';
  console.log(`${status} ${result.file} expected=${result.expected} blocking=${result.blockingDetected} notice=${result.noticeDetected} detail=${detail}`);
}

if (blockingFp > 0 || blockingFn > 0) {
  process.exit(1);
}
