import test from 'node:test';
import assert from 'node:assert/strict';
import { countBy, eraOf, hasPrimarySource, citationCount, loadedHits, scorerDisagreements, asymmetry, partiesOf } from '../scripts/audit-lib.mjs';

test('countBy and eraOf', () => {
  assert.deepEqual([...countBy([{ k: 'a' }, { k: 'b' }, { k: 'a' }], (x) => x.k)], [['a', 2], ['b', 1]]);
  assert.equal(eraOf('1997-04-01'), '1990s');
  assert.equal(eraOf(null), 'unknown');
});

test('source helpers', () => {
  assert.equal(hasPrimarySource([{ type: 'reputable-media' }]), false);
  assert.equal(hasPrimarySource([{ type: 'court' }]), true);
  assert.equal(citationCount('see [1] and [1][3]'), 2);
});

test('loadedHits is whole-word', () => {
  assert.deepEqual(loadedHits('A disastrous plan', ['disastrous']), ['disastrous']);
  assert.deepEqual(loadedHits('Miraculously fine', ['miracle']), []);
});

test('scorerDisagreements', () => {
  const a = { id: 'A', reach: 4, outcome: 2, sustainability: 1, process: 0, delivery: 3 };
  const b = { id: 'B', reach: 4, outcome: 0, sustainability: 2, process: 0, delivery: 3 };
  assert.deepEqual(scorerDisagreements([a, b]), [{ criterion: 'outcome', a: 2, b: 0 }]);
  assert.deepEqual(scorerDisagreements([]), []);
});

test('asymmetry and partiesOf', () => {
  const r = asymmetry([{ benefits: [{ evidence: '[1][2]' }], concerns: [{ evidence: '' }, { evidence: '[1]' }] }]);
  assert.equal(r.avgBenefits, 1);
  assert.equal(r.avgConcerns, 2);
  assert.equal(r.avgEvidencePerBullet, 1);
  assert.deepEqual(partiesOf({ partners: [{ party: 'a', share: 0.7 }, { party: 'b', share: 0 }] }), ['a']);
});
