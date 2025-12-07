import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import { lexicalToMarkdown } from '@/lib/lexical/utils/mdast'
import { useToast } from '@/components/toast'

export function ExtractMarkdownFromEditor () {
  const [editor] = useLexicalComposerContext()
  const toaster = useToast()

  return (
    <div className='text-muted'>
      <span
        className='text-reset pointer fw-bold font-monospace'
        onClick={() => {
          try {
            toaster.success('markdown copied to clipboard')
            navigator.clipboard.writeText(lexicalToMarkdown(editor))
          } catch (error) {
            toaster.danger('failed to copy markdown to clipboard')
          }
        }}
      >
        dbug: extract markdown
      </span>
    </div>
  )
}
