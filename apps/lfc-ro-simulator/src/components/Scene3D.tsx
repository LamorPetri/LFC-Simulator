import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { Water } from 'three/examples/jsm/objects/Water.js';
import { Sky } from 'three/examples/jsm/objects/Sky.js';
import { ImprovedNoise } from 'three/examples/jsm/math/ImprovedNoise.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { buildWellBoat, BOW_X } from './wellBoat';
import { buildFeedBarge } from './feedBarge';
import { useSim } from '../sim/store';
import { M_PER_LAT, mPerLon } from '../sim/engine';
import { FARMS, ROUTE, FARM_RADIUS_M } from '../sim/data';
import { TERRAIN } from './terrain';
import './map.css';

const R0 = { lat: 63.675, lon: 9.4 };
const M_PER_LON = mPerLon(R0.lat);

/** Itä = +x, pohjoinen = -z (three.js on oikeakätinen, y ylös): kartta ei peilaudu Map-välilehteen nähden. */
function toXZ(lat: number, lon: number): [number, number] {
  return [(lon - R0.lon) * M_PER_LON, -(lat - R0.lat) * M_PER_LAT];
}

/** radiaanit -> kompassiasteet 0..360 */
const deg = (rad: number) => (THREE.MathUtils.radToDeg(rad) + 360) % 360;

/* deterministinen kohina värivärähtelyyn */
function hashNoise(i: number, j: number): number {
  const s = Math.sin(i * 127.1 + j * 311.7) * 43758.5453;
  return s - Math.floor(s);
}

const EXAG = 3.1; // pystysuurennos — vuoret erottuvat

export default function Scene3D() {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const roseRef = useRef<SVGGElement | null>(null);
  const shipMarkRef = useRef<SVGGElement | null>(null);
  const hdgRef = useRef<SVGTextElement | null>(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.25));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.45;
    mount.appendChild(renderer.domElement);

    const scene = new THREE.Scene();

    scene.fog = new THREE.Fog(0xa9c0d4, 3000, 110000); // ilmaperspektiivi: kaukaiset vuoret sinertyvät (Water ei sumutu)

    const camera = new THREE.PerspectiveCamera(55, 1, 10, 160000);
    camera.position.set(9000, 5000, 11000);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.07;
    controls.maxPolarAngle = Math.PI / 2.04;
    controls.minDistance = 80;
    controls.maxDistance = 60000;

    /* valo: matala aurinko (~20°, pitkä auringonsilta veteen) + taivaan env map */
    scene.add(new THREE.HemisphereLight(0xc2d6e8, 0x39512e, 0.25));
    const sun = new THREE.DirectionalLight(0xfff4e0, 3);
    sun.position.set(20000, 8000, 9000); // kaakossa
    scene.add(sun);
    const sunDir = sun.position.clone().normalize();

    /* taivas: three.js Sky (Preetham + pilvet) leivotaan kerran cubemapiksi -> tausta, heijastus ja env-valo
       ovat pelkkä tekstuurihaku (pilvishaderin ajo joka pikselille 2x/frame oli raskain yksittäinen kulu). */
    const sky = new Sky();
    sky.scale.setScalar(1000);
    const su = sky.material.uniforms;
    su.turbidity.value = 4; su.rayleigh.value = 1; su.mieCoefficient.value = 0.003; su.mieDirectionalG.value = 0.8;
    su.sunPosition.value.copy(sunDir);
    const skyRT = new THREE.WebGLCubeRenderTarget(1024, { type: THREE.HalfFloatType }); // ponytail: static, bake again if sun moves
    new THREE.CubeCamera(1, 5000, skyRT).update(renderer, new THREE.Scene().add(sky));
    sky.geometry.dispose();
    sky.material.dispose();
    scene.background = skyRT.texture;
    scene.environment = skyRT.texture;

    /* ----- maasto: GEBCO-ruudukko 2x tihennettynä; maa korotettu + harjannekohina, rantaviiva (h = 0) säilyy ----- */
    const UP = 2;
    const cols = (TERRAIN.cols - 1) * UP + 1;
    const rows = (TERRAIN.rows - 1) * UP + 1;
    const hAt = (i: number, j: number) => { // bilineaarinen korkeus (m) tihennetyssä ruudukossa
      const fi = i / UP, fj = j / UP;
      const i0 = Math.floor(fi), j0 = Math.floor(fj);
      const i1 = Math.min(i0 + 1, TERRAIN.rows - 1), j1 = Math.min(j0 + 1, TERRAIN.cols - 1);
      const v = (a: number, b: number) => TERRAIN.values[a * TERRAIN.cols + b] / 10;
      const u = fj - j0;
      return THREE.MathUtils.lerp(THREE.MathUtils.lerp(v(i0, j0), v(i0, j1), u), THREE.MathUtils.lerp(v(i1, j0), v(i1, j1), u), fi - i0);
    };
    const perlin = new ImprovedNoise();
    const ridged = (x: number, z: number) => { // 0..1, terävät harjanteet; aallonpituudet 6 / 3 / 1.5 km
      let sum = 0;
      for (let o = 0, f = 1 / 6000, a = 0.5; o < 3; o++, f *= 2, a *= 0.5) sum += a * (1 - Math.abs(perlin.noise(x * f, z * f, o * 7.3)));
      return sum / 0.875;
    };
    const pos = new Float32Array(cols * rows * 3);
    const land = new Uint8Array(cols * rows);
    for (let i = 0; i < rows; i++) {
      for (let j = 0; j < cols; j++) {
        const idx = i * cols + j;
        const h = hAt(i, j);
        const [x, z] = toXZ(TERRAIN.lat0 + (i / UP) * TERRAIN.dlat, TERRAIN.lon0 + (j / UP) * TERRAIN.dlon);
        // maa: matala ranta pysyy matalana, yli 300 m huiput kaksinkertaistuvat, kohina tekee harjanteet
        // +6 m (liukuu 0..3 m korkeudella): matala maa ei z-taistele vesitason kanssa kaukaa katsottuna
        const y = h <= 0 ? h * EXAG : 6 * THREE.MathUtils.smoothstep(h, 0, 3) + h * EXAG * (1 + Math.min(h, 300) / 300) * (0.7 + 0.7 * ridged(x, z));
        pos.set([x, y, z], idx * 3);
        land[idx] = h > 0 ? 1 : 0;
      }
    }
    // vain ruudut joissa on maata: Water on läpinäkymätön, merenpohjaa ei koskaan näy
    const index: number[] = [];
    for (let i = 0; i < rows - 1; i++) {
      for (let j = 0; j < cols - 1; j++) {
        const a = i * cols + j, b = a + 1, c2 = a + cols, d = c2 + 1;
        if (land[a] + land[b] + land[c2] + land[d]) index.push(a, b, c2, b, d, c2);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setIndex(index);
    geo.computeVertexNormals();
    // väri korkeuden ja jyrkkyyden mukaan: märkä rantakallio -> nurmi -> metsä -> kanerva -> kallio -> lumi
    const c = {
      shore: new THREE.Color(0x4a4c47),
      grass: new THREE.Color(0x58743f),
      forest: new THREE.Color(0x2c4728),
      heath: new THREE.Color(0x6a6446),
      rock: new THREE.Color(0x716e67),
      cliff: new THREE.Color(0x3f3d39),
      snow: new THREE.Color(0xf2f5f7),
    };
    const { smoothstep } = THREE.MathUtils;
    const normal = geo.attributes.normal;
    const colors = new Float32Array(cols * rows * 3);
    const tmp = new THREE.Color();
    for (let idx = 0; idx < cols * rows; idx++) {
      const y = pos[idx * 3 + 1];
      const steep = 1 - normal.getY(idx);
      tmp.copy(c.shore)
        .lerp(c.grass, smoothstep(y, 12, 45))
        .lerp(c.forest, smoothstep(y, 60, 350))
        .lerp(c.heath, smoothstep(y, 500, 1000))
        .lerp(c.rock, smoothstep(y, 1300, 2000))
        .lerp(c.cliff, smoothstep(steep, 0.3, 0.6) * smoothstep(y, 30, 200))
        .lerp(c.snow, smoothstep(y, 2300, 3100) * (1 - smoothstep(steep, 0.45, 0.7)));
      const n = 0.9 + hashNoise(idx % cols, Math.floor(idx / cols)) * 0.2;
      colors.set([tmp.r * n, tmp.g * n, tmp.b * n], idx * 3);
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    scene.add(new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.96, metalness: 0 })));

    /* ----- meri: three.js Water (heijastus + normal map). Peittää koko kartan ja reunat horisontin taakse. ----- */
    const [tx0, tz0] = toXZ(TERRAIN.lat0, TERRAIN.lon0);
    const [tx1, tz1] = toXZ(TERRAIN.lat0 + (TERRAIN.rows - 1) * TERRAIN.dlat, TERRAIN.lon0 + (TERRAIN.cols - 1) * TERRAIN.dlon);
    // waternormals.jpg: mrdoob/three.js r187 examples/textures/waternormals.jpg (MIT)
    let water: Water | null = null; // luodaan vasta kun normal map on ladattu (muuten vesi renderöityy mustana)
    let disposed = false;
    const seaGeo = new THREE.PlaneGeometry(Math.abs(tx1 - tx0) * 1.6, Math.abs(tz1 - tz0) * 1.6);
    const addSea = (sea: THREE.Mesh) => {
      sea.rotation.x = -Math.PI / 2;
      sea.position.set((tx0 + tx1) / 2, 0, (tz0 + tz1) / 2);
      scene.add(sea);
    };
    const normals = new THREE.TextureLoader().load(new URL('textures/waternormals.jpg', document.baseURI).href, (tex) => {
      if (disposed) return;
      tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
      tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
      water = new Water(seaGeo, {
        textureWidth: 512, textureHeight: 512, waterNormals: tex, sunDirection: sunDir.clone(), sunColor: 0xffffff,
        waterColor: 0x0b4a5c, distortionScale: 3.0, fog: false, alpha: 1,
      });
      water.material.uniforms.size.value = 4;
      addSea(water);
    }, undefined, () => {
      // ilman normal mapia: tasainen meri, ettei laiva ja saaret jää roikkumaan ilmaan
      console.warn('waternormals.jpg ei latautunut, käytetään tasaista merta');
      if (!disposed) addSea(new THREE.Mesh(seaGeo, new THREE.MeshStandardMaterial({ color: 0x0b4a5c, roughness: 0.15, metalness: 0.3 })));
    });

    /* ----- kalankasvatushäkit: HDPE-rengaskassit 2x3-ruudukossa + rehulautta ----- */
    const PEN_OFFS = [[-64, -33], [0, -33], [64, -33], [-64, 33], [0, 33], [64, 33]];
    const BARGE_X = -128;
    const perPen = (g: THREE.BufferGeometry, y: number) =>
      mergeGeometries(PEN_OFFS.map(([dx, dz]) => g.clone().translate(dx, y, dz)));
    const flat = (g: THREE.BufferGeometry) => g.rotateX(Math.PI / 2);
    const farmParts: [THREE.BufferGeometry, THREE.Material][] = [
      // kaksi mustaa kelluputkea
      [mergeGeometries([
        perPen(flat(new THREE.TorusGeometry(26, 0.5, 6, 48)), 0.3),
        perPen(flat(new THREE.TorusGeometry(24.4, 0.5, 6, 48)), 0.3),
      ]), new THREE.MeshStandardMaterial({ color: 0x14171a, roughness: 0.45 })],
      // kävelytaso putkien välissä
      [perPen(new THREE.RingGeometry(24.4, 26, 48).rotateX(-Math.PI / 2), 0.75),
        new THREE.MeshStandardMaterial({ color: 0x3a4045, roughness: 0.9, side: THREE.DoubleSide })],
      // kaide
      [perPen(flat(new THREE.TorusGeometry(25.2, 0.09, 4, 48)), 2.1),
        new THREE.MeshStandardMaterial({ color: 0xd9a400, roughness: 0.6 })],
      // hyppyverkko kaiteeseen asti
      [perPen(new THREE.CylinderGeometry(25.2, 25.2, 1.4, 48, 1, true), 1.4),
        new THREE.MeshStandardMaterial({ color: 0x1c2226, transparent: true, opacity: 0.45, side: THREE.DoubleSide, depthWrite: false })],
      // lintuverkko keskitolpan varassa
      [perPen(new THREE.ConeGeometry(25.2, 4.5, 32, 1, true), 4.35),
        new THREE.MeshStandardMaterial({ color: 0xdfe6ea, transparent: true, opacity: 0.16, side: THREE.DoubleSide, depthWrite: false })],
      // rehulautta letkuineen (feedBarge.ts), kassien länsipuolella
      ...buildFeedBarge(PEN_OFFS.map(([dx, dz]) => [dx - BARGE_X, dz]), 26).map(([g, m]): [THREE.BufferGeometry, THREE.Material] => [g.translate(BARGE_X, 0, 0), m]),
      // varoalueen merkki
      [new THREE.CircleGeometry(FARM_RADIUS_M, 64).rotateX(-Math.PI / 2).translate(0, 10, 0),
        new THREE.MeshBasicMaterial({ color: 0xff8c00, transparent: true, opacity: 0.08, side: THREE.DoubleSide, depthWrite: false })],
    ];
    // yksi InstancedMesh per osa; tickissä piirretään vain katselupisteen lähellä olevat laitokset
    const FARM_DRAW_M = 12000; // vähintään; kasvaa kun kamera loitontaa (vapaa kamera, koko reitin yleiskuva)
    const farmXZ = FARMS.map((f) => toXZ(f.lat, f.lon));
    const farmMeshes = farmParts.map(([pg, pm]) => {
      const inst = new THREE.InstancedMesh(pg, pm, FARMS.length);
      inst.count = 0;
      inst.frustumCulled = false; // instanssit vaihtuvat; etäisyysrajaus hoitaa karsinnan
      scene.add(inst);
      return inst;
    });
    const farmM = new THREE.Matrix4();
    let farmKey = '';
    const cullFarms = () => {
      const { x: cx, z: cz } = controls.target;
      const r = Math.max(FARM_DRAW_M, camera.position.distanceTo(controls.target) * 1.5);
      const near = farmXZ.filter(([x, z]) => Math.hypot(x - cx, z - cz) < r);
      const key = near.join(';');
      if (key === farmKey) return;
      farmKey = key;
      for (const inst of farmMeshes) {
        near.forEach(([x, z], i) => inst.setMatrixAt(i, farmM.makeTranslation(x, 0, z)));
        inst.count = near.length;
        inst.instanceMatrix.needsUpdate = true;
      }
    };

    /* ----- well boat: proseduraalinen (wellBoat.ts), keula +x -> käännä +z-suuntaan ----- */
    const ship = new THREE.Group();
    scene.add(ship);
    const boat = buildWellBoat();
    boat.rotation.y = -Math.PI / 2;
    ship.add(boat);

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
    let lastT = performance.now();
    let prevPos: [number, number] | null = null;
    let heading = 0;
    let sprayTimer = 0;
    // pehmeä renderisijainti: storessa 1 Hz askelia (~5,7 m), täällä edellisen ja nykyisen store-pisteen
    // välillä TASAISELLA nopeudella (snapshot-interpolointi, ~1 s viive) -> ei kiihtyvyyshyppyjä askelten välillä.
    // Aiheempi eksponentiaalinen lähestyminen sai aluksen ryntäämään jokaisen askelen jälkeen ja hidastumaan.
    let seenLat = useSim.getState().vessel.lat;
    let seenLon = useSim.getState().vessel.lon;
    let prevLat = seenLat, prevLon = seenLon;
    let currLat = seenLat, currLon = seenLon;
    let lastSwitch = performance.now();
    let segDur = 1000;
    const camPos = camera.position.clone();
    const tmpV = new THREE.Vector3();
    const tick = (now: number) => {
      const dt = Math.min(0.1, (now - lastT) / 1000);
      lastT = now;
      const s = useSim.getState();
      if (s.vessel.lat !== seenLat || s.vessel.lon !== seenLon) {
        // uusi store-askel: nykyinen interpoloitu sijainti edelliseksi pisteeksi (liike jatkuu katkeamatta)
        const u0 = Math.min(1, Math.max(0, (now - lastSwitch) / segDur));
        prevLat = prevLat + (currLat - prevLat) * u0;
        prevLon = prevLon + (currLon - prevLon) * u0;
        segDur = Math.min(2000, Math.max(400, now - lastSwitch)); // mitattu askelväli (~1000 ms)
        lastSwitch = now;
        currLat = s.vessel.lat;
        currLon = s.vessel.lon;
        seenLat = currLat;
        seenLon = currLon;
      }
      const u = Math.min(1, Math.max(0, (now - lastSwitch) / segDur));
      const rLat = prevLat + (currLat - prevLat) * u;
      const rLon = prevLon + (currLon - prevLon) * u;
      const [x, z] = toXZ(rLat, rLon);
      let speed = 0; // m/s
      if (prevPos) {
        const dx = x - prevPos[0];
        const dz = z - prevPos[1];
        speed = Math.hypot(dx, dz) / Math.max(dt, 1e-3);
        if (speed > 0.5) { // m/s, ei matkaa per frame: 60+ fps:llä frame-askel on alle 0.3 m eikä keula kääntyisi
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

      // keulasuihke: purske keulan kohdalla vain liikkuessa
      if (speed > 1) {
        sprayTimer += dt;
        if (sprayTimer > 0.12) {
          sprayTimer = 0;
          const bowX = x + Math.sin(heading) * BOW_X;
          const bowZ = z + Math.cos(heading) * BOW_X;
          sprayBurst(bowX, 1, bowZ, 0.35);
        }
      }
      for (let i = 0; i < SPRAY_N; i++) {
        if (sprayLife[i] <= 0) { sprayPos[i * 3 + 1] = -1e4; continue; }
        sprayLife[i] -= dt;
        sprayVel[i * 3 + 1] -= 9.81 * dt;
        for (let a = 0; a < 3; a++) sprayPos[i * 3 + a] += sprayVel[i * 3 + a] * dt;
      }
      sprayGeo.attributes.position.needsUpdate = true;

      if (water) water.material.uniforms.time.value = t * 0.5;

      if (s.chase) {
        // 3/4-takaviisto: 150 m takana, 75 m sivulla, 28 m ylhäällä -> laiva täyttää kuvan
        const fx = Math.sin(heading);
        const fz = Math.cos(heading);
        camPos.lerp(tmpV.set(x - fx * 150 - fz * 75, 28, z - fz * 150 + fx * 75), 1 - Math.exp(-dt * 3)); // aikapohjainen: sama liike 30 ja 144 fps:llä
        camera.position.copy(camPos);
        controls.target.lerp(tmpV.set(x, 20, z), 1 - Math.exp(-dt * 4));
      } else {
        camPos.copy(camera.position); // seuranta jatkuu vapaan kameran paikasta, ei vanhasta
      }
      controls.update();
      cullFarms();

      // kompassi: pohjoinen = -z, itä = +x. Ruusu kääntyy kameran suunnan mukaan, merkki näyttää laivan kurssin.
      const camBearing = deg(Math.atan2(controls.target.x - camera.position.x, camera.position.z - controls.target.z));
      const course = deg(Math.atan2(Math.sin(heading), -Math.cos(heading)));
      roseRef.current?.setAttribute('transform', `rotate(${(-camBearing).toFixed(1)} 50 50)`);
      shipMarkRef.current?.setAttribute('transform', `rotate(${course.toFixed(1)} 50 50)`);
      const hdgText = `HDG ${String(Math.round(course) % 360).padStart(3, '0')}°`;
      if (hdgRef.current && hdgRef.current.textContent !== hdgText) hdgRef.current.textContent = hdgText;
      renderer.render(scene, camera);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    const resize = () => {
      const w = mount.clientWidth || 640;
      const h = mount.clientHeight || 480;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
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
      scene.traverse((o) => {
        const m = o as THREE.Mesh;
        m.geometry?.dispose();
        for (const mat of [m.material].flat()) mat?.dispose();
      });
      normals.dispose();
      skyRT.dispose();
      renderer.dispose();
      renderer.forceContextLoss(); // vapauttaa myös Waterin heijastus-targetin; välilehden vaihto luo aina uuden kontekstin
      if (renderer.domElement.parentElement === mount) mount.removeChild(renderer.domElement);
    };
  }, []);

  const sim = useSim();
  return (
    <div ref={mountRef} className="scene-3d" title={`Route: ${ROUTE.map((r) => r.name).join(' → ')}`} data-producing={sim.producing ? 1 : 0}>
      {/* HUD-kompassi: ylhäällä = kameran katselusuunta; tick päivittää transformit, ei React-renderöintiä */}
      <svg className="scene-compass lfc-pid-panel" viewBox="0 0 100 122" role="img" aria-label="Compass">
        <g ref={roseRef}>
          <circle cx="50" cy="50" r="40" fill="none" stroke="rgba(110,126,168,0.6)" strokeWidth="1" />
          {Array.from({ length: 12 }, (_, i) => (
            <line key={i} x1="50" y1="10" x2="50" y2={i % 3 === 0 ? 17 : 14} stroke="#aab4c8" strokeWidth={i % 3 === 0 ? 1.6 : 1} transform={`rotate(${i * 30} 50 50)`} />
          ))}
          {(['N', 'E', 'S', 'W'] as const).map((l, i) => (
            <text key={l} x="50" y="29" textAnchor="middle" fontSize="11" fontWeight="700" fill={l === 'N' ? '#fc8181' : '#e8ecf4'} transform={`rotate(${i * 90} 50 50)`}>{l}</text>
          ))}
          {/* laivan kurssi */}
          <g ref={shipMarkRef}>
            <path d="M50 6 L45 -3 L55 -3 Z" fill="#4fd1c5" transform="translate(0 6)" />
            <line x1="50" y1="50" x2="50" y2="34" stroke="#4fd1c5" strokeWidth="1.6" />
          </g>
        </g>
        {/* kameran katselusuunta (kiinteä) */}
        <path d="M50 3 L46.5 9 L53.5 9 Z" fill="#e8ecf4" />
        <circle cx="50" cy="50" r="2" fill="#e8ecf4" />
        <text ref={hdgRef} x="50" y="113" textAnchor="middle" fontSize="12" fontWeight="700" fill="#4fd1c5" className="lfc-value">HDG 000°</text>
      </svg>
    </div>
  );
}
