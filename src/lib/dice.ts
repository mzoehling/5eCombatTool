export function rollDie(sides: number): number {
  return 1 + Math.floor(Math.random() * sides)
}

export function d20(): number {
  return rollDie(20)
}
