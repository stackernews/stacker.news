// TODO: inspired from lexical playground
import {
  $isCodeNode,
  CodeNode,
  getLanguageFriendlyName
} from '@lexical/code'
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import { $getNearestNodeFromDOMNode, isHTMLElement } from 'lexical'
import { useEffect, useRef, useState, useCallback, useMemo } from 'react'
import { createPortal } from 'react-dom'
import styles from '../../theme/theme.module.css'
import { CopyButton } from '@/components/form'
import ActionTooltip from '@/components/action-tooltip'
import Dropdown from 'react-bootstrap/Dropdown'
import classNames from 'classnames'
import ArrowDownIcon from '@/svgs/arrow-down-s-line.svg'
import { getCodeLanguageOptions } from '@lexical/code-shiki'
import { useLexicalEditable } from '@lexical/react/useLexicalEditable'

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

function CodeLanguageDropdown ({ langs, selectedLang, className, setLang }) {
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')

  const filteredOptions = searchTerm
    ? langs.filter(([value, name]) =>
      value.toLowerCase().includes(searchTerm.toLowerCase()) ||
      name.toLowerCase().includes(searchTerm.toLowerCase())
    )
    : langs.slice(0, 5)

  return (
    <ActionTooltip notForm overlayText={<>language options <strong>{selectedLang}</strong></>} placement='top' noWrapper showDelay={500} transition disable={dropdownOpen}>
      <Dropdown className='pointer' as='div' onToggle={(isOpen) => setDropdownOpen(isOpen)} show={dropdownOpen}>
        <Dropdown.Toggle id='dropdown-basic' as='div' onPointerDown={e => e.preventDefault()} className={className}>
          {selectedLang}
          <ArrowDownIcon />
        </Dropdown.Toggle>
        <Dropdown.Menu className={styles.dropdownExtra}>
          <div className={styles.dropdownSearchContainer}>
            <input
              type='text'
              placeholder='what language'
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className={styles.dropdownSearchInput}
            />
          </div>
          {filteredOptions.map(([value, name]) => (
            <Dropdown.Item
              key={value}
              title={`${name}`}
              onClick={() => setLang(value)}
              className={classNames(styles.dropdownExtraItem, selectedLang === value ? styles.active : '')}
              onPointerDown={e => e.preventDefault()}
            >
              <span className={styles.dropdownExtraItemLabel}>
                <span className={styles.dropdownExtraItemText}>{name}</span>
              </span>
            </Dropdown.Item>
          ))}
        </Dropdown.Menu>
      </Dropdown>
    </ActionTooltip>
  )
}

// TODO: in editable mode, the dropdown should always be shown
// the problem is that we're basing this off mouse events
// instead we should use a mutation listener to detect when the code node is created or destroyed
// and then show the dropdown if the code node is created
// and hide the dropdown if the code node is destroyed
// this way we can always have the dropdown showing in editable mode
function CodeActionMenuContainer ({ anchorElem }) {
  const [editor] = useLexicalComposerContext()
  const isEditable = useLexicalEditable()
  const [lang, setLang] = useState('')
  const [isShown, setShown] = useState(false)
  const [shouldListenMouseMove, setShouldListenMouseMove] = useState(false)
  const [position, setPosition] = useState({
    right: '0',
    top: '0'
  })
  const codeSetRef = useRef(new Set())
  const codeDOMNodeRef = useRef(null)
  const langs = useMemo(() => getCodeLanguageOptions(), [])

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

  const updateLanguage = useCallback((newLang) => {
    setLang(newLang)
    editor.update(() => {
      const maybeCodeNode = $getNearestNodeFromDOMNode(codeDOMNodeRef.current)
      if ($isCodeNode(maybeCodeNode)) {
        maybeCodeNode.setLanguage(newLang)
      }
    })
  }, [editor])

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
        top: `${y - editorElemY - (isEditable ? 6 : 0)}px`
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

  return (isShown || (isEditable && lang)) && (
    <>
      <div className={styles.codeActionMenuContainer} style={{ ...position }}>
        {isEditable ? <CodeLanguageDropdown langs={langs} selectedLang={lang} className={styles.codeActionLanguage} setLang={updateLanguage} /> : <div className={styles.codeActionLanguage}>{codeFriendlyName}</div>}
        <div className={styles.codeActionCopyButton}>
          <CopyButton bareIcon value={() => getCodeValue()} />
        </div>
      </div>
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
