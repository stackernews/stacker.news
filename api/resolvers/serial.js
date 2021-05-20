const { UserInputError } = require('apollo-server-micro')

async function serialize (models, call) {
  try {
    const [, result] = await models.$transaction([
      models.$executeRaw(SERIALIZE),
      call
    ])
    return result
  } catch (error) {
    console.log(error)
    if (error.message.includes('SN_INSUFFICIENT_FUNDS')) {
      throw new UserInputError('insufficient funds')
    }
    if (error.message.includes('SN_NOT_SERIALIZABLE')) {
      throw new Error('wallet transaction isolation level is not serializable')
    }
    throw error
  }
}

const SERIALIZE = 'SET TRANSACTION ISOLATION LEVEL SERIALIZABLE'

module.exports = serialize
