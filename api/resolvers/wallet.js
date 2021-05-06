export default {
  Query: {
    invoice: async (parent, { id }, { me, models, lnd }) => {
      return 'lnbc1500n1psfxyaypp5tmlgpudspqed4qf32xxmc7dhlqrd4glc09x794exz4t2pw8ms38sdpa2fjkzep6yptks7fqt9hh2gzwv4jkggz5dus9gatjdcsyzmrvypvk7atjypzx7cqzpgxqr23ssp529tup4vaxlxnst0lwh9kljpl9n6zg6n6vma5hw78lmnws32x278s9qyyssqxe73jclrlz3u7v7ruwee3n7h70ktsdsfmvpfjkccqxq5wg5h6njhqxar0a9fef5hd09ethwhvsj0dha2qy4tjjdxu08nkqymfs8wghqp6d7kth'
    }
  },

  Mutation: {
    createInvoice: async (parent, { amount }, { me, models, lnd }) => {
      return 'lnbc1500n1psfxyaypp5tmlgpudspqed4qf32xxmc7dhlqrd4glc09x794exz4t2pw8ms38sdpa2fjkzep6yptks7fqt9hh2gzwv4jkggz5dus9gatjdcsyzmrvypvk7atjypzx7cqzpgxqr23ssp529tup4vaxlxnst0lwh9kljpl9n6zg6n6vma5hw78lmnws32x278s9qyyssqxe73jclrlz3u7v7ruwee3n7h70ktsdsfmvpfjkccqxq5wg5h6njhqxar0a9fef5hd09ethwhvsj0dha2qy4tjjdxu08nkqymfs8wghqp6d7kth'
    }
  }
}
