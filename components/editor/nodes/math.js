import { useLexicalEditable } from '@lexical/react/useLexicalEditable'
import KatexRenderer from '@/components/katex-renderer'
import { useToast } from '@/components/toast'

export default function MathComponent ({ math, inline }) {
  const isEditable = useLexicalEditable()
  const toaster = useToast()

  return (
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
  )
}
