import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  // 啟用 React 支援，這讓 Vite 能夠處理 App.jsx 中的 JSX 語法
  plugins: [react()],
  build: {
    // 定義編譯後的輸出目錄，Vercel 預設會讀取 dist 資料夾
    outDir: 'dist',
    // 確保資源引用路徑在部署環境中正確
    assetsDir: 'assets',
    // 部署時通常不建議開啟 sourcemap 以減少檔案大小，開發除錯時可改為 true
    sourcemap: false,
  },
  server: {
    // 本地開發伺服器設定
    port: 3000,
    open: true,
  }
})