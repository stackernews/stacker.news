import { Suspense, useCallback, useEffect, useRef, useState } from 'react'
import { mergeRegister } from '@lexical/utils'
import { AutoFocusPlugin } from '@lexical/react/LexicalAutoFocusPlugin'
import { ContentEditable } from '@lexical/react/LexicalContentEditable'
import { HistoryPlugin } from '@lexical/react/LexicalHistoryPlugin'
import { LexicalErrorBoundary } from '@lexical/react/LexicalErrorBoundary'
import { LexicalNestedComposer } from '@lexical/react/LexicalNestedComposer'
import { LinkPlugin } from '@lexical/react/LexicalLinkPlugin'
import { RichTextPlugin } from '@lexical/react/LexicalRichTextPlugin'
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import { useLexicalEditable } from '@lexical/react/useLexicalEditable'
import { useLexicalNodeSelection } from '@lexical/react/useLexicalNodeSelection'
import {
  $getNodeByKey, $isNodeSelection,
  $getSelection, $isRangeSelection, $setSelection,
  CLICK_COMMAND, COMMAND_PRIORITY_LOW, DRAGSTART_COMMAND, KEY_ENTER_COMMAND,
  KEY_ESCAPE_COMMAND, RIGHT_CLICK_IMAGE_COMMAND, SELECTION_CHANGE_COMMAND
} from 'lexical'
import MentionsPlugin from '@/components/lexical/plugins/decorative/mentions'
import { MediaOrLinkExperimental, LinkRaw } from '@/components/media-or-link'
import { useSharedHistoryContext } from '@/components/lexical/contexts/sharedhistory'
import { $isMediaNode } from './media'
import MediaResizer from './media-resizer'
import styles from '@/components/lexical/theme/media.module.css'
import { useLexicalItemContext } from '@/components/lexical/contexts/item'
import { IMGPROXY_URL_REGEXP, decodeProxyUrl } from '@/lib/url'

export function MediaOrLink ({
  src,
  srcSet,
  rel,
  altText,
  kind,
  nodeKey,
  width,
  height,
  resizable,
  showCaption,
  caption,
  captionsEnabled
}) {
  const mediaRef = useRef(null)
  const buttonRef = useRef(null)
  const [isSelected, setSelected, clearSelection] =
    useLexicalNodeSelection(nodeKey)
  const [isResizing, setIsResizing] = useState(false)
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

  const onClick = useCallback((payload) => {
    const event = payload
    if (isResizing) {
      return true
    }
    if (event.target === mediaRef.current) {
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
      if ((domElement.tagName === 'IMG' || domElement.tagName === 'VIDEO') &&
          $isRangeSelection(latestSelection) && latestSelection.getNodes().length === 1) {
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
          if (event.target === mediaRef.current) {
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
      if ($isMediaNode(node)) {
        node.setShowCaption(true)
      }
    })
  }

  const onResizeEnd = (nextWidth, nextHeight) => {
    setTimeout(() => {
      setIsResizing(false)
    }, 200)

    editor.update(() => {
      const node = $getNodeByKey(nodeKey)
      if ($isMediaNode(node)) {
        node.setWidthAndHeight(nextWidth, nextHeight)
      }
    })
  }

  const onResizeStart = () => {
    setIsResizing(true)
  }

  const { historyState } = useSharedHistoryContext()

  const draggable = isSelected && $isNodeSelection(selection) && !isResizing
  const isFocused = (isSelected || isResizing) && isEditable

  if (isLoadError) {
    return <LinkRaw src={src} rel={rel}>{src}</LinkRaw>
  }

  return (
    <Suspense fallback={null}>
      <>
        <div draggable={draggable}>
          <MediaOrLinkExperimental
            editable={isEditable}
            src={src}
            srcSet={srcSet}
            rel={rel}
            kind={kind}
            linkFallback={false}
            preTailor={{ width, height }}
            onError={() => setIsLoadError(true)}
            className={isFocused ? `focused ${$isNodeSelection(selection) ? 'draggable' : ''}` : null}
            imageRef={mediaRef}
          />
        </div>

        {showCaption && (
          <div className={styles.imageCaptionContainer}>
            <LexicalNestedComposer initialEditor={caption}>
              <AutoFocusPlugin />
              <LinkPlugin />
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
        {resizable && $isNodeSelection(selection) && isFocused && (
          <MediaResizer
            showCaption={showCaption}
            setShowCaption={setShowCaption}
            editor={editor}
            buttonRef={buttonRef}
            imageRef={mediaRef}
            onResizeStart={onResizeStart}
            onResizeEnd={onResizeEnd}
            captionsEnabled={!isLoadError && captionsEnabled}
          />
        )}
      </>
    </Suspense>
  )
}

export default function MediaComponent ({ src, status, ...props }) {
  const { imgproxyUrls, rel, outlawed } = useLexicalItemContext()
  const url = IMGPROXY_URL_REGEXP.test(src) ? decodeProxyUrl(src) : src
  const srcSet = imgproxyUrls?.[url]

  console.log('outlawed', outlawed)

  if (outlawed) {
    return <p className='outlawed'>{url}</p>
  }

  if (status === 'error') {
    return <LinkRaw src={url} rel={rel}>{url}</LinkRaw>
  }

  return <MediaOrLink srcSet={srcSet} src={src} rel={rel} {...props} />
}
