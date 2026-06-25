export const REPRIMAND_TEXTS = [
  '자세! 눈 똑바로!',
  '목소리 크게! 네!',
  '왜 그래! 정신 차려!',
  '반성문 3줄 써!',
  '훈련 더 해!',
  '계급장 제대로 차고 와!',
  '답변 큼직하게!',
  '기합 넣어!',
] as const

export function randomReprimand(): string {
  return REPRIMAND_TEXTS[Math.floor(Math.random() * REPRIMAND_TEXTS.length)]
}

export function buildGuboText(name: string, superiorName: string, superiorRank: string): string {
  return `${name} ${superiorRank} ${superiorName}님! 네! 🫡`
}
