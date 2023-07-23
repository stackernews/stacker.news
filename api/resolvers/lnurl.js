import { randomBytes } from 'crypto'
import { bech32 } from 'bech32'
import { GraphQLError } from 'graphql'

function encodedUrl (iurl, tag, k1) {
  const url = new URL(iurl)
  url.searchParams.set('tag', tag)
  url.searchParams.set('k1', k1)
  // bech32 encode url
  const words = bech32.toWords(Buffer.from(url.toString(), 'utf8'))
  return bech32.encode('lnurl', words, 1023)
}

function k1 () {
  return randomBytes(32).toString('hex')
}

export default {
  Query: {
    lnAuth: async (parent, { k1 }, { models }) => {
      return await models.lnAuth.findUnique({ where: { k1 } })
    },
    lnWith: async (parent, { k1 }, { models }) => {
      return await models.lnWith.findUnique({ where: { k1 } })
    }
  },
  Mutation: {
    createAuth: async (parent, args, { models }) => {
      return await models.lnAuth.create({ data: { k1: k1() } })
    },
    createWith: async (parent, args, { me, models }) => {
      if (!me) {
        throw new GraphQLError('you must be logged in', { extensions: { code: 'UNAUTHENTICATED' } })
      }

      return await models.lnWith.create({ data: { k1: k1(), userId: me.id } })
    }
  },
  LnAuth: {
    encodedUrl: async (lnAuth, args, { models }) => {
      return encodedUrl(process.env.LNAUTH_URL, 'login', lnAuth.k1)
    },
    slashtagUrl: async (lnAuth, args, { models, slashtags }) => {
      return slashtags.formatURL(lnAuth.k1)
    }
  },
  LnWith: {
    encodedUrl: async (lnWith, args, { models }) => {
      return encodedUrl(process.env.LNWITH_URL, 'withdrawRequest', lnWith.k1)
    },
    user: async (lnWith, args, { models }) => {
      return await models.user.findUnique({ where: { id: lnWith.userId } })
    }
  }
}
