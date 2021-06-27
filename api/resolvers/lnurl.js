import { randomBytes } from 'crypto'
import { bech32 } from 'bech32'

export default {
  Query: {
    lnAuth: async (parent, { k1 }, { models }) => {
      return await models.lnAuth.findUnique({ where: { k1 } })
    }
  },
  Mutation: {
    createAuth: async (parent, args, { models }) => {
      const k1 = randomBytes(32).toString('hex')
      return await models.lnAuth.create({ data: { k1 } })
    }
  },
  LnAuth: {
    encodedUrl: async (lnAuth, args, { models }) => {
      const url = new URL(process.env.LNAUTH_URL)
      url.searchParams.set('tag', 'login')
      url.searchParams.set('k1', lnAuth.k1)
      // bech32 encode url
      const words = bech32.toWords(Buffer.from(url.toString(), 'utf8'))
      return bech32.encode('lnurl', words, 1023)
    }
  }
}
