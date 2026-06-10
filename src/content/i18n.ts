import raw from './content.json';

export type Lang = 'en' | 'tj';
interface Entry { id: number; title_en: string; body_en: string; title_tj: string; body_tj: string }
const entries = raw as Entry[];

export const CARD_IDS = entries.map(e => e.id);

export function getCard(id: number, lang: Lang): { title: string; body: string } {
  const e = entries.find(x => x.id === id);
  if (!e) throw new Error(`no card ${id}`);
  return lang === 'en' ? { title: e.title_en, body: e.body_en } : { title: e.title_tj, body: e.body_tj };
}
