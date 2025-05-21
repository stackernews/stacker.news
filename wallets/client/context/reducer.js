// pages
export const FIRST_PAGE = 'FIRST_PAGE'
export const WALLET_LIST_PAGE = 'WALLET_LIST_PAGE'

// page actions
export const RESET_PAGE = 'RESET_PAGE'
export const NEXT_PAGE = 'NEXT_PAGE'

// wallet actions
export const SET_WALLETS = 'SET_WALLETS'

export default function reducer (state, action) {
  switch (action.type) {
    case RESET_PAGE:
      return {
        ...state,
        page: FIRST_PAGE
      }
    case NEXT_PAGE:
      return {
        ...state,
        page: state.page === FIRST_PAGE
          ? WALLET_LIST_PAGE
          : undefined
      }
    case SET_WALLETS:
      return {
        ...state,
        wallets: action.wallets
      }
    default:
      return state
  }
}
