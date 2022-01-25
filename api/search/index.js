import es from '@elastic/elasticsearch'

global.es ||= new es.Client()

export default global.es
