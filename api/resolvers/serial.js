const { UserInputError } = require('apollo-server-micro')
const retry = require('async-retry')

async function serialize (models, call) {
  return await retry(async bail => {
    try {
      const [, result] = await models.$transaction([
        models.$executeRaw(SERIALIZE),
        call
      ])
      return result
    } catch (error) {
      console.log(error)
      if (error.message.includes('SN_INSUFFICIENT_FUNDS')) {
        bail(new UserInputError('insufficient funds'))
      }
      if (error.message.includes('SN_NOT_SERIALIZABLE')) {
        bail(new Error('wallet balance transaction is not serializable'))
      }
      if (error.message.includes('SN_CONFIRMED_WITHDRAWL_EXISTS')) {
        bail(new Error('withdrawal invoice already confirmed (to withdraw again create a new invoice)'))
      }
      if (error.message.includes('SN_PENDING_WITHDRAWL_EXISTS')) {
        bail(new Error('withdrawal invoice exists and is pending'))
      }
      if (error.message.includes('SN_INELIGIBLE')) {
        bail(new Error('user ineligible for gift'))
      }
      if (error.message.includes('SN_UNSUPPORTED')) {
        bail(new Error('unsupported action'))
      }
      if (error.message.includes('SN_DUPLICATE')) {
        bail(new Error('duplicate not allowed'))
      }
      if (error.message.includes('SN_REVOKED_OR_EXHAUSTED')) {
        bail(new Error('faucet has been revoked or is exhausted'))
      }
      if (error.message.includes('23514')) {
        bail(new Error('constraint failure'))
      }
      if (error.message.includes('SN_INV_PENDING_LIMIT')) {
        bail(new Error('too many pending invoices'))
      }
      if (error.message.includes('SN_INV_EXCEED_BALANCE')) {
        bail(new Error('pending invoices must not cause balance to exceed 1m sats'))
      }
      if (error.message.includes('40001')) {
        throw new Error('wallet balance serialization failure - retry again')
      }
      bail(error)
    }
  }, {
    minTimeout: 100,
    factor: 1.1,
    retries: 5
  })
}

const SERIALIZE = 'SET TRANSACTION ISOLATION LEVEL SERIALIZABLE'

module.exports = serialize
