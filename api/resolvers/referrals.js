export default {
  Query: {
    // TODO: i plan to remove the notion of one day referrals
    // from rewards ... if a stacker does not have a signup referrer,
    // the one day refer will be who gets 10% of rewards
    referrals: async (parent, { when, from, to }, { models, me }) => {
      return []
    }
  }
}
