export function escapeText (text) {
  return text.replace(/"/g, '\\"')
}

export function exportMediaNode (node) {
  const altText = node.getAltText() || ''
  const src = node.getSrc()
  const { width, height } = node.getWidthAndHeight()

  let caption = ''
  if (node.getShowCaption()) {
    const escapedCaption = escapeText(node.getCaptionText())
    if (escapedCaption) {
      caption = ` "${escapedCaption}"`
    }
  }

  let dimensions = ''
  if (Number(width) > 0 && Number(height) > 0) {
    dimensions = `{width:${width},height:${height}}`
  }

  return `![${altText}](${src}${caption})${dimensions}`
}
