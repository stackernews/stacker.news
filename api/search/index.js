import es from '@opensearch-project/opensearch'

global.es ||= new es.Client({ node: 'http://localhost:9200' })

export default global.es
