export type HeroMode = 'pro' | 'creative'

export const HERO_PRO = {
  text: 'Tucker Anglemyer',
  font: '400 72px "Instrument Serif"',
  maxWidth: 600,
  lineHeight: 90,
  color: '#ffffff',
} as const

export const HERO_CREATIVE = {
  text: 'ANGLEMYER',
  font: '700 64px "Space Mono"',
  maxWidth: 2000,
  lineHeight: 72,
  color: '#ffffff',
  letterSpacingEm: 0.08,
} as const
