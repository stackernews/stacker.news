import {
  $applyNodeReplacement,
  $getNodeByKey,
  $getSelection,
  $isNodeSelection,
  $setSelection,
  CLICK_COMMAND, COMMAND_PRIORITY_HIGH, COMMAND_PRIORITY_LOW, createEditor, DecoratorNode,
  DRAGSTART_COMMAND, KEY_BACKSPACE_COMMAND, KEY_DELETE_COMMAND, KEY_ENTER_COMMAND,
  KEY_ESCAPE_COMMAND, SELECTION_CHANGE_COMMAND
} from 'lexical'
import { useRef, Suspense, useEffect, useCallback } from 'react'
import { useLexicalNodeSelection } from '@lexical/react/useLexicalNodeSelection'
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import { mergeRegister } from '@lexical/utils'

const imageCache = new Set()

function useSuspenseImage (src) {
  if (!imageCache.has(src)) {
    throw new Promise((resolve) => {
      const img = new window.Image()
      img.src = src
      img.onload = () => {
        imageCache.add(src)
        resolve(null)
      }
    })
  }
}

function LazyImage ({
  altText,
  className,
  imageRef,
  src,
  width,
  height,
  maxWidth
}) {
  useSuspenseImage(src)
  return (
    <img
      className={className || undefined}
      src={src}
      alt={altText}
      ref={imageRef}
      style={{
        height,
        maxHeight: '25vh',
        width: 'auto',
        maxWidth: '100%'
      }}
    />
  )
}

function convertImageElement (domNode) {
  if (domNode instanceof window.HTMLImageElement) {
    const { alt: altText, src } = domNode
    const node = $createImageNode({ altText, src })
    return { node }
  }
  return null
}

export class ImageNode extends DecoratorNode {
  __src
  __altText
  __width
  __height
  __maxWidth
  __showCaption
  __caption
  // Captions cannot yet be used within editor cells
  __captionsEnabled

  static getType () {
    return 'image'
  }

  static clone (node) {
    return new ImageNode(
      node.__src,
      node.__altText,
      node.__maxWidth,
      node.__width,
      node.__height,
      node.__showCaption,
      node.__caption,
      node.__captionsEnabled,
      node.__key
    )
  }

  static importJSON (serializedNode) {
    const { altText, height, width, maxWidth, caption, src, showCaption } =
      serializedNode
    const node = $createImageNode({
      altText,
      height,
      maxWidth,
      showCaption,
      src,
      width
    })
    const nestedEditor = node.__caption
    const editorState = nestedEditor.parseEditorState(caption.editorState)
    if (!editorState.isEmpty()) {
      nestedEditor.setEditorState(editorState)
    }
    return node
  }

  exportDOM (editor) {
    const wrapper = document.createElement('span')
    const theme = editor._config.theme
    const className = theme.mediaContainer
    if (className !== undefined) {
      wrapper.className = className
    }
    const element = document.createElement('img')
    element.setAttribute('src', this.__src)
    element.setAttribute('alt', this.__altText)
    wrapper.appendChild(element)
    return { element: wrapper }
  }

  static importDOM () {
    return {
      img: (node) => ({
        conversion: convertImageElement,
        priority: 0
      })
    }
  }

  constructor (
    src,
    altText,
    maxWidth,
    width,
    height,
    showCaption,
    caption,
    captionsEnabled,
    key
  ) {
    super(key)
    this.__src = src
    this.__altText = altText
    this.__maxWidth = maxWidth
    this.__width = width || 'inherit'
    this.__height = height || 'inherit'
    this.__showCaption = showCaption || false
    this.__caption = caption || createEditor()
    this.__captionsEnabled = captionsEnabled || captionsEnabled === undefined
  }

  exportJSON () {
    return {
      altText: this.getAltText(),
      caption: this.__caption.toJSON(),
      height: this.__height === 'inherit' ? 0 : this.__height,
      maxWidth: this.__maxWidth,
      showCaption: this.__showCaption,
      src: this.getSrc(),
      type: 'image',
      version: 1,
      width: this.__width === 'inherit' ? 0 : this.__width
    }
  }

  setWidthAndHeight (
    width,
    height
  ) {
    const writable = this.getWritable()
    writable.__width = width
    writable.__height = height
  }

  setShowCaption (showCaption) {
    const writable = this.getWritable()
    writable.__showCaption = showCaption
  }

  // View

  createDOM (config) {
    const span = document.createElement('span')
    const theme = config.theme
    const className = theme.mediaContainer
    if (className !== undefined) {
      span.className = className
    }
    return span
  }

  updateDOM () {
    return false
  }

  getSrc () {
    return this.__src
  }

  getAltText () {
    return this.__altText
  }

  decorate () {
    return (
      <Suspense fallback={null}>
        <ImageComponent
          src={this.__src}
          altText={this.__altText}
          width={this.__width}
          height={this.__height}
          maxWidth={this.__maxWidth}
          nodeKey={this.getKey()}
          showCaption={this.__showCaption}
          caption={this.__caption}
          captionsEnabled={this.__captionsEnabled}
          resizable
        />
      </Suspense>
    )
  }
}

export function $createImageNode ({
  altText,
  height,
  maxWidth = 500,
  captionsEnabled,
  src,
  width,
  showCaption,
  caption,
  key
}) {
  return $applyNodeReplacement(
    new ImageNode(
      src,
      altText,
      maxWidth,
      width,
      height,
      showCaption,
      caption,
      captionsEnabled,
      key
    )
  )
}

export function $isImageNode (
  node
) {
  return node instanceof ImageNode
}

export default function ImageComponent ({
  src,
  altText,
  nodeKey,
  width,
  height,
  maxWidth,
  resizable,
  showCaption,
  caption,
  captionsEnabled
}) {
  const imageRef = useRef(null)
  const buttonRef = useRef(null)
  const [isSelected, setSelected, clearSelection] =
    useLexicalNodeSelection(nodeKey)
  const [editor] = useLexicalComposerContext()
  // const [selection, setSelection] = useState(null)
  const activeEditorRef = useRef(null)

  const onDelete = useCallback(
    (payload) => {
      if (isSelected && $isNodeSelection($getSelection())) {
        const event = payload
        event.preventDefault()
        const node = $getNodeByKey(nodeKey)
        if ($isImageNode(node)) {
          node.remove()
        }
        setSelected(false)
      }
      return false
    },
    [isSelected, nodeKey, setSelected]
  )

  const onEnter = useCallback(
    (event) => {
      const latestSelection = $getSelection()
      const buttonElem = buttonRef.current
      if (
        isSelected &&
        $isNodeSelection(latestSelection) &&
        latestSelection.getNodes().length === 1
      ) {
        if (showCaption) {
          // Move focus into nested editor
          $setSelection(null)
          event.preventDefault()
          caption.focus()
          return true
        } else if (
          buttonElem !== null &&
          buttonElem !== document.activeElement
        ) {
          event.preventDefault()
          buttonElem.focus()
          return true
        }
      }
      return false
    },
    [caption, isSelected, showCaption]
  )

  const onEscape = useCallback(
    (event) => {
      if (
        activeEditorRef.current === caption ||
        buttonRef.current === event.target
      ) {
        $setSelection(null)
        editor.update(() => {
          setSelected(true)
          const parentRootElement = editor.getRootElement()
          if (parentRootElement !== null) {
            parentRootElement.focus()
          }
        })
        return true
      }
      return false
    },
    [caption, editor, setSelected]
  )

  useEffect(() => {
    return mergeRegister(
      // editor.registerUpdateListener(({ editorState }) => {
      //   setSelection(editorState.read(() => $getSelection()))
      // }),
      editor.registerCommand(
        SELECTION_CHANGE_COMMAND,
        (_, activeEditor) => {
          activeEditorRef.current = activeEditor
          return false
        },
        COMMAND_PRIORITY_LOW
      ),
      editor.registerCommand(
        CLICK_COMMAND,
        (payload) => {
          const event = payload
          if (event.target === imageRef.current) {
            if (event.shiftKey) {
              setSelected(!isSelected)
            } else {
              clearSelection()
              setSelected(true)
            }
            return true
          }

          return false
        },
        COMMAND_PRIORITY_LOW
      ),
      editor.registerCommand(
        DRAGSTART_COMMAND,
        (payload) => {
          const event = payload
          if (event.target === imageRef.current) {
            if (event.shiftKey) {
              setSelected(!isSelected)
            } else {
              clearSelection()
              setSelected(true)
            }
            return true
          }

          return false
        },
        COMMAND_PRIORITY_HIGH
      ),
      editor.registerCommand(
        DRAGSTART_COMMAND,
        (event) => {
          if (event.target === imageRef.current) {
            // TODO This is just a temporary workaround for FF to behave like other browsers.
            // Ideally, this handles drag & drop too (and all browsers).
            event.preventDefault()
            return true
          }
          return false
        },
        COMMAND_PRIORITY_LOW
      ),
      editor.registerCommand(
        KEY_DELETE_COMMAND,
        onDelete,
        COMMAND_PRIORITY_LOW
      ),
      editor.registerCommand(
        KEY_BACKSPACE_COMMAND,
        onDelete,
        COMMAND_PRIORITY_LOW
      ),
      editor.registerCommand(KEY_ENTER_COMMAND, onEnter, COMMAND_PRIORITY_LOW),
      editor.registerCommand(
        KEY_ESCAPE_COMMAND,
        onEscape,
        COMMAND_PRIORITY_LOW
      )
    )
  }, [
    clearSelection,
    editor,
    isSelected,
    nodeKey,
    onDelete,
    onEnter,
    onEscape,
    setSelected
  ])

  // const draggable = isSelected && $isNodeSelection(selection)
  // const isFocused = isSelected
  return (
    <Suspense fallback={null}>
      <>
        <div draggable>
          <LazyImage
            // className={
            //   isFocused
            //     ? `focused ${$isNodeSelection(selection) ? 'draggable' : ''}`
            //     : null
            // }
            src={src}
            altText={altText}
            imageRef={imageRef}
            width={width}
            height={height}
            maxWidth={maxWidth}
          />
        </div>
      </>
    </Suspense>
  )
}
