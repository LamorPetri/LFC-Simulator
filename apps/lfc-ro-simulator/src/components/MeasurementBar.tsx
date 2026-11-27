/**
 * Mittauskortti (3D-sivun slider-taulukko): sama HMI-ilme kuin Process-välilehden arvokortit —
 * tumma kortti, tilapalkki vasemmalla, tag + nimi, arvo monospace-fontilla, ja slider-rata jonka
 * vihreä/keltainen/punainen kaista tulevat PLC Tag Map -datasetistä (tai kutsujasta pyyntöön suhteistettuna).
 */
import { Box, Flex, Slider, SliderThumb, SliderTrack, Text } from '@chakra-ui/react';
import { TagRec } from '../api';
import { Level, tagLevel } from './tagLevel';
import { tagLabel } from '../sim/tagLimits';

// HMI-värit: kaistat aina värillisiä (ok = vihreä), arvoteksti neutraali kun ok
const bandColor = (l: Level) => ({ ok: 'var(--perm)', warn: 'var(--warn)', alarm: 'var(--alarm)' })[l];

interface Band { from: number; to: number; level: Level }

/** Värikaistat asteikolla [lo, hi]: punainen < alarmBelow, keltainen alarmBelow–normalMin, vihreä normal, keltainen normalMax–alarmAbove, punainen > alarmAbove. */
function buildBands(tag: TagRec, lo: number, hi: number): Band[] {
  const gLo = tag.normalMin ?? lo;
  const gHi = tag.normalMax ?? hi;
  const out: Band[] = [];
  const push = (from: number, to: number, level: Level) => {
    const a = Math.max(lo, Math.min(from, to));
    const b = Math.min(hi, Math.max(from, to));
    if (b - a > 1e-9) out.push({ from: a, to: b, level });
  };
  if (tag.alarmBelow !== null) push(lo, tag.alarmBelow, 'alarm');
  push(tag.alarmBelow ?? lo, gLo, 'warn');
  push(gLo, gHi, 'ok');
  push(gHi, tag.alarmAbove ?? hi, 'warn');
  if (tag.alarmAbove !== null) push(tag.alarmAbove, hi, 'alarm');
  return out;
}

const fmtNum = (v: number) => {
  const s = Math.round(v * 100) / 100;
  return Number.isInteger(s) ? s.toString() : s.toFixed(2).replace(/\.?0+$/, '');
};

interface Props {
  tag: TagRec;
  value: number;
  decimals?: number;
  /** Asteikko [min, max]; oletus datasetin Scale min/max (tai rajoista johdettu). */
  scale?: [number, number];
  /** Kaistat; oletus datasetin rajoista. */
  bands?: Band[];
  /** Asteikon numerot palkin alla; oletus kaistojen rajat. */
  ticks?: number[];
  /** Tason ohitus (esim. kohinaton suhde pyyntöön). */
  level?: Level;
  /** Lisäteksti arvon alle (esim. "96 % of request"). */
  note?: string;
  /** Idle-tila (ei tuotantoa): ei hälytysvärejä, himmeä nappi. */
  idle?: boolean;
  /** Hälytysteksti kortin alle (esim. CIP REQUIRED). */
  alert?: string;
}

export default function MeasurementBar({ tag, value, decimals = 0, scale, bands: bandsProp, ticks: ticksProp, level: levelProp, note, idle = false, alert }: Props) {
  const label = tagLabel(tag);
  const level = levelProp ?? tagLevel(value, tag);
  // asteikko datasetistä (Scale min/max); puuttuessa johdetaan rajoista
  const lo = scale?.[0] ?? tag.scaleMin ?? Math.min(0, tag.normalMin ?? 0, tag.alarmBelow ?? 0, value);
  const hi = scale?.[1] ?? tag.scaleMax ?? Math.max((tag.normalMax ?? 0) * 1.25, (tag.alarmAbove ?? 0) * 1.25, value * 1.1, lo + 1);
  const span = hi - lo || 1;
  const clamp = (v: number) => Math.max(lo, Math.min(hi, v));
  const pct = (v: number) => ((clamp(v) - lo) / span) * 100;
  const bands = bandsProp ?? buildBands(tag, lo, hi);
  const ticks = ticksProp ?? [...new Set([lo, tag.alarmBelow, tag.normalMin, tag.normalMax, tag.alarmAbove, hi].filter((v): v is number => v !== null).map(clamp))].sort((a, b) => a - b);
  const tickLabel = (v: number, i: number) => (i === 0 ? fmtNum(lo) : i === ticks.length - 1 ? fmtNum(hi) : fmtNum(v));
  const active = !idle && level !== 'ok';
  const valueColor = idle ? 'var(--mut)' : active ? bandColor(level) : 'var(--txt)';

  return (
    <Box className="lfc-mbar">
      <Box className="lfc-mbar-bar" bg={active ? bandColor(level) : 'var(--eqs)'} />
      <Flex justify="space-between" align="baseline" gap={2}>
        <Text fontSize="9.5px" noOfLines={1} title={label}>
          <Text as="span" className="lfc-mbar-tag">{tag.tag}</Text>
          <Text as="span" className="lfc-mbar-name" ml={1.5}>{label}</Text>
        </Text>
        <Text className="lfc-pid-num" fontSize="16px" fontWeight={600} color={valueColor} whiteSpace="nowrap" style={{ lineHeight: 1.1 }}>
          {value.toFixed(decimals)}
          <Text as="span" fontSize="9.5px" fontWeight={500} color="var(--mut)" ml={1} fontFamily="inherit">{tag.unit ?? ''}</Text>
        </Text>
      </Flex>
      <Slider min={lo} max={hi} value={clamp(value)} isReadOnly focusThumbOnChange={false} mt={1}>
        <SliderTrack height="7px" borderRadius="sm" bg="var(--eq2)">
          {bands.map((b, i) => (
            <Box
              key={i}
              position="absolute"
              top={0}
              bottom={0}
              left={`${pct(b.from)}%`}
              width={`${Math.max(0, pct(b.to) - pct(b.from))}%`}
              bg={bandColor(b.level)}
              opacity={idle ? 0.3 : 1}
            />
          ))}
        </SliderTrack>
        <SliderThumb width="3px" height="15px" borderRadius="1px" bg={idle ? 'var(--mut)' : 'var(--txt)'} border="1px solid var(--bg)" boxShadow="0 0 0 1px var(--line)" />
      </Slider>
      <Box position="relative" height="12px" mt={0.5}>
        {ticks.map((v, i) => (
          <Text
            key={i}
            className="lfc-mbar-tick lfc-pid-num"
            left={i === ticks.length - 1 ? undefined : `${pct(v)}%`}
            right={i === ticks.length - 1 ? 0 : undefined}
            transform={i === 0 || i === ticks.length - 1 ? undefined : 'translateX(-50%)'}
          >
            {tickLabel(v, i)}
          </Text>
        ))}
      </Box>
      {note && <Text className="lfc-mbar-note" title={note}>{note}</Text>}
      {alert && (
        <Text fontSize="10px" fontWeight={700} color="var(--alarm)" mt={0.5} className="lfc-pulse" letterSpacing=".04em">⚠ {alert}</Text>
      )}
    </Box>
  );
}
