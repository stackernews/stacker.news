import { forwardRef, useMemo } from 'react'
import dynamic from 'next/dynamic'
import { applySNCustomizations } from '@/lib/lexical/html/customs'
import { useRouter } from 'next/router'
import { LexicalPreferencesContextProvider } from './contexts/preferences'
import { LexicalItemContextProvider } from './contexts/item'
import Editor from './editor'

export const LexicalEditor = ({ ...props }) => {
  return (
    <LexicalPreferencesContextProvider>
      <Editor {...props} />
    </LexicalPreferencesContextProvider>
  )
}

export const LexicalReader = forwardRef(function LexicalReader ({ html, children, outlawed, imgproxyUrls, topLevel, rel, ...props }, ref) {
  const router = useRouter()
  const snCustomizedHTML = useMemo(() => applySNCustomizations(html, { outlawed, imgproxyUrls, topLevel }), [html, outlawed, imgproxyUrls, topLevel])
  // debug html with ?html
  if (router.query.html) return <div className={props.className} dangerouslySetInnerHTML={{ __html: snCustomizedHTML }} />

  const Reader = useMemo(() => dynamic(() => import('./reader'), {
    ssr: false,
    loading: () => {
      if (snCustomizedHTML) {
        return (
          <div className={props.className} ref={ref}>
            <div dangerouslySetInnerHTML={{ __html: snCustomizedHTML }} />
            {children}
          </div>
        )
      }
      return null
    }
  }), [])

  return (

    <LexicalItemContextProvider imgproxyUrls={imgproxyUrls} topLevel={topLevel} outlawed={outlawed} rel={rel}>
      <Reader {...props} contentRef={ref}>
        {children}
      </Reader>
    </LexicalItemContextProvider>
  )
})
