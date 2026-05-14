import { getTokenStyleObject, stringifyTokenStyle } from '@shikijs/core'
import { $createCodeHighlightNode, DEFAULT_CODE_LANGUAGE } from '@lexical/code-core'
import { $createLineBreakNode, $createTabNode } from 'lexical'
import { shikiCodeToTokens } from '@/lib/lexical/exts/shiki/highlighter'

const DEFAULT_CODE_THEME = 'one-light'
const DIFF_LANGUAGE_REGEX = /^diff-([\w-]+)/i

// matches the upstream interface so CodeShikiExtension consumers can drop in
// a different tokenizer with the same shape if they ever want to
export const ShikiTokenizer = {
  defaultLanguage: DEFAULT_CODE_LANGUAGE,
  defaultTheme: DEFAULT_CODE_THEME,
  $tokenize (codeNode, language) {
    return $getHighlightNodes(codeNode, language || this.defaultLanguage)
  }
}

// tokenizes the CodeNode's text content with shiki and converts the resulting
// token stream into Lexical CodeHighlightNode / TabNode / LineBreakNode children.
// also pushes the theme's foreground/background onto the CodeNode style attribute.
export function $getHighlightNodes (codeNode, language) {
  const diffMatch = DIFF_LANGUAGE_REGEX.exec(language)
  const code = codeNode.getTextContent()
  const { tokens, bg, fg } = shikiCodeToTokens(code, {
    lang: diffMatch ? diffMatch[1] : language,
    theme: codeNode.getTheme() || 'poimandres'
  })

  let style = ''
  if (bg) style += `background-color: ${bg};`
  if (fg) style += `color: ${fg};`
  if (codeNode.getStyle() !== style) codeNode.setStyle(style)

  return mapTokensToLexicalStructure(tokens, !!diffMatch)
}

function mapTokensToLexicalStructure (tokens, diff) {
  const nodes = []
  tokens.forEach((line, idx) => {
    if (idx) nodes.push($createLineBreakNode())
    line.forEach((token, tidx) => {
      let text = token.content

      // diff-xxxx languages: first character of each line maps to a highlight
      // type so the editor can paint inserted/deleted/unchanged gutters
      if (diff && tidx === 0 && text.length > 0) {
        const prefixes = ['+', '-', '>', '<', ' ']
        const prefixTypes = ['inserted', 'deleted', 'inserted', 'deleted', 'unchanged']
        const prefixIndex = prefixes.indexOf(text[0])
        if (prefixIndex !== -1) {
          nodes.push($createCodeHighlightNode(prefixes[prefixIndex], prefixTypes[prefixIndex]))
          text = text.slice(1)
        }
      }

      // split on \t so we emit TabNode for tabs (Lexical needs them as their
      // own node type to handle tab indentation/navigation correctly)
      const parts = text.split('\t')
      parts.forEach((part, pidx) => {
        if (pidx) nodes.push($createTabNode())
        if (part !== '') {
          const node = $createCodeHighlightNode(part)
          const style = stringifyTokenStyle(token.htmlStyle || getTokenStyleObject(token))
          node.setStyle(style)
          nodes.push(node)
        }
      })
    })
  })
  return nodes
}
