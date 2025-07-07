import { SN_ADMIN_IDS } from '@/lib/constants'

export default {
  Query: {
    snl: async (parent, _, { models }) => {
      const snl = await models.snl.findFirst()
      return !!snl?.live
    }
  },
  Mutation: {
    onAirToggle: async (parent, _, { models, me }) => {
      if (!me || !SN_ADMIN_IDS.includes(me.id)) {
        throw new Error('not an admin')
      }
      const { id, live } = await models.snl.findFirst()
      await models.snl.update({ where: { id }, data: { live: !live } })
      return !live
    },
    approveOAuthApplication: async (parent, { id }, { models, me }) => {
      if (!me || !SN_ADMIN_IDS.includes(me.id)) {
        throw new Error('not an admin')
      }
      const app = await models.oAuthApplication.update({
        where: { id: Number(id) },
        data: { approved: true }
      })
      return app
    }
  }
}
