import { createContext, useContext } from 'react'
import dynamic from 'next/dynamic'
import { useRouter } from 'next/router'
import { ToolbarContextProvider } from './contexts/toolbar'
import { EditorModeProvider } from './contexts/mode'

const Editor = dynamic(() => import('./editor'), {
  ssr: false,
  loading: () => <div className='form-control clouds' style={{ minHeight: '6rem' }} />
})

export function SNEditor ({ ...props }) {
  return (
    <EditorModeProvider>
      <ToolbarContextProvider topLevel={props.topLevel}>
        <Editor {...props} />
      </ToolbarContextProvider>
    </EditorModeProvider>
  )
}

const HTMLContext = createContext('')

function HTMLFallback () {
  const html = useContext(HTMLContext)
  return <div data-sn-reader dangerouslySetInnerHTML={{ __html: html }} />
}

const Reader = dynamic(() => import('./reader'), {
  ssr: false,
  loading: HTMLFallback
})

export function SNReader ({ html, ...props }) {
  const router = useRouter()
  const debug = router.isReady && router.query.html

  if (debug) return <div data-sn-reader dangerouslySetInnerHTML={{ __html: html }} />

  return (
    <HTMLContext.Provider value={html}>
      <Reader {...props} />
    </HTMLContext.Provider>
  )
}
