import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import { useEffect } from 'react'
import styles from '@/sn-lexical/theme/theme.module.css'
import { $getRoot } from 'lexical'
import { registerMarkdownShortcuts, CODE } from '@lexical/markdown'

// WIP: not final, broken, switching to markdown and back breaks this
export default function MarkdownWysiwygPlugin ({ enabled = true }) {
  const [editor] = useLexicalComposerContext()
  registerMarkdownShortcuts(editor, [CODE])

  useEffect(() => {
    return editor.registerRootListener((root, prev) => {
      if (prev) prev.classList.remove('md-live')
      if (enabled && root) root.classList.add('md-live')
    })
  }, [editor, enabled])

  useEffect(() => {
    if (!enabled) return

    return editor.registerUpdateListener(({ editorState }) => {
      editorState.read(() => {
        const root = $getRoot()
        const children = root.getChildren()
        const headingClasses = [
          styles.heading1,
          styles.heading2,
          styles.heading3,
          styles.heading4,
          styles.heading5,
          styles.heading6
        ]
        const toRemove = new Set([
          styles.quote,
          styles.code,
          styles.listItem,
          styles.listUl,
          styles.listOl,
          styles.mdhr
        ])

        for (const node of children) {
          const key = node.getKey?.()
          if (!key) continue
          const el = editor.getElementByKey(key)
          if (!el) continue

          for (const c of headingClasses) el.classList.remove(c)
          toRemove.forEach(c => el.classList.remove(c))
          el.style.paddingLeft = ''

          if (node.getType?.() !== 'paragraph') continue

          const text = node.getTextContent()

          // horizontal rule line
          const hr = text.match(/^(-{3,}|\*{3,}|_{3,})$/)
          if (hr) {
            el.classList.add(styles.mdhr)
            continue
          }

          // heading: # .. ######
          const h = text.match(/^(#{1,6})\s+/)
          if (h) {
            const level = h[1].length
            const klass = headingClasses[level - 1]
            if (klass) el.classList.add(klass)
            continue
          }

          // blockquote: > or nested >>>
          // even though lexical doesn't support nested blockquotes, we might want to support it
          const bq = text.match(/^(\s*>+)\s+/)
          if (bq) {
            const depth = bq[1].replace(/\s/g, '').length
            el.classList.add(styles.quote)
            el.style.paddingLeft = `${depth * 16}px`
            continue
          }

          // unordered list: -, +, *
          const ul = text.match(/^(\s*)([-+*])\s+/)
          if (ul) {
            const indent = Math.floor((ul[1] || '').length / 2)
            el.classList.add(styles.listItem)
            el.classList.add(styles.listUl)
            el.style.paddingLeft = `${indent * 16}px`
            continue
          }

          // ordered list: 1. or 1)
          const ol = text.match(/^(\s*)(\d+)[.)]\s+/)
          if (ol) {
            const indent = Math.floor((ol[1] || '').length / 2)
            el.classList.add(styles.listItem)
            el.classList.add(styles.listOl)
            el.style.paddingLeft = `${indent * 16}px`
            continue
          }
        }
      })
    })
  }, [editor, enabled])

  return null
}
