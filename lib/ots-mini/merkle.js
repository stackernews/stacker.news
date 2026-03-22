import { OpAppend, OpPrepend, OpSHA256 } from './ops.js'
import { Timestamp } from './timestamp.js'

/**
 * Link two leaf Timestamps into a single parent via SHA-256(left.msg || right.msg).
 * Mutates both left and right by adding op-edges.
 * @param {Timestamp} left - The left leaf timestamp.
 * @param {Timestamp} right - The right leaf timestamp.
 * @returns {Timestamp} The shared parent Timestamp.
 * @throws {Error} If left or right is not an instance of Timestamp.
 */
export function catSHA256 (left, right) {
  if (!(left instanceof Timestamp) || !(right instanceof Timestamp)) {
    throw new Error('catSHA256: both left and right must be instances of Timestamp')
  }
  const sharedChild = left.add(new OpAppend(right.msg))
  right.addChild(new OpPrepend(left.msg), sharedChild)
  return sharedChild.add(new OpSHA256())
}

/**
 * Build a Merkle Mountain Range over an array of leaf Timestamps.
 * @param {Timestamp[]} leaves - Array of leaf Timestamps to combine.
 * @returns {Timestamp} The single Merkle tip Timestamp.
 * @throws {Error} If leaves is empty.
 */
export function makeMerkleTree (leaves) {
  if (leaves.length === 0) throw new Error('empty leaves')
  if (leaves.length === 1) return leaves[0]

  let stamps = leaves.slice()
  while (stamps.length > 1) {
    const nextPass = []
    for (let i = 0; i + 1 < stamps.length; i += 2) {
      nextPass.push(catSHA256(stamps[i], stamps[i + 1]))
    }
    if (stamps.length % 2 === 1) nextPass.push(stamps[stamps.length - 1])
    stamps = nextPass
  }
  return stamps[0]
}
