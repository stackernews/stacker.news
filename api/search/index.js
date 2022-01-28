const os = require('@opensearch-project/opensearch')

global.os = global.os || new os.Client(
  process.env.NODE_ENV !== 'development'
    ? {
        node: process.env.OPENSEARCH_URL,
        auth: {
          username: process.env.OPENSEARCH_USERNAME,
          password: process.env.OPENSEARCH_PASSWORD
        }
      }
    : { node: 'http://localhost:9200' })

module.exports = global.os
