import { createContext, useContext } from 'react'
import dynamic from 'next/dynamic'
import { useRouter } from 'next/router'
import Editor from './editor'

export function SNEditor ({ ...props }) {
  return <Editor {...props} />
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
