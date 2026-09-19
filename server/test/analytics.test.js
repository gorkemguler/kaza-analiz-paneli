import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateAccidents, TYPES, SEVERITIES, WEATHERS } from '../src/data.js';
import { filterAccidents, computeStats, computeHotspots } from '../src/analytics.js';

const meta = { types: TYPES, severities: SEVERITIES, weathers: WEATHERS };
const data = generateAccidents({ count: 1000 });

test('veri üretimi deterministik', () => {
  assert.deepEqual(generateAccidents({ count: 50 }), generateAccidents({ count: 50 }));
});

test('şehir ve çoklu önem filtresi', () => {
  const list = filterAccidents(data, { city: 'Ankara', severity: 'Yaralanmalı,Ölümlü' });
  assert.ok(list.length > 0);
  assert.ok(list.every((a) => a.city === 'Ankara' && a.severity !== 'Maddi hasarlı'));
});

test('tarih filtresi bitiş gününü kapsar', () => {
  const list = filterAccidents(data, { from: '2025-03-01', to: '2025-03-31' });
  assert.ok(list.length > 0);
  assert.ok(list.every((a) => a.date >= '2025-03-01' && a.date < '2025-04-01'));
});

test('istatistik toplamları tutarlı', () => {
  const s = computeStats(data, meta);
  assert.equal(s.totals.accidents, data.length);
  assert.equal(s.byHour.length, 24);
  assert.equal(s.byHour.reduce((t, d) => t + d.value, 0), data.length);
  assert.equal(s.bySeverity.reduce((t, d) => t + d.value, 0), data.length);
});

test('risk noktaları puana göre sıralı', () => {
  const h = computeHotspots(data, { limit: 5 });
  assert.equal(h.length, 5);
  for (let i = 1; i < h.length; i++) assert.ok(h[i - 1].score >= h[i].score);
});

test('boş veride hata vermez', () => {
  assert.deepEqual(computeHotspots([]), []);
  assert.equal(computeStats([], meta).totals.accidents, 0);
});
