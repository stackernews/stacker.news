import { visit } from 'unist-util-visit'

export default function remarkFilterUnicode () {
  return (tree) => {
    try {
      visit(tree, 'paragraph', (node) => {
        node.children = node.children.map(child => {
          if (child.type !== 'inlineMath') return child

          // if inline math contains currency symbols, rehypeMathjax will throw
          // see https://github.com/stackernews/stacker.news/issues/1525
          // and https://github.com/stackernews/stacker.news/pull/1526

          let { hChildren } = child.data
          hChildren = hChildren.map(child2 => {
            return { ...child2, value: filterUnicode(child2.value) }
          })
          child.data.hChildren = hChildren

          return { ...child, value: filterUnicode(child.value) }
        })
      })
    } catch (err) {
      console.error(err)
    }
  }
}

function filterUnicode (text) {
  return text.replace(/\p{Sc}/u, '')
}
