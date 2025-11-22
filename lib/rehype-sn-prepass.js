// Pre-pass to assemble <details>/<summary> blocks across sibling nodes, with nesting support

export function assembleDetails (node) {
  if (!node || !Array.isArray(node.children)) return
  const originalChildren = node.children
  const [assembledChildren, ok] = assembleDetailsOnChildren(originalChildren)
  if (ok) node.children = assembledChildren
  // Recurse
  for (const child of node.children) assembleDetails(child)
}

function assembleDetailsOnChildren (children) {
  const result = []
  const stack = [] // { node, summaryOpen, summaryText: string, summaryChildren: Node[] }
  let ok = true

  const pushText = (text) => {
    if (!text) return
    const target = stack[stack.length - 1]
    if (target) {
      if (target.summaryOpen) {
        target.summaryText += text
      } else {
        target.node.children.push({ type: 'text', value: text })
      }
    } else {
      result.push({ type: 'text', value: text })
    }
  }

  const openDetails = (attrs) => {
    const properties = {}
    if (attrs.open) properties.open = true
    const detailsEl = { type: 'element', tagName: 'details', properties, children: [] }
    stack.push({ node: detailsEl, summaryOpen: false, summaryText: '', summaryChildren: [] })
  }

  const closeDetails = () => {
    const frame = stack.pop()
    if (!frame) return
    if (frame.summaryOpen) {
      if (frame.summaryText && frame.summaryText.trim()) {
        frame.summaryChildren.push({ type: 'text', value: frame.summaryText })
      }
      frame.node.children.unshift(createSummaryNode(
        frame.summaryChildren.length > 0 ? frame.summaryChildren : frame.summaryText
      ))
      frame.summaryOpen = false
      frame.summaryText = ''
      frame.summaryChildren = []
    }
    const target = stack[stack.length - 1]
    if (target) {
      target.node.children.push(frame.node)
    } else {
      result.push(frame.node)
    }
  }

  const openSummary = () => {
    const frame = stack[stack.length - 1]
    if (!frame) { pushText('<summary>'); return }
    const hasSummary = frame.node.children.some(c => c.tagName === 'summary')
    if (hasSummary || frame.summaryOpen) { pushText('<summary>'); return }
    frame.summaryOpen = true
    frame.summaryText = ''
    frame.summaryChildren = []
  }

  const closeSummary = () => {
    const frame = stack[stack.length - 1]
    if (!frame || !frame.summaryOpen) { pushText('</summary>'); return }
    if (frame.summaryText && frame.summaryText.trim()) {
      frame.summaryChildren.push({ type: 'text', value: frame.summaryText })
    }
    frame.node.children.unshift(createSummaryNode(
      frame.summaryChildren.length > 0 ? frame.summaryChildren : frame.summaryText
    ))
    frame.summaryOpen = false
    frame.summaryText = ''
    frame.summaryChildren = []
  }

  for (const child of children) {
    if (child?.type === 'raw' && typeof child.value === 'string') {
      const { tokens, hasTag } = tokenizeRaw(child.value)
      if (!hasTag && stack.length === 0) {
        result.push(child)
        continue
      }
      for (const token of tokens) {
        switch (token.type) {
          case 'text':
            pushText(token.value)
            break
          case 'detailsOpen':
            openDetails(token.attrs || {})
            break
          case 'detailsClose':
            closeDetails()
            break
          case 'summaryOpen':
            openSummary()
            break
          case 'summaryClose':
            closeSummary()
            break
          default:
            break
        }
      }
      continue
    }

    if (stack.length > 0) {
      const top = stack[stack.length - 1]
      if (top.summaryOpen) {
        if (top.summaryText && top.summaryText.trim()) {
          top.summaryChildren.push({ type: 'text', value: top.summaryText })
          top.summaryText = ''
        }
        top.summaryChildren.push(child)
      } else {
        top.node.children.push(child)
      }
    } else {
      result.push(child)
    }
  }

  if (stack.length > 0) {
    ok = false
    return [children, ok]
  }

  return [result, ok]
}

function tokenizeRaw (value) {
  const tokens = []
  const tagRe = /<\/?(details|summary)\b([^>]*)>/ig
  let lastIndex = 0
  let m
  let hasTag = false
  while ((m = tagRe.exec(value)) !== null) {
    hasTag = true
    if (m.index > lastIndex) {
      tokens.push({ type: 'text', value: value.slice(lastIndex, m.index) })
    }
    const isClosing = value[m.index + 1] === '/'
    const tag = m[1].toLowerCase()
    const attrString = m[2] || ''
    const attrs = parseAttributes(attrString)
    if (tag === 'details') {
      tokens.push({ type: isClosing ? 'detailsClose' : 'detailsOpen', attrs: isClosing ? undefined : attrs })
    } else if (tag === 'summary') {
      tokens.push({ type: isClosing ? 'summaryClose' : 'summaryOpen', attrs: isClosing ? undefined : attrs })
    }
    lastIndex = tagRe.lastIndex
  }
  if (lastIndex < value.length) {
    tokens.push({ type: 'text', value: value.slice(lastIndex) })
  }
  return { tokens, hasTag }
}

function parseAttributes (attrString) {
  // Parse only the 'open' attribute, could eventually support other attrs if needed
  const attrs = {}
  const re = /(\w[\w-]*)(?:\s*=\s*("([^"]*)"|'([^']*)'|([^\s"'>/]+)))?/g
  let m
  while ((m = re.exec(attrString)) !== null) {
    const key = m[1].toLowerCase()
    if (key === 'open') attrs.open = true
  }
  return attrs
}

function createSummaryNode (content) {
  const children = Array.isArray(content)
    ? content
    : [{ type: 'text', value: (content || '').trim() }]
  return {
    type: 'element',
    tagName: 'summary',
    properties: {},
    children
  }
}
