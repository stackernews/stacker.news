export default {
  Query: {
    snl: async (parent, _, { models }) => {
      const snl = await models.snl.findFirst()
      return !!snl?.live
    }
  },
  Mutation: {
    onAirToggle: async (parent, _, { models, me }) => {
      if (me.id !== 616) {
        throw new Error('not an admin')
      }
      const { id, live } = await models.snl.findFirst()
      await models.snl.update({ where: { id }, data: { live: !live } })
      return !live
    }
  }
}
