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

export function SNReader (props) {
  return <Reader {...props} />
}
