/**
 * 캐릭터 단계 표시 — Lv.1~6 대신 광부·농부·상인·기사·귀족·왕족 아이콘과 이름을 쓴다.
 * 점수 구간은 서버 CharacterScore(100점이 한 단계, 최대 500)와 맞춘다. 이 표 밖의 단계(서버가 나중에 늘릴 때)는 'Lv.N'으로 보인다.
 */
export const LEVELS: Record<number, { icon: string; name: string; range: string }> = {
  1: { icon: '⛏️', name: '광부', range: '0~99점' },
  2: { icon: '🐴', name: '농부', range: '100~199점' },
  3: { icon: '💰', name: '상인', range: '200~299점' },
  4: { icon: '🛡️', name: '기사', range: '300~399점' },
  5: { icon: '🎩', name: '귀족', range: '400~499점' },
  6: { icon: '👑', name: '왕족', range: '500점' },
};

/** '광부'처럼 이름만. 읽어 주는 라벨과 텍스트용 */
export function levelName(level: number): string {
  return LEVELS[level]?.name ?? `Lv.${level}`;
}
