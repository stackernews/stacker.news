import { fromMarkdown } from 'mdast-util-from-markdown'
import { visit } from 'unist-util-visit'
import { toString } from 'mdast-util-to-string'
import { slug } from 'github-slugger'

export function extractHeadings (markdownOrTree) {
  const tree = typeof markdownOrTree === 'string'
    ? fromMarkdown(markdownOrTree)
    : markdownOrTree

  const headings = []

  visit(tree, 'heading', node => {
    const str = toString(node)
    headings.push({
      heading: str,
      slug: slug(str.replace(/[^\w\-\s]+/gi, '')),
      depth: node.depth
    })
  })

  return headings
}
