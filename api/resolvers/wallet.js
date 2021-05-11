import { createInvoice } from 'ln-service'
import { UserInputError, AuthenticationError } from 'apollo-server-micro'

export default {
  Query: {
    invoice: async (parent, { id }, { me, models, lnd }) => {
      return await models.invoice.findUnique({ where: { id: Number(id) } })
    }
  },

  Mutation: {
    createInvoice: async (parent, { amount }, { me, models, lnd }) => {
      if (!me) {
        throw new AuthenticationError('You must be logged in')
      }

      if (!amount || amount <= 0) {
        throw new UserInputError('Amount must be positive', { argumentName: 'amount' })
      }

      /*
        chain_address: undefined,
        created_at: '2021-05-06T22:16:28.000Z',
        description: 'hi there',
        id: '30946d6ff432933e30f6c180cce982c92b509a80bf6c2e896e6579cbda4c1677',
        mtokens: '1000',
        payment: 'e3deb7a0471bf050aa5dd0ef9b546887ab1fdf0306a7cb67d9dda8473f9542f2',
        request: 'lnbcrt10n1psfg64upp5xz2x6ml5x2fnuv8kcxqve6vzey44px5qhakzaztwv4uuhkjvzemsdqddp5jqargv4ex2cqzpgxqr23ssp5u00t0gz8r0c9p2ja6rhek4rgs743lhcrq6nuke7emk5yw0u4gteq9q8zqqyssq92epsvsap3pyfcj4kex5vysew4tqg6c8vxux5nfmc7yqx36l6dk49pafs62dlr92lm5ekzftl7nq6r4wvjhwydtekg6lpj0xgjm5auqpwflxyk',
        secret: '82abf620f82dc9a61cf3921f77432e31d4a11e1dc066ccc177d31937c473eb30',
        tokens: 1
      */
      // set expires at to 3 hours into future
      const expiresAt = new Date(new Date().setHours(new Date().getHours() + 3))
      const description = `${amount} sats for @${me.name} on stacker.news`
      const invoice = await createInvoice({ description, lnd, tokens: amount, expires_at: expiresAt })

      const data = {
        hash: invoice.id,
        bolt11: invoice.request,
        expiresAt: expiresAt,
        msatsRequested: amount * 1000,
        user: {
          connect: {
            name: me.name
          }
        }
      }

      return await models.invoice.create({ data })
    }
  }
}
