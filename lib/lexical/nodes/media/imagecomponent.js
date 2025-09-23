import { useRef, useState, useCallback, useEffect, Suspense } from 'react'
import { useLexicalNodeSelection } from '@lexical/react/useLexicalNodeSelection'
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import { useLexicalEditable } from '@lexical/react/useLexicalEditable'
import { LexicalNestedComposer } from '@lexical/react/LexicalNestedComposer'
import AutoFocusPlugin from '@/lexical/plugins/autofocus'
import { LexicalLinkPlugin } from '@lexical/react/LexicalLinkPlugin'
import { HistoryPlugin } from '@lexical/react/LexicalHistoryPlugin'
import MentionsPlugin from '@/lexical/plugins/interop/mentions'
import { RichTextPlugin } from '@lexical/react/LexicalRichTextPlugin'
import { ContentEditable } from '@lexical/react/LexicalContentEditable'
import { LexicalErrorBoundary } from '@lexical/react/LexicalErrorBoundary'
import { $getNodeByKey, $isNodeSelection, $getSelection, $setSelection, $isRangeSelection, RIGHT_CLICK_IMAGE_COMMAND, COMMAND_PRIORITY_LOW, CLICK_COMMAND, DRAGSTART_COMMAND, KEY_ENTER_COMMAND, KEY_ESCAPE_COMMAND, SELECTION_CHANGE_COMMAND } from 'lexical'
import { mergeRegister } from '@lexical/utils'
import { useSharedHistoryContext } from '@/lexical/contexts/sharedhistorycontext'
import { $isImageNode } from './imagenode'
import styles from '@/lexical/theme/media.module.css'

const imageCache = new Map()

function useSuspenseImage (src) {
  let cached = imageCache.get(src)
  if (cached && 'error' in cached && typeof cached.error === 'boolean') {
    return cached
  } else if (!cached) {
    cached = new Promise((resolve) => {
      const img = new window.Image()
      img.src = src
      img.onload = () => {
        resolve({
          error: false,
          height: img.naturalHeight,
          width: img.naturalWidth
        })
      }
      img.onerror = () => resolve({ error: true })
    }).then((result) => {
      imageCache.set(src, result)
      return result
    })
    imageCache.set(src, cached)
    throw cached
  }
  throw cached
}

function LazyImage ({ src, altText, imageRef, width, height, maxWidth, onError, className }) {
  const isSVG = src.toLowerCase().endsWith('.svg')
  const status = useSuspenseImage(src)

  useEffect(() => {
    if (status.error) {
      onError()
    }
  }, [status.error, onError])

  if (status.error) {
    // should return a broken image svg
    return null
  }

  const calculateDimensions = () => {
    if (!isSVG) {
      return {
        height,
        width,
        maxWidth
      }
    }

    const naturalHeight = status.height
    const naturalWidth = status.width

    let finalHeight = naturalHeight
    let finalWidth = naturalWidth

    if (finalWidth > maxWidth) {
      const scale = maxWidth / finalWidth
      finalWidth = maxWidth
      finalHeight = Math.round(finalHeight * scale)
    }

    const maxHeight = 500
    if (finalHeight > maxHeight) {
      const scale = maxHeight / finalHeight
      finalHeight = maxHeight
      finalWidth = Math.round(finalWidth * scale)
    }

    return {
      height: finalHeight,
      width: finalWidth,
      maxWidth
    }
  }

  const imageStyle = calculateDimensions()

  return (
    <img
      className={className || undefined}
      src={src}
      alt={altText}
      ref={imageRef}
      style={imageStyle}
      onError={onError}
      draggable={false}
    />
  )
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
  const controlWrapperRef = useRef(null)
  const [isSelected, setSelected, clearSelection] =
    useLexicalNodeSelection(nodeKey)
  const [isResizing] = useState(false)
  const [editor] = useLexicalComposerContext()
  const [selection, setSelection] = useState(null)
  const activeEditorRef = useRef(null)
  const [isLoadError, setIsLoadError] = useState(false)
  const isEditable = useLexicalEditable()

  const $onEnter = useCallback((event) => {
    const latestSelection = $getSelection()
    const buttonElem = buttonRef.current
    if (isSelected && $isNodeSelection(latestSelection) && latestSelection.getNodes().length === 1) {
      if (showCaption) {
        $setSelection(null)
        event.preventDefault()
        caption.focus()
        return true
      } else if (buttonElem !== null && buttonElem !== document.activeElement) {
        event.preventDefault()
        buttonElem.focus()
        return true
      }
      return false
    }
  }, [isSelected, showCaption, caption])

  const $onEscape = useCallback((event) => {
    if (activeEditorRef.current === caption || buttonRef.current === event.target) {
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
  }, [caption, editor, setSelected])

  const onClick = useCallback((event) => {
    if (!isResizing) {
      return true
    }
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
  }, [isResizing, isSelected, clearSelection, setSelected])

  const onRightClick = useCallback((event) => {
    editor.getEditorState().read(() => {
      const latestSelection = $getSelection()
      const domElement = event.target
      if (domElement.tagName === 'IMG' && $isRangeSelection(latestSelection) && latestSelection.getNodes().length === 1) {
        editor.dispatchCommand(RIGHT_CLICK_IMAGE_COMMAND, event)
      }
    })
  }, [editor])

  useEffect(() => {
    const rootEl = editor.getRootElement()
    const unregister = mergeRegister(
      editor.registerUpdateListener(({ editorState }) => {
        const updatedSelection = editorState.read(() => $getSelection())
        if ($isNodeSelection(updatedSelection)) {
          setSelection(updatedSelection)
        } else {
          setSelection(null)
        }
      }),
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
        onClick,
        COMMAND_PRIORITY_LOW
      ),
      editor.registerCommand(
        RIGHT_CLICK_IMAGE_COMMAND,
        onClick,
        COMMAND_PRIORITY_LOW
      ),
      editor.registerCommand(
        DRAGSTART_COMMAND,
        (event) => {
          if (event.target === imageRef.current) {
            event.preventDefault()
            return true
          }
          return false
        },
        COMMAND_PRIORITY_LOW
      ),
      editor.registerCommand(KEY_ENTER_COMMAND, $onEnter, COMMAND_PRIORITY_LOW),
      editor.registerCommand(KEY_ESCAPE_COMMAND, $onEscape, COMMAND_PRIORITY_LOW)
    )

    rootEl?.addEventListener('contextmenu', onRightClick)

    return () => {
      unregister()
      rootEl?.removeEventListener('contextmenu', onRightClick)
    }
  }, [clearSelection, editor, isResizing, isSelected, onClick, nodeKey, onRightClick, $onEnter, $onEscape, setSelected])

  const setShowCaption = () => {
    editor.update(() => {
      const node = $getNodeByKey(nodeKey)
      if ($isImageNode(node)) {
        node.setShowCaption(showCaption)
      }
    })
  }

  /* const onResizeEnd = (nextWidth, nextHeight) => {
    setTimeout(() => {
      setIsResizing(false)
    }, 200)

    editor.update(() => {
      const node = $getNodeByKey(nodeKey)
      if ($isImageNode(node)) {
        node.setWidthAndHeight(nextWidth, nextHeight)
      }
    })
  }

  const onResizeStart = () => {
    setIsResizing(true)
  } */

  const { historyState } = useSharedHistoryContext()

  const draggable = isSelected && $isNodeSelection(selection) && !isResizing
  const isFocused = (isSelected || isResizing) && isEditable

  return (
    <Suspense fallback={null}>
      <>
        <div draggable={draggable}>
          {isLoadError
            ? (
              <div className={styles.loadError}>
                <span>Failed to load image</span>
              </div>)
            : (
              <LazyImage
                className={isFocused ? `focused ${$isNodeSelection(selection) ? 'draggable' : ''}` : null}
                src={src}
                altText={altText}
                imageRef={imageRef}
                width={width}
                height={height}
                maxWidth={maxWidth}
                onError={() => setIsLoadError(true)}
              />)}
        </div>

        {showCaption && (
          <div className={styles.imageCaptionContainer}>
            <LexicalNestedComposer initialEditor={caption}>
              <AutoFocusPlugin />
              <LexicalLinkPlugin />
              <HistoryPlugin externalHistoryState={historyState} />
              <MentionsPlugin />
              <RichTextPlugin
                contentEditable={
                  <ContentEditable
                    className={styles.imageCaptionContentEditable}
                  />
                }
                ErrorBoundary={LexicalErrorBoundary}
              />
            </LexicalNestedComposer>
          </div>
        )}
        {resizable && (
          // image resizer
          // for now we just have the caption button
          <div ref={controlWrapperRef}>
            {!showCaption && captionsEnabled && (
              <button
                className={styles.imageCaptionButton}
                ref={buttonRef}
                onClick={() => {
                  setShowCaption(!showCaption)
                }}
              >
                Add Caption
              </button>
            )}
          </div>
        )}
      </>
    </Suspense>
  )
}
