import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { ChakraProvider } from '@chakra-ui/react'
import hailerTheme from './hailer/theme/theme.ts'

/**
 * Itsepäivitystarkistus.
 * Hailer-iframe voi palvella index.html:n (ja siitä vanhan bundle-nimen) selaimen/CDN:n välimuistista,
 * jolloin sovellus näyttää vanhalta vaikka julkaisu olisi uusi. Noudetaan tuore index.html
 * (välimuisti ohitetaan kyselyparametrilla) ja verrataan sen bundle-nimeä käynnissä olevaan.
 * Jos julkaistu versio on uusi ja latautuu, ladataan sivu kerran uudelleen tuoreella URL:lla.
 */
function checkForNewerBundle(): void {
  const current = import.meta.url.split('/').pop()?.split('?')[0] ?? '';
  if (!/^index-[\w-]+\.js$/.test(current)) return; // dev-palvelin: ei hashattua bundlea
  const key = `${__APP_ID__}.selfReload`;
  const fetchHtml = () => {
    const u = new URL('index.html', document.baseURI);
    u.searchParams.set('_v', String(Date.now()));
    return fetch(u.toString(), { cache: 'no-store' }).then((r) => (r.ok ? r.text() : ''));
  };
  void fetchHtml()
    .then((html) => {
      const m = html.match(/assets\/(index-[\w-]+\.js)/);
      if (!m || m[1] === current) return null;
      // varmistetaan että uusi bundle on jo ladattavissa (julkaisun eteneminen CDN:ssä)
      const next = new URL(`assets/${m[1]}`, document.baseURI);
      return fetch(next.toString(), { method: 'HEAD', cache: 'no-store' }).then((r) => (r.ok ? m[1] : null));
    })
    .then((next) => {
      if (!next) return;
      const last = Number(sessionStorage.getItem(key) ?? 0);
      if (Date.now() - last < 60000) return; // ei uudelleenlatausilmioita
      sessionStorage.setItem(key, String(Date.now()));
      const u = new URL(location.href);
      u.searchParams.set('_v', String(Date.now()));
      console.info(`New app version published (${next} != ${current}) — reloading`);
      location.replace(u.toString());
    })
    .catch(() => { /* ei verkkoa — jatketaan nykyisellä */ });
}
checkForNewerBundle();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ChakraProvider theme={hailerTheme}>
      <App />
    </ChakraProvider>
  </React.StrictMode>,
)
