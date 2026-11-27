import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import dns from 'dns'
import fs from 'fs'

dns.setDefaultResultOrder('verbatim');

/** Lisää index.html:n asset-URL:eihin aikaleimakyselyn -> ei vanhoja välimuistiversioita päivitysten jälkeen */
function cacheBustPlugin(): Plugin {
  return {
    name: 'cache-bust-html',
    enforce: 'post',
    transformIndexHtml(html) {
      const ts = Date.now();
      return html.replace(/(src|href)="([^"]+\.(js|css))"/g, (_m, attr, url) => `${attr}="${url}?v=${ts}"`);
    },
  };
}

// Sovelluksen versio public/manifest.json:ista bundleen (näytetään otsikossa ja käytetään itsepäivitystarkistukseen)
const manifest = JSON.parse(fs.readFileSync('./public/manifest.json', 'utf8')) as { version: string; appId: string };

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), cacheBustPlugin()],
  base: './',
  define: {
    __APP_VERSION__: JSON.stringify(manifest.version),
    __APP_ID__: JSON.stringify(manifest.appId),
  },
  server: {
    port: 3000,
    cors: true,
  },
})
