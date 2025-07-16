import { isTemplate, isWallet } from '@/wallets/lib/util'

// states that dictate if we show a button or wallets on the wallets page
export const Status = {
  LOADING_WALLETS: 'LOADING_WALLETS',
  NO_WALLETS: 'NO_WALLETS',
  HAS_WALLETS: 'HAS_WALLETS',
  PASSPHRASE_REQUIRED: 'PASSPHRASE_REQUIRED',
  WALLETS_UNAVAILABLE: 'WALLETS_UNAVAILABLE'
}

// wallet actions
export const SET_WALLETS = 'SET_WALLETS'
export const SET_KEY = 'SET_KEY'
export const WRONG_KEY = 'WRONG_KEY'
export const KEY_MATCH = 'KEY_MATCH'
export const NO_KEY = 'KEY_UNAVAILABLE'
export const WALLETS_QUERY_ERROR = 'WALLETS_QUERY_ERROR'

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
        status: transitionStatus(action, state, wallets.length > 0 ? Status.HAS_WALLETS : Status.NO_WALLETS),
        wallets,
        templates
      }
    }
    case WALLETS_QUERY_ERROR:
      return {
        ...state,
        status: transitionStatus(action, state, action.error)
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
        status: transitionStatus(action, state, Status.PASSPHRASE_REQUIRED)
      }
    case KEY_MATCH:
      return {
        ...state,
        status: transitionStatus(action, state, state.wallets.length > 0 ? Status.HAS_WALLETS : Status.NO_WALLETS)
      }
    case NO_KEY:
      return {
        ...state,
        status: transitionStatus(action, state, Status.WALLETS_UNAVAILABLE)
      }
    default:
      return state
  }
}

function transitionStatus ({ type }, { status: from }, to) {
  switch (type) {
    case SET_WALLETS: {
      return (from instanceof Error || [Status.PASSPHRASE_REQUIRED, Status.WALLETS_UNAVAILABLE].includes(from)) ? from : to
    }
    case KEY_MATCH: {
      return (from instanceof Error || from === Status.LOADING_WALLETS) ? from : to
    }
    default:
      return to
  }
}
