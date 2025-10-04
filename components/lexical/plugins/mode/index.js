import ModeStatusPlugin from './status'
import SwitchPlugin from './switch'
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import { getMarkdownMode } from '@/components/lexical/universal/utils/mode'

export default function ModePlugins () {
  const [editor] = useLexicalComposerContext()
  const markdownMode = getMarkdownMode(editor)
  return (
    <>
      <SwitchPlugin markdownMode={markdownMode} />
      <ModeStatusPlugin markdownMode={markdownMode} />
    </>
  )
}
