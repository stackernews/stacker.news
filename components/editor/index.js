import { useRouter } from 'next/router'
import Editor from './editor'
import { ToolbarContextProvider } from './contexts/toolbar'
import { EditorModeProvider } from './contexts/mode'
import Reader from './reader'

export function SNEditor ({ ...props }) {
  return (
    <EditorModeProvider>
      <ToolbarContextProvider topLevel={props.topLevel}>
        <Editor {...props} />
      </ToolbarContextProvider>
    </EditorModeProvider>
  )
}

export function SNReader ({ html, ...props }) {
  const router = useRouter()
  const debug = router.isReady && router.query.html

  if (debug) return <div data-sn-reader dangerouslySetInnerHTML={{ __html: html }} />

  return <Reader {...props} />
}
