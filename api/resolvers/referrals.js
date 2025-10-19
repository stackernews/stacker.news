export default {
  Query: {
    // TODO: need a new aggreation for referrals probably
    // or just remove the notion of one day referrals
    referrals: async (parent, { when, from, to }, { models, me }) => {
      return null
    }
  }
}
