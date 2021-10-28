import { createInvoice, decodePaymentRequest, subscribeToPayViaRequest } from 'ln-service'
import { UserInputError, AuthenticationError } from 'apollo-server-micro'
import serialize from './serial'

export default {
  Query: {
    invoice: async (parent, { id }, { me, models, lnd }) => {
      if (!me) {
        throw new AuthenticationError('you must be logged in')
      }

      const inv = await models.invoice.findUnique({
        where: {
          id: Number(id)
        },
        include: {
          user: true
        }
      })

      if (inv.user.id !== me.id) {
        throw new AuthenticationError('not ur invoice')
      }

      return inv
    },
    withdrawl: async (parent, { id }, { me, models, lnd }) => {
      if (!me) {
        throw new AuthenticationError('you must be logged in')
      }

      const wdrwl = await models.withdrawl.findUnique({
        where: {
          id: Number(id)
        },
        include: {
          user: true
        }
      })

      if (wdrwl.user.id !== me.id) {
        throw new AuthenticationError('not ur withdrawal')
      }

      return wdrwl
    },
    connectAddress: async (parent, args, { lnd }) => {
      return process.env.LND_CONNECT_ADDRESS
    }
  },

  Mutation: {
    createInvoice: async (parent, { amount }, { me, models, lnd }) => {
      if (!me) {
        throw new AuthenticationError('you must be logged in')
      }

      if (!amount || amount <= 0) {
        throw new UserInputError('amount must be positive', { argumentName: 'amount' })
      }

      // set expires at to 3 hours into future
      const expiresAt = new Date(new Date().setHours(new Date().getHours() + 3))
      const description = `${amount} sats for @${me.name} on stacker.news`
      try {
        const invoice = await createInvoice({
          description,
          lnd,
          tokens: amount,
          expires_at: expiresAt
        })

        const data = {
          hash: invoice.id,
          bolt11: invoice.request,
          expiresAt: expiresAt,
          msatsRequested: amount * 1000,
          user: {
            connect: {
              id: me.id
            }
          }
        }

        return await models.invoice.create({ data })
      } catch (error) {
        console.log(error)
        throw error
      }
    },
    createWithdrawl: async (parent, { invoice, maxFee }, { me, models, lnd }) => {
      // decode invoice to get amount
      let decoded
      try {
        decoded = await decodePaymentRequest({ lnd, request: invoice })
      } catch (error) {
        throw new UserInputError('could not decode invoice')
      }

      // TODO: test
      if (!decoded.mtokens || Number(decoded.mtokens) <= 0) {
        throw new UserInputError('you must specify amount')
      }

      const msatsFee = Number(maxFee) * 1000

      // create withdrawl transactionally (id, bolt11, amount, fee)
      const [withdrawl] = await serialize(models,
        models.$queryRaw`SELECT * FROM create_withdrawl(${decoded.id}, ${invoice},
          ${Number(decoded.mtokens)}, ${msatsFee}, ${me.name})`)

      // create the payment, subscribing to its status
      const sub = subscribeToPayViaRequest({
        lnd,
        request: invoice,
        // can't use max_fee_mtokens https://github.com/alexbosworth/ln-service/issues/141
        max_fee: Number(maxFee),
        pathfinding_timeout: 30000
      })

      // if it's confirmed, update confirmed returning extra fees to user
      sub.once('confirmed', async e => {
        console.log(e)

        sub.removeAllListeners()

        // mtokens also contains the fee
        const fee = Number(e.fee_mtokens)
        const paid = Number(e.mtokens) - fee
        await serialize(models, models.$queryRaw`
            SELECT confirm_withdrawl(${withdrawl.id}, ${paid}, ${fee})`)
      })

      // if the payment fails, we need to
      // 1. return the funds to the user
      // 2. update the widthdrawl as failed
      sub.once('failed', async e => {
        console.log(e)

        sub.removeAllListeners()

        let status = 'UNKNOWN_FAILURE'
        if (e.is_insufficient_balance) {
          status = 'INSUFFICIENT_BALANCE'
        } else if (e.is_invalid_payment) {
          status = 'INVALID_PAYMENT'
        } else if (e.is_pathfinding_timeout) {
          status = 'PATHFINDING_TIMEOUT'
        } else if (e.is_route_not_found) {
          status = 'ROUTE_NOT_FOUND'
        }
        await serialize(models, models.$queryRaw`
            SELECT reverse_withdrawl(${withdrawl.id}, ${status})`)
      })

      return withdrawl
    }
  },

  Withdrawl: {
    satsPaying: w => Math.floor(w.msatsPaying / 1000),
    satsPaid: w => Math.floor(w.msatsPaid / 1000),
    satsFeePaying: w => Math.floor(w.msatsFeePaying / 1000),
    satsFeePaid: w => Math.floor(w.msatsFeePaid / 1000)
  }
}
