import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import { useEffect } from 'react'
import { registerCodeHighlighting, ShikiTokenizer } from '@lexical/code-shiki'
import styles from '@/sn-lexical/theme/theme.module.css'

// Lexical/Shiki Custom Styles Injector
// Half done and kinda crazy, lol
function computeStyle (className) {
  const el = document.createElement('div')
  el.className = className
  document.body.appendChild(el)
  const style = window.getComputedStyle(el)

  const result = {
    color: style.color,
    'font-size': style.fontSize,
    'font-weight': style.fontWeight,
    margin: style.margin,
    'margin-bottom': style.marginBottom,
    'font-family': style.fontFamily
  }

  el.remove()

  return Object.entries(result)
    .map(([key, value]) => `${key}:${value}`)
    .join(';')
}

const AwareTokenizer = {
  ...ShikiTokenizer,
  defaultTheme: 'github-dark-default',
  $tokenize (codeNode, language) {
    const nodes = ShikiTokenizer.$tokenize(codeNode, language)

    if ((language ?? '').toLowerCase() !== 'markdown') return nodes

    const headingStyles = {
      1: computeStyle(styles.heading1),
      2: computeStyle(styles.heading2),
      3: computeStyle(styles.heading3),
      4: computeStyle(styles.heading4),
      5: computeStyle(styles.heading5),
      6: computeStyle(styles.heading6)
    }

    const quoteStyles = {
      1: computeStyle(styles.quote)
    }

    const codeStyles = {
      1: computeStyle(styles.code)
    }

    for (const node of nodes) {
      if (node.getType?.() !== 'code-highlight') continue

      const text = node.getTextContent()
      const headingMatch = text.match(/^#{1,6}\s/)
      if (headingMatch) {
        const level = headingMatch[0].length - 1 // subtract 1 for the space
        const headingStyle = headingStyles[level]
        if (headingStyle) {
          node.setStyle(`${headingStyle}`)
          continue
        }
      }

      const quoteMatch = text.match(/^>/)
      if (quoteMatch) {
        node.setStyle(`${quoteStyles[1]}`)
        continue
      }

      const codeMatch = text.match(/^`/)
      if (codeMatch) {
        console.log('codeMatch', codeMatch)
        node.setStyle(`${codeStyles[1]}`)
        continue
      }
    }

    return nodes
  }
}

export default function CodeShikiPlugin ({ isEditable = true }) {
  const [editor] = useLexicalComposerContext()

  useEffect(() => {
    return registerCodeHighlighting(editor, AwareTokenizer)
  }, [editor])

  return null
}
