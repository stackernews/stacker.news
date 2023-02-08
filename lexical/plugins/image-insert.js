import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import { $wrapNodeInElement, mergeRegister } from '@lexical/utils'
import {
  $createParagraphNode,
  $createRangeSelection,
  $getSelection,
  $insertNodes,
  $isRootOrShadowRoot,
  $setSelection,
  COMMAND_PRIORITY_EDITOR,
  COMMAND_PRIORITY_HIGH,
  COMMAND_PRIORITY_LOW,
  createCommand,
  DRAGOVER_COMMAND,
  DRAGSTART_COMMAND,
  DROP_COMMAND
} from 'lexical'
import { useEffect, useRef } from 'react'
import { ensureProtocol } from '../../lib/url'

import {
  $createImageNode,
  $isImageNode,
  ImageNode
} from '../nodes/image'
import { Form, Input, SubmitButton } from '../../components/form'
import styles from '../styles.module.css'
import { urlSchema } from '../../lib/validate'

const getDOMSelection = (targetWindow) =>
  typeof window !== 'undefined' ? (targetWindow || window).getSelection() : null

export const INSERT_IMAGE_COMMAND = createCommand('INSERT_IMAGE_COMMAND')

export function ImageInsertModal ({ onClose, editor }) {
  const inputRef = useRef(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  return (
    <Form
      initial={{
        url: '',
        alt: ''
      }}
      schema={urlSchema}
      onSubmit={async ({ alt, url }) => {
        editor.dispatchCommand(INSERT_IMAGE_COMMAND, { src: ensureProtocol(url), altText: alt })
        onClose()
      }}
    >
      <Input
        label='url'
        name='url'
        innerRef={inputRef}
        required
        autoFocus
      />
      <Input
        label={<>alt text <small className='text-muted ml-2'>optional</small></>}
        name='alt'
      />
      <div className='d-flex'>
        <SubmitButton variant='success' className='ml-auto mt-1 px-4'>ok</SubmitButton>
      </div>
    </Form>
  )
}

export default function ImageInsertPlugin ({
  captionsEnabled
}) {
  const [editor] = useLexicalComposerContext()

  useEffect(() => {
    if (!editor.hasNodes([ImageNode])) {
      throw new Error('ImagesPlugin: ImageNode not registered on editor')
    }

    return mergeRegister(
      editor.registerCommand(
        INSERT_IMAGE_COMMAND,
        (payload) => {
          const imageNode = $createImageNode(payload)
          $insertNodes([imageNode])
          if ($isRootOrShadowRoot(imageNode.getParentOrThrow())) {
            $wrapNodeInElement(imageNode, $createParagraphNode).selectEnd()
          }

          return true
        },
        COMMAND_PRIORITY_EDITOR
      ),
      editor.registerCommand(
        DRAGSTART_COMMAND,
        (event) => {
          return onDragStart(event)
        },
        COMMAND_PRIORITY_HIGH
      ),
      editor.registerCommand(
        DRAGOVER_COMMAND,
        (event) => {
          return onDragover(event)
        },
        COMMAND_PRIORITY_LOW
      ),
      editor.registerCommand(
        DROP_COMMAND,
        (event) => {
          return onDrop(event, editor)
        },
        COMMAND_PRIORITY_HIGH
      )
    )
  }, [captionsEnabled, editor])

  return null
}

const TRANSPARENT_IMAGE =
   'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'
const img = typeof window !== 'undefined' ? document.createElement('img') : undefined
if (img) {
  img.src = TRANSPARENT_IMAGE
}

function onDragStart (event) {
  const node = getImageNodeInSelection()
  if (!node) {
    return false
  }
  const dataTransfer = event.dataTransfer
  if (!dataTransfer) {
    return false
  }
  dataTransfer.setData('text/plain', '_')
  img.src = node.getSrc()
  dataTransfer.setDragImage(img, 0, 0)
  dataTransfer.setData(
    'application/x-lexical-drag',
    JSON.stringify({
      data: {
        altText: node.__altText,
        caption: node.__caption,
        height: node.__height,
        maxHeight: '25vh',
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

function onDragover (event) {
  const node = getImageNodeInSelection()
  if (!node) {
    return false
  }
  if (!canDropImage(event)) {
    event.preventDefault()
  }
  return true
}

function onDrop (event, editor) {
  const node = getImageNodeInSelection()
  if (!node) {
    return false
  }
  const data = getDragImageData(event)
  if (!data) {
    return false
  }
  event.preventDefault()
  if (canDropImage(event)) {
    const range = getDragSelection(event)
    node.remove()
    const rangeSelection = $createRangeSelection()
    if (range !== null && range !== undefined) {
      rangeSelection.applyDOMRange(range)
    }
    $setSelection(rangeSelection)
    editor.dispatchCommand(INSERT_IMAGE_COMMAND, data)
  }
  return true
}

function getImageNodeInSelection () {
  const selection = $getSelection()
  const nodes = selection.getNodes()
  const node = nodes[0]
  return $isImageNode(node) ? node : null
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
    target &&
     target instanceof HTMLElement &&
     !target.closest('code, span.editor-image') &&
     target.parentElement &&
     target.parentElement.closest(`div.${styles.editorInput}`)
  )
}

function getDragSelection (event) {
  let range
  const target = event.target
  const targetWindow =
     target == null
       ? null
       : target.nodeType === 9
         ? target.defaultView
         : target.ownerDocument.defaultView
  const domSelection = getDOMSelection(targetWindow)
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
