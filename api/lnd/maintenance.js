import { GqlInputError } from '@/lib/error'

export const LND_MAINTENANCE_MESSAGE = 'Lightning is temporarily unavailable for maintenance.'

const ENABLED_VALUES = new Set(['1', 'true'])

export function isLndMaintenance (env = process.env) {
  return ENABLED_VALUES.has(env.LND_MAINTENANCE?.trim().toLowerCase())
}

export function assertLndAvailable () {
  if (isLndMaintenance()) {
    throw new GqlInputError(LND_MAINTENANCE_MESSAGE)
  }
}
