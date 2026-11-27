/** Näyttönimi: PLC Tag Map -datasetin kuvaus tai nimi ilman tagi-etuliitettä ("CT-301 X" → "X"). */
import { TagRec } from '../api';

export function tagLabel(t: TagRec): string {
  const d = t.description?.trim();
  if (d) return d;
  return t.name.replace(/^[A-Z]{2,4}-\d{3}\s*/, '').trim() || t.tag;
}
