import { string } from '@/lib/yup'
import { assertContentTypeJson, assertResponseOk } from '@/lib/url'

export const name = 'phoenixd'
export const walletType = 'PHOENIXD'
export const walletField = 'walletPhoenixd'

// configure wallet fields
export const fields = [
  {
    name: 'url',
    label: 'url',
    type: 'text',
    validate: string().url().trim()
  },
  {
    name: 'primaryPassword',
    label: 'primary password',
    type: 'password',
    optional: 'for sending',
    help: 'You can find the primary password as `http-password` in your phoenixd configuration file as mentioned [here](https://phoenix.acinq.co/server/api#security).',
    clientOnly: true,
    requiredWithout: 'secondaryPassword',
    validate: string().length(64).hex()
  },
  {
    name: 'secondaryPassword',
    label: 'secondary password',
    type: 'password',
    optional: 'for receiving',
    help: 'You can find the secondary password as `http-password-limited-access` in your phoenixd configuration file as mentioned [here](https://phoenix.acinq.co/server/api#security).',
    serverOnly: true,
    requiredWithout: 'primaryPassword',
    validate: string().length(64).hex()
  }
]

// configure wallet card
export const card = {
  title: 'phoenixd',
  subtitle: 'use [phoenixd](https://phoenix.acinq.co/server) for payments',
  image: { src: '/wallets/phoenixd.png' }
}

export async function callApi (
  path,
  args = {},
  { url, password, method = 'POST' }
) {
  const headers = new Headers()
  headers.set('Authorization', 'Basic ' + Buffer.from(':' + password).toString('base64'))
  headers.set('Content-type', 'application/x-www-form-urlencoded')

  let fullUrl = url.trim()
  if (!fullUrl.endsWith('/')) fullUrl += '/'
  fullUrl += path

  const body = new URLSearchParams()
  for (const [key, value] of Object.entries(args)) {
    body.append(key, value)
  }

  if (method === 'GET' && Object.keys(args).length > 0) {
    fullUrl += '?' + body.toString()
  }

  const res = await fetch(fullUrl, {
    method,
    headers,
    body: method === 'POST' ? body : undefined
  })

  assertResponseOk(res)
  assertContentTypeJson(res)

  return await res.json()
}
