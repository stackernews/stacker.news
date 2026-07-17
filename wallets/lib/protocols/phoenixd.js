import { urlValidator } from '@/wallets/lib/validate'
import { string } from '@/lib/yup'
import { snFetch } from '@/lib/fetch'
import { assertContentTypeJson, assertResponseOk } from '@/lib/url'
import { assertWalletAuthorized } from '@/wallets/lib/errors'

// phoenix.conf accepts custom http-password strings too.
const phoenixdPasswordValidator = string().max(1024)

// Phoenixd
// https://phoenix.acinq.co/server

export default [
  {
    name: 'PHOENIXD',
    displayName: 'Phoenixd',
    send: true,
    fields: [
      {
        name: 'url',
        type: 'text',
        label: 'url',
        // send wallet: dialed by the user's browser, so private/LAN addresses are allowed
        validate: urlValidator('clearnet', { allowPrivate: true }),
        required: true,
        share: true
      },
      {
        name: 'apiKey',
        type: 'password',
        label: 'api key',
        help: [
          'The primary password can be found as `http-password` in your phoenixd configuration file.',
          'The default location is ~/.phoenix/phoenix.conf.',
          'Read the [official documentation](https://phoenix.acinq.co/server/api#security) for more details.'
        ],
        validate: phoenixdPasswordValidator,
        required: true,
        encrypt: true
      }
    ],
    relationName: 'walletSendPhoenixd'
  },
  {
    name: 'PHOENIXD',
    displayName: 'Phoenixd',
    send: false,
    fields: [
      {
        name: 'url',
        type: 'text',
        label: 'url',
        // receive wallet: dialed by our servers, which can reach onion via the Tor proxy
        validate: urlValidator('clearnet', 'tor'),
        required: true,
        share: true
      },
      {
        name: 'apiKey',
        type: 'password',
        label: 'api key',
        help: [
          'The secondary password can be found as `http-password-limited-access` in your phoenixd configuration file.',
          'The default location is ~/.phoenix/phoenix.conf.',
          'Read the [official documentation](https://phoenix.acinq.co/server/api#security) for more details.'
        ],
        validate: phoenixdPasswordValidator,
        required: true
      }
    ],
    relationName: 'walletRecvPhoenixd'
  }
]

export async function phoenixdRequest ({
  url,
  apiKey,
  path,
  method = 'GET',
  body,
  signal,
  timeout,
  notFoundOk = false
}) {
  const headers = new Headers()
  headers.set('Accept', 'application/json')
  headers.set('Authorization', 'Basic ' + Buffer.from(':' + apiKey).toString('base64'))
  if (body) headers.set('Content-Type', 'application/x-www-form-urlencoded')

  const res = await snFetch(url, {
    path,
    method,
    headers,
    body,
    signal,
    timeout
  })

  if (notFoundOk && res.status === 404) return null

  assertWalletAuthorized(res)
  assertResponseOk(res, { method })
  assertContentTypeJson(res, { method })

  return await res.json()
}
