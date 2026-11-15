import type { Item } from '@df/shared';
const paths: Record<string, string> = {
  sword: 'M7 25 26 6l-1 9-13 13M5 20l9 9M4 30l4-4',
  axe: 'M8 30 24 5M17 8c11-6 16 5 9 11l-12-6',
  mace: 'M6 31 21 14M16 5l7-3 9 9-3 7-9-1-5-6Z',
  spear: 'M5 30 24 8M20 9l9-6-5 11Z',
  bow: 'M9 4Q34 18 9 31L17 18ZM5 18h24m-5-4 5 4-5 4',
  shield: 'M6 6 18 3l12 3v11q-2 10-12 15Q6 27 6 17ZM18 9v16M11 16h14',
  focus: 'M8 30 24 10M24 3l2 5 5 2-5 2-2 5-2-5-5-2 5-2Z',
  armor: 'M11 4 5 8 2 15l7 4v12h18V19l7-4-3-7-6-4q-7 10-14 0ZM12 20h12',
  potion: 'M14 3h8v5l1 5q14 17-5 19Q-1 30 13 13l1-5ZM11 23h14M14 8h8',
  scroll: 'M8 8q-5-8-5 1h23q8 0 5-6H9v24q0 7 8 4V12M12 17h10m-10 5h9',
  fire: 'M19 2q2 10 9 15 10 15-10 16Q0 32 8 19l6-8q-2 13 4 14 6-3 1-23Z',
  ice: 'M18 2v32M4 10l28 16M4 26 32 10M12 5l6 6 6-6M12 31l6-6 6 6',
  light: 'M18 3v30M3 18h30M7 7l22 22M7 29 29 7M18 10l8 8-8 8-8-8Z',
  arcane: 'M18 2l5 11 11 5-11 5-5 11-5-11-11-5 11-5ZM18 12v12M12 18h12',
  bag: 'M10 10 7 4h22l-3 6q15 22-8 22T10 10ZM12 12h12M18 18v9',
};
export function ItemIcon({ item, spell, size = 36 }: { item?: Item; spell?: string; size?: number }) {
  const id = item?.id ?? '';
  const kind = spell ? ({ FIRE: 'fire', ICE: 'ice', LIGHT: 'light', ARCANE: 'arcane' }[spell] ?? 'arcane')
    : id.includes('SCROLL') ? 'scroll' : id.includes('AXE') ? 'axe' : id.includes('SPEAR') ? 'spear' : id === 'MACE' ? 'mace'
    : item?.category === 'RANGED' ? 'bow' : item?.category === 'WEAPON' ? 'sword'
    : item?.category === 'SHIELD' ? 'shield' : item?.category === 'MAGIC_FOCUS' ? 'focus'
    : item?.category === 'ARMOR' ? 'armor' : item?.category === 'CONSUMABLE' ? 'potion' : 'bag';
  return <svg className={`item-icon icon-${kind}`} width={size} height={size} viewBox="0 0 36 36" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[kind]}/></svg>;
}
