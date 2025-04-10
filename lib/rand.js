export function randInRange (min, max) {
  return Math.random() * (max - min) + min
}

export function shuffleArray (array) {
  return [...array].sort(() => Math.random() - 0.5)
}
