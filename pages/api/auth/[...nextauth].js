import NextAuth from 'next-auth'
import Providers from 'next-auth/providers'
import Adapters from 'next-auth/adapters'
import prisma from '../../../api/models'

export default (req, res) => NextAuth(req, res, options)

const options = {
  providers: [
    Providers.GitHub({
      clientId: process.env.GITHUB_ID,
      clientSecret: process.env.GITHUB_SECRET,
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
      server: process.env.EMAIL_SERVER,
      from: process.env.EMAIL_FROM,
      profile: profile => {
        return profile
      }
    })
  ],
  adapter: Adapters.Prisma.Adapter({ prisma }),
  secret: process.env.SECRET,
  pages: {
    signIn: '/login'
  }
}
