// Amounts are integers in øre inside the backend, so sums never hit float rounding (0.1 + 0.2)
export function toOre(decimalString) {
  const [kr, ore = ''] = String(decimalString).split('.')
  const sign = kr.startsWith('-') ? -1 : 1
  return sign * (Math.abs(Number(kr)) * 100 + Number(ore.padEnd(2, '0').slice(0, 2)))
}

export const toKr = (ore) => ore / 100
