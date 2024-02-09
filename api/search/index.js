import os from '@opensearch-project/opensearch'

const options = {
  node: process.env.OPENSEARCH_URL,
  auth: {
    username: process.env.OPENSEARCH_USERNAME,
    password: process.env.OPENSEARCH_PASSWORD
  }
}

global.os = global.os || new os.Client(options)

export default global.os
