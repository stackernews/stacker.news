import { mergeRegister, isHTMLElement, $findMatchingParent } from '@lexical/utils'
import { defineExtension } from '@lexical/extension'
import { MediaNode, $createMediaNode, $isMediaNode } from '@/lib/lexical/nodes/content/media'
import { $isAutoLinkNode, $isLinkNode, TOGGLE_LINK_COMMAND } from '@lexical/link'
import {
  COMMAND_PRIORITY_HIGH, COMMAND_PRIORITY_LOW, COMMAND_PRIORITY_EDITOR, DRAGSTART_COMMAND, DRAGOVER_COMMAND, DROP_COMMAND, $isRootOrShadowRoot, $wrapNodeInElement, $createParagraphNode, $insertNodes,
  $isNodeSelection, $getSelection, $createRangeSelection, $setSelection, getDOMSelectionFromTarget, createCommand
} from 'lexical'
import styles from '@/components/lexical/theme/theme.module.css'

/** creates a media node */
export const SN_INSERT_MEDIA_COMMAND = createCommand('SN_INSERT_MEDIA_COMMAND')

export const MediaDragDropExtension = defineExtension({
  dependencies: [MediaNode],
  name: 'MediaDragDropExtension',
  register: (editor) => {
    return mergeRegister(
      editor.registerCommand(
        SN_INSERT_MEDIA_COMMAND,
        (payload) => {
          const mediaNode = $createMediaNode(payload)
          $insertNodes([mediaNode])
          if ($isRootOrShadowRoot(mediaNode.getParentOrThrow())) {
            $wrapNodeInElement(mediaNode, $createParagraphNode).selectEnd()
          }
          return true
        },
        COMMAND_PRIORITY_EDITOR
      ),
      editor.registerCommand(
        DRAGSTART_COMMAND,
        (event) => {
          return $onDragStart(event)
        },
        COMMAND_PRIORITY_HIGH
      ),
      editor.registerCommand(
        DRAGOVER_COMMAND,
        (event) => {
          return $onDragover(event)
        },
        COMMAND_PRIORITY_LOW
      ),
      editor.registerCommand(
        DROP_COMMAND,
        (event) => {
          return $onDrop(event, editor)
        },
        COMMAND_PRIORITY_HIGH
      )
    )
  }
})

function $onDragStart (event) {
  const node = $getMediaNodeInSelection()
  if (!node) {
    return false
  }
  const dataTransfer = event.dataTransfer
  if (!dataTransfer) {
    return false
  }
  dataTransfer.setData('text/plain', '_')
  // we create a transparent image to not obstruct the view while dragging
  const transparentImg = new window.Image()
  transparentImg.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'
  dataTransfer.setDragImage(transparentImg, 0, 0)
  dataTransfer.setData(
    'application/x-lexical-drag',
    JSON.stringify({
      data: {
        altText: node.__altText,
        caption: node.__caption,
        height: node.__height,
        key: node.getKey(),
        maxWidth: node.__maxWidth,
        showCaption: node.__showCaption,
        src: node.__src,
        width: node.__width
      },
      type: 'image'
    })
  )

  return true
}

function $onDragover (event) {
  const node = $getMediaNodeInSelection()
  if (!node) {
    return false
  }
  if (!canDropImage(event)) {
    event.preventDefault()
  }
  return true
}

function $onDrop (event, editor) {
  const node = $getMediaNodeInSelection()
  if (!node) {
    return false
  }
  const data = getDragImageData(event)
  if (!data) {
    return false
  }
  const existingLink = $findMatchingParent(
    node,
    (parent) =>
      !$isAutoLinkNode(parent) && $isLinkNode(parent)
  )
  event.preventDefault()
  if (canDropImage(event)) {
    const range = getDragSelection(event)
    node.remove()
    const rangeSelection = $createRangeSelection()
    if (range !== null && range !== undefined) {
      rangeSelection.applyDOMRange(range)
    }
    $setSelection(rangeSelection)
    editor.dispatchCommand(SN_INSERT_MEDIA_COMMAND, data)
    if (existingLink) {
      editor.dispatchCommand(TOGGLE_LINK_COMMAND, existingLink.getURL())
    }
  }
  return true
}

function $getMediaNodeInSelection () {
  const selection = $getSelection()
  if (!$isNodeSelection(selection)) {
    return null
  }
  const nodes = selection.getNodes()
  const node = nodes[0]
  return $isMediaNode(node) ? node : null
}

function getDragImageData (event) {
  const dragData = event.dataTransfer?.getData('application/x-lexical-drag')
  if (!dragData) {
    return null
  }
  const { type, data } = JSON.parse(dragData)
  if (type !== 'image') {
    return null
  }

  return data
}

function canDropImage (event) {
  const target = event.target
  return !!(
    isHTMLElement(target) &&
    !target.closest('code, span.sn__mediaContainer') &&
    isHTMLElement(target.parentElement) &&
    target.parentElement.closest(`.${styles.editorInput}`)
  )
}

function getDragSelection (event) {
  let range
  const domSelection = getDOMSelectionFromTarget(event.target)
  if (document.caretRangeFromPoint) {
    range = document.caretRangeFromPoint(event.clientX, event.clientY)
  } else if (event.rangeParent && domSelection !== null) {
    domSelection.collapse(event.rangeParent, event.rangeOffset || 0)
    range = domSelection.getRangeAt(0)
  } else {
    throw Error('Cannot get the selection when dragging')
  }

  return range
}
