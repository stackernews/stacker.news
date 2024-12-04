import { TOTP } from 'otpauth'
import { NextResponse } from 'next/server'
import { getToken, encode } from 'next-auth/jwt'

/**
 * Get totp provider
 */
function getTotp ({ label, secret } = {}) {
  return new TOTP({
    issuer: 'stacker.news',
    label,
    digits: 6,
    period: 30,
    secret
  })
}

/**
 * Check if the given token is valid within the window
 * @param {Object} param0
 * @param {string} param0.secret - the totp secret
 * @param {string} param0.token - the totp token
 * @returns {boolean} - true if the token is valid
 */
export function validateTotp ({ secret, token }) {
  const totp = getTotp({ secret })
  const delta = totp.validate({ token, window: 1 })
  return delta !== null
}

/**
 * Generate a totp secret
 * @param {args} param0
 * @param {string} param0.label - the totp label (eg. usernames)
 * @returns {Object} - the totp secret
 * @returns {string} base32 - the base32 secret
 * @returns {string} uri - the totp uri
 */
export function generateTotpSecret ({ label = 'stacker.news - login' }) {
  const totp = getTotp({ label })
  return {
    base32: totp.secret.base32,
    uri: totp.toString()
  }
}

/**
 * Return all the 2fa methods supported by the user
 * @param {Object} context
 * @param {Object} context.me - the user object
 * @returns {Array<String>} - the 2fa methods supported by the user eg ['totp']
 */
export function getRequired2faMethods ({ me }) {
  if (me?.isTotpEnabled || me?.totpSecret) {
    return ['totp']
  }
  return null
}

/**
 * Validate 2fa
 * @param {string} method - the 2fa method (eg totp)
 * @param {Object} args - the 2fa tokens required for the method
 * @param {Object} context
 * @param {Object} context.me - the user object
 * @returns {boolean} - true if the 2fa is valid
 */
export function validate2fa (method, args, { me }) {
  switch (method) {
    case 'totp': {
      const { token } = args
      const totpSecret = me.totpSecret
      if (!totpSecret) throw new Error('2FA not enabled')
      return validateTotp({ secret: totpSecret, token })
    }
    default:
      throw new Error('Unsupported 2FA method ' + method)
  }
}

/**
 * Get the 2fa jwt token for the user session
 * @param {Object} context
 * @param {Object} context.req - the request object
 * @param {string} context.userId - the user id
 * @returns {Object} - the decoded 2fa token
 */
export async function getLogin2faToken ({ req, userId }) {
  const cookieName = `sn2fa_${userId}`
  const secret = process.env.NEXTAUTH_SECRET
  const token = await getToken({ req, secret, cookieName })
  return token
}

/**
 * Check if the user session requires 2fa
 * @param {args} param0
 * @param {Object} param0.session - the user session
 * @param {Object} param0.req - the request object
 * @returns {Object}
 * @returns {Object} session - the verified session or null if 2fa is required
 * @returns {Object} unverifiedSession - the unverified session or null if 2fa is not required
 */
export async function sessionGuard ({ session, req }) {
  // if anon or 2fa is not set, user doesn't need 2fa
  if (!session?.requires2faMethods) return { session }
  const token2fa = await getLogin2faToken({ req, userId: session.user.id })
  let unverifiedSession = null

  // if 2fa was not passed or the jti2fa is different (replay attack), user needs 2fa
  const needLogin2fa = token2fa?.jti2fa !== session?.jti2fa
  if (needLogin2fa) {
    unverifiedSession = session
    session = null
  }

  return { session, unverifiedSession }
}

/**
 * Check if the user session requires 2fa and if so redirect to the 2fa prompt page
 * @param {Object} param0
 * @param {Object} param0.req - the request object
 * @returns {Object|null} - the nextjs redirect response or null if no redirect is needed
 */
export async function pageGuard ({ req }) {
  const secret = process.env.NEXTAUTH_SECRET
  const token = await getToken({ req, secret })
  const userId = token?.id

  // anons don't need 2fa
  if (!userId) return null

  // if not 2fa method is required, user doesn't need 2fa
  if (!token?.requires2faMethods?.length) return null

  // select one 2fa method from the available ones
  const method2fa = token.requires2faMethods[0] // there is a single 2fa method for now

  // if we are already on the right 2fa prompt page, we don't need to redirect
  const pathname = req.nextUrl.pathname
  const searchParams = new URLSearchParams(req.nextUrl.search)
  if (pathname === '/auth/prompt2fa' && searchParams.get('method') === method2fa) return null

  // redirect only if the 2fa was not passed or the jti2fa is different (replay attack)
  const token2fa = await getLogin2faToken({ req, userId })
  const needLogin2fa = token2fa?.jti2fa !== token?.jti2fa
  if (needLogin2fa) {
    const redirectTo = new URL('/auth/prompt2fa', req.url)
    redirectTo.searchParams.set('callbackUrl', req.url)
    redirectTo.searchParams.set('method', method2fa)
    return NextResponse.redirect(redirectTo)
  }
}

/**
 * Get the 2fa encoded token to be stored in the user session
 * @param {Object} param0
 * @param {boolean} param0.result - the 2fa result
 * @param {string} param0.userId - the user id
 * @param {string} param0.jti2fa - the 2fa jwt id
 * @returns {Object} - the cookie key and value
 */
export async function getEncodedLogin2faToken ({ result, userId, jti2fa }) {
  const cookieName = `sn2fa_${userId}`
  const secret = process.env.NEXTAUTH_SECRET
  const encodedToken = await encode({
    token: {
      jti2fa
    },
    secret
  })
  return {
    key: cookieName,
    value: encodedToken
  }
}
