import { createContext, useContext } from 'react'
import dynamic from 'next/dynamic'
import { useRouter } from 'next/router'
import Editor from './editor'
import { ToolbarContextProvider } from './contexts/toolbar'

export function SNEditor ({ ...props }) {
  return (
    <ToolbarContextProvider topLevel={props.topLevel}>
      <Editor {...props} />
    </ToolbarContextProvider>
  )
}

const HTMLContext = createContext('')

function HTMLFallback () {
  const html = useContext(HTMLContext)
  return <div dangerouslySetInnerHTML={{ __html: html }} />
}

const Reader = dynamic(() => import('./reader'), {
  ssr: false,
  loading: HTMLFallback
})

export function SNReader ({ html, ...props }) {
  const router = useRouter()
  const debug = router.isReady && router.query.html

  if (debug) return <div dangerouslySetInnerHTML={{ __html: html }} />

  return (
    <HTMLContext.Provider value={html}>
      <Reader {...props} />
    </HTMLContext.Provider>
  )
}
