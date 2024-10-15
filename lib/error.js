import { GraphQLError } from 'graphql'

export const E_FORBIDDEN = 'E_FORBIDDEN'
export const E_UNAUTHENTICATED = 'E_UNAUTHENTICATED'
export const E_BAD_INPUT = 'E_BAD_INPUT'

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
  constructor (message) {
    super(message, { extensions: { code: E_BAD_INPUT } })
  }
}
