import { forwardRef, useMemo } from 'react'
import dynamic from 'next/dynamic'
import { applySNCustomizations } from '@/lib/lexical/html/customs'
import { useRouter } from 'next/router'
import { LexicalItemContextProvider } from './contexts/item'
import Editor from './editor'

export const LexicalEditor = ({ ...props }) => {
  return <Editor {...props} />
}

export const LexicalReader = forwardRef(function LexicalReader ({ html, children, outlawed, imgproxyUrls, topLevel, rel, ...props }, ref) {
  const router = useRouter()
  const snCustomizedHTML = useMemo(() => (
    <div
      className={props.className}
      // suppressHydrationWarning is used as a band-aid but maybe applySNCustomizations is not the proper solution.
      dangerouslySetInnerHTML={{ __html: applySNCustomizations(html, { outlawed, imgproxyUrls, topLevel }) }}
      suppressHydrationWarning
    />
  ), [html, outlawed, imgproxyUrls, topLevel, props.className])

  // debug html with ?html
  if (router.query.html) return snCustomizedHTML

  const Reader = useMemo(() => dynamic(() => import('./reader'), { ssr: false, loading: () => snCustomizedHTML }), [])

  return (

    <LexicalItemContextProvider imgproxyUrls={imgproxyUrls} topLevel={topLevel} outlawed={outlawed} rel={rel}>
      <Reader {...props} contentRef={ref} topLevel={topLevel}>
        {children}
      </Reader>
    </LexicalItemContextProvider>
  )
})
