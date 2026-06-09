// thanks ChatGPT

const avgCharWidth = (fontSize) => fontSize * 0.56

function estimateTextWidthPx (text, fontSize) {
  return text.length * avgCharWidth(fontSize)
}

function shouldRotateBottomLabel ({
  text,
  nodeWidth,
  padding,
  fontSize,
  // how much "extra room" you think exists between nodes;
  // tie it to your nodeSpacing so it's stable.
  extraSlot = 24,
  // keep a small buffer so we rotate a bit earlier than “exact fit”
  safety = 8
}) {
  const est = estimateTextWidthPx(text, fontSize)
  const slot = nodeWidth + extraSlot - safety
  return est > slot
}

export function RotatingSankeyLabels (props) {
  const node = props.node ?? props
  if (!node) return null

  const text =
    props.label ??
    node.label ??
    node.id ??
    node.data?.label ??
    node.data?.id ??
    node.data?.name

  if (!text) return null

  const x0 = node.x0 ?? node.x ?? 0
  const x1 = node.x1 ?? (x0 + (node.width ?? 0))
  const y0 = node.y0 ?? node.y ?? 0
  const y1 = node.y1 ?? (y0 + (node.height ?? 0))

  const padding = props.labelPadding ?? 8
  const depth = node.depth ?? node.layer ?? 0
  const isTop = depth === 0

  const nodeWidth = x1 - x0

  const fontSize = 12

  if (isTop) {
    const x = (x0 + x1) / 2
    const y = y0 - padding
    return (
      <text
        x={x}
        y={y}
        fill={props.color ?? node.color ?? '#000'}
        opacity={props.opacity ?? 1}
        textAnchor='middle'
        dominantBaseline='auto'
        style={{ pointerEvents: 'none', fontSize }}
      >
        {text}
      </text>
    )
  }

  const x = (x0 + x1) / 2
  const y = y1 + padding

  const rotate = shouldRotateBottomLabel({
    text,
    nodeWidth,
    padding,
    fontSize,
    extraSlot: 24,
    safety: 10
  })

  return (
    <text
      x={x}
      y={y}
      fill={props.color ?? node.color ?? '#000'}
      opacity={props.opacity ?? 1}
      textAnchor={rotate ? 'start' : 'middle'}
      dominantBaseline='hanging'
      transform={rotate ? `rotate(45 ${x} ${y})` : undefined}
      style={{ pointerEvents: 'none', fontSize }}
    >
      {text}
    </text>
  )
}
