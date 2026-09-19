// İstanbul verisini diskten yükler; analizler shared/istanbul-analiz.js içinde
import fs from 'node:fs'
import zlib from 'node:zlib'
import { prepareIstanbul } from '../../shared/istanbul-analiz.js'

export * from '../../shared/istanbul-analiz.js'

export const readIstanbulRaw = (file) => JSON.parse(zlib.gunzipSync(fs.readFileSync(file)))
export const loadIstanbul = (file) => prepareIstanbul(readIstanbulRaw(file))
