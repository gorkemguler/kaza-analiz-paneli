import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react()],
  // Göreli yollar: site GitHub Pages alt dizininde (/kaza-analiz-paneli/) ya da herhangi bir yerde çalışır
  base: './',
  build: { chunkSizeWarningLimit: 1000 },
})
