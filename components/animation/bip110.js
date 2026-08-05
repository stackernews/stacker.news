export const BIP_110_FORK_START_HEIGHT = 961632
export const BIP_110_FORK_DURATION_BLOCKS = 144
export const BIP_110_COUNTDOWN_DURATION_BLOCKS = 144

export function isBip110ForkHeight (height, { preview = false } = {}) {
  return preview || (height >= BIP_110_FORK_START_HEIGHT &&
    height < BIP_110_FORK_START_HEIGHT + BIP_110_FORK_DURATION_BLOCKS)
}

export function getBip110Ticker (height, { preview = false } = {}) {
  const blocksUntilFork = BIP_110_FORK_START_HEIGHT - height

  if (blocksUntilFork > 0 && blocksUntilFork <= BIP_110_COUNTDOWN_DURATION_BLOCKS) {
    return { phase: 'countdown', blocksUntilFork }
  }

  if (isBip110ForkHeight(height, { preview })) {
    return { phase: 'forked' }
  }

  return null
}
