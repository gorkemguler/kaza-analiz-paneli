import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import { loadTurkiye } from '../src/turkiye.js';
import { loadIstanbul, filterAccidents, computeStats, computeHotspots, placeName } from '../src/istanbul.js';
import { classifySeverity, classifyRoad, ROAD_NAMES } from '../../scripts/ibb-guncelle.mjs';

const DATA = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../data');
const turkiye = loadTurkiye(path.join(DATA, 'egm'));
const istanbul = loadIstanbul(path.join(DATA, 'ibb/kazalar.json.gz'));

test('EGM: her bültende 81 il var ve il toplamları ülke toplamına eşit', () => {
  assert.ok(turkiye.periods().length > 0);
  for (const { period } of turkiye.periods()) {
    const d = turkiye.get(period);
    for (const scope of ['month', 'ytd']) {
      const rows = d.iller[scope];
      assert.equal(rows.length, 81, `${period} ${scope}`);
      assert.equal(new Set(rows.map((r) => r.plaka)).size, 81);
      const t = d.totals[scope].toplam;
      assert.equal(rows.reduce((s, r) => s + r.olu, 0), t.olu, `${period} ${scope} ölü`);
      assert.equal(rows.reduce((s, r) => s + r.yarali, 0), t.yarali, `${period} ${scope} yaralı`);
      assert.equal(rows.reduce((s, r) => s + r.maddiHasarliKaza, 0), t.maddiHasarliKaza);
      assert.equal(rows.reduce((s, r) => s + r.olumluYaralanmaliKaza, 0), t.olumluKaza + t.yaralanmaliKaza);
    }
  }
});

test('EGM: yerleşim yeri + yerleşim yeri dışı = toplam', () => {
  for (const { period } of turkiye.periods()) {
    const { month } = turkiye.get(period).totals;
    for (const k of Object.keys(month.toplam)) assert.equal(month.yerlesimYeri[k] + month.yerlesimYeriDisi[k], month.toplam[k], `${period} ${k}`);
  }
});

test('İBB: kaza sonucu duyuru başlığından çıkarılır', () => {
  const sev = (t) => ['Maddi hasarlı', 'Yaralanmalı', 'Ölümlü', 'Belirtilmemiş'][classifySeverity(t)];
  assert.equal(sev('D100 Kınalı-Silivri Yönü, trafik kazası (can kaybı).'), 'Ölümlü');
  assert.equal(sev('Tem Kemerburgaz-Alibeyköy Yönü sağ şerit Trafik kazası (yaralanmalı)'), 'Yaralanmalı');
  assert.equal(sev('Tünel Sarıyer-Çayırbaşı Yönü Maddi Hasarlı Trafik Kazası'), 'Maddi hasarlı');
  assert.equal(sev('TEM Elmalı-Kavacık Yönü, trafik kazası (zincirleme).'), 'Belirtilmemiş');
});

test('İBB: yol adı ve yer adı çıkarımı', () => {
  assert.equal(ROAD_NAMES[classifyRoad('D100 Maltepe-Kartal Yönü, orta şerit trafik kazası (hasarlı).')], 'D100 (E-5)');
  assert.equal(ROAD_NAMES[classifyRoad('Tem Kemerburgaz-Alibeyköy Yönü')], 'TEM');
  assert.equal(ROAD_NAMES[classifyRoad('Riva Yolu-Kavacık Yönü')], 'Diğer');
  assert.equal(placeName('D100 Maltepe-Kartal Yönü, orta şerit trafik kazası (hasarlı).'), 'D100 Maltepe-Kartal');
  assert.equal(placeName('Aksaray-Çapa Trafik kazası (hasarlı)'), 'Aksaray-Çapa');
});

test('İBB: filtreler ve istatistik toplamları tutarlı', () => {
  const list = filterAccidents(istanbul.accidents, { from: '2024-01-01', to: '2024-12-31', severity: 'Yaralanmalı,Ölümlü' });
  assert.ok(list.length > 0);
  assert.ok(list.every((a) => a.year === 2024 && a.severity !== 'Maddi hasarlı'));
  const s = computeStats(list, istanbul.meta);
  assert.equal(s.totals.kaza, list.length);
  assert.equal(s.byHour.reduce((t, d) => t + d.value, 0), list.length);
  assert.equal(s.weekHourGrid.flat().reduce((t, v) => t + v, 0), list.length);
});

test('İBB: risk noktaları puana göre sıralı, boş veride hata yok', () => {
  const h = computeHotspots(istanbul.accidents, { limit: 5 });
  assert.equal(h.length, 5);
  for (let i = 1; i < h.length; i++) assert.ok(h[i - 1].score >= h[i].score);
  assert.deepEqual(computeHotspots([]), []);
  assert.equal(computeStats([], istanbul.meta).totals.kaza, 0);
});

test('KGM: kara noktalar Türkiye sınırlarında ve tekil', () => {
  const kgm = JSON.parse(fs.readFileSync(path.join(DATA, 'kgm/kara-noktalar.json'), 'utf8'));
  assert.ok(kgm.noktalar.length > 0);
  assert.ok(kgm.noktalar.every((n) => n.lat > 35.5 && n.lat < 42.5 && n.lng > 25 && n.lng < 45));
  assert.ok(kgm.noktalar.every((n) => n.il && n.km));
  assert.equal(new Set(kgm.noktalar.map((n) => n.kkno + n.km)).size, kgm.noktalar.length);
});
