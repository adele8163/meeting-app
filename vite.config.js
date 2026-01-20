import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// 這是確保 Vercel 能正確編譯 JSX 語法的關鍵設定
export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
  }
})