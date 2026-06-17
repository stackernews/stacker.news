import { visit } from 'unist-util-visit'

const isTaskItem = (item) => typeof item.checked === 'boolean'

// CommonMark merges consecutive list items that share a marker into a single
// list, even when some are GFM task items (`- [ ]`) and others are plain (`- `).
// Lexical types lists per-list (check | bullet | number) and can't represent a
// mixed list, so split such a list into consecutive homogeneous runs (task vs
// plain) so each becomes its own correctly-typed lexical list.
export function splitMixedListsTransform (tree) {
  visit(tree, 'list', (node, index, parent) => {
    if (!parent || typeof index !== 'number') return
    const items = node.children ?? []
    if (items.length < 2) return

    // group items into runs that flip between task and plain
    const segments = []
    let prevIsTask = null
    for (const item of items) {
      const task = isTaskItem(item)
      if (task !== prevIsTask) {
        segments.push([])
        prevIsTask = task
      }
      segments[segments.length - 1].push(item)
    }

    // homogeneous list, nothing to split
    if (segments.length < 2) return

    // preserve ordered numbering across the split
    let offset = 0
    const newLists = segments.map((segItems) => {
      const list = { ...node, children: segItems }
      if (node.ordered) list.start = (node.start ?? 1) + offset
      offset += segItems.length
      return list
    })

    parent.children.splice(index, 1, ...newLists)
    // revisit at the same index so nested mixed lists are still split,
    // while the now-homogeneous lists are skipped by the guard above
    return index
  })
}
