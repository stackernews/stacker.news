import { randomBytes } from 'crypto'
import assertApiKeyNotPermitted from './apiKey'
import { encodeLnurl } from '@/lib/lnurl'

function encodedUrl (iurl, tag, k1) {
  const url = new URL(iurl)
  url.searchParams.set('tag', tag)
  url.searchParams.set('k1', k1)
  return encodeLnurl(url)
}

function k1 () {
  return randomBytes(32).toString('hex')
}

export default {
  Query: {
    lnAuth: async (parent, { k1 }, { models }) => {
      return await models.lnAuth.findUnique({ where: { k1 } })
    }
  },
  Mutation: {
    createAuth: async (parent, args, { models, me }) => {
      assertApiKeyNotPermitted({ me })
      return await models.lnAuth.create({ data: { k1: k1() } })
    }
  },
  LnAuth: {
    encodedUrl: async (lnAuth, args, { models }) => {
      return encodedUrl(process.env.LNAUTH_URL, 'login', lnAuth.k1)
    }
  }
}
