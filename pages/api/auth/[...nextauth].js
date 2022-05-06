import NextAuth from 'next-auth'
import Providers from 'next-auth/providers'
import Adapters from 'next-auth/adapters'
import prisma from '../../../api/models'
import nodemailer from 'nodemailer'

export default (req, res) => NextAuth(req, res, options)

const options = {
  callbacks: {
    /**
     * @param  {object}  token     Decrypted JSON Web Token
     * @param  {object}  user      User object      (only available on sign in)
     * @param  {object}  account   Provider account (only available on sign in)
     * @param  {object}  profile   Provider profile (only available on sign in)
     * @param  {boolean} isNewUser True if new user (only available on sign in)
     * @return {object}            JSON Web Token that will be saved
     */
    async jwt (token, user, account, profile, isNewUser) {
      // Add additional session params
      if (user?.id) {
        token.id = user.id
      }

      // sign them up for the newsletter
      if (isNewUser && profile.email) {
        fetch(process.env.LIST_MONK_URL + '/api/subscribers', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Basic ' + Buffer.from(process.env.LIST_MONK_AUTH).toString('base64')
          },
          body: JSON.stringify({
            email: profile.email,
            name: 'blank',
            lists: [2],
            status: 'enabled',
            preconfirm_subscriptions: true
          })
        }).then(async r => console.log(await r.json())).catch(console.log)
      }

      return token
    },
    async session (session, token) {
      // we need to add additional session params here
      session.user.id = token.id
      return session
    }
  },
  providers: [
    Providers.Credentials({
    // The name to display on the sign in form (e.g. 'Sign in with...')
      name: 'Lightning',
      // The credentials is used to generate a suitable form on the sign in page.
      // You can specify whatever fields you are expecting to be submitted.
      // e.g. domain, username, password, 2FA token, etc.
      credentials: {
        pubkey: { label: 'publickey', type: 'text' },
        k1: { label: 'k1', type: 'text' }
      },
      async authorize (credentials, req) {
        const { k1, pubkey } = credentials
        try {
          const lnauth = await prisma.lnAuth.findUnique({ where: { k1 } })
          if (lnauth.pubkey === pubkey) {
            let user = await prisma.user.findUnique({ where: { pubkey } })
            if (!user) {
              user = await prisma.user.create({ data: { name: pubkey.slice(0, 10), pubkey } })
            }
            await prisma.lnAuth.delete({ where: { k1 } })
            return user
          }
        } catch (error) {
          console.log(error)
        }

        return null
      }
    }),
    Providers.GitHub({
      clientId: process.env.GITHUB_ID,
      clientSecret: process.env.GITHUB_SECRET,
      authorization: 'https://github.com/login/oauth/authorize?scope=read:user',
      profile: profile => {
        return {
          ...profile,
          name: profile.login
        }
      }
    }),
    Providers.Twitter({
      clientId: process.env.TWITTER_ID,
      clientSecret: process.env.TWITTER_SECRET,
      profile: profile => {
        return {
          ...profile,
          name: profile.screen_name
        }
      }
    }),
    Providers.Email({
      server: process.env.LOGIN_EMAIL_SERVER,
      from: process.env.LOGIN_EMAIL_FROM,
      sendVerificationRequest,
      profile: profile => {
        return profile
      }
    })
  ],
  adapter: Adapters.Prisma.Adapter({ prisma }),
  secret: process.env.NEXTAUTH_SECRET,
  session: { jwt: true },
  jwt: {
    signingKey: process.env.JWT_SIGNING_PRIVATE_KEY
  },
  pages: {
    signIn: '/login'
  }
}

function sendVerificationRequest ({
  identifier: email,
  url,
  token,
  baseUrl,
  provider
}) {
  return new Promise((resolve, reject) => {
    const { server, from } = provider
    // Strip protocol from URL and use domain as site name
    const site = baseUrl.replace(/^https?:\/\//, '')

    nodemailer.createTransport(server).sendMail(
      {
        to: email,
        from,
        subject: `login to ${site}`,
        text: text({ url, site, email }),
        html: html({ url, site, email })
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
  const buttonBorderColor = '#FADA5E'
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
            <td align="center" style="border-radius: 5px;" bgcolor="${buttonBackgroundColor}"><a href="${url}" target="_blank" style="font-size: 18px; font-family: Helvetica, Arial, sans-serif; color: ${buttonTextColor}; text-decoration: none; text-decoration: none;border-radius: 5px; padding: 10px 20px; border: 1px solid ${buttonBorderColor}; display: inline-block; font-weight: bold;">login</a></td>
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
