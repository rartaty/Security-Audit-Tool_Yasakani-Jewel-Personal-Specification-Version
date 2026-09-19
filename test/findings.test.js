'use strict';

const assert = require('assert');
const {
  CATEGORIES,
  normalizeFinding,
  mergeFindings,
  formatFalsePositiveLikelihood,
} = require('../src/findings');

const normalized = normalizeFinding({
  category: CATEGORIES.PII,
  ruleId: 'pii.email',
  title: 'Email address in git diff',
  location: { path: 'src/example.js', line: 12 },
  severity: 'high',
  action: 'block',
  falsePositiveLikelihood: 'low',
  evidence: '[email]',
  sources: 'prefilter',
});

assert.strictEqual(normalized.category, CATEGORIES.PII);
assert.strictEqual(normalized.location.path, 'src/example.js');
assert.strictEqual(normalized.location.line, 12);
assert.deepStrictEqual(normalized.evidence, ['[email]']);
assert.deepStrictEqual(normalized.sources, ['prefilter']);

const fallback = normalizeFinding({
  category: 'UNKNOWN',
  severity: 'urgent',
  action: 'drop',
  falsePositiveLikelihood: 'certain',
});

assert.strictEqual(fallback.category, CATEGORIES.OTHER);
assert.strictEqual(fallback.severity, 'medium');
assert.strictEqual(fallback.action, 'report');
assert.strictEqual(fallback.falsePositiveLikelihood, 'unknown');

const merged = mergeFindings([
  {
    category: CATEGORIES.SECRET,
    ruleId: 'secret.keyword',
    title: 'Hardcoded secret',
    location: { path: 'src/app.js', line: 4 },
    severity: 'medium',
    action: 'warn',
    falsePositiveLikelihood: 'high',
    evidence: 'keyword',
    sources: 'prefilter',
  },
  {
    category: CATEGORIES.SECRET,
    ruleId: 'secret.keyword',
    title: 'Hardcoded secret',
    location: { path: 'src/app.js', line: 4 },
    severity: 'critical',
    action: 'block',
    falsePositiveLikelihood: 'low',
    evidence: 'entropy',
    sources: 'manual-review',
  },
]);

assert.strictEqual(merged.length, 1);
assert.strictEqual(merged[0].severity, 'critical');
assert.strictEqual(merged[0].action, 'block');
assert.strictEqual(merged[0].falsePositiveLikelihood, 'low');
assert.deepStrictEqual(merged[0].evidence, ['keyword', 'entropy']);
assert.deepStrictEqual(merged[0].sources, ['prefilter', 'manual-review']);

const reportOnly = mergeFindings([
  {
    category: CATEGORIES.DATA_EXPOSURE,
    ruleId: 'data.possible-overexposure',
    title: 'Possible excessive response',
    location: 'src/controller.js',
    severity: 'medium',
    action: 'report',
    falsePositiveLikelihood: 'high',
  },
]);

assert.strictEqual(reportOnly.length, 1);
assert.strictEqual(reportOnly[0].action, 'report');
assert.strictEqual(
  formatFalsePositiveLikelihood(reportOnly[0].falsePositiveLikelihood),
  'high false-positive likelihood; report-only investigation candidate'
);

console.log('findings tests passed');
