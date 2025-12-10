import { useMemo } from 'react'
import { useRouter } from 'next/router'
import dynamic from 'next/dynamic'
import { LexicalItemContextProvider } from './contexts/item'
import { applySNCustomizations } from '@/lib/lexical/html/customs'
import Editor from './editor'

export function SNEditor ({ ...props }) {
  return <Editor {...props} />
}

export function SNReader ({ html, outlawed, imgproxyUrls, topLevel, rel, ...props }) {
  const router = useRouter()
  const snCustomizedHTML = useMemo(() => (
    <div
      // suppressHydrationWarning is used as a band-aid but maybe applySNCustomizations is not the proper solution.
      dangerouslySetInnerHTML={{ __html: applySNCustomizations(html, { outlawed, imgproxyUrls, topLevel }) }}
      suppressHydrationWarning
    />
  ), [html, outlawed, imgproxyUrls, topLevel, props.className])

  // debug html with ?html
  if (router.query.html) return snCustomizedHTML

  const Reader = useMemo(() => dynamic(() => import('./reader'), { ssr: false, loading: () => snCustomizedHTML }), [snCustomizedHTML])

  return (
    <LexicalItemContextProvider imgproxyUrls={imgproxyUrls} topLevel={topLevel} outlawed={outlawed} rel={rel}>
      <Reader topLevel={topLevel} {...props} />
    </LexicalItemContextProvider>
  )
}
