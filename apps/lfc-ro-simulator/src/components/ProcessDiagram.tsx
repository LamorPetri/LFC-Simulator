import { ReactNode } from 'react';
import { useSim } from '../sim/store';
import { TagRec } from '../api';
import { trend, TrendKey } from './trend';
import { Level, levelColor, tagLevel } from './tagLevel';

const MONO = "'JetBrains Mono', ui-monospace, 'DejaVu Sans Mono', Menlo, Consolas, monospace";
type Kind = 'feed' | 'perm' | 'brine' | 'cip';

/** Putki: runko + virtausviiva. Katkoviiva liikkuu vain kun linja on käynnissä (on). */
function Pipe({ d, kind = 'feed', w = 5, dotted = false, on }: { d: string; kind?: Kind; w?: number; dotted?: boolean; on: boolean }) {
  const line = { d, fill: 'none', strokeLinecap: 'round', strokeLinejoin: 'round' } as const;
  return (
    <>
      <path {...line} stroke="var(--pipe)" strokeWidth={w + 2} />
      {on && !dotted && <path {...line} stroke={`var(--${kind})`} strokeWidth={w + 5} opacity={0.16} />}
      <path
        {...line} stroke={`var(--${kind})`} strokeWidth={w - 2}
        strokeDasharray={dotted ? '2 9' : on ? '14 10' : undefined}
        opacity={on ? 1 : 0.3} className={on ? 'lfc-dash' : undefined}
      />
    </>
  );
}

function Eq({ x, y, w, h, r = 8, stroke = 'var(--eqs)' }: { x: number; y: number; w: number; h: number; r?: number; stroke?: string }) {
  return (
    <>
      <rect x={x} y={y} width={w} height={h} rx={r} fill="url(#pidEq)" stroke={stroke} />
      <path d={`M${x + r} ${y + 1.2}H${x + w - r}`} stroke="var(--hi)" strokeWidth={1.4} strokeLinecap="round" />
    </>
  );
}

function Label({ x, y, size = 9.5, anchor = 'middle', strong = false, fill, children }: { x: number; y: number; size?: number; anchor?: 'start' | 'middle' | 'end'; strong?: boolean; fill?: string; children: ReactNode }) {
  return <text x={x} y={y} textAnchor={anchor} fontSize={size} fontWeight={strong ? 700 : 600} letterSpacing=".08em" fill={fill ?? (strong ? 'var(--txt)' : 'var(--mut)')}>{children}</text>;
}

/** Arvokortti instrumenttinsa vieressä; lead = [x, y, kortin x, kortin y] piirtää viivan putken instrumenttikuplaan. */
function Card({ x, y, tag, name, value, unit, level = 'ok', lead }: { x: number; y: number; tag?: string; name: string; value: string; unit: string; level?: Level; lead?: [number, number, number, number] }) {
  const c = levelColor(level);
  const edge = level === 'ok' ? 'var(--line)' : c;
  return (
    <g>
      {lead && (
        <>
          <path d={`M${lead[0]} ${lead[1]}L${lead[2]} ${lead[3]}`} stroke="var(--eqs)" strokeDasharray="2 3" fill="none" />
          <Bubble x={lead[0]} y={lead[1]} text={(tag ?? '').slice(0, 2)} level={level} />
        </>
      )}
      <rect x={x} y={y} width={128} height={44} rx={6} fill="var(--bg)" stroke={edge} strokeWidth={level === 'ok' ? 1 : 1.4} />
      <rect x={x} y={y + 6} width={3} height={32} rx={1.5} fill={level === 'ok' ? 'var(--eqs)' : c} />
      <text x={x + 11} y={y + 15} fontSize={8} fontWeight={600} letterSpacing=".08em" fill="var(--mut)">
        {tag && <tspan fill="var(--txt)">{tag} </tspan>}{name}
      </text>
      <text x={x + 11} y={y + 35} fontSize={17} fontWeight={600} fill={c} fontFamily={MONO}>
        {value}<tspan fontSize={9} fill="var(--mut)" dx={4} fontFamily="inherit">{unit}</tspan>
      </text>
    </g>
  );
}

function Bubble({ x, y, text, level = 'ok' }: { x: number; y: number; text: string; level?: Level }) {
  return (
    <>
      <circle cx={x} cy={y} r={7} fill="var(--panel)" stroke={level === 'ok' ? 'var(--eqs)' : levelColor(level)} strokeWidth={1.4} />
      <text x={x} y={y + 2.6} textAnchor="middle" fontSize={6.2} fontWeight={700} fill="var(--txt)">{text}</text>
    </>
  );
}

function Capsule({ x, y, w, h, stroke = 'var(--eqs)' }: { x: number; y: number; w: number; h: number; stroke?: string }) {
  return (
    <>
      <rect x={x} y={y} width={w} height={h} rx={Math.min(w, h) / 2} fill="url(#pidEq)" stroke={stroke} />
      <path d={`M${x + w / 2} ${y + 4}V${y + h - 4}`} stroke="var(--hi)" />
    </>
  );
}

/** 10 min trendi; normaalialue varjostettu. */
function Trend({ x, tag, name, k, value, level, t }: { x: number; tag: string; name: string; k: TrendKey; value: string; level: Level; t: TagRec | undefined }) {
  const y = 716, w = 283, h = 138, px = x + 12, pw = w - 24, top = y + 36, ph = 88;
  const data = trend[k];
  const lo = Math.min(t?.normalMin ?? Infinity, ...data), hi = Math.max(t?.normalMax ?? -Infinity, ...data);
  const span = hi - lo || 1;
  const yOf = (v: number) => top + ph - ((v - lo) / span) * ph;
  const d = data.map((v, i) => `${i ? 'L' : 'M'}${(px + (i / Math.max(1, data.length - 1)) * pw).toFixed(1)} ${yOf(v).toFixed(1)}`).join('');
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx={6} fill="var(--bg)" stroke="var(--line)" />
      <text x={px} y={y + 18} fontSize={8} fontWeight={600} letterSpacing=".08em" fill="var(--mut)"><tspan fill="var(--txt)">{tag} </tspan>{name} · 10 MIN</text>
      <text x={x + w - 12} y={y + 19} textAnchor="end" fontSize={12} fontWeight={600} fill={levelColor(level)} fontFamily={MONO}>{value}</text>
      {t?.normalMin != null && t.normalMax != null && (
        <rect x={px} y={yOf(t.normalMax)} width={pw} height={Math.max(1, yOf(t.normalMin) - yOf(t.normalMax))} fill="var(--eqs)" opacity={0.16} />
      )}
      {data.length > 1 && <path d={d} fill="none" stroke={level === 'ok' ? 'var(--feed)' : levelColor(level)} strokeWidth={1.6} strokeLinejoin="round" />}
    </g>
  );
}

const f = (v: number, digits = 0) => v.toFixed(digits);

export default function ProcessDiagram({ tagByTag }: { tagByTag: Record<string, TagRec> }) {
  const sim = useSim();
  const { tags } = sim;
  const v = sim.vesselEval;
  const on = sim.producing;
  const t2 = sim.capacity > 63; // linja 2 käynnistyy vasta kun kapasiteetti ylittää yhden linjan
  const on2 = on && t2;
  const cip = sim.cipRunning;
  const lv = (tag: string, value: number) => tagLevel(value, tagByTag[tag]);
  const foulLevel: Level = sim.fouling > 70 ? 'alarm' : sim.fouling > 40 ? 'warn' : 'ok';
  const abollLevel: Level = sim.abollDp > 0.65 ? 'alarm' : sim.abollDp > 0.45 ? 'warn' : 'ok';
  const statusFill = v.status === 'good' ? 'var(--perm)' : v.status === 'caution' ? 'var(--warn)' : 'var(--alarm)';
  const statusLabel = v.status === 'good' ? 'SUITABLE AREA' : v.status === 'caution' ? 'CAUTION' : v.status === 'farm' ? 'FISH FARM ZONE' : 'SHALLOW WATER';
  const [runText, runFill] = on ? ['RUNNING', 'var(--perm)'] : cip ? ['CIP', 'var(--cip)'] : ['STOPPED', 'var(--mut)'];
  const tankH = 234 * Math.min(1, Math.max(0, tags.LT401 / 100));

  return (
    <svg viewBox="0 0 1200 870" style={{ width: '100%', height: '100%', display: 'block' }} role="img" aria-label="RO process diagram">
      <defs>
        <linearGradient id="pidEq" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="var(--eq1)" /><stop offset="1" stopColor="var(--eq2)" /></linearGradient>
        <linearGradient id="pidWat" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="var(--perm)" stopOpacity=".85" /><stop offset="1" stopColor="var(--perm)" stopOpacity=".25" /></linearGradient>
        <pattern id="pidGrid" width="40" height="40" patternUnits="userSpaceOnUse"><path d="M40 0H0V40" fill="none" stroke="var(--line)" strokeWidth=".5" opacity=".45" /></pattern>
      </defs>
      <rect width="1200" height="870" fill="url(#pidGrid)" />

      {/* otsikko + KPI-palkki */}
      <Label x={24} y={34} size={14} anchor="start" strong>RO WATER TREATMENT</Label>
      <Label x={24} y={50} size={8.5} anchor="start">LIVE FISH CARRIER · PROCESS OVERVIEW</Label>
      <rect x={250} y={20} width={84} height={22} rx={11} fill="none" stroke={runFill} />
      <circle cx={264} cy={31} r={3.5} fill={runFill} className={on ? 'lfc-pulse' : undefined} />
      <Label x={300} y={34.5} size={9} strong fill={runFill}>{runText}</Label>
      <Card x={524} y={12} name="PRODUCED" value={f(sim.volume)} unit="m³" />
      <Card x={658} y={12} name="FOULING" value={f(sim.fouling)} unit="%" level={foulLevel} />
      <rect x={722} y={42} width={56} height={4} rx={2} fill="var(--line)" />
      <rect x={722} y={42} width={Math.max(2, Math.min(56, (sim.fouling / 100) * 56))} height={4} rx={2} fill={foulLevel === 'ok' ? 'var(--eqs)' : levelColor(foulLevel)} />
      <Card x={792} y={12} tag="AT-501" name="pH" value={f(tags.AT501, 2)} unit="pH" level={lv('AT-501', tags.AT501)} />
      <Card x={926} y={12} tag="CT-301" name="CONDUCTIVITY" value={f(tags.CT301)} unit="µS/cm" level={lv('CT-301', tags.CT301)} />
      <Card x={1060} y={12} tag="LT-401" name="TANK" value={f(tags.LT401)} unit="%" level={lv('LT-401', tags.LT401)} />
      <path d="M16 66H1184" stroke="var(--line)" />

      <g transform="translate(0,22)">
        {/* ---- putket ensin (laitteiden alle) ---- */}
        <Pipe d="M150 300H672" on={on} />
        <Pipe d="M672 300V165H812" on={on} />
        <Pipe d="M672 225H812" on={on} />
        <Pipe d="M672 300V435H812" on={on2} />
        <Pipe d="M672 375H812" on={on2} />
        {/* rejekti: stack -> iSave -> ulos */}
        <Pipe d="M930 250V274H752V243" kind="brine" w={4} dotted on={on} />
        <Pipe d="M728 243V289H985" kind="brine" w={4} dotted on={on} />
        <Pipe d="M930 350V326H752V357" kind="brine" w={4} dotted on={on2} />
        <Pipe d="M728 357V311H985" kind="brine" w={4} dotted on={on2} />
        <Pipe d="M985 289V404" kind="brine" w={4} dotted on={on} />
        <Pipe d="M985 416V560H1150" kind="brine" w={4} dotted on={on} />
        {/* permeaatti: stack -> mikseri -> tankki */}
        <Pipe d="M962 190H1050V300H1100" kind="perm" on={on} />
        <Pipe d="M962 410H1050V300" kind="perm" on={on2} />
        {/* annostelut */}
        <Pipe d="M1020 150V178" kind="cip" w={3} dotted on={on} />
        <Pipe d="M1020 470V422" kind="cip" w={3} dotted on={on2} />
        <Pipe d="M455 232V292" kind="cip" w={3} dotted on={on} />
        {/* CIP-kierto */}
        <Pipe d="M524 596H656V308" kind="cip" w={4} dotted on={cip} />
        <Pipe d="M985 560V646H500V636" kind="cip" w={3} dotted on={cip} />
        <path d="M1150 560l-9 -5v10z" fill="var(--brine)" />
        <Label x={1150} y={548} size={8.5} anchor="end">BRINE OUT</Label>
        <Label x={760} y={640} size={8}>CIP RETURN</Label>

        {/* ---- esikäsittely ---- */}
        <Eq x={34} y={236} w={116} h={128} r={10} />
        <Label x={92} y={258} size={10.5} strong>SEAWATER</Label>
        <path d="M46 286q11 -9 23 0t23 0 23 0 23 0" fill="none" stroke="var(--feed)" strokeWidth={1.6} opacity={0.8} />
        <path d="M46 298q11 -9 23 0t23 0 23 0 23 0" fill="none" stroke="var(--feed)" strokeWidth={1.2} opacity={0.4} />
        <Label x={92} y={322}>depth {v.depth === null ? '—' : v.depth.toFixed(0)} m</Label>
        <Label x={92} y={338} size={8.5} strong fill={statusFill}>{statusLabel}</Label>
        <Label x={92} y={353} size={8.5}>{v.farm ? `farm ${(v.farm.distM / 1000).toFixed(2)} km` : ''}</Label>

        <Eq x={196} y={252} w={96} h={96} r={12} />
        <circle cx={244} cy={300} r={30} fill="var(--bg)" stroke={on ? 'var(--feed)' : 'var(--eqs)'} />
        <g className={on ? 'lfc-spin-slow' : undefined} style={{ transformOrigin: '244px 300px' }}>
          {Array.from({ length: 8 }, (_, i) => <path key={i} d="M244 300h30" stroke="var(--eqs)" transform={`rotate(${i * 45} 244 300)`} />)}
        </g>
        <circle cx={244} cy={300} r={12} fill="url(#pidEq)" stroke="var(--eqs)" />
        <Label x={244} y={366}>DRUM FILTER</Label>

        <Eq x={326} y={240} w={84} h={120} r={14} stroke={abollLevel === 'ok' ? undefined : levelColor(abollLevel)} />
        {Array.from({ length: 5 }, (_, i) => <path key={i} d={`M338 ${262 + i * 19}H398`} stroke="var(--eqs)" strokeDasharray="3 3" />)}
        <Label x={368} y={378}>AQUABOLL · AUTO FILTER</Label>

        <Eq x={440} y={186} w={30} h={46} r={5} />
        <rect x={443} y={208} width={24} height={21} rx={3} fill="var(--warn)" opacity={0.35} />
        <Label x={455} y={178} size={8}>ANTISCALANT</Label>

        {[[500, 250], [572, 250], [500, 312], [572, 312]].map(([x, y], i) => (
          <g key={i}>
            <Capsule x={x} y={y} w={58} h={38} stroke={on && foulLevel !== 'ok' ? levelColor(foulLevel) : undefined} />
            <Label x={x + 29} y={y + 24} fill="var(--txt)">C{i + 1}</Label>
          </g>
        ))}
        <Label x={565} y={238}>CARTRIDGE FILTERS</Label>

        {/* ---- fresh water back-flush C1–C4: sisään JÄTTÖPÄÄSTÄ (C2/C4, CIP-nousuputkesta), läpi takaperin (C2→C1, C4→C3), ulos TULOPÄÄSTÄ (C1/C3) viemäriin ---- */}
        <Pipe d="M656 308V269H631" kind="cip" w={4} dotted on={cip} />
        <Pipe d="M656 321H631" kind="cip" w={4} dotted on={cip} />
        <Pipe d="M499 269H488V486" kind="cip" w={4} dotted on={cip} />
        <Pipe d="M499 321H488" kind="cip" w={4} dotted on={cip} />
        {/* venttiilit: auki vain huuhtelussa (C2- ja C4-jättölinjat + viemäri) */}
        <path d="M650 283h12l-6 9z M650 301h12l-6 -9z" fill="var(--panel)" stroke={cip ? 'var(--cip)' : 'var(--eqs)'} />
        <path d="M637 315v12l8 -6z M653 315v12l-8 -6z" fill="var(--panel)" stroke={cip ? 'var(--cip)' : 'var(--eqs)'} />
        <path d="M482 383h12l-6 9z M482 401h12l-6 -9z" fill="var(--panel)" stroke={cip ? 'var(--cip)' : 'var(--eqs)'} />
        {/* viemärisymboli */}
        <path d="M480 488h16l-5 10h-6z" fill="none" stroke="var(--cip)" />
        <path d="M488 498v6" stroke="var(--cip)" />
        <Label x={648} y={420} size={8} anchor="end">FW BACK-FLUSH IN</Label>
        <Label x={476} y={500} size={8} anchor="end">BACK-FLUSH OUT → DRAIN</Label>
        {/* takaperinvirtaus suodattimien läpi (C2→C1, C4→C3), näkyy vain huuhtelussa */}
        {cip && (
          <g stroke="var(--cip)" strokeWidth={2} strokeDasharray="10 8" className="lfc-dash" opacity={0.95}>
            <path d="M629 269H501" fill="none" />
            <path d="M629 321H501" fill="none" />
          </g>
        )}

        {/* ---- linjat: HPP + iSave + RO-stack ---- */}
        {[
          { hpp: 165, isave: 225, stack: 130, mixer: 190, naoh: 104, n: 1, run: on, dim: 1 },
          { hpp: 435, isave: 375, stack: 350, mixer: 410, naoh: 470, n: 2, run: on2, dim: t2 ? 1 : 0.35 },
        ].map((L) => (
          <g key={L.n} opacity={L.dim}>
            <circle cx={742} cy={L.hpp} r={15} fill="url(#pidEq)" stroke={L.run ? 'var(--feed)' : 'var(--eqs)'} />
            <path d={`M736 ${L.hpp - 8}L751 ${L.hpp}L736 ${L.hpp + 8}Z`} fill="var(--feed)" opacity={L.run ? 1 : 0.5} />
            <Label x={742} y={L.n === 1 ? L.hpp - 24 : L.hpp + 32}>{`HPP ${L.n}${L.dim < 1 ? ' · STANDBY' : ''}`}</Label>

            <Eq x={716} y={L.isave - 18} w={52} h={36} r={6} />
            <circle cx={742} cy={L.isave} r={9} fill="var(--bg)" stroke="var(--perm)" />
            <path d={`M742 ${L.isave - 9}V${L.isave + 9}M733 ${L.isave}H751`} stroke="var(--perm)" strokeWidth={1.2} className={L.run ? 'lfc-spin' : undefined} style={{ transformOrigin: `742px ${L.isave}px` }} />
            <Label x={742} y={L.n === 1 ? L.isave - 23 : L.isave + 31} size={8.5}>{`iSAVE ${L.n}`}</Label>

            <Eq x={812} y={L.stack} w={150} h={120} r={10} stroke={L.run ? 'var(--feed)' : undefined} />
            {[0, 1, 2].flatMap((r) => [0, 1].map((c) => {
              const vx = 824 + c * 68, vy = L.stack + 26 + r * 30;
              return (
                <g key={`${r}${c}`}>
                  <rect x={vx} y={vy} width={60} height={18} rx={9} fill="var(--bg)" stroke="var(--eqs)" />
                  <rect x={vx + 3} y={vy + 3} width={54} height={12} rx={6} fill="url(#pidWat)" opacity={L.run ? 0.75 : 0.25} />
                  <circle cx={vx + 9} cy={vy + 9} r={2.2} fill="var(--feed)" />
                  <circle cx={vx + 51} cy={vy + 9} r={2.2} fill="var(--perm)" />
                </g>
              );
            }))}
            <Label x={887} y={L.stack + 17} strong>{`RO STACK ${L.n}`}</Label>

            <Eq x={1004} y={L.mixer - 12} w={32} h={24} r={5} />
            <path d={`M1012 ${L.mixer + 7}l5 -14m3 14l5 -14`} stroke="var(--perm)" strokeWidth={1.4} />
            <Label x={1020} y={L.n === 1 ? L.mixer + 24 : L.mixer + 28} size={7.5}>MIXER</Label>
            <Eq x={1004} y={L.naoh} w={32} h={46} r={5} />
            <rect x={1007} y={L.naoh + 20} width={26} height={23} rx={3} fill="var(--cip)" opacity={0.4} />
            <Label x={1020} y={L.n === 1 ? L.naoh - 6 : L.naoh + 58} size={8}>{`NaOH ${L.n}`}</Label>
          </g>
        ))}

        {/* ---- makeavesitankki ---- */}
        <Eq x={1100} y={176} w={72} h={250} r={12} />
        <rect x={1108} y={184 + 234 - tankH} width={56} height={tankH} rx={7} fill="url(#pidWat)" />
        {[1, 2, 3, 4].map((i) => <path key={i} d={`M1164 ${184 + i * 46.8}h-10`} stroke="var(--hi)" />)}
        <Label x={1136} y={444} strong>FW TANK</Label>
        <Bubble x={1066} y={300} text="AT" level={lv('AT-501', tags.AT501)} />
        <Bubble x={1084} y={300} text="CT" level={lv('CT-301', tags.CT301)} />

        {/* ---- CIP ---- */}
        <Label x={440} y={528} size={9} anchor="start">CIP + FRESH WATER FLUSH</Label>
        <path d="M440 536H640" stroke="var(--line)" />
        <Eq x={440} y={552} w={84} h={84} r={8} stroke={cip ? 'var(--cip)' : undefined} />
        <path d="M446 596q18 -8 36 0t36 0V630H446Z" fill="var(--cip)" opacity={0.4} />
        <Label x={482} y={568} size={8.5} strong>CIP TANK</Label>
        <circle cx={562} cy={596} r={14} fill="url(#pidEq)" stroke={cip ? 'var(--cip)' : 'var(--eqs)'} />
        <path d="M557 589l11 7 -11 7z" fill="var(--cip)" opacity={cip ? 1 : 0.5} />
        <Label x={562} y={626} size={8.5}>CIP PUMP</Label>
        <Capsule x={606} y={580} w={26} h={32} stroke={cip ? 'var(--cip)' : undefined} />
        <Label x={619} y={626} size={8.5}>CIP FILTER</Label>
        <path d="M650 330h12l-6 9z M650 348h12l-6 -9z" fill="var(--panel)" stroke={cip ? 'var(--cip)' : 'var(--eqs)'} />

        {/* ---- arvokortit instrumenttiensa vieressä ---- */}
        <Card x={108} y={150} tag="FT-101" name="FEED FLOW" value={f(tags.FT101)} unit="m³/h" level={lv('FT-101', tags.FT101)} lead={[172, 300, 172, 194]} />
        <Card x={28} y={392} tag="TT-104" name="SEA TEMP" value={f(tags.TT104, 1)} unit="°C" level={lv('TT-104', tags.TT104)} lead={[92, 364, 92, 392]} />
        <Card x={304} y={426} tag="PDT-102" name="AQUABOLL ΔP" value={f(sim.abollDp, 2)} unit="bar" level={abollLevel} lead={[368, 360, 368, 426]} />
        <Card x={391} y={96} tag="FT-502" name="ANTISCALANT" value={f(tags.FT502, 2)} unit="L/h" level={lv('FT-502', tags.FT502)} lead={[455, 186, 455, 140]} />
        <Card x={823} y={62} tag="PDT-103" name="MEMBRANE ΔP" value={f(tags.PDT103, 2)} unit="bar" level={lv('PDT-103', tags.PDT103)} lead={[887, 130, 887, 106]} />
        <Card x={1056} y={96} tag="FT-501" name="NaOH DOSE" value={f(tags.FT501, 1)} unit="L/h" level={lv('FT-501', tags.FT501)} lead={[1042, 127, 1056, 118]} />
      </g>

      {/* ---- trendinauha ---- */}
      <path d="M16 702H1184" stroke="var(--line)" />
      <Trend x={16} tag="FT-101" name="FEED FLOW" k="FT101" value={`${f(tags.FT101)} m³/h`} level={lv('FT-101', tags.FT101)} t={tagByTag['FT-101']} />
      <Trend x={309} tag="PDT-103" name="MEMBRANE ΔP" k="PDT103" value={`${f(tags.PDT103, 2)} bar`} level={lv('PDT-103', tags.PDT103)} t={tagByTag['PDT-103']} />
      <Trend x={602} tag="CT-301" name="CONDUCTIVITY" k="CT301" value={`${f(tags.CT301)} µS/cm`} level={lv('CT-301', tags.CT301)} t={tagByTag['CT-301']} />
      <Trend x={895} tag="LT-401" name="TANK LEVEL" k="LT401" value={`${f(tags.LT401)} %`} level={lv('LT-401', tags.LT401)} t={tagByTag['LT-401']} />
    </svg>
  );
}
