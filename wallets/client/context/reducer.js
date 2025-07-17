import { isTemplate, isWallet } from '@/wallets/lib/util'

export const KeyStatus = {
  KEY_STORAGE_UNAVAILABLE: 'KEY_STORAGE_UNAVAILABLE',
  WRONG_KEY: 'WRONG_KEY'
}

// wallet actions
export const SET_WALLETS = 'SET_WALLETS'
export const SET_KEY = 'SET_KEY'
export const WRONG_KEY = 'WRONG_KEY'
export const KEY_MATCH = 'KEY_MATCH'
export const KEY_STORAGE_UNAVAILABLE = 'KEY_STORAGE_UNAVAILABLE'
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
        walletsLoading: false,
        walletsError: null,
        wallets,
        templates
      }
    }
    case WALLETS_QUERY_ERROR:
      return {
        ...state,
        walletsLoading: false,
        walletsError: action.error
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
        keyError: KeyStatus.WRONG_KEY
      }
    case KEY_MATCH:
      return {
        ...state,
        keyError: null
      }
    case KEY_STORAGE_UNAVAILABLE:
      return {
        ...state,
        keyError: KeyStatus.KEY_STORAGE_UNAVAILABLE
      }
    default:
      return state
  }
}
