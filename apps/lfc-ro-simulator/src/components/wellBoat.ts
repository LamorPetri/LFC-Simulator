import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { buildDeckPlant } from './deckPlant';

const { smoothstep, clamp } = THREE.MathUtils;
const N = 64; // kaaria pituussuunnassa

/** Runkomuoto: keula +x, vesiraja y = 0, metrejä. Käytössä well boatissa ja rehulautassa. */
export interface HullSpec {
  len: number;
  halfBeam: number;
  draught: number;
  deck: number;      // pääkansi vesirajasta
  focsle: number;    // korotettu keulakansi (0 = tasakansi)
  rake: number;      // viisto keularanka: kansirivi on tämän verran vesirajaa pidempi
  bowStart: number;  // s (0 perä .. 1 keula), josta keula alkaa kaveta
  colors: [number, number, number]; // pohja, kylki, parras
  deckColor: number;
}

/** Loftattu runko + kansi. Palauttaa myös kannen korkeuden ja puolileveyden kohdassa s. */
export function buildHull(spec: HullSpec) {
  /* s = 0 perä .. 1 keula; t = -1 köli, 0 vesiraja, 1 kansi, >1 parras */
  const deckY = (s: number) => spec.deck + spec.focsle * smoothstep(s, 0.6, 0.68);
  const rowY = (t: number, s: number) => (t <= 0 ? t * spec.draught : t <= 1 ? t * deckY(s) : deckY(s) + (t - 1) * 10);
  // ylemmät rivit ovat pidempiä -> viisto keularanka ja keulan levenevä kaari (flare)
  const rowX = (t: number, s: number) => -spec.len / 2 + s * (spec.len + spec.rake * clamp(t, -1, 1.12));
  const halfBeam = (t: number, s: number) =>
    spec.halfBeam
    * (0.85 + 0.15 * smoothstep(s, 0, 0.15))
    * (s > spec.bowStart ? Math.pow(Math.max(0, 1 - Math.pow((s - spec.bowStart) / (1 - spec.bowStart), 2.2)), 0.6) : 1)
    * (t < 0 ? 1 - 0.35 * t * t : 1);

  const [bottom, side, rail] = spec.colors.map((c) => new THREE.Color(c));
  // tuplarivit samalla t:llä = terävä väriraja
  const rows: [number, THREE.Color][] = [
    [-1, bottom], [-0.5, bottom], [0.06, bottom], [0.06, side], [0.5, side], [1, side], [1, rail], [1.12, rail],
  ];
  const R = rows.length;
  const C = N + 1;
  const pos: number[] = [];
  const col: number[] = [];
  const idx: number[] = [];
  for (const sgn of [1, -1]) {
    for (const [t, c] of rows) {
      for (let i = 0; i <= N; i++) {
        const s = i / N;
        pos.push(rowX(t, s), rowY(t, s), sgn * halfBeam(t, s));
        col.push(c.r, c.g, c.b);
      }
    }
  }
  const at = (sd: number, r: number, i: number) => (sd * R + r) * C + i;
  for (let r = 0; r < R - 1; r++) {
    for (const sd of [0, 1]) {
      for (let i = 0; i < N; i++) {
        idx.push(at(sd, r, i), at(sd, r + 1, i), at(sd, r + 1, i + 1), at(sd, r, i), at(sd, r + 1, i + 1), at(sd, r, i + 1));
      }
    }
  }
  // peräpeili omilla vertekseillään (ei sekoita kylkien normaaleja)
  const t0 = pos.length / 3;
  for (const [t, c] of rows) {
    for (const sgn of [1, -1]) {
      pos.push(rowX(t, 0), rowY(t, 0), sgn * halfBeam(t, 0));
      col.push(c.r, c.g, c.b);
    }
  }
  for (let r = 0; r < R - 1; r++) {
    const a = t0 + r * 2;
    idx.push(a, a + 2, a + 3, a, a + 3, a + 1);
  }
  const hullGeo = new THREE.BufferGeometry();
  hullGeo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  hullGeo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  hullGeo.setIndex(idx);
  hullGeo.computeVertexNormals();
  // DoubleSide: peilatun kyljen kiertosuunta on käänteinen, three kääntää normaalin takapinnalle
  const hull = new THREE.Mesh(hullGeo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.45, metalness: 0.1, side: THREE.DoubleSide }));

  const dpos: number[] = [];
  const didx: number[] = [];
  for (let i = 0; i <= N; i++) {
    const s = i / N;
    const w = halfBeam(1, s) * 0.99;
    dpos.push(rowX(1, s), deckY(s), w, rowX(1, s), deckY(s), -w);
    if (i < N) didx.push(i * 2, i * 2 + 1, i * 2 + 3, i * 2, i * 2 + 3, i * 2 + 2);
  }
  const deckGeo = new THREE.BufferGeometry();
  deckGeo.setAttribute('position', new THREE.Float32BufferAttribute(dpos, 3));
  deckGeo.setIndex(didx);
  deckGeo.computeVertexNormals();
  const deck = new THREE.Mesh(deckGeo, new THREE.MeshStandardMaterial({ color: spec.deckColor, roughness: 0.85, side: THREE.DoubleSide }));
  return { hull, deck };
}

/* Well boat (Live Fish Carrier), ~100 m */
const WELL_BOAT: HullSpec = {
  len: 100, halfBeam: 9.5, draught: 6, deck: 6.5, focsle: 4.5, rake: 4, bowStart: 0.68,
  colors: [0x8e2a20, 0x1b3c66, 0xf2f4f5], deckColor: 0x4f5d58,
};
export const BOW_X = WELL_BOAT.len / 2; // keula vesirajassa

export function buildWellBoat(): THREE.Group {
  const ship = new THREE.Group();
  const white = new THREE.MeshStandardMaterial({ color: 0xf2f4f5, roughness: 0.4, metalness: 0.05 });
  const navy = new THREE.MeshStandardMaterial({ color: 0x1b3c66, roughness: 0.45, metalness: 0.1 });
  const glass = new THREE.MeshStandardMaterial({ color: 0x0b1620, roughness: 0.08, metalness: 0.9 });
  const steel = new THREE.MeshStandardMaterial({ color: 0x77828a, roughness: 0.55, metalness: 0.4 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x2b3238, roughness: 0.7 });
  const yellow = new THREE.MeshStandardMaterial({ color: 0xe2a50a, roughness: 0.5 });
  const orange = new THREE.MeshStandardMaterial({ color: 0xe8591a, roughness: 0.5 });

  const add = (geo: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z: number): THREE.Mesh => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    ship.add(m);
    return m;
  };
  const box = (w: number, h: number, d: number, r = 0) => (r ? new RoundedBoxGeometry(w, h, d, 3, r) : new THREE.BoxGeometry(w, h, d));

  const { hull, deck } = buildHull(WELL_BOAT);
  ship.add(hull, deck);

  // asuintilat + komentosilta keulassa (moderni well boat)
  add(box(26, 10.5, 16, 0.8), white, 22, 11.75, 0);
  add(box(22, 1.1, 16.2), glass, 22, 14.9, 0);
  add(box(22, 3, 15, 0.5), white, 22, 18.5, 0);
  add(box(18, 1.1, 15.2), glass, 22, 18.8, 0);
  add(box(12, 3.4, 18.5, 0.5), white, 26, 21.7, 0);
  add(box(12.3, 1.4, 18.8), glass, 26, 22.3, 0);
  // masto + tutka
  add(new THREE.CylinderGeometry(0.3, 0.45, 8, 8), steel, 24, 27.4, 0);
  add(box(0.5, 0.35, 4.5), white, 24, 29.6, 0);
  add(box(0.3, 0.3, 7), steel, 24, 26.4, 0);
  // kulkuvalot siiven päissä: vihreä oikealla (styrpuuri = +z kun keula +x ja y ylös), punainen vasemmalla
  add(new THREE.SphereGeometry(0.45, 8, 8), new THREE.MeshBasicMaterial({ color: 0x2ecc71 }), 26, 23.7, 9.2);
  add(new THREE.SphereGeometry(0.45, 8, 8), new THREE.MeshBasicMaterial({ color: 0xe74c3c }), 26, 23.7, -9.2);
  // pelastusvene
  add(box(6, 1.8, 2.2, 0.7), orange, 15, 18, 6);
  // kaksi savupiippua ylärakenteen takana
  for (const z of [-6.2, 6.2]) {
    add(box(3.2, 9, 2.6, 0.4), navy, 6.5, 11, z);
    add(box(3.4, 1, 2.8), dark, 6.5, 15.2, z);
  }

  // työkansi perässä: kolme kalatankin luukkua, putkistot, jakotukki (perimmän luukun takana RO-laitos: kontit + rumpusuodatin)
  for (const x of [-35, -20, -5]) add(box(13, 1.2, 12.4, 0.3), dark, x, 7.1, 0);
  const pipe = new THREE.CylinderGeometry(0.4, 0.4, 43, 10);
  pipe.rotateZ(Math.PI / 2);
  for (const z of [-7.6, 7.6]) add(pipe, steel, -18.5, 8.4, z);
  add(box(2, 1.6, 16), steel, -12.5, 8.2, 0);
  add(box(2, 1.6, 16), steel, -27.5, 8.2, 0);
  // kaksi kansinosturia, puomi 35° vaakatasosta ylös perään päin (sylinterin akseli kääntyy 55° pystystä)
  const boomGeo = new THREE.CylinderGeometry(0.45, 0.6, 16, 8);
  for (const [x, z] of [[-15, 7], [-30, -7]] as const) {
    add(new THREE.CylinderGeometry(1.1, 1.3, 6, 12), yellow, x, 9.5, z);
    add(box(2.6, 2, 2.6, 0.4), yellow, x, 13.2, z);
    add(boomGeo, yellow, x - 6.55, 17.6, z).rotation.z = THREE.MathUtils.degToRad(55);
  }
  // RO-laitos peräkannelle: 2 × Lamor 20 ft RO -kontti (±z), 10 ft CIP-kontti, HEX-rumpusuodatin + putket
  ship.add(buildDeckPlant());
  return ship;
}
