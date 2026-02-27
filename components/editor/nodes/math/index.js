import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import { useLexicalEditable } from '@lexical/react/useLexicalEditable'
import { useState, useRef, useCallback, useEffect, forwardRef } from 'react'
import { $isMathNode } from '@/lib/lexical/nodes/formatting/math'
import { mergeRegister } from '@lexical/utils'
import {
  COMMAND_PRIORITY_LOW,
  COMMAND_PRIORITY_HIGH,
  KEY_ESCAPE_COMMAND,
  KEY_ENTER_COMMAND,
  SELECTION_CHANGE_COMMAND,
  $getNodeByKey,
  $setSelection
} from 'lexical'
import ErrorBoundary from '@/components/error-boundary'
import KatexRenderer from '@/components/katex-renderer'
import { useToast } from '@/components/toast'
import useDecoratorNodeSelection from '@/components/editor/hooks/use-decorator-selection'
import styles from './math.module.css'

export default function MathComponent ({ math, inline, nodeKey }) {
  const [editor] = useLexicalComposerContext()
  const isEditable = useLexicalEditable()
  const toaster = useToast()
  const [mathValue, setMathValue] = useState(math)
  const [showMathEditor, setShowMathEditor] = useState(false)
  const inputRef = useRef(null)

  const { isSelected } = useDecoratorNodeSelection(nodeKey, {
    focusedClass: 'focused',
    active: !showMathEditor
  })

  // auto-open editor on new nodes
  useEffect(() => {
    if (!math && isEditable) {
      setShowMathEditor(true)
    }
  }, [])

  // clear Lexical selection when editor opens to hide the block cursor
  useEffect(() => {
    if (!showMathEditor || !isEditable || inline) return
    editor.update(() => {
      $setSelection(null)
    })
  }, [editor, showMathEditor, isEditable, inline])

  const onHide = useCallback((restoreSelection) => {
    setShowMathEditor(false)
    editor.update(() => {
      const node = $getNodeByKey(nodeKey)
      if ($isMathNode(node)) {
        if (mathValue.trim() === '') {
          node.remove()
          return
        }
        node.setMath(mathValue)
        if (restoreSelection) {
          node.selectNext(0, 0)
        }
      }
    })
  }, [editor, mathValue, nodeKey])

  // sync local value with prop when editor is closed
  useEffect(() => {
    if (!showMathEditor && mathValue !== math) {
      setMathValue(math)
    }
  }, [showMathEditor, mathValue, math])

  // close editor when Lexical selection changes or Escape is pressed outside the input
  useEffect(() => {
    if (!isEditable || !showMathEditor) return

    const handler = () => {
      if (document.activeElement !== inputRef.current) {
        onHide()
      }
      return false
    }

    return mergeRegister(
      editor.registerCommand(SELECTION_CHANGE_COMMAND, handler, COMMAND_PRIORITY_HIGH),
      editor.registerCommand(KEY_ESCAPE_COMMAND, handler, COMMAND_PRIORITY_HIGH)
    )
  }, [editor, onHide, showMathEditor, isEditable])

  useEffect(() => {
    if (!isEditable || showMathEditor) return

    return editor.registerCommand(
      KEY_ENTER_COMMAND,
      (event) => {
        if (!isSelected) return false
        event?.preventDefault()
        setShowMathEditor(true)
        return true
      },
      COMMAND_PRIORITY_LOW
    )
  }, [editor, isSelected, showMathEditor, isEditable])

  return (
    <>
      {showMathEditor && isEditable
        ? (
          <MathEditor
            math={mathValue}
            setMath={setMathValue}
            inline={inline}
            ref={inputRef}
            onBlur={() => onHide()}
            onKeyDown={(e) => {
              if (e.key === 'Escape') onHide()
            }}
          />
          )
        : (
          <ErrorBoundary onError={(e) => editor._onError(e)} fallback={null}>
            <KatexRenderer
              equation={mathValue}
              inline={inline}
              onDoubleClick={() => {
                if (isEditable) {
                  setShowMathEditor(true)
                }
              }}
              onClick={() => {
                if (!isEditable) {
                  try {
                    navigator.clipboard.writeText(mathValue)
                    toaster.success('math copied to clipboard')
                  } catch {}
                }
              }}
            />
          </ErrorBoundary>
          )}
    </>
  )
}

const MathEditor = forwardRef(function MathEditor ({ math, setMath, inline, onBlur, onKeyDown }, ref) {
  useEffect(() => {
    ref?.current?.focus()
  }, [ref])

  useEffect(() => {
    const el = ref?.current
    if (!el || inline) return
    el.style.height = 'auto'
    el.style.height = el.scrollHeight + 'px'
  }, [math, ref, inline])

  const InputComponent = inline ? 'input' : 'textarea'

  return (
    <div className={inline ? styles.inlineContainer : styles.container}>
      <InputComponent
        ref={ref}
        type={inline ? 'text' : undefined}
        rows={inline ? undefined : 1}
        value={math}
        placeholder='x^2 + y^2 = z^2'
        onChange={(e) => setMath(e.target.value)}
        onBlur={onBlur}
        onKeyDown={onKeyDown}
        className={styles.input}
      />
      {math.trim() && (
        <div className={styles.preview} onMouseDown={(e) => e.preventDefault()}>
          <ErrorBoundary fallback={null}>
            <KatexRenderer equation={math} inline={inline} />
          </ErrorBoundary>
        </div>
      )}
    </div>
  )
})
