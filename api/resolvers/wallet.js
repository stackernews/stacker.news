import { createInvoice, decodePaymentRequest, payViaPaymentRequest } from 'ln-service'
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
    },
    createWithdrawl: async (parent, { invoice, maxFee }, { me, models, lnd }) => {
      if (!me) {
        throw new AuthenticationError('You must be logged in')
      }

      // decode invoice to get amount
      const decoded = await decodePaymentRequest({ lnd, request: invoice })

      // create withdrawl transactionally (id, bolt11, amount, fee)
      const withdrawl =
        await models.$queryRaw`SELECT confirm_withdrawl(${decoded.id}, ${invoice},
          ${decoded.mtokens}, ${Number(maxFee)}, ${me.name})`

      // create the payment, subscribing to its status
      const sub = subscribeToPayViaRequest({ lnd, request: invoice, max_fee_mtokens: maxFee, pathfinding_timeout: 30000 })

      // if it's confirmed, update confirmed
      sub.on('confirmed', recordStatus)

      // if the payment fails, we need to
      // 1. transactionally return the funds to the user
      // 2. transactionally update the widthdrawl as failed
      sub.on('failed', recordStatus)

      // in walletd
      // for each payment that hasn't failed or succeede
      return 0
    }
  }
}
