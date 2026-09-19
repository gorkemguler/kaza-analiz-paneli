import express from 'express';
import cors from 'cors';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { generateAccidents, CITIES, TYPES, SEVERITIES, WEATHERS } from './data.js';
import { filterAccidents, computeStats, computeHotspots } from './analytics.js';

const PORT = process.env.PORT || 3001;
const accidents = generateAccidents();
const meta = {
  cities: Object.keys(CITIES),
  types: TYPES,
  severities: SEVERITIES,
  weathers: WEATHERS,
  dateRange: { from: '2025-01-01', to: '2025-12-31' },
  synthetic: true,
};

const app = express();
app.use(cors());

app.get('/api/meta', (_req, res) => res.json(meta));

app.get('/api/accidents', (req, res) => {
  const list = filterAccidents(accidents, req.query);
  res.json(list.map(({ id, lat, lng, severity, type, date, location }) => ({ id, lat, lng, severity, type, date, location })));
});

app.get('/api/stats', (req, res) => {
  res.json(computeStats(filterAccidents(accidents, req.query), meta));
});

app.get('/api/hotspots', (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 10, 50);
  res.json(computeHotspots(filterAccidents(accidents, req.query), { limit }));
});

// Üretimde derlenmiş React uygulamasını da aynı sunucudan ver
const dist = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../client/dist');
if (fs.existsSync(dist)) {
  app.use(express.static(dist));
  app.get(/^(?!\/api).*/, (_req, res) => res.sendFile(path.join(dist, 'index.html')));
}

app.listen(PORT, () => console.log(`API hazır: http://localhost:${PORT} (${accidents.length} kayıt)`));
