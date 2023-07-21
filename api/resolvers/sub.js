export default {
  Query: {
    sub: async (parent, { name }, { models, me }) => {
      if (!name) return null

      if (me && name === 'jobs') {
        models.user.update({
          where: {
            id: me.id
          },
          data: {
            lastCheckedJobs: new Date()
          }
        }).catch(console.log)
      }

      return await models.sub.findUnique({
        where: {
          name
        }
      })
    },
    subLatestPost: async (parent, { name }, { models, me }) => {
      const latest = await models.item.findFirst({
        where: {
          subName: name
        },
        orderBy: {
          createdAt: 'desc'
        }
      })

      return latest?.createdAt
    }
  }
}
