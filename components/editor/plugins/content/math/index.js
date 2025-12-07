import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import { useLexicalEditable } from '@lexical/react/useLexicalEditable'
import ErrorBoundary from '@/components/error-boundary'
import KatexRenderer from '@/components/katex-renderer'
import { useToast } from '@/components/toast'

export default function MathComponent ({ math, inline }) {
  const [editor] = useLexicalComposerContext()
  const isEditable = useLexicalEditable()
  const toaster = useToast()

  return (
    <ErrorBoundary onError={(e) => editor._onError(e)} fallback={null}>
      <KatexRenderer
        equation={math}
        inline={inline}
        onClick={() => {
          if (!isEditable) {
            try {
              navigator.clipboard.writeText(math)
              toaster.success('math copied to clipboard')
            } catch {}
          }
        }}
      />
    </ErrorBoundary>
  )
}
