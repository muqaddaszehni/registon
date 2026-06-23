import raw from './content.json';

export type Lang = 'en' | 'tj';
interface Entry { id: number; title_en: string; body_en: string; title_tj: string; title_tj_ar?: string; body_tj: string }
const entries = raw as Entry[];

export const CARD_IDS = entries.map(e => e.id);

/**
 * Card text. For Tajik the title is returned as Perso-Arabic (Nastaliq) — the
 * authentic Samarkand inscription script — with the Cyrillic kept as `titleAlt`
 * for accessibility/fallback. Body stays in readable Tajik Cyrillic.
 */
export function getCard(id: number, lang: Lang): { title: string; titleAlt?: string; body: string } {
  const e = entries.find(x => x.id === id);
  if (!e) throw new Error(`no card ${id}`);
  if (lang === 'en') return { title: e.title_en, body: e.body_en };
  return { title: e.title_tj_ar ?? e.title_tj, titleAlt: e.title_tj, body: e.body_tj };
}
