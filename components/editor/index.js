import { useRouter } from 'next/router'
import dynamic from 'next/dynamic'
import Editor from './editor'

export function SNEditor ({ ...props }) {
  return <Editor {...props} />
}

export function SNReader ({ html, ...props }) {
  const router = useRouter()

  // debug html with ?html
  if (router.query.html) return <div dangerouslySetInnerHTML={{ __html: html }} />

  const Reader = dynamic(() => import('./reader'), {
    ssr: false,
    loading: () => <div dangerouslySetInnerHTML={{ __html: html }} />
  })

  return <Reader {...props} />
}
