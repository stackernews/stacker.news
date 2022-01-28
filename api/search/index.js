const os = require('@opensearch-project/opensearch')

const options = process.env.NODE_ENV === 'development'
  ? { node: 'http://localhost:9200' }
  : {
      node: process.env.OPENSEARCH_URL,
      auth: {
        username: process.env.OPENSEARCH_USERNAME,
        password: process.env.OPENSEARCH_PASSWORD
      }
    }

global.os = global.os || new os.Client(options)

module.exports = global.os
