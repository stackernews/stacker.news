import NextAuth from 'next-auth'
import Providers from 'next-auth/providers'
import Adapters from 'next-auth/adapters'
import prisma from '../../../api/models'

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

      // XXX We need to update the user name incase they update it ... kind of hacky
      // better if we use user id everywhere an ignore the username ...
      if (token?.id) {
        const { name } = await prisma.user.findUnique({ where: { id: token.id } })
        token.name = name
      }
      return token
    },
    async session (session, token) {
      // we need to add additional session params here
      session.user.id = token.id
      session.user.name = token.name
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
