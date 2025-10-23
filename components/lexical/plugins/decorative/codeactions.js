// TODO: inspired from lexical playground
import {
  $isCodeNode,
  CodeNode,
  getLanguageFriendlyName
} from '@lexical/code'
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import { $getNearestNodeFromDOMNode, isHTMLElement } from 'lexical'
import { useEffect, useRef, useState, useCallback } from 'react'
import { createPortal } from 'react-dom'
import styles from '../../theme/theme.module.css'
import { CopyButton } from '@/components/form'

function getMouseInfo (event) {
  const target = event.target

  if (isHTMLElement(target)) {
    const codeDOMNode = target.closest('code.sn__codeBlock')
    const isOutside = !(
      codeDOMNode || target.closest(`div.${styles.codeActionMenuContainer}`)
    )

    return { codeDOMNode, isOutside }
  } else {
    return { codeDOMNode: null, isOutside: true }
  }
}

function CodeActionMenuContainer ({ anchorElem }) {
  const [editor] = useLexicalComposerContext()

  const [lang, setLang] = useState('')
  const [isShown, setShown] = useState(false)
  const [shouldListenMouseMove, setShouldListenMouseMove] = useState(false)
  const [position, setPosition] = useState({
    right: '0',
    top: '0'
  })
  const codeSetRef = useRef(new Set())
  const codeDOMNodeRef = useRef(null)

  const getCodeValue = useCallback(() => {
    let content = ''
    editor.update(() => {
      const maybeCodeNode = $getNearestNodeFromDOMNode(codeDOMNodeRef.current)
      if ($isCodeNode(maybeCodeNode)) {
        content = maybeCodeNode.getTextContent()
      }
    })
    return content
  }, [editor, codeDOMNodeRef])

  const onMouseMove = (event) => {
    const { codeDOMNode, isOutside } = getMouseInfo(event)
    if (isOutside) {
      setShown(false)
      return
    }

    if (!codeDOMNode) {
      return
    }

    codeDOMNodeRef.current = codeDOMNode

    let codeNode = null
    let _lang = ''

    editor.update(() => {
      const maybeCodeNode = $getNearestNodeFromDOMNode(codeDOMNode)

      if ($isCodeNode(maybeCodeNode)) {
        codeNode = maybeCodeNode
        _lang = codeNode.getLanguage() || ''
      }
    })

    if (codeNode) {
      const {
        y: editorElemY,
        right: editorElemRight
      } = anchorElem.getBoundingClientRect()
      const { y, right } = codeDOMNode.getBoundingClientRect()
      setLang(_lang)
      setShown(true)
      setPosition({
        right: `${editorElemRight - right + 8}px`,
        top: `${y - editorElemY}px`
      })
    }
  }

  useEffect(() => {
    if (!shouldListenMouseMove) return

    document.addEventListener('mousemove', onMouseMove)
    return () => {
      document.removeEventListener('mousemove', onMouseMove)
    }
  }, [onMouseMove, shouldListenMouseMove])

  useEffect(() => {
    return editor.registerMutationListener(
      CodeNode,
      mutations => {
        editor.getEditorState().read(() => {
          for (const [key, type] of mutations) {
            switch (type) {
              case 'created':
                codeSetRef.current.add(key)
                break

              case 'destroyed':
                codeSetRef.current.delete(key)
                break

              default:
                break
            }
          }
        })
        setShouldListenMouseMove(codeSetRef.current.size > 0)
      },
      { skipInitialization: false }
    )
  }, [editor])

  const codeFriendlyName = getLanguageFriendlyName(lang)

  return (
    <>
      {isShown && (
        <div className={styles.codeActionMenuContainer} style={{ ...position }}>
          <div className={styles.codeActionLanguage}>{codeFriendlyName}</div>
          <CopyButton bareIcon value={() => getCodeValue()} />
        </div>
      )}
    </>
  )
}

export default function CodeActionsPlugin ({ anchorElem = document.body }) {
  if (!anchorElem) return null
  return createPortal(
    <CodeActionMenuContainer anchorElem={anchorElem} />,
    anchorElem
  )
}
