import { GraphQLError } from 'graphql'

export function isAbortError (err) {
  return err?.name === 'AbortError'
}

export function errorMessage (err) {
  return err?.message || err?.toString?.() || 'unknown error'
}

export const E_FORBIDDEN = 'E_FORBIDDEN'
export const E_UNAUTHENTICATED = 'E_UNAUTHENTICATED'
export const E_BAD_INPUT = 'E_BAD_INPUT'
export const E_VAULT_KEY_EXISTS = 'E_VAULT_KEY_EXISTS'
export const E_PAY_IN_RETRY_RACE = 'E_PAY_IN_RETRY_RACE'
export const E_EXTERNAL_WALLET_SEND_CONFIRMATION_REQUIRED = 'E_EXTERNAL_WALLET_SEND_CONFIRMATION_REQUIRED'

export class GqlAuthorizationError extends GraphQLError {
  constructor (message) {
    super(message, { extensions: { code: E_FORBIDDEN } })
  }
}

export class GqlAuthenticationError extends GraphQLError {
  constructor () {
    super('you must be logged in', { extensions: { code: E_UNAUTHENTICATED } })
  }
}

export class GqlInputError extends GraphQLError {
  constructor (message, code) {
    super(message, { extensions: { code: code || E_BAD_INPUT } })
  }
}

// a payIn retry lost a benign race (lineage already advanced, successor not FAILED yet,
// or a concurrent retry won the successorId lock) — clients key on the code to suppress it
export class GqlPayInRetryRaceError extends GraphQLError {
  constructor (message) {
    super(message, { extensions: { code: E_PAY_IN_RETRY_RACE } })
  }
}

export class GqlExternalWalletSendConfirmationError extends GraphQLError {
  constructor (message, duplicate) {
    super(message, {
      extensions: {
        code: E_EXTERNAL_WALLET_SEND_CONFIRMATION_REQUIRED,
        duplicate
      }
    })
  }
}
