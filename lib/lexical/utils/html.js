import { buildEditorFromExtensions, defineExtension } from '@lexical/extension'
import { RichTextExtension } from '@lexical/rich-text'
import { ListExtension, CheckListExtension } from '@lexical/list'
import { LinkExtension } from '@lexical/link'
import { $generateHtmlFromNodes, $generateNodesFromDOM } from '@lexical/html'
import { $getRoot } from 'lexical'
import DefaultNodes from '@/lib/lexical/nodes'
import DefaultTheme from '@/lib/lexical/theme'
import { $markdownToLexical, $lexicalToMarkdown } from '@/lib/lexical/utils/mdast'

let _bridge = null
function getBridge () {
  if (!_bridge) {
    _bridge = buildEditorFromExtensions(
      defineExtension({
        name: 'sn-clipboard-bridge',
        dependencies: [RichTextExtension, ListExtension, CheckListExtension, LinkExtension],
        nodes: DefaultNodes,
        theme: DefaultTheme,
        onError: (error) => console.error('clipboard bridge error:', error)
      })
    )
  }
  return _bridge
}

export function htmlToMarkdown (html) {
  const bridge = getBridge()
  let markdown = ''
  bridge.update(() => {
    const root = $getRoot()
    root.clear()
    const dom = new window.DOMParser().parseFromString(html, 'text/html')
    const nodes = $generateNodesFromDOM(bridge, dom)
    root.append(...nodes)
    markdown = $lexicalToMarkdown()
    root.clear()
  })
  return markdown
}

export function markdownToHtml (markdown) {
  const bridge = getBridge()
  let html = ''
  bridge.update(() => {
    $markdownToLexical(markdown)
    html = $generateHtmlFromNodes(bridge)
    $getRoot().clear()
  })
  return html
}
