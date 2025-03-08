// Concept of interoperability with cache
export default {
  Query: {
    customDomains: async (_, __, { models }) => {
      return models.customDomain.findMany()
    }
  },

  Mutation: {
    upsertCustomDomain: async (_, { domain, subName, sslEnabled }, { models, boss }) => {
      const result = await models.customDomain.upsert({
        where: { domain },
        update: {
          subName,
          sslEnabled: sslEnabled ?? false
        },
        create: {
          domain,
          subName,
          sslEnabled: sslEnabled ?? false
        }
      })

      // maybe a job?
      // BUT pgboss will be used
      await boss.send('invalidateDomainCache', {}, { priority: 'high' })

      return result
    },

    deleteCustomDomain: async (_, { domain }, { models, boss }) => {
      await models.customDomain.delete({
        where: { domain }
      })

      // maybe a job? x2
      // BUT pgboss will be used
      await boss.send('invalidateDomainCache', {}, { priority: 'high' })

      return true
    }
  }
}
