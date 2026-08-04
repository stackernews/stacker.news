export const BIP_110_FORK_START_HEIGHT = 961632
export const BIP_110_FORK_DURATION_BLOCKS = 144

export function isBip110ForkHeight (height, { preview = false } = {}) {
  return preview || (height >= BIP_110_FORK_START_HEIGHT &&
    height < BIP_110_FORK_START_HEIGHT + BIP_110_FORK_DURATION_BLOCKS)
}
