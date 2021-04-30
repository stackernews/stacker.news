export default {
  Query: {
    accounts: async (parent, args, { lnd }) => {
      console.log('hi')
      console.log(lnd.wallet.listAccounts)
      lnd.wallet.listAccounts({}, (err, res) => {
        console.log(err, res)
      })
      return []
    }
  },

  Mutation: {
    createAccount: async (parent, args, { lnd }) => {
      lnd.default.newAddress({ type: 'p2wpkh', account: 'default' }, (err, res) => {
        console.log(err, res)
      })
      return 'ok'
    }
  }
}
