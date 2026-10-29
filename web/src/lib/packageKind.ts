// Guess which component body to draw for a part without a photo, from its folder / description / MPN.
// Purely cosmetic: a wrong guess just draws the generic IC.
export type PackageKind = 'capacitor' | 'resistor' | 'inductor' | 'diode' | 'chip'

const RULES: [PackageKind, RegExp][] = [
  ['capacitor', /capacit|\bmlcc\b|\d\s*[pnuµ]f\b/i],
  ['resistor', /resist|\d\s*[km]?\s*(Ω|ohms?\b)/i],
  ['inductor', /induct|ferrite|choke|\d\s*[nuµ]h\b/i],
  ['diode', /diode|\bleds?\b|zener|schottky|rectifier/i],
]

export function packageKind(...texts: string[]): PackageKind {
  return RULES.find(([, re]) => texts.some(t => re.test(t)))?.[0] ?? 'chip'
}
