import { GqlAuthorizationError } from '@/lib/error'

export default function assertApiKeyNotPermitted ({ me }) {
  if (me?.apiKey === true) {
    throw new GqlAuthorizationError('this operation is not allowed to be performed via API Key')
  }
}
