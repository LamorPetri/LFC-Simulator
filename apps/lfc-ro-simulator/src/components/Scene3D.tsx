import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { useSim } from '../sim/store';
import { FARMS, ROUTE, FARM_RADIUS_M } from '../sim/data';
import { TERRAIN } from './terrain';
import { createOceanMaterial } from './oceanMaterial';
// GLB Viten assettiputkena: hashattu URL, suhteessa JS-moduuliin (ei riipu document.baseURI:sta eikä CDN:n vanhentuneesta välimuistista)
import workboatGlbUrl from '../assets/workboat20.glb?url';

const R0 = { lat: 63.675, lon: 9.4 };
const M_PER_LAT = 111320;
const M_PER_LON = 55050;

function toXZ(lat: number, lon: number): [number, number] {
  return [(lon - R0.lon) * M_PER_LON, (lat - R0.lat) * M_PER_LAT];
}

/* deterministinen kohina värivärähtelyyn */
function hashNoise(i: number, j: number): number {
  const s = Math.sin(i * 127.1 + j * 311.7) * 43758.5453;
  return s - Math.floor(s);
}

const EXAG = 3.1; // pystysuurennos — vuoret erottuvat

/** Solvtrans-tyylinen Live Fish Carrier / well boat. */
function buildWellBoat(): THREE.Group {
  const ship = new THREE.Group();
  const white = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.38, metalness: 0.08 });
  const navy = new THREE.MeshStandardMaterial({ color: 0x1f3a5f, roughness: 0.45 });
  const glass = new THREE.MeshStandardMaterial({ color: 0x0f2233, roughness: 0.12, metalness: 0.75 });
  const red = new THREE.MeshStandardMaterial({ color: 0xa93226, roughness: 0.5 });
  const grey = new THREE.MeshStandardMaterial({ color: 0xb9c2c9, roughness: 0.6 });
  const orange = new THREE.MeshStandardMaterial({ color: 0xe67e22, roughness: 0.5 });

  // runko: pieneltä kannalta piirretty ääriviiva (prow edessä +x)
  const hullShape = new THREE.Shape();
  const L = 52; // puolipituus
  const W = 9;  // puolileveys
  hullShape.moveTo(-L, 0);
  hullShape.quadraticCurveTo(-L - 4, 6, -L - 2, W);
  hullShape.lineTo(-20, W + 1);
  hullShape.lineTo(24, W);
  hullShape.quadraticCurveTo(42, W - 2, L + 4, 1.2);
  hullShape.quadraticCurveTo(44, -1.2, 24, -W);
  hullShape.lineTo(-20, -W - 1);
  hullShape.quadraticCurveTo(-L - 4, -6, -L, 0);
  const hullGeo = new THREE.ExtrudeGeometry(hullShape, { depth: 11, bevelEnabled: false });
  hullGeo.rotateX(Math.PI / 2); // litistys pystyyn
  const hull = new THREE.Mesh(hullGeo, white);
  hull.position.y = 4;
  ship.add(hull);
  // sinertävä vesiraita
  const stripeGeo = new THREE.ExtrudeGeometry(hullShape, { depth: 2.2, bevelEnabled: false });
  stripeGeo.rotateX(Math.PI / 2);
  const stripe = new THREE.Mesh(stripeGeo, navy);
  stripe.position.y = 4.6;
  stripe.scale.set(1.005, 1, 1.005);
  ship.add(stripe);
  // punainen pohja
  const bottomGeo = new THREE.ExtrudeGeometry(hullShape, { depth: 3.4, bevelEnabled: false });
  bottomGeo.rotateX(Math.PI / 2);
  const bottom = new THREE.Mesh(bottomGeo, red);
  bottom.position.y = -6.4;
  bottom.scale.set(0.96, 1, 0.96);
  ship.add(bottom);
  // kanssi
  const deckShape = hullShape;
  const deckGeo = new THREE.ExtrudeGeometry(deckShape, { depth: 1.2, bevelEnabled: false });
  deckGeo.rotateX(Math.PI / 2);
  const deck = new THREE.Mesh(deckGeo, grey);
  deck.position.y = 9.4;
  deck.scale.set(0.97, 1, 0.97);
  ship.add(deck);

  // ylärakenne (well boat -tyyliin lähes koko peräpuolikas)
  const house = new THREE.Mesh(new THREE.BoxGeometry(74, 12, 17), white);
  house.position.set(-14, 16, 0);
  ship.add(house);
  const house2 = new THREE.Mesh(new THREE.BoxGeometry(50, 9, 15.4), white);
  house2.position.set(-24, 26, 0);
  ship.add(house2);
  // ikkunakaistat
  for (const [y, z, len, x] of [[13.5, 8.6, 70, -14], [13.5, -8.6, 70, -14], [23.5, 7.8, 46, -24], [23.5, -7.8, 46, -24]] as const) {
    const band = new THREE.Mesh(new THREE.BoxGeometry(len, 2.6, 0.6), glass);
    band.position.set(x, y, z);
    ship.add(band);
  }
  // komentosilta + siivet
  const bridge = new THREE.Mesh(new THREE.BoxGeometry(16, 7, 19), white);
  bridge.position.set(6, 33.5, 0);
  ship.add(bridge);
  const bridgeGlass = new THREE.Mesh(new THREE.BoxGeometry(0.6, 3.2, 17), glass);
  bridgeGlass.position.set(14.2, 34.5, 0);
  ship.add(bridgeGlass);
  // piippu
  const funnel = new THREE.Mesh(new THREE.BoxGeometry(10, 8, 8), white);
  funnel.position.set(-38, 34, 0);
  ship.add(funnel);
  const funnelBand = new THREE.Mesh(new THREE.BoxGeometry(10.4, 2.2, 8.4), navy);
  funnelBand.position.set(-38, 37.5, 0);
  ship.add(funnelBand);
  // helikopterikansi ylärakenteen päällä
  const heli = new THREE.Mesh(new THREE.CylinderGeometry(9, 9, 0.8, 24), grey);
  heli.position.set(-14, 22.6, 0);
  ship.add(heli);
  const heliRing = new THREE.Mesh(new THREE.TorusGeometry(7.4, 0.5, 8, 28), new THREE.MeshStandardMaterial({ color: 0xe6e6e6 }));
  heliRing.rotation.x = Math.PI / 2;
  heliRing.position.set(-14, 23.2, 0);
  ship.add(heliRing);
  // well-kansiluukut keulapuolella
  const hatchMat = new THREE.MeshStandardMaterial({ color: 0x5d6d7e, roughness: 0.65 });
  for (const x of [26, 38]) {
    const hatch = new THREE.Mesh(new THREE.BoxGeometry(9, 1.6, 13), hatchMat);
    hatch.position.set(x, 10.6, 0);
    ship.add(hatch);
    // kohotettu reunus
    const rim = new THREE.Mesh(new THREE.BoxGeometry(9.6, 0.8, 13.6), white);
    rim.position.set(x, 10.2, 0);
    ship.add(rim);
  }
  // kaksi kansinosturia (Solvtrans-tyyli)
  for (const [x, side] of [[16, 1], [16, -1]] as const) {
    const pedestal = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.7, 5, 10), orange);
    pedestal.position.set(x, 12.7, side * 6);
    ship.add(pedestal);
    const boom1 = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.1, 16, 8), orange);
    boom1.rotation.z = Math.PI / 2.4;
    boom1.rotation.y = side * -0.5;
    boom1.position.set(x + 4, 17.5, side * 10);
    ship.add(boom1);
    const boom2 = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.9, 10, 8), orange);
    boom2.rotation.z = -Math.PI / 3.2;
    boom2.rotation.y = side * -0.5;
    boom2.position.set(x + 9, 20.5, side * 15);
    ship.add(boom2);
  }
  // keulamasto
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 1.1, 22, 8), grey);
  mast.position.set(44, 20, 0);
  ship.add(mast);
  // navigointivalot
  const lightGreen = new THREE.Mesh(new THREE.SphereGeometry(0.9, 8, 8), new THREE.MeshBasicMaterial({ color: 0x2ecc71 }));
  lightGreen.position.set(6, 37.5, 10.5);
  ship.add(lightGreen);
  const lightRed = new THREE.Mesh(new THREE.SphereGeometry(0.9, 8, 8), new THREE.MeshBasicMaterial({ color: 0xe74c3c }));
  lightRed.position.set(6, 37.5, -10.5);
  ship.add(lightRed);
  return ship;
}

export default function Scene3D() {
  const mountRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;
    let disposed = false;

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.92;
    mount.appendChild(renderer.domElement);

    // diagnostiikka (3D info -paneeli): WebGL/GPU, shaderit ja GLB-lataus — helpottaa etädiagnosointia
    const diag = (patch: Record<string, string>) => useSim.getState().setSceneDiag(patch);
    try {
      const gl = renderer.getContext();
      const dbgExt = gl.getExtension('WEBGL_debug_renderer_info');
      diag({
        'Three.js': `r${THREE.REVISION}`,
        WebGL: String(gl.getParameter(gl.VERSION) ?? ''),
        GPU: dbgExt ? String(gl.getParameter(dbgExt.UNMASKED_RENDERER_WEBGL)) : String(gl.getParameter(gl.RENDERER)),
        'Max texture': String(gl.getParameter(gl.MAX_TEXTURE_SIZE)),
        'Pixel ratio': String(renderer.getPixelRatio()),
        'Module URL': import.meta.url.split('?')[0],
        'Document base': document.baseURI,
        'User agent': navigator.userAgent,
        'Device pixel ratio': String(window.devicePixelRatio),
        'GLB status': 'loading…',
      });
    } catch (e) {
      diag({ WebGL: `unavailable: ${String(e)}` });
    }

    const scene = new THREE.Scene();

    /* gradient-taivas (CanvasTexture-kupu) */
    const skyCanvas = document.createElement('canvas');
    skyCanvas.width = 16;
    skyCanvas.height = 256;
    const sctx = skyCanvas.getContext('2d')!;
    const grad = sctx.createLinearGradient(0, 0, 0, 256);
    grad.addColorStop(0, '#5d81a3');
    grad.addColorStop(0.55, '#93b4cd');
    grad.addColorStop(0.82, '#c4d5e2');
    grad.addColorStop(1, '#d3e2ec');
    sctx.fillStyle = grad;
    sctx.fillRect(0, 0, 16, 256);
    const skyTex = new THREE.CanvasTexture(skyCanvas);
    const sky = new THREE.Mesh(
      new THREE.SphereGeometry(70000, 24, 16),
      new THREE.MeshBasicMaterial({ map: skyTex, side: THREE.BackSide, fog: false }),
    );
    scene.add(sky);
    scene.fog = new THREE.Fog(0xb9c9d7, 10000, 48000);

    const camera = new THREE.PerspectiveCamera(55, 1, 10, 160000);
    camera.position.set(9000, 5000, 11000);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.07;
    controls.maxPolarAngle = Math.PI / 2.04;
    controls.minDistance = 200;
    controls.maxDistance = 60000;

    scene.add(new THREE.HemisphereLight(0xc2d6e8, 0x39512e, 0.8));
    const sun = new THREE.DirectionalLight(0xeff4fb, 2.0);
    sun.position.set(20000, 16000, -9000);
    scene.add(sun);
    const fill = new THREE.DirectionalLight(0x9db8d6, 0.5);
    fill.position.set(-12000, 8000, 14000);
    scene.add(fill);

    /* ----- maasto rinteineen ----- */
    const cols = TERRAIN.cols;
    const rows = TERRAIN.rows;
    const geo = new THREE.PlaneGeometry(1, 1, cols - 1, rows - 1);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position as THREE.BufferAttribute;
    const colors = new Float32Array(cols * rows * 3);
    const c = {
      deep: new THREE.Color(0x0d3354),
      mid: new THREE.Color(0x13567e),
      shal: new THREE.Color(0x3f8db3),
      sand: new THREE.Color(0xd8c48f),
      grass: new THREE.Color(0x3f6b35),
      forest: new THREE.Color(0x2d5228),
      rock: new THREE.Color(0x6e6a5f),
      dark: new THREE.Color(0x4a463d),
      snow: new THREE.Color(0xf4f7f9),
    };
    const tmp = new THREE.Color();
    for (let i = 0; i < rows; i++) {
      for (let j = 0; j < cols; j++) {
        const idx = i * cols + j;
        const raw = TERRAIN.values[idx];
        const h = raw / 10;
        const [x, z] = toXZ(TERRAIN.lat0 + i * TERRAIN.dlat, TERRAIN.lon0 + j * TERRAIN.dlon);
        pos.setXYZ(idx, x, h * EXAG, z);
        // rinne (yksinkertainen naapurierotus)
        const hR = (j < cols - 1 ? TERRAIN.values[idx + 1] : raw) / 10;
        const hU = (i < rows - 1 ? TERRAIN.values[idx + cols] : raw) / 10;
        const slope = Math.min(1, (Math.abs(hR - h) + Math.abs(hU - h)) / 26);
        if (h < -60) tmp.copy(c.deep);
        else if (h < -18) tmp.copy(c.deep).lerp(c.mid, (h + 60) / 42);
        else if (h < -10) tmp.copy(c.mid).lerp(c.shal, (h + 18) / 8);
        else if (h <= 0) tmp.copy(c.shal).lerp(c.sand, (h + 10) / 10);
        else if (h < 25) tmp.copy(c.sand).lerp(c.grass, h / 25);
        else if (h < 130) tmp.copy(c.grass).lerp(c.forest, (h - 25) / 105);
        else if (h < 330) tmp.copy(c.forest).lerp(c.rock, (h - 130) / 200);
        else tmp.copy(c.rock).lerp(c.snow, Math.min(1, (h - 330) / 160));
        // jyrkät rinteet paljastavat kalliota
        if (h > 15) tmp.lerp(c.dark, slope * 0.55);
        // lumi vain loiville huippuille
        if (h > 400 && slope < 0.5) tmp.lerp(c.snow, 0.8);
        // hienovarainen kohina
        const n = 0.94 + hashNoise(i, j) * 0.12;
        colors[idx * 3] = Math.min(1, tmp.r * n);
        colors[idx * 3 + 1] = Math.min(1, tmp.g * n);
        colors[idx * 3 + 2] = Math.min(1, tmp.b * n);
      }
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.computeVertexNormals();
    scene.add(new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.96, metalness: 0 })));

    /* ----- valtameri: Gerstner + fresnel + vaahto (Lamor-tyyli) ----- */
    const ocean = createOceanMaterial();
    const depthData = new Float32Array(TERRAIN.cols * TERRAIN.rows);
    for (let i = 0; i < TERRAIN.values.length; i++) depthData[i] = TERRAIN.values[i] / 10;
    const depthTex = new THREE.DataTexture(depthData, TERRAIN.cols, TERRAIN.rows, THREE.RedFormat, THREE.FloatType);
    depthTex.minFilter = THREE.LinearFilter;
    depthTex.magFilter = THREE.LinearFilter;
    depthTex.needsUpdate = true;
    const [tx0, tz0] = toXZ(TERRAIN.lat0, TERRAIN.lon0);
    const [tx1, tz1] = toXZ(TERRAIN.lat0 + (TERRAIN.rows - 1) * TERRAIN.dlat, TERRAIN.lon0 + (TERRAIN.cols - 1) * TERRAIN.dlon);
    ocean.uniforms.uDepthTex.value = depthTex;
    ocean.uniforms.uTerrainUv.value.set(tx0, tz0, 1 / (tx1 - tx0), 1 / (tz1 - tz0));
    ocean.uniforms.uSunDir.value.copy(sun.position).normalize();
    const nearGeo = new THREE.PlaneGeometry(13000, 13000, 420, 420);
    nearGeo.rotateX(-Math.PI / 2);
    const nearWater = new THREE.Mesh(nearGeo, ocean.material as THREE.Material);
    scene.add(nearWater);
    const farGeo = new THREE.PlaneGeometry(1, 1, 8, 8);
    farGeo.rotateX(-Math.PI / 2);
    const farWater = new THREE.Mesh(farGeo, ocean.material as THREE.Material);
    farWater.scale.set(Math.abs(tx1 - tx0) * 1.6, 1, Math.abs(tz1 - tz0) * 1.6);
    farWater.position.set((tx0 + tx1) / 2, 0, (tz0 + tz1) / 2);
    scene.add(farWater);

    /* ----- kalankasvatushäkit ----- */
    const farmGroup = new THREE.Group();
    const collarMat = new THREE.MeshStandardMaterial({ color: 0x2c3e50, roughness: 0.6 });
    const floatMat = new THREE.MeshStandardMaterial({ color: 0xe8e8e8, roughness: 0.5 });
    const netMat = new THREE.MeshStandardMaterial({ color: 0x9bd1e8, transparent: true, opacity: 0.30, side: THREE.DoubleSide });
    const bargeMat = new THREE.MeshStandardMaterial({ color: 0xf39c12, roughness: 0.55 });
    const zoneMat = new THREE.MeshBasicMaterial({ color: 0xff8c00, transparent: true, opacity: 0.08, side: THREE.DoubleSide });
    for (const f of FARMS) {
      const [x, z] = toXZ(f.lat, f.lon);
      const g = new THREE.Group();
      const offs = [[0, 0], [72, 12], [-72, 14], [22, 70], [-32, -68], [82, -56]];
      for (const [dx, dz] of offs) {
        const collar = new THREE.Mesh(new THREE.CylinderGeometry(26, 26, 4, 18, 1, true), collarMat);
        collar.position.set(dx, 1.5, dz);
        g.add(collar);
        const rim = new THREE.Mesh(new THREE.TorusGeometry(26, 3.4, 8, 20), floatMat);
        rim.rotation.x = Math.PI / 2;
        rim.position.set(dx, 3.4, dz);
        g.add(rim);
        const net = new THREE.Mesh(new THREE.CylinderGeometry(25, 22, 20, 12, 1, true), netMat);
        net.position.set(dx, -9, dz);
        g.add(net);
      }
      // käytävä renkaiden välissä
      const walkMat = new THREE.MeshStandardMaterial({ color: 0xbdc3c7, roughness: 0.8 });
      for (const [x1, z1] of offs) {
        const walk = new THREE.Mesh(new THREE.BoxGeometry(Math.hypot(x1, z1) || 1, 1.6, 5), walkMat);
        walk.position.set(x1 / 2, 3, z1 / 2);
        walk.rotation.y = -Math.atan2(z1, x1);
        walk.scale.x = 1;
        g.add(walk);
      }
      // rehulautta siloineen
      const barge = new THREE.Mesh(new THREE.BoxGeometry(38, 9, 17), bargeMat);
      barge.position.set(-100, 6, 46);
      g.add(barge);
      const houseB = new THREE.Mesh(new THREE.BoxGeometry(14, 7, 12), new THREE.MeshStandardMaterial({ color: 0xecf0f1 }));
      houseB.position.set(-104, 13, 44);
      g.add(houseB);
      for (const dz of [-3, 3]) {
        const silo = new THREE.Mesh(new THREE.CylinderGeometry(4, 4, 14, 10), new THREE.MeshStandardMaterial({ color: 0xd5dbdb }));
        silo.position.set(-96, 18, 46 + dz);
        g.add(silo);
      }
      const zone = new THREE.Mesh(new THREE.CircleGeometry(FARM_RADIUS_M, 40), zoneMat);
      zone.rotation.x = -Math.PI / 2;
      zone.position.y = 10;
      g.add(zone);
      g.position.set(x, 0, z);
      farmGroup.add(g);
    }
    scene.add(farmGroup);

    /* ----- well boat: GLB-malli (Lamor Simin tapaan), proseduraalinen varalla ----- */
    const ship = new THREE.Group();
    scene.add(ship);
    // proseduraalinen malli: keula +x -> käännä +z-suuntaan
    const procedural = buildWellBoat();
    procedural.rotation.y = -Math.PI / 2;
    ship.add(procedural);
    // GLB: lataa ja korvaa onnistuessa (metrejä, vesiraja-origo, forward +x).
    // Useita URL-kandidaatteja (moduulisuhde, dokumentti, legacy-polku) + uudelleenyritys:
    // CDN voi palauttaa hetkellisesti virheen julkaisun jälkeen (muuten proseduraalinen jäisi koko istunnoksi).
    const glbFile = workboatGlbUrl.split('/').pop() ?? 'workboat20.glb';
    const glbCandidates = [workboatGlbUrl];
    try {
      glbCandidates.push(new URL(`assets/${glbFile}`, document.baseURI).href, new URL('models/workboat20.glb', document.baseURI).href);
    } catch {
      /* document.baseURI ei hierarkkinen — riittää moduulisuhde */
    }
    type GlbResult = { gltf: Awaited<ReturnType<GLTFLoader['loadAsync']>>; url: string };
    const loadGlb = (attempt: number): Promise<GlbResult> => {
      const url = glbCandidates[Math.min(Math.floor(attempt / 2), glbCandidates.length - 1)];
      return new GLTFLoader().loadAsync(url).then((gltf) => ({ gltf, url }), (e) => {
        if (disposed || attempt >= 7) throw e;
        return new Promise<GlbResult>((resolve, reject) => {
          window.setTimeout(() => loadGlb(attempt + 1).then(resolve, reject), Math.min(15000, 1000 * 2 ** attempt));
        });
      });
    };
    const t0 = performance.now();
    void loadGlb(0).then(({ gltf, url }) => {
      diag({ 'GLB status': `loaded ${url} (${Math.round(performance.now() - t0)} ms)` });
      if (disposed) return;
      const wrapper = new THREE.Group();
      gltf.scene.rotation.y = -Math.PI / 2; // forward +x -> +z
      gltf.scene.traverse((o) => {
        const me = o as THREE.Mesh;
        if (me.isMesh) {
          if (!me.geometry.getAttribute('normal')) me.geometry.computeVertexNormals();
          const mat = me.material as THREE.MeshStandardMaterial;
          if (mat && 'roughness' in mat) mat.envMapIntensity = 1.2;
        }
      });
      wrapper.add(gltf.scene);
      wrapper.scale.setScalar(4.3); // 20 m workboat -> ~86 m LFC
      wrapper.position.y = 1;
      ship.add(wrapper);
      procedural.visible = false; // Lamor-periaate: GLB piilottaa proseduraalisen
    }).catch((e: unknown) => {
      const msg = e instanceof Error ? e.message : String(e);
      diag({ 'GLB status': `FAILED: ${msg} (tried ${glbCandidates.join(', ')})` });
      console.warn('GLB ei ladannut, proseduraalinen jäi:', e);
    });


    /* ----- keulasuihke (Lamor Simin tapaan: pooled Points + painovoima) ----- */
    const SPRAY_N = 160;
    const sprayPos = new Float32Array(SPRAY_N * 3);
    const sprayVel = new Float32Array(SPRAY_N * 3);
    const sprayLife = new Float32Array(SPRAY_N);
    for (let i = 0; i < SPRAY_N; i++) sprayPos[i * 3 + 1] = -1e4;
    const sprayGeo = new THREE.BufferGeometry();
    sprayGeo.setAttribute('position', new THREE.BufferAttribute(sprayPos, 3).setUsage(THREE.DynamicDrawUsage));
    const spray = new THREE.Points(sprayGeo, new THREE.PointsMaterial({ color: 0xffffff, size: 2.6, transparent: true, opacity: 0.75, depthWrite: false }));
    spray.frustumCulled = false;
    scene.add(spray);
    let sprayNext = 0;
    const sprayBurst = (x: number, y: number, z: number, strength: number) => {
      const n = Math.floor(10 + 26 * strength);
      for (let k = 0; k < n; k++, sprayNext = (sprayNext + 1) % SPRAY_N) {
        sprayPos[sprayNext * 3] = x; sprayPos[sprayNext * 3 + 1] = y; sprayPos[sprayNext * 3 + 2] = z;
        const a = Math.random() * Math.PI * 2;
        const sp = (2 + 7 * strength) * Math.random();
        sprayVel[sprayNext * 3] = Math.cos(a) * sp;
        sprayVel[sprayNext * 3 + 1] = (6 + 14 * strength) * (0.4 + Math.random());
        sprayVel[sprayNext * 3 + 2] = Math.sin(a) * sp;
        sprayLife[sprayNext] = 0.7 + Math.random() * 1.0;
      }
    };

    /* ----- animaatio ----- */
    let raf = 0;
    let shaderChecked = false;
    let lastT = performance.now();
    let prevPos: [number, number] | null = null;
    let heading = 0;
    let sprayTimer = 0;
    // pehmeä renderisijainti: storessa 1 Hz, täällä 60 fps interpolointi
    let rLat = useSim.getState().vessel.lat;
    let rLon = useSim.getState().vessel.lon;
    const camPos = camera.position.clone();
    const tick = (now: number) => {
      const dt = Math.min(0.1, (now - lastT) / 1000);
      lastT = now;
      const s = useSim.getState();
      const k = 1 - Math.exp(-dt * 2.6);
      rLat += (s.vessel.lat - rLat) * k;
      rLon += (s.vessel.lon - rLon) * k;
      const [x, z] = toXZ(rLat, rLon);
      if (prevPos) {
        const dx = x - prevPos[0];
        const dz = z - prevPos[1];
        if (Math.hypot(dx, dz) > 0.3) {
          const target = Math.atan2(dx, dz);
          let d = target - heading;
          while (d > Math.PI) d -= 2 * Math.PI;
          while (d < -Math.PI) d += 2 * Math.PI;
          heading += d * Math.min(1, dt * 2.0);
        }
      }
      prevPos = [x, z];
      const t = now / 1000;
      ship.position.set(x, 1 + Math.sin(t * 1.1) * 0.9, z);
      ship.rotation.y = heading;
      ship.rotation.z = Math.sin(t * 0.8) * 0.012;
      ship.rotation.x = Math.sin(t * 0.63) * 0.008;

      // keulasuihke: purske keulan kohdalla liikkuessa
      if (prevPos && Math.hypot(x - prevPos[0], z - prevPos[1]) >= 0) {
        sprayTimer += dt;
        if (sprayTimer > 0.12) {
          sprayTimer = 0;
          const bowX = x + Math.sin(heading) * 88;
          const bowZ = z + Math.cos(heading) * 88;
          sprayBurst(bowX, 3, bowZ, 0.35);
        }
      }
      for (let i = 0; i < SPRAY_N; i++) {
        if (sprayLife[i] <= 0) { sprayPos[i * 3 + 1] = -1e4; continue; }
        sprayLife[i] -= dt;
        sprayVel[i * 3 + 1] -= 9.81 * dt;
        for (let a = 0; a < 3; a++) sprayPos[i * 3 + a] += sprayVel[i * 3 + a] * dt;
      }
      sprayGeo.attributes.position.needsUpdate = true;

      // valtameri: aika + laivan tila uniformeihin, patch seuraa alusta
      ocean.uniforms.uTime.value = t;
      ocean.uniforms.uShipPos.value.set(x, z);
      ocean.uniforms.uHeading.value = heading;
      ocean.uniforms.uSpeedK.value = s.mode === 'auto' ? 0.75 : 0.35;
      nearWater.position.set(x, 0, z);

      if (s.chase) {
        const behind = new THREE.Vector3(Math.sin(heading), 0, Math.cos(heading)).multiplyScalar(-700);
        camPos.lerp(new THREE.Vector3(x + behind.x, 330, z + behind.z), 0.05);
        camera.position.copy(camPos);
        controls.target.lerp(new THREE.Vector3(x, 40, z), 0.07);
      }
      controls.update();
      renderer.render(scene, camera);
      // shader-tarkistus ensimmäisen ruudun jälkeen: jos meri-shader ei käänny (ajuri/GPU), korvataan yksinkertaisella materiaalilla
      if (!shaderChecked) {
        shaderChecked = true;
        const programs = (renderer.info.programs ?? []) as Array<{ name?: string; diagnostics?: { programLog?: string } }>;
        const failed = programs.filter((p) => p.diagnostics);
        if (failed.length) {
          const summary = failed.map((p) => `${p.name ?? '?'}: ${(p.diagnostics?.programLog ?? '').slice(0, 400)}`).join(' | ');
          diag({ Shaders: `FAILED: ${summary}` });
          if (failed.some((p) => p.name === 'ShaderMaterial')) {
            const fallback = new THREE.MeshStandardMaterial({ color: 0x1e4f6b, roughness: 0.32, metalness: 0.05, transparent: true, opacity: 0.94 });
            nearWater.material = fallback;
            farWater.material = fallback;
            diag({ Ocean: 'shader failed — flat fallback water' });
          }
        } else {
          diag({ Shaders: `ok (${programs.length} programs)`, Ocean: 'Gerstner/fresnel shader' });
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    const resize = () => {
      const w = mount.clientWidth || 640;
      const h = mount.clientHeight || 480;
      // updateStyle=true: canvasin CSS-koko = säiliön koko (piirtoalue × pikselisuhde). Ilman tätä HiDPI-näytöllä
      // canvas oleisi 1.75× säiliötä -> skene zoomautuisi ja leikkautuisi (näyttäisi "vanhalta/lähikuvalta").
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      diag({ Canvas: `${w}×${h} px (drawing buffer ${renderer.domElement.width}×${renderer.domElement.height})` });
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(mount);

    (mount as unknown as { __setChase?: (v: boolean) => void }).__setChase = (v: boolean) => {
      useSim.setState({ chase: v });
    };

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      ro.disconnect();
      controls.dispose();
      renderer.dispose();
      geo.dispose();
      nearGeo.dispose();
      farGeo.dispose();
      depthTex.dispose();
      if (renderer.domElement.parentElement === mount) mount.removeChild(renderer.domElement);
    };
  }, []);

  const sim = useSim();
  return <div ref={mountRef} className="scene-3d" title={`Route: ${ROUTE.map((r) => r.name).join(' → ')}`} data-producing={sim.producing ? 1 : 0} />;
}
