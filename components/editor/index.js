import { useMemo } from 'react'
import { useRouter } from 'next/router'
import dynamic from 'next/dynamic'
import Editor from './editor'

export function SNEditor ({ ...props }) {
  return <Editor {...props} />
}

export function SNReader ({ html, outlawed, imgproxyUrls, topLevel, rel, readerRef, ...props }) {
  const router = useRouter()

  // debug html with ?html
  if (router.query.html) return <div dangerouslySetInnerHTML={{ __html: html }} />

  const Reader = useMemo(() =>
    dynamic(() => import('./reader'), {
      ssr: false,
      loading: () => <div dangerouslySetInnerHTML={{ __html: html }} />
    }), [html])

  return <Reader topLevel={topLevel} readerRef={readerRef} {...props} />
}
