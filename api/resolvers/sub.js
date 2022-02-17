export default {
  Query: {
    sub: async (parent, { name }, { models }) => {
      return await models.sub.findUnique({
        where: {
          name
        }
      })
    }
  }
}
