import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { buildHull } from './wellBoat';

/* Rehulautta (AKVA / ScaleAQ -tyylinen teräslautta), ~36 m. Rakennetaan keula +x, käännetään lopuksi
   niin että perä ja rehuletkut osoittavat kasseille (+x). Palauttaa yhden geometrian per materiaali. */
const LEN = 36;
const HALF_BEAM = 6;
const DECK = 2.5;

export type Part = [THREE.BufferGeometry, THREE.Material];

/** pens: kassien keskipisteet [x, z] lautan keskipisteen suhteen (kassit +x-puolella, kaksi riviä z:n molemmin puolin). */
export function buildFeedBarge(pens: number[][], penRadius: number): Part[] {
  const mats = {
    white: new THREE.MeshStandardMaterial({ color: 0xeef1f2, roughness: 0.45, metalness: 0.05 }),
    glass: new THREE.MeshStandardMaterial({ color: 0x0b1620, roughness: 0.08, metalness: 0.9 }),
    steel: new THREE.MeshStandardMaterial({ color: 0x8a949b, roughness: 0.5, metalness: 0.5 }),
    black: new THREE.MeshStandardMaterial({ color: 0x15181b, roughness: 0.8 }),
    yellow: new THREE.MeshStandardMaterial({ color: 0xe2a50a, roughness: 0.5 }),
    lamp: new THREE.MeshBasicMaterial({ color: 0xfff3c4 }),
  };
  const bins = new Map<THREE.Material, THREE.BufferGeometry[]>();
  const put = (mat: THREE.Material, geo: THREE.BufferGeometry, x: number, y: number, z: number) => {
    bins.set(mat, [...(bins.get(mat) ?? []), geo.translate(x, y, z)]);
  };
  const box = (w: number, h: number, d: number, r = 0) => (r ? new RoundedBoxGeometry(w, h, d, 2, r) : new THREE.BoxGeometry(w, h, d));
  const cyl = (r: number, h: number, seg = 10) => new THREE.CylinderGeometry(r, r, h, seg);
  // kaide suorakaiteen ympäri: yläjohde, välijohde ja tolpat
  const railing = (cx: number, cz: number, len: number, wid: number, y0: number) => {
    for (const y of [0.55, 1.05]) {
      for (const sz of [-1, 1]) put(mats.steel, box(len, 0.07, 0.07), cx, y0 + y, cz + (sz * wid) / 2);
      for (const sx of [-1, 1]) put(mats.steel, box(0.07, 0.07, wid), cx + (sx * len) / 2, y0 + y, cz);
    }
    const nx = Math.round(len / 2.5);
    for (let i = 0; i <= nx; i++) for (const sz of [-1, 1]) put(mats.steel, box(0.07, 1.05, 0.07), cx - len / 2 + (i * len) / nx, y0 + 0.525, cz + (sz * wid) / 2);
  };

  // runko: tumma teräs, viisto leveä keula, parras kaiteena
  const { hull, deck } = buildHull({
    len: LEN, halfBeam: HALF_BEAM, draught: 1.6, deck: DECK, focsle: 0, rake: 2.5, bowStart: 0.8,
    colors: [0x1d2327, 0x37424b, 0x4a5761], deckColor: 0x566059,
  });

  // siilotalo: rehusiilot ovat talon sisällä, katolla näkyvät vain kupolit ja täyttöluukut
  put(mats.white, box(17, 6, 10, 0.35), -3.5, DECK + 3, 0);
  for (const x of [-10, -5.7, -1.3, 3]) {
    for (const z of [-2.6, 2.6]) {
      put(mats.white, new THREE.SphereGeometry(1.9, 16, 6, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 0.45, 1), x, DECK + 6, z);
      put(mats.steel, cyl(0.45, 0.35, 12), x, DECK + 6.95, z);
    }
  }
  railing(-3.5, 0, 16.6, 9.6, DECK + 6);
  put(mats.steel, box(0.9, 5.6, 0.12), 5.2, DECK + 2.9, 3.6); // tikkaat katolle

  // ohjaamorakennus keulassa: kaksi kerrosta, ylempi on panoraamaohjaamo
  put(mats.white, box(7, 2.8, 9, 0.3), 10.5, DECK + 1.4, 0);
  put(mats.glass, box(5, 1, 9.15), 10.5, DECK + 1.6, 0);
  put(mats.white, box(7.6, 2.8, 10, 0.3), 10.5, DECK + 4.2, 0);
  put(mats.glass, box(7.75, 1.2, 10.15), 10.5, DECK + 4.5, 0);
  railing(10.5, 0, 7.2, 9.6, DECK + 5.6);
  // masto: antennit, tutka ja valo
  put(mats.steel, cyl(0.12, 5, 6), 10.5, DECK + 8.1, 0);
  put(mats.steel, box(0.08, 0.08, 3), 10.5, DECK + 9.4, 0);
  for (const z of [-1.4, 1.4]) put(mats.steel, cyl(0.04, 2.2, 5), 10.5, DECK + 10.5, z);
  put(mats.white, box(0.3, 0.25, 1.8), 10.5, DECK + 8.3, 0);
  put(mats.lamp, new THREE.SphereGeometry(0.22, 8, 6), 10.5, DECK + 10.7, 0);
  for (const z of [-4.6, 4.6]) put(mats.lamp, box(0.3, 0.2, 0.5), 6.65, DECK + 5.3, z); // työvalot kannelle

  // perä: puhallinhuone, rehuputkien jakotukki ja kansinosturi
  put(mats.white, box(3.4, 2.4, 6, 0.2), -14.6, DECK + 1.2, -1.5);
  put(mats.steel, box(0.8, 0.8, 8), -17, DECK + 0.6, 0);
  put(mats.yellow, cyl(0.45, 3, 10), -15.5, DECK + 1.5, 4.2);
  put(mats.yellow, box(1.2, 1, 1.2, 0.2), -15.5, DECK + 3.3, 4.2);
  put(mats.yellow, new THREE.CylinderGeometry(0.2, 0.3, 8, 8).rotateZ(THREE.MathUtils.degToRad(60)), -15.5 - 3.46, DECK + 3.6 + 2, 4.2);

  // lepuuttajat kyljillä
  for (const x of [-14, -8, -2, 4, 10]) for (const z of [-1, 1]) put(mats.black, cyl(0.5, 1.9, 10), x, 1.1, z * (HALF_BEAM + 0.42));

  const merge = (gs: THREE.BufferGeometry[]) => mergeGeometries(gs.map((g) => (g.index ? g.toNonIndexed() : g)));
  // lautta rakennettiin keula +x: käännä perä kasseja kohti
  const parts: Part[] = [[hull.geometry, hull.material], [deck.geometry, deck.material], ...[...bins].map(([m, gs]): Part => [merge(gs), m])];
  for (const [g] of parts) g.rotateY(Math.PI);

  // kelluvat rehuletkut: perästä rivien väliseen käytävään ja siitä jokaiselle kassille
  const sternX = LEN / 2 + 1;
  const hoses = pens.map(([px, pz], i) => {
    const sgn = Math.sign(pz);
    const lane = sgn * (0.7 + (pens.length - 1 - i) % 3 * 0.9); // oma kaista käytävässä
    const edge = sgn * (Math.abs(pz) - penRadius - 0.6);
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(sternX - 1.5, DECK + 0.5, lane * 1.2),
      new THREE.Vector3(sternX + 2.5, 0.15, lane * 1.2),
      new THREE.Vector3(sternX + 14, 0.15, lane),
      new THREE.Vector3(px - 18, 0.15, lane),
      new THREE.Vector3(px - 5, 0.15, sgn * Math.min(Math.abs(edge), Math.abs(lane) + 1.5)),
      new THREE.Vector3(px, 0.6, edge),
    ]);
    return new THREE.TubeGeometry(curve, 48, 0.28, 6);
  });
  parts.push([merge(hoses), new THREE.MeshStandardMaterial({ color: 0xc9cfd3, roughness: 0.6 })]);
  return parts;
}
