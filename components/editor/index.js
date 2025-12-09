import { forwardRef, useMemo } from 'react'
import { useRouter } from 'next/router'
import dynamic from 'next/dynamic'
import { LexicalItemContextProvider } from './contexts/item'
import { applySNCustomizations } from '@/lib/lexical/html/customs'

export const SNReader = forwardRef(function SNReader ({ html, children, outlawed, imgproxyUrls, topLevel, rel, ...props }, ref) {
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

  const Reader = useMemo(() => dynamic(() => import('./reader'), { ssr: false, loading: () => snCustomizedHTML }), [snCustomizedHTML])

  return (
    <LexicalItemContextProvider imgproxyUrls={imgproxyUrls} topLevel={topLevel} outlawed={outlawed} rel={rel}>
      <Reader {...props} contentRef={ref} topLevel={topLevel}>
        {children}
      </Reader>
    </LexicalItemContextProvider>
  )
})
