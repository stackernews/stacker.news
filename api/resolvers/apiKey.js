import { GraphQLError } from 'graphql'

export default function assertApiKeyNotPermitted ({ me }) {
  if (me?.apiKey === true) {
    throw new GraphQLError('this operation is not allowed to be performed via API Key', { extensions: { code: 'FORBIDDEN' } })
  }
}
