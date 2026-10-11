import test from 'node:test';
import assert from 'node:assert/strict';
import { replaceScorersBlock, validateScore } from '../scripts/merge-scores.mjs';

const doc = `---
title: X
scoring:
  era_baseline: base
  scorers:
    - { id: A, reach: 1, outcome: 1, sustainability: 1, process: 1, delivery: 1, note: "old" }
    - { id: B, reach: 2, outcome: 2, sustainability: 2, process: 2, delivery: 2, note: "old" }
sources: []
---
Body text
`;
const s = (id) => ({ id, reach: 4, outcome: 2, sustainability: 1, process: 0, delivery: 3, note: 'n "q"' });

test('replaces only the scorers block', () => {
  const out = replaceScorersBlock(doc, [s('A'), s('B')]);
  assert.ok(out.includes('{ id: A, reach: 4, outcome: 2, sustainability: 1, process: 0, delivery: 3, note: "n \\"q\\"" }'));
  assert.ok(!out.includes('"old"'));
  assert.ok(out.endsWith('sources: []\n---\nBody text\n'));
  assert.ok(out.startsWith('---\ntitle: X\nscoring:\n  era_baseline: base\n  scorers:\n'));
});

test('handles an empty inline list', () => {
  const out = replaceScorersBlock(doc.replace(/    - \{.*\n/g, '').replace('scorers:', 'scorers: []'), [s('A'), s('B')]);
  assert.ok(out.includes('    - { id: B,'));
});

test('rejects out-of-range scores', () => {
  assert.throws(() => validateScore('x', { ...s('A'), reach: 6 }, 'A'));
  assert.throws(() => validateScore('x', { ...s('A'), reach: 1.5 }, 'A'));
});
