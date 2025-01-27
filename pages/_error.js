import Image from 'react-bootstrap/Image'
import { StaticLayout } from '@/components/layout'
import styles from '@/styles/error.module.css'

const statusDescribe = {
  200: 'OK',
  201: 'Created',
  202: 'Accepted',
  203: 'Non-Authoritative Information',
  204: 'No Content',
  205: 'Reset Content',
  206: 'Partial Content',
  300: 'Multiple Choices',
  301: 'Moved Permanently',
  302: 'Found',
  303: 'See Other',
  304: 'Not Modified',
  305: 'Use Proxy',
  306: 'Unused',
  307: 'Temporary Redirect',
  400: 'Bad Request',
  401: 'Unauthorized',
  402: 'Payment Required',
  403: 'Forbidden',
  404: 'Not Found',
  405: 'Method Not Allowed',
  406: 'Not Acceptable',
  407: 'Proxy Authentication Required',
  408: 'Request Timeout',
  409: 'Conflict',
  410: 'Gone',
  411: 'Length Required',
  412: 'Precondition Required',
  413: 'Request Entry Too Large',
  414: 'Request-URI Too Long',
  415: 'Unsupported Media Type',
  416: 'Requested Range Not Satisfiable',
  417: 'Expectation Failed',
  418: 'I\'m a teapot',
  429: 'Too Many Requests',
  500: 'Internal Server Error',
  501: 'Not Implemented',
  502: 'Bad Gateway',
  503: 'Service Unavailable',
  504: 'Gateway Timeout',
  505: 'HTTP Version Not Supported'
}

function ErrorImage ({ statusCode }) {
  if (statusCode === 404) {
    return <Image className='rounded-1 shadow-sm' width='500' height='376' src={`${process.env.NEXT_PUBLIC_ASSET_PREFIX}/maze.gif`} fluid />
  }
  if (statusCode >= 500) {
    return <Image className='rounded-1 shadow-sm' width='300' height='225' src={`${process.env.NEXT_PUBLIC_ASSET_PREFIX}/falling.gif`} fluid />
  }
  if (statusCode >= 400) {
    return <Image className='rounded-1 shadow-sm' width='500' height='381' src={`${process.env.NEXT_PUBLIC_ASSET_PREFIX}/forbidden.gif`} fluid />
  }
  if (statusCode >= 300) {
    return <Image className='rounded-1 shadow-sm' width='500' height='375' src={`${process.env.NEXT_PUBLIC_ASSET_PREFIX}/double.gif`} fluid />
  }
  return <Image className='rounded-1 shadow-sm' width='500' height='376' src={`${process.env.NEXT_PUBLIC_ASSET_PREFIX}/falling.gif`} fluid />
}

export default function ErrorPage ({ statusCode }) {
  return (
    <StaticLayout>
      <ErrorImage statusCode={statusCode} />
      <h1 className={styles.status}><span>{statusCode}</span><span className={styles.describe}>{statusDescribe[statusCode].toUpperCase()}</span></h1>
    </StaticLayout>
  )
}

ErrorPage.getInitialProps = ({ res, err }) => {
  const statusCode = res ? res.statusCode : err ? err.statusCode : 404
  return { statusCode }
}
