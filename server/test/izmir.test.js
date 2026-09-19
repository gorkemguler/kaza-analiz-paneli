import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import zlib from 'node:zlib';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { prepareIzmir, attachLocations, computeMapPoints, filterEvents, computeStats, computeStreets, normalizeType, TYPES } from '../../shared/izmir-analiz.js';

const DATA = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../data');
const { events, meta } = prepareIzmir(JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(DATA, 'izmir/olaylar.json.gz')))));

test('İzmir: tür adları tek biçime indirgenir', () => {
  assert.equal(normalizeType('MAddi Hasarlı'), 'Maddi hasarlı');
  assert.equal(normalizeType('yaralanmalı Kaza'), 'Yaralanmalı');
  assert.equal(normalizeType('Ölümlü Kaza'), 'Ölümlü');
  assert.equal(normalizeType('Yakıt Bitimi'), 'Yakıtı biten');
  assert.equal(normalizeType('Futbol Maçı'), 'Diğer');
  assert.equal(normalizeType(''), null);
  assert.ok(events.every((e) => TYPES.includes(e.tur)));
});

test('İzmir: kayıtlar tarih sırasında ve alanlar tutarlı', () => {
  assert.ok(events.length > 20000);
  for (let i = 1; i < events.length; i++) assert.ok(events[i - 1].tarih <= events[i].tarih);
  assert.ok(events.every((e) => e.mudahaleDk == null || (e.mudahaleDk >= 0 && e.mudahaleDk <= 600)));
  assert.ok(events.every((e) => e.hour == null || (e.hour >= 0 && e.hour <= 23)));
  assert.ok(events.every((e) => e.weekday >= 0 && e.weekday <= 6));
});

test('İzmir: filtre ve istatistik toplamları tutarlı', () => {
  const list = filterEvents(events, { from: '2025-01-01', to: '2025-12-31', type: 'Ölümlü,Yaralanmalı' });
  assert.ok(list.length > 0);
  assert.ok(list.every((e) => e.year === 2025 && ['Ölümlü', 'Yaralanmalı'].includes(e.tur)));
  const s = computeStats(list, meta);
  assert.equal(s.totals.olay, list.length);
  assert.equal(s.totals.olumlu + s.totals.yaralanmali, list.length);
  assert.equal(s.byType.reduce((t, d) => t + d.value, 0), list.length);
  assert.equal(s.weekHourGrid.flat().reduce((t, v) => t + v, 0), list.filter((e) => e.hour != null).length);
});

test('İzmir: mevki konumları olaylara bağlanır ve İzmir sınırları içindedir', () => {
  const konumlar = JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(DATA, 'izmir/konumlar.json.gz'))));
  const { events: located } = attachLocations(events, konumlar);
  const withGeo = located.filter((e) => e.lat != null);
  assert.ok(withGeo.length / located.length > 0.5, 'kayıtların yarısından fazlası haritalanmalı');
  assert.ok(withGeo.every((e) => e.lat > 38.2 && e.lat < 38.7 && e.lng > 26.7 && e.lng < 27.6), 'noktalar İzmir sınırlarında olmalı');
  const map = computeMapPoints(located);
  assert.equal(map.toplam, located.length);
  assert.equal(map.eslesen, withGeo.length);
  assert.equal(map.points.reduce((t, p) => t + p[2], 0), withGeo.length);
  for (let i = 1; i < map.top.length; i++) assert.ok(map.top[i - 1].score >= map.top[i].score);
});

test('İzmir: caddeler risk puanına göre sıralı, boş veride hata yok', () => {
  const list = computeStreets(events, { limit: 5 });
  assert.equal(list.length, 5);
  for (let i = 1; i < list.length; i++) assert.ok(list[i - 1].score >= list[i].score);
  assert.deepEqual(computeStreets([]), []);
  assert.equal(computeStats([], meta).totals.olay, 0);
});
