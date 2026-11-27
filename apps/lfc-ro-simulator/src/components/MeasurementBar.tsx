/**
 * Mittauspalkki: slider-tyylinen rata, jossa vihreä = normal-alue, keltainen = varoitus ja
 * punainen = hälytysalue; nappi osoittaa nykyisen arvon. Nimet, rajat ja asteikko tulevat
 * PLC Tag Map -datasetistä (data, ei koodia) — käyttäjä voi muuttaa niitä Hailerissa.
 * Dynaamiseen käyttöön (esim. tuotantopyyntöön suhteutettu virtaama) kaistat, asteikko ja
 * taso voidaan antaa kutsujasta.
 */
import { Box, Flex, Slider, SliderThumb, SliderTrack, Text } from '@chakra-ui/react';
import { TagRec } from '../api';
import { Level, tagLevel } from './tagLevel';
import { tagLabel } from '../sim/tagLimits';

// HMI-värit: kaistat aina värillisiä (ok = vihreä), arvoteksti neutraali kun ok
const bandColor = (l: Level) => ({ ok: '#35e0c4', warn: '#ffb020', alarm: '#ff5263' })[l];

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
}

export default function MeasurementBar({ tag, value, decimals = 0, scale, bands: bandsProp, ticks: ticksProp, level: levelProp, note, idle = false }: Props) {
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
  const valueColor = idle ? '#8e9ab8' : level === 'ok' ? '#e6ecfa' : bandColor(level);

  return (
    <Box>
      <Text fontSize="xs" fontWeight="semibold" color="#e6ecfa" noOfLines={1} title={label}>{label}</Text>
      <Flex justify="space-between" align="baseline" mb={0.5}>
        <Text fontSize="10px" className="lfc-muted">{tag.tag}</Text>
        <Text fontSize="sm" fontWeight="700" color={valueColor} style={{ fontVariantNumeric: 'tabular-nums' }}>
          {value.toFixed(decimals)}
          <Text as="span" fontSize="10px" fontWeight="400" className="lfc-muted" ml={1}>{tag.unit ?? ''}</Text>
        </Text>
      </Flex>
      <Slider min={lo} max={hi} value={clamp(value)} isReadOnly focusThumbOnChange={false}>
        <SliderTrack height="8px" borderRadius="sm" bg="#141f3b">
          {bands.map((b, i) => (
            <Box
              key={i}
              position="absolute"
              top={0}
              bottom={0}
              left={`${pct(b.from)}%`}
              width={`${Math.max(0, pct(b.to) - pct(b.from))}%`}
              bg={bandColor(b.level)}
              opacity={idle ? 0.35 : 1}
            />
          ))}
        </SliderTrack>
        <SliderThumb width="4px" height="14px" borderRadius="1px" bg={idle ? '#8e9ab8' : '#e6ecfa'} border="1px solid #090e1b" boxShadow="0 0 4px rgba(0,0,0,0.7)" />
      </Slider>
      <Box position="relative" height="12px" mt={0.5}>
        {ticks.map((v, i) => (
          <Text
            key={i}
            position="absolute"
            fontSize="9px"
            className="lfc-muted"
            left={i === ticks.length - 1 ? undefined : `${pct(v)}%`}
            right={i === ticks.length - 1 ? 0 : undefined}
            transform={i === 0 || i === ticks.length - 1 ? undefined : 'translateX(-50%)'}
            whiteSpace="nowrap"
          >
            {tickLabel(v, i)}
          </Text>
        ))}
      </Box>
      {note && (
        <Text fontSize="10px" className="lfc-muted" mt={0.5} noOfLines={1} title={note}>{note}</Text>
      )}
    </Box>
  );
}
