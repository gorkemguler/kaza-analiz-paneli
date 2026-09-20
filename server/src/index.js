import express from 'express';
import cors from 'cors';
import compression from 'compression';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { loadTurkiye } from './turkiye.js';
import { loadIstanbul, filterAccidents, computeStats, computeHotspots } from './istanbul.js';

const PORT = process.env.PORT || 3001;
const here = path.dirname(fileURLToPath(import.meta.url));
const DATA = path.resolve(here, '../data');

const turkiye = loadTurkiye(path.join(DATA, 'egm'));
const istanbul = loadIstanbul(path.join(DATA, 'ibb/kazalar.json.gz'));

const app = express();
app.use(cors());
app.use(compression());

// --- Türkiye geneli (EGM aylık bültenleri) ---
app.get('/api/turkiye/donemler', (_req, res) => res.json(turkiye.periods()));
app.get('/api/turkiye/seri', (_req, res) => res.json(turkiye.series()));
app.get('/api/turkiye/donem/:period', (req, res) => {
  const data = turkiye.get(req.params.period);
  if (!data) return res.status(404).json({ error: 'Bu döneme ait bülten yok' });
  res.json(data);
});
app.get('/api/turkiye/il/:plaka', (req, res) => res.json(turkiye.provinceSeries(Number(req.params.plaka))));

// --- İstanbul (İBB UYM kaza duyuruları) ---
app.get('/api/istanbul/meta', (_req, res) => res.json(istanbul.meta));
app.get('/api/istanbul/stats', (req, res) => {
  res.json(computeStats(filterAccidents(istanbul.accidents, req.query), istanbul.meta));
});
app.get('/api/istanbul/hotspots', (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 10, 50);
  res.json(computeHotspots(filterAccidents(istanbul.accidents, req.query), { limit }));
});
app.get('/api/istanbul/points', (req, res) => {
  const list = filterAccidents(istanbul.accidents, req.query);
  const sev = istanbul.meta.severities;
  res.json({
    points: list.map((a) => [a.lat, a.lng, sev.indexOf(a.severity)]),
    fatal: list.filter((a) => a.severity === 'Ölümlü').map(({ id, lat, lng, t, title }) => ({ id, lat, lng, t, title })),
  });
});

// Üretimde derlenmiş React uygulamasını da aynı sunucudan ver
const dist = path.resolve(here, '../../client/dist');
if (fs.existsSync(dist)) {
  app.use(express.static(dist));
  app.get(/^(?!\/api).*/, (_req, res) => res.sendFile(path.join(dist, 'index.html')));
}

app.listen(PORT, () => {
  console.log(`API hazır: http://localhost:${PORT}`);
  console.log(`  EGM: ${turkiye.periods().length} aylık bülten, İBB: ${istanbul.accidents.length} kaza kaydı`);
});
