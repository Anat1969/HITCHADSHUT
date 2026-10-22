import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'

// Link previews need absolute URLs (og:url, og:image). Vercel provides the production domain at build time;
// without it, the known production address is used.
function siteUrl(): Plugin {
  const host = process.env.SITE_URL || process.env.VERCEL_PROJECT_PRODUCTION_URL || 'ashdod-ma-nivne.vercel.app'
  const base = host.startsWith('http') ? host.replace(/\/$/, '') : `https://${host}`
  return { name: 'site-url', transformIndexHtml: (html) => html.replaceAll('%SITE_URL%', base) }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), siteUrl()],
})
