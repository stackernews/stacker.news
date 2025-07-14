import { isTemplate, isWallet } from '@/wallets/lib/util'

// states that dictate if we show a button or wallets on the wallets page
export const Status = {
  LOADING_WALLETS: 'LOADING_WALLETS',
  NO_WALLETS: 'NO_WALLETS',
  HAS_WALLETS: 'HAS_WALLETS',
  PASSPHRASE_REQUIRED: 'PASSPHRASE_REQUIRED'
}

// wallet actions
export const SET_WALLETS = 'SET_WALLETS'
export const SET_KEY = 'SET_KEY'
export const WRONG_KEY = 'WRONG_KEY'
export const KEY_MATCH = 'KEY_MATCH'

export default function reducer (state, action) {
  switch (action.type) {
    case SET_WALLETS: {
      const wallets = action.wallets
        .filter(isWallet)
        .sort((a, b) => a.priority === b.priority ? a.id - b.id : a.priority - b.priority)
      const templates = action.wallets
        .filter(isTemplate)
        .sort((a, b) => a.name.localeCompare(b.name))
      return {
        ...state,
        status: statusLocked(state.status)
          ? state.status
          : walletStatus(wallets),
        wallets,
        templates
      }
    }
    case SET_KEY:
      return {
        ...state,
        key: action.key,
        keyHash: action.hash
      }
    case WRONG_KEY:
      return {
        ...state,
        status: Status.PASSPHRASE_REQUIRED
      }
    case KEY_MATCH:
      return {
        ...state,
        status: state.status === Status.LOADING_WALLETS
          ? state.status
          : walletStatus(state.wallets)
      }
    default:
      return state
  }
}

function statusLocked (status) {
  return [Status.PASSPHRASE_REQUIRED].includes(status)
}

function walletStatus (wallets) {
  return wallets.length > 0
    ? Status.HAS_WALLETS
    : Status.NO_WALLETS
}
