import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

/**
 * Peräkannen RO-laitos: kaksi Lamor-brändättyä sinistä 20 jalan RO-konttia (tuloputket kansien
 * alta kylkeen, rejekti- ja tuotetun veden putket ulos kyljestä), 10 jalan CIP-kontti konttien
 * välissä sekä vaakamallinen HEX-rumpusuodatin (CM Aqua -tyyli: musta PE-säiliö, polymeerirumpu,
 * DDGW-suora-ajo, keraamiset suutinpalkki). Kaikki metrejä, samassa keula +x -kehyksessä kuin runko.
 */

const DECK_Y = 6.5;
const RO_L = 6.06; // 20 ft
const CIP_L = 2.99; // 10 ft
const W = 2.44;
const H = 2.59;

/** Lamor-sininen (brändi) ja apuvärit. */
const LAMOR_BLUE = '#0b4c9f';
const LAMOR_BLUE_DARK = '#083a7c';

function canvasTexture(w: number, h: number, draw: (ctx: CanvasRenderingContext2D) => void): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d')!;
  draw(ctx);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

/** Aaltopeltirei'itys: vaihtelevat pystyvalot/varjot. */
function corrugation(ctx: CanvasRenderingContext2D, w: number, h: number) {
  for (let x = 0; x < w; x += 36) {
    const g = ctx.createLinearGradient(x, 0, x + 36, 0);
    g.addColorStop(0, 'rgba(255,255,255,0.00)');
    g.addColorStop(0.35, 'rgba(255,255,255,0.13)');
    g.addColorStop(0.65, 'rgba(0,0,0,0.00)');
    g.addColorStop(1, 'rgba(0,0,0,0.22)');
    ctx.fillStyle = g;
    ctx.fillRect(x, 0, 36, h);
  }
}

/** Tyylitelty vesiroiske: kruunu-sormet + pisarat. */
function drawSplash(ctx: CanvasRenderingContext2D, cx: number, cy: number, s: number) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(s, s);
  const drops: [number, number, number][] = [[-90, -150, 16], [-40, -190, 12], [20, -205, 15], [85, -175, 11], [130, -120, 9], [-135, -95, 10], [160, -70, 7]];
  // pohja-aalto
  ctx.fillStyle = 'rgba(191,229,255,0.85)';
  ctx.beginPath();
  ctx.moveTo(-200, 40);
  ctx.bezierCurveTo(-130, 0, -80, 60, 0, 20);
  ctx.bezierCurveTo(80, -20, 140, 50, 210, 10);
  ctx.lineTo(210, 70);
  ctx.lineTo(-200, 70);
  ctx.closePath();
  ctx.fill();
  // kruunu: kolme kaarevaa sormea
  for (const [ox, hgt, wid] of [[-70, 150, 36], [0, 200, 42], [75, 140, 32]] as [number, number, number][]) {
    ctx.beginPath();
    ctx.moveTo(ox - wid, 30);
    ctx.bezierCurveTo(ox - wid * 0.9, -hgt * 0.45, ox - wid * 0.3, -hgt * 0.95, ox, -hgt);
    ctx.bezierCurveTo(ox + wid * 0.4, -hgt * 0.9, ox + wid * 0.8, -hgt * 0.4, ox + wid, 30);
    ctx.closePath();
    ctx.fillStyle = 'rgba(214,240,255,0.92)';
    ctx.fill();
  }
  // sisempi vaaleampi hehku
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.beginPath();
  ctx.ellipse(0, 10, 120, 22, 0, 0, Math.PI * 2);
  ctx.fill();
  // pisarat
  for (const [dx, dy, r] of drops) {
    ctx.fillStyle = 'rgba(230,246,255,0.95)';
    ctx.beginPath();
    ctx.ellipse(dx, dy, r, r * 1.35, dx * 0.004, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function lamorWordmark(ctx: CanvasRenderingContext2D, x: number, y: number, size: number) {
  ctx.fillStyle = '#ffffff';
  ctx.font = `800 ${size}px "Segoe UI", "Helvetica Neue", Arial, sans-serif`;
  ctx.letterSpacing = `${Math.round(size * 0.12)}px`;
  ctx.fillText('LAMOR', x, y);
  ctx.letterSpacing = '0px';
}

/** Sivutekstuuri: Lamor-sininen, LAMOR-logo, vesiroiske ja konttityyppi. Leveys skaalaa kontin pituuteen (20 ft 1024 px, 10 ft 512 px). */
function sideTexture(label: string, short: string, w = 1024): THREE.CanvasTexture {
  const k = w / 1024;
  return canvasTexture(w, 440, (ctx) => {
    const g = ctx.createLinearGradient(0, 0, 0, 440);
    g.addColorStop(0, LAMOR_BLUE);
    g.addColorStop(1, LAMOR_BLUE_DARK);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, 440);
    corrugation(ctx, w, 440);
    // ylä- ja alapoimut
    ctx.fillStyle = 'rgba(5,25,60,0.75)';
    ctx.fillRect(0, 0, w, 22);
    ctx.fillRect(0, 418, w, 22);
    // vesiroiske oikealle
    drawSplash(ctx, w * 0.74, 300, Math.max(0.62, 1.15 * k));
    // logo ja teksti
    lamorWordmark(ctx, 56 * k, 150, Math.round(96 * k + 12 * (1 - k)));
    ctx.fillStyle = 'rgba(255,255,255,0.92)';
    ctx.font = `600 ${Math.round(34 * k + 4)}px "Segoe UI", "Helvetica Neue", Arial, sans-serif`;
    ctx.letterSpacing = '4px';
    ctx.fillText(label, 60 * k, 205);
    ctx.font = '500 24px "Segoe UI", "Helvetica Neue", Arial, sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.fillText(short, 60 * k, 242);
    // kulmakuviot (corner castings)
    ctx.fillStyle = '#2b2f36';
    for (const [x, y] of [[0, 0], [w - 48, 0], [0, 392], [w - 48, 392]]) ctx.fillRect(x, y, 48, 48);
  });
}

/** Ovitekstuuri kontin päihin: kaksi oven sivua, lukkosauvat, saranat. */
function doorTexture(label: string): THREE.CanvasTexture {
  return canvasTexture(420, 440, (ctx) => {
    const g = ctx.createLinearGradient(0, 0, 0, 440);
    g.addColorStop(0, LAMOR_BLUE);
    g.addColorStop(1, LAMOR_BLUE_DARK);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 420, 440);
    corrugation(ctx, 420, 440);
    ctx.fillStyle = 'rgba(5,25,60,0.75)';
    ctx.fillRect(0, 0, 420, 22);
    ctx.fillRect(0, 418, 420, 22);
    // ovien sauma ja saranat
    ctx.fillStyle = 'rgba(5,20,50,0.8)';
    ctx.fillRect(207, 22, 6, 396);
    for (const x of [10, 400]) { ctx.fillStyle = '#2b2f36'; for (const y of [60, 180, 300]) ctx.fillRect(x, y, 12, 44); }
    // lukkosauvat
    ctx.strokeStyle = '#cfd6dd';
    ctx.lineWidth = 5;
    for (const y of [95, 160, 250, 330]) {
      ctx.beginPath(); ctx.moveTo(22, y); ctx.lineTo(200, y); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(220, y); ctx.lineTo(398, y); ctx.stroke();
    }
    // kahvat
    ctx.fillStyle = '#e8edf2';
    for (const x of [150, 250]) ctx.fillRect(x, 200, 18, 36);
    // pieni logo ylhäällä
    ctx.fillStyle = 'rgba(255,255,255,0.95)';
    ctx.font = '800 30px "Segoe UI", "Helvetica Neue", Arial, sans-serif';
    ctx.letterSpacing = '3px';
    ctx.fillText('LAMOR', 24, 56);
    ctx.font = '600 20px "Segoe UI", Arial, sans-serif';
    ctx.letterSpacing = '2px';
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.fillText(label, 24, 404);
  });
}

function plainTexture(): THREE.CanvasTexture {
  return canvasTexture(64, 64, (ctx) => {
    ctx.fillStyle = LAMOR_BLUE_DARK;
    ctx.fillRect(0, 0, 64, 64);
  });
}

/** Lamor-kontti: pituus x, leveys z, korkeus y; pohja y=0. */
function buildContainer(len: number, label: string, short: string, doorsAt: 'both' | 'fwd'): THREE.Group {
  const g = new THREE.Group();
  const side = new THREE.MeshStandardMaterial({ map: sideTexture(label, short, len > 4 ? 1024 : 512), roughness: 0.55, metalness: 0.15 });
  const door = new THREE.MeshStandardMaterial({ map: doorTexture(label), roughness: 0.55, metalness: 0.15 });
  const plain = new THREE.MeshStandardMaterial({ map: plainTexture(), roughness: 0.6, metalness: 0.15 });
  // BoxGeometry-materiaalijärjestys: +x, -x, +y, -y, +z, -z
  const mats = doorsAt === 'both' ? [door, door, plain, plain, side, side] : [door, plain, plain, plain, side, side];
  const body = new THREE.Mesh(new THREE.BoxGeometry(len, H, W), mats);
  body.position.y = H / 2;
  g.add(body);
  // kulmaprofiilit
  const edgeMat = new THREE.MeshStandardMaterial({ color: 0x2b2f36, roughness: 0.6, metalness: 0.3 });
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.16, H, 0.16), edgeMat);
    post.position.set((sx * len) / 2, H / 2, (sz * W) / 2);
    g.add(post);
  }
  return g;
}

function drumMeshTexture(): THREE.CanvasTexture {
  return canvasTexture(256, 256, (ctx) => {
    ctx.fillStyle = '#d9dde0';
    ctx.fillRect(0, 0, 256, 256);
    ctx.fillStyle = 'rgba(60,70,80,0.55)';
    // "HEX HP" -paneelien kuviollinen verkko
    for (let y = 0; y < 256; y += 12) {
      for (let x = 0; x < 256; x += 12) {
        const ox = (y / 12) % 2 ? 6 : 0;
        ctx.beginPath();
        ctx.arc(x + ox, y, 2.1, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.strokeStyle = 'rgba(90,100,110,0.6)';
    ctx.lineWidth = 3;
    for (let x = 0; x < 256; x += 64) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 256); ctx.stroke(); }
  });
}

function labelTexture(text: string, sub: string): THREE.CanvasTexture {
  return canvasTexture(512, 128, (ctx) => {
    ctx.fillStyle = '#15181b';
    ctx.fillRect(0, 0, 512, 128);
    ctx.fillStyle = '#ffffff';
    ctx.font = '800 54px "Segoe UI", Arial, sans-serif';
    ctx.letterSpacing = '6px';
    ctx.fillText(text, 24, 70);
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.font = '600 26px "Segoe UI", Arial, sans-serif';
    ctx.letterSpacing = '3px';
    ctx.fillText(sub, 24, 108);
  });
}

/** CM Aqua HEX-rumpusuodatin (T-versio): musta PE-säiliö ja -kehys, polymeerirumpuverkko, DDGW-ajo, suutinpalkki. Pohja y=0. */
function buildDrumFilter(): THREE.Group {
  const g = new THREE.Group();
  const pe = new THREE.MeshStandardMaterial({ color: 0x15181b, roughness: 0.8 });
  const drumMat = new THREE.MeshStandardMaterial({ map: drumMeshTexture(), roughness: 0.6, metalness: 0.05 });
  const steel = new THREE.MeshStandardMaterial({ color: 0x8a949b, roughness: 0.45, metalness: 0.6 });
  const motor = new THREE.MeshStandardMaterial({ color: 0x2b3238, roughness: 0.5, metalness: 0.4 });
  const accent = new THREE.MeshStandardMaterial({ color: 0x0b4c9f, roughness: 0.5 });

  const L = 3.0, TW = 1.7;
  // kehys + säiliö
  const frame = new THREE.Mesh(new THREE.BoxGeometry(L, 0.3, TW), pe);
  frame.position.y = 0.15;
  g.add(frame);
  const tank = new THREE.Mesh(new RoundedBoxGeometry(L, 1.1, TW, 2, 0.08), pe);
  tank.position.y = 0.3 + 0.55;
  g.add(tank);
  // rumpu: akseli x, yläosa säiliön yläpuolella
  const drum = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 2.4, 28, 1, false), drumMat);
  drum.rotation.z = Math.PI / 2;
  drum.position.y = 1.25;
  g.add(drum);
  // rummun päät (POM-päätyslevyt)
  for (const sx of [-1, 1]) {
    const end = new THREE.Mesh(new THREE.CylinderGeometry(0.58, 0.58, 0.08, 28), new THREE.MeshStandardMaterial({ color: 0xf0f2f4, roughness: 0.5 }));
    end.rotation.z = Math.PI / 2;
    end.position.set(sx * 1.22, 1.25, 0);
    g.add(end);
  }
  // puolikansi rummun ylle (musta PE)
  const cover = new THREE.Mesh(new THREE.CylinderGeometry(0.68, 0.68, 2.6, 24, 1, true, 0, Math.PI), pe);
  cover.rotation.z = Math.PI / 2;
  cover.position.y = 1.25;
  g.add(cover);
  // suutinpalkki (keraamiset suuttimet) kannen alla
  const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 2.4, 8), steel);
  bar.rotation.z = Math.PI / 2;
  bar.position.y = 1.9;
  g.add(bar);
  for (let i = -2; i <= 2; i++) {
    const noz = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.16, 8), steel);
    noz.position.set(i * 0.5, 1.8, 0);
    noz.rotation.x = Math.PI;
    g.add(noz);
  }
  // DDGW-suora-ajo: hammaspyörä + moottori +x-päässä
  const gear = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.36, 0.14, 24), accent);
  gear.rotation.z = Math.PI / 2;
  gear.position.set(1.4, 1.25, 0);
  g.add(gear);
  const mot = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.45, 0.45), motor);
  mot.position.set(1.62, 0.95, 0);
  g.add(mot);
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.3, 10), steel);
  shaft.rotation.z = Math.PI / 2;
  shaft.position.set(1.5, 1.25, 0);
  g.add(shaft);
  // merkintä säiliön kylkeen
  const lbl = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.4), new THREE.MeshBasicMaterial({ map: labelTexture('HEX | DRUM FILTER', 'CM AQUA · POLYMER · X24'), transparent: true }));
  lbl.position.set(0, 0.95, TW / 2 + 0.012);
  g.add(lbl);
  // tuloputki -x-päästä, ulostulot +x-pään pohjasta
  const inlet = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.6, 12), steel);
  inlet.rotation.z = Math.PI / 2;
  inlet.position.set(-L / 2 - 0.25, 0.95, 0);
  g.add(inlet);
  for (const sz of [-1, 1]) {
    const out = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.5, 12), steel);
    out.position.set(L / 2 - 0.3, 0.25, sz * 0.4);
    g.add(out);
  }
  return g;
}

function pipeRun(g: THREE.Group, pts: [number, number, number][], r: number, mat: THREE.Material) {
  const up = new THREE.Vector3(0, 1, 0);
  for (let i = 0; i < pts.length - 1; i++) {
    const a = new THREE.Vector3(...pts[i]);
    const b = new THREE.Vector3(...pts[i + 1]);
    const len = a.distanceTo(b);
    if (len < 1e-6) continue;
    const cyl = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, 12), mat);
    cyl.position.copy(a).add(b).multiplyScalar(0.5);
    cyl.quaternion.setFromUnitVectors(up, b.clone().sub(a).normalize());
    g.add(cyl);
    if (i > 0) {
      const joint = new THREE.Mesh(new THREE.SphereGeometry(r * 1.12, 12, 10), mat);
      joint.position.copy(a);
      g.add(joint);
    }
  }
  // kansiläpivalu (flanges) pisteissä jotka menevät kannen läpi
  for (const p of [pts[0], pts[pts.length - 1]]) {
    if (Math.abs(p[1] - (DECK_Y - 0.3)) < 1e-6) {
      const fl = new THREE.Mesh(new THREE.CylinderGeometry(r * 1.9, r * 1.9, 0.12, 16), new THREE.MeshStandardMaterial({ color: 0x2b3238, roughness: 0.6, metalness: 0.4 }));
      fl.position.set(p[0], DECK_Y + 0.06, p[2]);
      g.add(fl);
    }
  }
}

/** Kokonaisuus peräkannelle: RO-kontit ±z, CIP-kontti keskilinjalla perässä, rumpusuodatti keskilinjalla edessä. */
export function buildDeckPlant(): THREE.Group {
  const g = new THREE.Group();
  const steel = new THREE.MeshStandardMaterial({ color: 0x77828a, roughness: 0.5, metalness: 0.45 });
  const reject = new THREE.MeshStandardMaterial({ color: 0x4a5560, roughness: 0.55, metalness: 0.3 });
  const permeate = new THREE.MeshStandardMaterial({ color: 0x2fa4c7, roughness: 0.45, metalness: 0.2 });
  const cip = new THREE.MeshStandardMaterial({ color: 0x7bd389, roughness: 0.5, metalness: 0.15 });

  const RO_X = -46.7, RO_Z = 4.3;
  const CIP_X = -48.3;
  const DF_X = -44.4;

  for (const sz of [1, -1]) {
    const c = buildContainer(RO_L, 'RO WATER TREATMENT', 'LIVE FISH CARRIER · 20 ft', 'fwd');
    c.position.set(RO_X, DECK_Y, sz * RO_Z);
    g.add(c);
    const z = (v: number) => sz * v;
    // syöttö: kansien alta nouseva putki kontin merenpuoleiseen kylkeen
    pipeRun(g, [[RO_X + 1.3, DECK_Y - 0.3, z(6.35)], [RO_X + 1.3, DECK_Y + 1.0, z(6.35)], [RO_X + 1.3, DECK_Y + 1.0, z(RO_Z + W / 2)]], 0.28, steel);
    // rejekti ulos keulapäästä kansien alle
    pipeRun(g, [[RO_X + RO_L / 2, DECK_Y + 0.65, z(4.95)], [RO_X + RO_L / 2 + 1.1, DECK_Y + 0.65, z(4.95)], [RO_X + RO_L / 2 + 1.1, DECK_Y - 0.3, z(4.95)]], 0.3, reject);
    // tuotettu vesi ulos keulapäästä kansien alle
    pipeRun(g, [[RO_X + RO_L / 2, DECK_Y + 1.7, z(3.75)], [RO_X + RO_L / 2 + 1.3, DECK_Y + 1.7, z(3.75)], [RO_X + RO_L / 2 + 1.3, DECK_Y - 0.3, z(3.75)]], 0.24, permeate);
  }

  const cipC = buildContainer(CIP_L, 'CIP · CLEANING', 'LIVE FISH CARRIER · 10 ft', 'fwd');
  cipC.position.set(CIP_X, DECK_Y, 0);
  g.add(cipC);
  pipeRun(g, [[CIP_X + 0.8, DECK_Y - 0.3, 1.55], [CIP_X + 0.8, DECK_Y + 0.9, 1.55], [CIP_X + 0.8, DECK_Y + 0.9, W / 2]], 0.2, steel);
  pipeRun(g, [[CIP_X + CIP_L / 2, DECK_Y + 1.4, 1.1], [CIP_X + CIP_L / 2 + 0.3, DECK_Y + 1.4, 1.1], [CIP_X + CIP_L / 2 + 0.3, DECK_Y - 0.3, 1.1]], 0.2, cip);

  const df = buildDrumFilter();
  df.position.set(DF_X, DECK_Y, 0);
  g.add(df);
  pipeRun(g, [[DF_X - 1.9, DECK_Y - 0.3, 0], [DF_X - 1.9, DECK_Y + 0.95, 0], [DF_X - 1.5 - 0.25, DECK_Y + 0.95, 0]], 0.22, steel);
  for (const sz of [1, -1]) {
    pipeRun(g, [[DF_X + 1.2, DECK_Y + 0.25, sz * 0.4], [DF_X + 1.65, DECK_Y + 0.25, sz * 0.4], [DF_X + 1.65, DECK_Y - 0.3, sz * 0.4]], 0.18, sz > 0 ? permeate : reject);
  }
  return g;
}
