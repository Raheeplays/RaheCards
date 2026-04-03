import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(), // Yeh aapki design (CSS) ko build mein include karega
  ],
  base: '/RaheeCards/', // Isse CSS files ka path sahi ho jayega
})
