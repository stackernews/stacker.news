import * as Auth2fa from '@/lib/auth2fa'

export default {
  Mutation: {
    verify2fa: async (parent, { method, callbackUrl, ...args }, { models, unverifiedSession }) => {
      const session = unverifiedSession
      if (!session) throw new Error('Not authenticated')

      const userId = session.user.id
      const user = await models.user.findUnique({ where: { id: userId } })
      if (!user) throw new Error('User not found')

      const valid = Auth2fa.validate2fa(method, args, { me: user })
      if (!valid) throw new Error('Invalid 2FA token')

      const token = await Auth2fa.getEncodedLogin2faToken({ result: valid, userId, jti2fa: session.jti2fa, callbackUrl })
      return {
        result: valid,
        tokens: [
          token
        ],
        callbackUrl
      }
    }
  }
}
