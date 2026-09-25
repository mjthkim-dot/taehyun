import type { CharacterId } from './types';

/** 캐릭터별 표시 이름·아바타 색 — 대화 UI와 롤플레이 역할 선택에서 쓴다. */
export const CHARACTERS: Record<
  CharacterId,
  { nameKr: string; initial: string; color: string }
> = {
  Ross: { nameKr: '로스', initial: 'R', color: '#7c5cbf' },
  Rachel: { nameKr: '레이첼', initial: 'Ra', color: '#2f9e6e' },
  Monica: { nameKr: '모니카', initial: 'M', color: '#c2410c' },
  Chandler: { nameKr: '챈들러', initial: 'C', color: '#2563ab' },
  Joey: { nameKr: '조이', initial: 'J', color: '#b3822b' },
  Phoebe: { nameKr: '피비', initial: 'P', color: '#c04277' },
  Guest: { nameKr: '게스트', initial: 'G', color: '#74716b' },
};

export function characterLabel(id: CharacterId, label?: string): string {
  return id === 'Guest' && label ? label : CHARACTERS[id].nameKr;
}
