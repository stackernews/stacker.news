import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import { useEffect, useRef } from 'react'
import { $getSelection, $isRangeSelection } from 'lexical'

const MARKDOWN_EXPOSABLE_CLASSES = /\btheme_(textBold|textItalic|textUnderline|textStrikethrough|code|link|heading[1-6])(?:_\w+)?\b/

function isMarkdownExposable (el) {
  return MARKDOWN_EXPOSABLE_CLASSES.test(el.className)
}

export default function MarkdownLivePreviewPlugin () {
  const [editor] = useLexicalComposerContext()
  const prevExposed = useRef(new Set())

  useEffect(() => {
    return editor.registerUpdateListener(({ editorState }) => {
      const newlyExposedKeys = new Set()

      editorState.read(() => {
        const selection = $getSelection()
        if (!$isRangeSelection(selection)) return

        const nodes = selection.getNodes()
        nodes.forEach((node) => {
          let cur = node
          while (cur) {
            const key = cur.getKey?.()
            if (!key) break

            const el = editor.getElementByKey(key)
            if (el) {
              if (isMarkdownExposable(el)) {
                newlyExposedKeys.add(key)
                el.setAttribute('data-md-expose', 'true')
              }
            }

            cur = cur.getParent?.()
          }
        })

        for (const key of prevExposed.current) {
          if (!newlyExposedKeys.has(key)) {
            const el = editor.getElementByKey(key)
            if (el) {
              el.removeAttribute('data-md-expose')
            }
          }
        }

        prevExposed.current = newlyExposedKeys
      })
    })
  }, [editor])

  useEffect(() => {
    return editor.registerRootListener((_root, _prev) => {
      if (_prev) {
        _prev.querySelectorAll('[data-md-expose]').forEach((el) => {
          el.removeAttribute('data-md-expose')
        })
      }
    })
  }, [editor])

  return null
}
