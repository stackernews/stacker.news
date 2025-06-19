import { isEncrypted, isTemplate, isWallet } from '@/wallets/lib/util'

// pages
export const FIRST_PAGE = 'FIRST_PAGE'
export const UNLOCK_PAGE = 'UNLOCK_PAGE'
export const WALLET_LIST_PAGE = 'WALLET_LIST_PAGE'

// page actions
export const RESET_PAGE = 'RESET_PAGE'
export const NEXT_PAGE = 'NEXT_PAGE'

// wallet actions
export const SET_WALLETS = 'SET_WALLETS'
export const SET_KEY = 'SET_KEY'

export default function reducer (state, action) {
  switch (action.type) {
    case RESET_PAGE:
      return {
        ...state,
        page: getPage(state)
      }
    case NEXT_PAGE:
      return {
        ...state,
        page: nextPage(state)
      }
    case SET_WALLETS: {
      const wallets = action.wallets
        .filter(isWallet)
        .sort((a, b) => a.priority === b.priority ? a.id - b.id : a.priority - b.priority)
      const templates = action.wallets
        .filter(isTemplate)
        .sort((a, b) => a.name.localeCompare(b.name))
      return {
        ...state,
        page: getPage({ ...action, wallets, templates }),
        wallets,
        templates,
        loading: false
      }
    }
    case SET_KEY:
      return {
        ...state,
        key: action.key
      }
    default:
      return state
  }
}

function getPage (state) {
  // did decryption fail for a wallet?
  if (state.wallets.some(isEncrypted)) {
    return UNLOCK_PAGE
  }

  return state.wallets.length > 0
    ? WALLET_LIST_PAGE
    : FIRST_PAGE
}

function nextPage (state) {
  return [FIRST_PAGE, UNLOCK_PAGE].includes(state.page)
    ? WALLET_LIST_PAGE
    : state.page
}
