import { createHash } from 'node:crypto'
import NextAuth from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import GitHubProvider from 'next-auth/providers/github'
import TwitterProvider from 'next-auth/providers/twitter'
import EmailProvider from 'next-auth/providers/email'
import prisma from '@/api/models'
import nodemailer from 'nodemailer'
import { PrismaAdapter } from '@auth/prisma-adapter'
import { NodeNextRequest, NodeNextResponse } from 'next/dist/server/base-http/node'
import { getToken, encode as encodeJWT } from 'next-auth/jwt'
import { datePivot } from '@/lib/time'
import { schnorr } from '@noble/curves/secp256k1'
import { notifyReferral } from '@/lib/webPush'
import { hashEmail } from '@/lib/crypto'
import * as cookie from 'cookie'
import { multiAuthMiddleware } from '@/pages/api/graphql'

/**
 * Stores userIds in user table
 * @returns {Partial<import('next-auth').EventCallbacks>}
 * */
function getEventCallbacks () {
  return {
    async linkAccount ({ user, profile, account }) {
      if (account.provider === 'github') {
        await prisma.user.update({ where: { id: user.id }, data: { githubId: profile.name } })
      } else if (account.provider === 'twitter') {
        await prisma.user.update({ where: { id: user.id }, data: { twitterId: profile.name } })
      }
    },
    async signIn ({ user, profile, account, isNewUser }) {
      if (account.provider === 'github') {
        await prisma.user.update({ where: { id: user.id }, data: { githubId: profile.name } })
      } else if (account.provider === 'twitter') {
        await prisma.user.update({ where: { id: user.id }, data: { twitterId: profile.name } })
      }
    }
  }
}

async function getReferrerId (referrer) {
  try {
    if (referrer.startsWith('item-')) {
      return (await prisma.item.findUnique({ where: { id: parseInt(referrer.slice(5)) } }))?.userId
    } else if (referrer.startsWith('profile-')) {
      return (await prisma.user.findUnique({ where: { name: referrer.slice(8) } }))?.id
    } else if (referrer.startsWith('territory-')) {
      return (await prisma.sub.findUnique({ where: { name: referrer.slice(10) } }))?.userId
    } else {
      return (await prisma.user.findUnique({ where: { name: referrer } }))?.id
    }
  } catch (error) {
    console.error('error getting referrer id', error)
  }
}

/** @returns {Partial<import('next-auth').CallbacksOptions>} */
function getCallbacks (req, res) {
  return {
    /**
     * @param  {object}  token     Decrypted JSON Web Token
     * @param  {object}  user      User object      (only available on sign in)
     * @param  {object}  account   Provider account (only available on sign in)
     * @param  {object}  profile   Provider profile (only available on sign in)
     * @param  {boolean} isNewUser True if new user (only available on sign in)
     * @return {object}            JSON Web Token that will be saved
     */
    async jwt ({ token, user, account, profile, isNewUser }) {
      if (user) {
        // token won't have an id on it for new logins, we add it
        // note: token is what's kept in the jwt
        token.id = Number(user.id)

        // if referrer exists, set on user
        // isNewUser doesn't work for nostr/lightning auth because we create the user before nextauth can
        // this means users can update their referrer if they don't have one, which is fine
        if (req.cookies.sn_referrer && user?.id) {
          const referrerId = await getReferrerId(req.cookies.sn_referrer)
          if (referrerId && referrerId !== parseInt(user?.id)) {
            const { count } = await prisma.user.updateMany({ where: { id: user.id, referrerId: null }, data: { referrerId } })
            if (count > 0) notifyReferral(referrerId)
          }
        }
      }

      if (token?.id) {
        // HACK token.sub is used by nextjs v4 internally and is used like a userId
        // setting it here allows us to link multiple auth method to an account
        // ... in v3 this linking field was token.user.id
        token.sub = Number(token.id)
      }

      // response is only defined during signup/login
      if (req && res) {
        req = new NodeNextRequest(req)
        res = new NodeNextResponse(res)
        const secret = process.env.NEXTAUTH_SECRET
        const jwt = await encodeJWT({ token, secret })
        const me = await prisma.user.findUnique({ where: { id: token.id } })
        // we set multi_auth cookies on login/signup with only one user so the rest of the code doesn't
        // have to consider the case where they aren't set yet because account switching wasn't used yet
        setMultiAuthCookies(req, res, { ...me, jwt })
      }

      return token
    },
    async session ({ session, token }) {
      // note: this function takes the current token (result of running jwt above)
      // and returns a new object session that's returned whenever get|use[Server]Session is called
      session.user.id = token.id

      return session
    }
  }
}

function setMultiAuthCookies (req, res, { id, jwt, name, photoId }) {
  const b64Encode = obj => Buffer.from(JSON.stringify(obj)).toString('base64')
  const b64Decode = s => JSON.parse(Buffer.from(s, 'base64'))

  // default expiration for next-auth JWTs is in 1 month
  const expiresAt = datePivot(new Date(), { months: 1 })
  const secure = process.env.NODE_ENV === 'production'
  const cookieOptions = {
    path: '/',
    httpOnly: true,
    secure,
    sameSite: 'lax',
    expires: expiresAt
  }

  // add JWT to **httpOnly** cookie
  res.appendHeader('Set-Cookie', cookie.serialize(`multi_auth.${id}`, jwt, cookieOptions))

  // switch to user we just added
  res.appendHeader('Set-Cookie', cookie.serialize('multi_auth.user-id', id, { ...cookieOptions, httpOnly: false }))

  let newMultiAuth = [{ id, name, photoId }]
  if (req.cookies.multi_auth) {
    const oldMultiAuth = b64Decode(req.cookies.multi_auth)
    // make sure we don't add duplicates
    if (oldMultiAuth.some(({ id: id_ }) => id_ === id)) return
    newMultiAuth = [...oldMultiAuth, ...newMultiAuth]
  }
  res.appendHeader('Set-Cookie', cookie.serialize('multi_auth', b64Encode(newMultiAuth), { ...cookieOptions, httpOnly: false }))
}

async function pubkeyAuth (credentials, req, res, pubkeyColumnName) {
  const { k1, pubkey } = credentials

  // are we trying to add a new account for switching between?
  const { body } = req.body
  const multiAuth = typeof body.multiAuth === 'string' ? body.multiAuth === 'true' : !!body.multiAuth

  try {
    // does the given challenge (k1) exist in our db?
    const lnauth = await prisma.lnAuth.findUnique({ where: { k1 } })

    // delete challenge to prevent replay attacks
    await prisma.lnAuth.delete({ where: { k1 } })

    // does the given pubkey match the one for which we verified the signature?
    if (lnauth.pubkey === pubkey) {
      // does the pubkey already exist in our db?
      let user = await prisma.user.findUnique({ where: { [pubkeyColumnName]: pubkey } })

      // get token if it exists
      req = multiAuthMiddleware(req)
      const token = await getToken({ req })
      if (!user) {
        // we have not seen this pubkey before

        // only update our pubkey if we're not currently trying to add a new account
        if (token?.id && !multiAuth) {
          user = await prisma.user.update({ where: { id: token.id }, data: { [pubkeyColumnName]: pubkey } })
        } else {
          // we're not logged in: create new user with that pubkey
          user = await prisma.user.create({ data: { name: pubkey.slice(0, 10), [pubkeyColumnName]: pubkey } })
        }
      }

      if (token && token?.id !== user.id && multiAuth) {
        // we're logged in as a different user than the one we're authenticating as
        // and we want to add a new account. this means we want to add this account
        // to our list of accounts for switching between so we issue a new JWT and
        // update the cookies for multi-authentication.
        const secret = process.env.NEXTAUTH_SECRET
        const userJWT = await encodeJWT({ token: { id: user.id, name: user.name, email: user.email }, secret })
        setMultiAuthCookies(req, res, { ...user, jwt: userJWT })
        return token
      }

      return user
    }
  } catch (error) {
    console.log(error)
  }

  return null
}

async function nostrEventAuth (event) {
  // parse event
  const e = JSON.parse(event)

  // is the event id a hash of this event
  const id = createHash('sha256').update(
    JSON.stringify(
      [0, e.pubkey, e.created_at, e.kind, e.tags, e.content]
    )
  ).digest('hex')
  if (id !== e.id) {
    throw new Error('invalid event id')
  }

  // is the signature valid
  if (!(await schnorr.verify(e.sig, e.id, e.pubkey))) {
    throw new Error('invalid signature')
  }

  // is the challenge present in the event
  if (!(e.tags[0].length === 2 && e.tags[0][0] === 'challenge')) {
    throw new Error('expected tags = [["challenge", <challenge>]]')
  }

  const pubkey = e.pubkey
  const k1 = e.tags[0][1]
  await prisma.lnAuth.update({ data: { pubkey }, where: { k1 } })

  return { k1, pubkey }
}

/** @type {import('next-auth/providers').Provider[]} */
const getProviders = res => [
  CredentialsProvider({
    id: 'lightning',
    name: 'Lightning',
    credentials: {
      pubkey: { label: 'publickey', type: 'text' },
      k1: { label: 'k1', type: 'text' }
    },
    authorize: async (credentials, req) => {
      return await pubkeyAuth(credentials, new NodeNextRequest(req), new NodeNextResponse(res), 'pubkey')
    }
  }),
  CredentialsProvider({
    id: 'nostr',
    name: 'Nostr',
    credentials: {
      event: { label: 'event', type: 'text' }
    },
    authorize: async ({ event }, req) => {
      const credentials = await nostrEventAuth(event)
      return await pubkeyAuth(credentials, new NodeNextRequest(req), new NodeNextResponse(res), 'nostrAuthPubkey')
    }
  }),
  GitHubProvider({
    clientId: process.env.GITHUB_ID,
    clientSecret: process.env.GITHUB_SECRET,
    authorization: {
      url: 'https://github.com/login/oauth/authorize',
      params: { scope: '' }
    },
    profile (profile) {
      return {
        id: profile.id,
        name: profile.login
      }
    }
  }),
  TwitterProvider({
    clientId: process.env.TWITTER_ID,
    clientSecret: process.env.TWITTER_SECRET,
    profile (profile) {
      return {
        id: profile.id,
        name: profile.screen_name
      }
    }
  }),
  EmailProvider({
    server: process.env.LOGIN_EMAIL_SERVER,
    from: process.env.LOGIN_EMAIL_FROM,
    sendVerificationRequest
  })
]

/** @returns {import('next-auth').AuthOptions} */
export const getAuthOptions = (req, res) => ({
  callbacks: getCallbacks(req, res),
  providers: getProviders(res),
  adapter: {
    ...PrismaAdapter(prisma),
    createUser: data => {
      // replace email with email hash in new user payload
      if (data.email) {
        const { email } = data
        data.emailHash = hashEmail({ email })
        delete data.email
        // data.email used to be used for name of new accounts. since it's missing, let's generate a new name
        data.name = data.emailHash.substring(0, 10)
        // sign them up for the newsletter
        // don't await it, let it run async
        enrollInNewsletter({ email })
      }
      return prisma.user.create({ data })
    },
    getUserByEmail: async email => {
      const hashedEmail = hashEmail({ email })
      let user = await prisma.user.findUnique({
        where: {
          // lookup by email hash since we don't store plaintext emails any more
          emailHash: hashedEmail
        }
      })
      if (!user) {
        user = await prisma.user.findUnique({
          where: {
            // lookup by email as a fallback in case a user attempts to login by email during the migration
            // and their email hasn't been migrated yet
            email
          }
        })
      }
      // HACK! This is required to satisfy next-auth's check here:
      // https://github.com/nextauthjs/next-auth/blob/5b647e1ac040250ad055e331ba97f8fa461b63cc/packages/next-auth/src/core/routes/callback.ts#L227
      // since we are nulling `email`, but it expects it to be truthy there.
      // Since we have the email from the input request, we can copy it here and pretend like we store user emails, even though we don't.
      if (user) {
        user.email = email
      }
      return user
    }
  },
  session: {
    strategy: 'jwt'
  },
  pages: {
    signIn: '/login',
    verifyRequest: '/email',
    error: '/auth/error'
  },
  events: getEventCallbacks()
})

async function enrollInNewsletter ({ email }) {
  if (process.env.LIST_MONK_URL && process.env.LIST_MONK_AUTH) {
    try {
      const response = await fetch(process.env.LIST_MONK_URL + '/api/subscribers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Basic ' + Buffer.from(process.env.LIST_MONK_AUTH).toString('base64')
        },
        body: JSON.stringify({
          email,
          name: 'blank',
          lists: [2],
          status: 'enabled',
          preconfirm_subscriptions: true
        })
      })
      const jsonResponse = await response.json()
      console.log(jsonResponse)
    } catch (err) {
      console.log('error signing user up for newsletter')
      console.log(err)
    }
  } else {
    console.log('LIST MONK env vars not set, skipping newsletter enrollment')
  }
}

export default async (req, res) => {
  await NextAuth(req, res, getAuthOptions(req, res))
}

async function sendVerificationRequest ({
  identifier: email,
  url,
  provider
}) {
  let user = await prisma.user.findUnique({
    where: {
      // Look for the user by hashed email
      emailHash: hashEmail({ email })
    }
  })
  if (!user) {
    user = await prisma.user.findUnique({
      where: {
        // or plaintext email, in case a user tries to login via email during the migration
        // before their particular record has been migrated
        email
      }
    })
  }

  return new Promise((resolve, reject) => {
    const { server, from } = provider

    const site = new URL(url).host

    nodemailer.createTransport(server).sendMail(
      {
        to: email,
        from,
        subject: `login to ${site}`,
        text: text({ url, site, email }),
        html: user ? html({ url, site, email }) : newUserHtml({ url, site, email })
      },
      (error) => {
        if (error) {
          return reject(new Error('SEND_VERIFICATION_EMAIL_ERROR', error))
        }
        return resolve()
      }
    )
  })
}

// Email HTML body
const html = ({ url, site, email }) => {
  // Insert invisible space into domains and email address to prevent both the
  // email address and the domain from being turned into a hyperlink by email
  // clients like Outlook and Apple mail, as this is confusing because it seems
  // like they are supposed to click on their email address to sign in.
  const escapedEmail = `${email.replace(/\./g, '&#8203;.')}`
  const escapedSite = `${site.replace(/\./g, '&#8203;.')}`

  // Some simple styling options
  const backgroundColor = '#f5f5f5'
  const textColor = '#212529'
  const mainBackgroundColor = '#ffffff'
  const buttonBackgroundColor = '#FADA5E'
  const buttonTextColor = '#212529'

  // Uses tables for layout and inline CSS due to email client limitations
  return `
<body style="background: ${backgroundColor};">
  <table width="100%" border="0" cellspacing="0" cellpadding="0">
    <tr>
      <td align="center" style="padding: 10px 0px 20px 0px; font-size: 22px; font-family: Helvetica, Arial, sans-serif; color: ${textColor};">
        <strong>${escapedSite}</strong>
      </td>
    </tr>
  </table>
  <table width="100%" border="0" cellspacing="20" cellpadding="0" style="background: ${mainBackgroundColor}; max-width: 600px; margin: auto; border-radius: 10px;">
    <tr>
      <td align="center" style="padding: 10px 0px 0px 0px; font-size: 18px; font-family: Helvetica, Arial, sans-serif; color: ${textColor};">
        login as <strong>${escapedEmail}</strong>
      </td>
    </tr>
    <tr>
      <td align="center" style="padding: 20px 0;">
        <table border="0" cellspacing="0" cellpadding="0">
          <tr>
            <td align="center" style="border-radius: 5px;" bgcolor="${buttonBackgroundColor}"><a href="${url}" target="_blank" style="font-size: 18px; font-family: Helvetica, Arial, sans-serif; color: ${buttonTextColor}; text-decoration: none; text-decoration: none;border-radius: 5px; padding: 10px 20px; border: 1px solid ${buttonBackgroundColor}; display: inline-block; font-weight: bold;">login</a></td>
          </tr>
        </table>
      </td>
    </tr>
    <tr>
      <td align="center" style="padding: 0px 0px 10px 0px; font-size: 16px; line-height: 22px; font-family: Helvetica, Arial, sans-serif; color: ${textColor};">
        Or copy and paste this link: <a href="#" style="text-decoration:none; color:${textColor}">${url}</a>
      </td>
    </tr>
    <tr>
      <td align="center" style="padding: 0px 0px 10px 0px; font-size: 10px; line-height: 22px; font-family: Helvetica, Arial, sans-serif; color: ${textColor};">
        If you did not request this email you can safely ignore it.
      </td>
    </tr>
  </table>
</body>
`
}

// Email text body –fallback for email clients that don't render HTML
const text = ({ url, site }) => `Sign in to ${site}\n${url}\n\n`

const newUserHtml = ({ url, site, email }) => {
  const escapedEmail = `${email.replace(/\./g, '&#8203;.')}`

  const replaceCb = (path) => {
    const urlObj = new URL(url)
    urlObj.searchParams.set('callbackUrl', path)
    return urlObj.href
  }

  const dailyUrl = replaceCb('/daily')
  const guideUrl = replaceCb('/guide')
  const faqUrl = replaceCb('/faq')
  const topUrl = replaceCb('/top/stackers/forever')
  const postUrl = replaceCb('/post')

  // Some simple styling options
  const backgroundColor = '#f5f5f5'
  const textColor = '#212529'
  const mainBackgroundColor = '#ffffff'
  const buttonBackgroundColor = '#FADA5E'

  return `
<!doctype html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">

<head>
  <title>
  </title>
  <!--[if !mso]><!-->
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <!--<![endif]-->
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style type="text/css">
    #outlook a {
      padding: 0;
    }

    body {
      margin: 0;
      padding: 0;
      -webkit-text-size-adjust: 100%;
      -ms-text-size-adjust: 100%;
    }

    table,
    td {
      border-collapse: collapse;
      mso-table-lspace: 0pt;
      mso-table-rspace: 0pt;
    }

    img {
      border: 0;
      height: auto;
      line-height: 100%;
      outline: none;
      text-decoration: none;
      -ms-interpolation-mode: bicubic;
    }

    p {
      display: block;
      margin: 13px 0;
    }
  </style>
  <!--[if mso]>
        <noscript>
        <xml>
        <o:OfficeDocumentSettings>
          <o:AllowPNG/>
          <o:PixelsPerInch>96</o:PixelsPerInch>
        </o:OfficeDocumentSettings>
        </xml>
        </noscript>
        <![endif]-->
  <!--[if lte mso 11]>
        <style type="text/css">
          .mj-outlook-group-fix { width:100% !important; }
        </style>
        <![endif]-->
  <style type="text/css">
    @media only screen and (min-width:480px) {
      .mj-column-per-100 {
        width: 100% !important;
        max-width: 100%;
      }
    }
  </style>
  <style media="screen and (min-width:480px)">
    .moz-text-html .mj-column-per-100 {
      width: 100% !important;
      max-width: 100%;
    }
  </style>
  <style type="text/css">
  </style>
</head>

<body style="word-spacing:normal;background-color:${backgroundColor};">
  <div style="background-color:${backgroundColor};">
    <!--[if mso | IE]><table align="center" border="0" cellpadding="0" cellspacing="0" class="" style="width:600px;" width="600" ><tr><td style="line-height:0px;font-size:0px;mso-line-height-rule:exactly;"><![endif]-->
    <div style="margin:0px auto;max-width:600px;">
      <table align="center" border="0" cellpadding="0" cellspacing="0" role="presentation" style="width:100%;">
        <tbody>
          <tr>
            <td style="direction:ltr;font-size:0px;padding:20px 0;text-align:center;">
              <!--[if mso | IE]><table role="presentation" border="0" cellpadding="0" cellspacing="0"><tr><td class="" style="vertical-align:top;width:600px;" ><![endif]-->
              <div class="mj-column-per-100 mj-outlook-group-fix" style="font-size:0px;text-align:left;direction:ltr;display:inline-block;vertical-align:top;width:100%;">
                <table border="0" cellpadding="0" cellspacing="0" role="presentation" style="vertical-align:top;" width="100%">
                  <tbody>
                    <tr>
                      <td align="center" style="font-size:0px;padding:10px 25px;word-break:break-word;">
                        <div style="font-family:Helvetica, Arial, sans-serif;font-size:22px;line-height:1;text-align:center;color:#000000;"><b>Welcome to Stacker News!</b></div>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <!--[if mso | IE]></td></tr></table><![endif]-->
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    <!--[if mso | IE]></td></tr></table><table align="center" border="0" cellpadding="0" cellspacing="0" class="" style="width:600px;" width="600" bgcolor="${mainBackgroundColor}" ><tr><td style="line-height:0px;font-size:0px;mso-line-height-rule:exactly;"><![endif]-->
    <div style="background:${mainBackgroundColor};background-color:${mainBackgroundColor};margin:0px auto;max-width:600px;">
      <table align="center" border="0" cellpadding="0" cellspacing="0" role="presentation" style="background:${mainBackgroundColor};background-color:${mainBackgroundColor};width:100%;">
        <tbody>
          <tr>
            <td style="direction:ltr;font-size:0px;padding:20px 0;text-align:center;">
              <!--[if mso | IE]><table role="presentation" border="0" cellpadding="0" cellspacing="0"><tr><td class="" style="vertical-align:top;width:600px;" ><![endif]-->
              <div class="mj-column-per-100 mj-outlook-group-fix" style="font-size:0px;text-align:left;direction:ltr;display:inline-block;vertical-align:top;width:100%;">
                <table border="0" cellpadding="0" cellspacing="0" role="presentation" style="vertical-align:top;" width="100%">
                  <tbody>
                    <tr>
                      <td align="left" style="font-size:0px;padding:10px 25px;word-break:break-word;">
                        <div style="font-family:Helvetica, Arial, sans-serif;font-size:16px;line-height:22px;text-align:left;color:#000000;">If you know how Stacker News works, click the login button below.</div>
                      </td>
                    </tr>
                    <tr>
                      <td align="left" style="font-size:0px;padding:10px 25px;word-break:break-word;">
                        <div style="font-family:Helvetica, Arial, sans-serif;font-size:16px;line-height:22px;text-align:left;color:#000000;">If you want to learn how Stacker News works, keep reading.</div>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <!--[if mso | IE]></td></tr></table><![endif]-->
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    <!--[if mso | IE]></td></tr></table><table align="center" border="0" cellpadding="0" cellspacing="0" class="" style="width:600px;" width="600" bgcolor="${backgroundColor}" ><tr><td style="line-height:0px;font-size:0px;mso-line-height-rule:exactly;"><![endif]-->
    <div style="background:${backgroundColor};background-color:${backgroundColor};margin:0px auto;max-width:600px;">
      <table align="center" border="0" cellpadding="0" cellspacing="0" role="presentation" style="background:${backgroundColor};background-color:${backgroundColor};width:100%;">
        <tbody>
          <tr>
            <td style="direction:ltr;font-size:0px;padding:20px 0;text-align:center;">
              <!--[if mso | IE]><table role="presentation" border="0" cellpadding="0" cellspacing="0"><tr><td class="" style="vertical-align:top;width:600px;" ><![endif]-->
              <div class="mj-column-per-100 mj-outlook-group-fix" style="font-size:0px;text-align:left;direction:ltr;display:inline-block;vertical-align:top;width:100%;">
                <table border="0" cellpadding="0" cellspacing="0" role="presentation" style="vertical-align:top;" width="100%">
                  <tbody>
                    <tr>
                      <td align="center" style="font-size:0px;padding:10px 25px;word-break:break-word;">
                        <div style="font-family:Helvetica, Arial, sans-serif;font-size:18px;line-height:1;text-align:center;color:#000000;">login as <b>${escapedEmail}</b></div>
                      </td>
                    </tr>
                    <tr>
                      <td align="center" vertical-align="middle" style="font-size:0px;padding:10px 25px;padding-top:20px;padding-bottom:30px;word-break:break-word;">
                        <table border="0" cellpadding="0" cellspacing="0" role="presentation" style="border-collapse:separate;line-height:100%;">
                          <tr>
                            <td align="center" bgcolor="${buttonBackgroundColor}" role="presentation" style="border:none;border-radius:5px;cursor:auto;mso-padding-alt:15px 40px;background:${buttonBackgroundColor};" valign="middle">
                              <a href="${url}" style="display:inline-block;background:${buttonBackgroundColor};color:${textColor};font-family:Helvetica, Arial, sans-serif;font-size:22px;font-weight:normal;line-height:120%;margin:0;text-decoration:none;text-transform:none;padding:15px 40px;mso-padding-alt:0px;border-radius:5px;" target="_blank">
                                <mj-text align="center" font-family="Helvetica, Arial, sans-serif" font-size="20px"><b font-family="Helvetica, Arial, sans-serif">login</b></mj-text>
                              </a>
                            </td>
                          </tr>
                        </table>
                      </td>
                    </tr>
                    <tr>
                      <td align="center" style="font-size:0px;padding:10px 25px;word-break:break-word;">
                        <div style="font-family:Helvetica, Arial, sans-serif;font-size:14px;line-height:24px;text-align:center;color:#000000;">Or copy and paste this link: <a href="#" style="text-decoration:none; color:#787878">${url}</a></div>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <!--[if mso | IE]></td></tr></table><![endif]-->
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    <!--[if mso | IE]></td></tr></table><table align="center" border="0" cellpadding="0" cellspacing="0" class="" style="width:600px;" width="600" bgcolor="${mainBackgroundColor}" ><tr><td style="line-height:0px;font-size:0px;mso-line-height-rule:exactly;"><![endif]-->
    <div style="background:${mainBackgroundColor};background-color:${mainBackgroundColor};margin:0px auto;max-width:600px;">
      <table align="center" border="0" cellpadding="0" cellspacing="0" role="presentation" style="background:${mainBackgroundColor};background-color:${mainBackgroundColor};width:100%;">
        <tbody>
          <tr>
            <td style="direction:ltr;font-size:0px;padding:20px 0;text-align:center;">
              <!--[if mso | IE]><table role="presentation" border="0" cellpadding="0" cellspacing="0"><tr><td class="" style="vertical-align:top;width:600px;" ><![endif]-->
              <div class="mj-column-per-100 mj-outlook-group-fix" style="font-size:0px;text-align:left;direction:ltr;display:inline-block;vertical-align:top;width:100%;">
                <table border="0" cellpadding="0" cellspacing="0" role="presentation" style="vertical-align:top;" width="100%">
                  <tbody>
                    <tr>
                      <td align="left" style="font-size:0px;padding:10px 25px;word-break:break-word;">
                        <div style="font-family:Helvetica, Arial, sans-serif;font-size:14px;line-height:20px;text-align:left;color:#000000;">Stacker News is like Reddit or Hacker News, but it <b>pays you Bitcoin</b>. Instead of giving posts or comments “upvotes,” Stacker News users (aka stackers) send you small amounts of Bitcoin called sats.</div>
                      </td>
                    </tr>
                    <tr>
                      <td align="left" style="font-size:0px;padding:10px 25px;word-break:break-word;">
                        <div style="font-family:Helvetica, Arial, sans-serif;font-size:14px;line-height:20px;text-align:left;color:#000000;">In fact, <a href="${topUrl}"><b>some stackers</b></a> have already stacked <b>millions of sats</b> just for posting and starting thoughtful conversations.</div>
                      </td>
                    </tr>
                    <tr>
                      <td align="left" style="font-size:0px;padding:10px 25px;word-break:break-word;">
                        <div style="font-family:Helvetica, Arial, sans-serif;font-size:14px;line-height:20px;text-align:left;color:#000000;">To start earning sats, <a href="${postUrl}"><b><i>click here to make your first post</i></b></a>. You can share links, discussion questions, polls, or even bounties with other stackers. <a href="${guideUrl}">This guide</a> offers some useful tips and best practices for sharing content on Stacker News.</div>
                      </td>
                    </tr>
                    <tr>
                      <td align="left" style="font-size:0px;padding:10px 25px;word-break:break-word;">
                        <div style="font-family:Helvetica, Arial, sans-serif;font-size:14px;line-height:20px;text-align:left;color:#000000;">If you’re not sure what to share, <a href="${dailyUrl}"><b><i>click here to introduce yourself to the community</i></b></a> with a comment on the daily discussion thread.</div>
                      </td>
                    </tr>
                    <tr>
                      <td align="left" style="font-size:0px;padding:10px 25px;word-break:break-word;">
                        <div style="font-family:Helvetica, Arial, sans-serif;font-size:14px;line-height:20px;text-align:left;color:#000000;">If you still have questions, <a href="${faqUrl}"><b><i>click here to learn more about Stacker News</i></b></a> by reading our FAQ.</div>
                      </td>
                    </tr>
                    <tr>
                      <td align="left" style="font-size:0px;padding:10px 25px;word-break:break-word;">
                        <div style="font-family:Helvetica, Arial, sans-serif;font-size:14px;line-height:20px;text-align:left;color:#000000;">If anything isn’t clear, comment on the FAQ post and we’ll answer your question.</div>
                      </td>
                    </tr>
                    <tr>
                      <td align="left" style="font-size:0px;padding:10px 25px;word-break:break-word;">
                        <div style="font-family:Helvetica, Arial, sans-serif;font-size:14px;line-height:20px;text-align:left;color:#000000;">Zap,<br /> Stacker News</div>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <!--[if mso | IE]></td></tr></table><![endif]-->
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    <!--[if mso | IE]></td></tr></table><table align="center" border="0" cellpadding="0" cellspacing="0" class="" style="width:600px;" width="600" bgcolor="${mainBackgroundColor}" ><tr><td style="line-height:0px;font-size:0px;mso-line-height-rule:exactly;"><![endif]-->
    <div style="background:${mainBackgroundColor};background-color:${mainBackgroundColor};margin:0px auto;max-width:600px;">
      <table align="center" border="0" cellpadding="0" cellspacing="0" role="presentation" style="background:${mainBackgroundColor};background-color:${mainBackgroundColor};width:100%;">
        <tbody>
          <tr>
            <td style="direction:ltr;font-size:0px;padding:0px 0px 20px 0px;text-align:center;">
              <!--[if mso | IE]><table role="presentation" border="0" cellpadding="0" cellspacing="0"><tr><td class="" style="vertical-align:top;width:600px;" ><![endif]-->
              <div class="mj-column-per-100 mj-outlook-group-fix" style="font-size:0px;text-align:left;direction:ltr;display:inline-block;vertical-align:top;width:100%;">
                <table border="0" cellpadding="0" cellspacing="0" role="presentation" style="vertical-align:top;" width="100%">
                  <tbody>
                    <tr>
                      <td align="center" style="font-size:0px;padding:0px 25px 0px 25px;word-break:break-word;">
                        <div style="font-family:Arial, sans-serif;font-size:14px;line-height:28px;text-align:center;color:#55575d;">P.S. Stacker News loves you!</div>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <!--[if mso | IE]></td></tr></table><![endif]-->
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    <!--[if mso | IE]></td></tr></table><table align="center" border="0" cellpadding="0" cellspacing="0" class="" style="width:600px;" width="600" ><tr><td style="line-height:0px;font-size:0px;mso-line-height-rule:exactly;"><![endif]-->
    <div style="margin:0px auto;max-width:600px;">
      <table align="center" border="0" cellpadding="0" cellspacing="0" role="presentation" style="width:100%;">
        <tbody>
          <tr>
            <td style="direction:ltr;font-size:0px;padding:20px 0px 20px 0px;text-align:center;">
              <!--[if mso | IE]><table role="presentation" border="0" cellpadding="0" cellspacing="0"><tr><td class="" style="vertical-align:top;width:600px;" ><![endif]-->
              <div class="mj-column-per-100 mj-outlook-group-fix" style="font-size:0px;text-align:left;direction:ltr;display:inline-block;vertical-align:top;width:100%;">
                <table border="0" cellpadding="0" cellspacing="0" role="presentation" style="vertical-align:top;" width="100%">
                  <tbody>
                    <tr>
                      <td align="center" style="font-size:0px;padding:0px 20px;word-break:break-word;">
                        <div style="font-family:Arial, sans-serif;font-size:11px;line-height:22px;text-align:center;color:#55575d;">If you did not request this email you can safely ignore it.</div>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <!--[if mso | IE]></td></tr></table><![endif]-->
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    <!--[if mso | IE]></td></tr></table><![endif]-->
  </div>
</body>

</html>
`
}
