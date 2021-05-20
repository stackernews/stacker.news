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
