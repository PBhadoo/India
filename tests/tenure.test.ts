import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { daysInOffice, yearsInOffice, partyYears, timelineSegments } from '../src/lib/tenure.ts';
import type { Government } from '../src/lib/types.ts';

const raw = JSON.parse(fs.readFileSync(new URL('./fixtures/governments.json', import.meta.url), 'utf8'));
const govs: Government[] = raw.centre.map((g: any) => ({ ...g, level: 'centre', leader: g.pm }));
const [c1, c2] = govs;
const near = (a: number, b: number, eps = 1e-9) => assert.ok(Math.abs(a - b) < eps, `${a} vs ${b}`);

test('days in office for a closed term', () => {
  assert.equal(daysInOffice(c1, '2030-01-01'), 731); // 2000 is a leap year
  near(yearsInOffice(c1, '2030-01-01'), 731 / 365.25);
});

test('open-ended government runs to asOf', () => {
  assert.equal(daysInOffice(c2, '2002-01-31'), 30);
  assert.equal(daysInOffice(c2, '2001-01-01'), 0);
});

test('closed government is clamped by asOf', () => {
  assert.equal(daysInOffice(c1, '2000-01-11'), 10);
});

test('coalition share weighting and years led', () => {
  const asOf = '2004-01-01';
  const y = partyYears(govs, asOf);
  const y1 = 731 / 365.25;
  const y2 = 730 / 365.25; // 2002-01-01 .. 2004-01-01
  near(y.aaa.weighted, y1 * 0.75);
  near(y.bbb.weighted, y1 * 0.25 + y2);
  near(y.aaa.led, y1);
  near(y.bbb.led, y2);
});

test('timeline segments cover the span', () => {
  const segs = timelineSegments(govs, '2004-01-01');
  assert.equal(segs.length, 2);
  near(segs[0].startPct, 0);
  near(segs[0].widthPct + segs[1].widthPct, 100, 1e-6);
  assert.equal(segs[1].ongoing, true);
});
