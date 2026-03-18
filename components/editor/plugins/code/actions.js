import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import { useLexicalEditable } from '@lexical/react/useLexicalEditable'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { CodeNode, $isCodeNode, getLanguageFriendlyName, getCodeLanguageOptions } from '@lexical/code'
import { $getNearestNodeFromDOMNode } from 'lexical'
import { createPortal } from 'react-dom'
import { isHTMLElement } from '@lexical/utils'
import Dropdown from 'react-bootstrap/Dropdown'
import classNames from 'classnames'
import { CopyButton } from '@/components/form'
import { MenuAlternateDimension } from '@/components/editor/utils'
import codeStyles from './code.module.css'

const CODE_PADDING = 8
const MAX_SUGGESTIONS = 5
const LANGUAGE_OPTIONS = getCodeLanguageOptions()

function getCodeNodeFromDOMNode (domNode) {
  const node = $getNearestNodeFromDOMNode(domNode)
  return $isCodeNode(node) ? node : null
}

function getRandomLanguageSuggestions () {
  return [...LANGUAGE_OPTIONS]
    .sort(() => Math.random() - 0.5)
    .slice(0, MAX_SUGGESTIONS)
}

function getMouseInfo (event) {
  const { target } = event
  if (!isHTMLElement(target)) return { codeDOMNode: null, isOutside: true }

  const codeDOMNode = target.closest('code.sn-code-block')
  const isOutside = !codeDOMNode && !target.closest('span.' + codeStyles.codeActionMenuContainer)
  return { codeDOMNode, isOutside }
}

function LanguageSelector ({ lang, editor, codeDOMNodeRef, isEditingRef, onLanguageChange }) {
  const [open, setOpen] = useState(false)
  const [filter, setFilter] = useState('')
  const [highlightedIndex, setHighlightedIndex] = useState(0)
  const isEditable = useLexicalEditable()

  // random placeholder suggestions until the user types
  const randomized = useMemo(
    () => getRandomLanguageSuggestions(),
    [open]
  )

  const filtered = useMemo(() => {
    const q = filter.toLowerCase()
    if (!q) return randomized
    return LANGUAGE_OPTIONS
      .filter(([, name]) => name.toLowerCase().includes(q))
      .slice(0, MAX_SUGGESTIONS)
  }, [filter, randomized])

  useEffect(() => { setHighlightedIndex(0) }, [filter])

  useEffect(() => {
    isEditingRef.current = open
    if (!open) setFilter('')
  }, [open, isEditingRef])

  const selectLanguage = useCallback((langKey) => {
    editor.update(() => {
      const domNode = codeDOMNodeRef.current
      if (!domNode) return
      const codeNode = getCodeNodeFromDOMNode(domNode)
      if (codeNode) codeNode.setLanguage(langKey)
    })
    onLanguageChange(langKey)
    setOpen(false)
  }, [editor, codeDOMNodeRef, onLanguageChange])

  const handleKeyDown = useCallback((e) => {
    e.stopPropagation()
    if (!filtered.length && e.key !== 'Escape') return

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setHighlightedIndex(i => Math.min(i + 1, filtered.length - 1))
        break
      case 'ArrowUp':
        e.preventDefault()
        setHighlightedIndex(i => Math.max(i - 1, 0))
        break
      case 'Enter':
        e.preventDefault()
        if (filtered[highlightedIndex]) selectLanguage(filtered[highlightedIndex][0])
        break
      case 'Escape':
        e.preventDefault()
        setOpen(false)
        break
    }
  }, [filtered, highlightedIndex, selectLanguage])

  return (
    <Dropdown drop='down' as='span' onToggle={setOpen} show={open}>
      <Dropdown.Toggle
        as='span'
        className={classNames(codeStyles.codeActionLanguage, isEditable && codeStyles.editable)}
        onPointerDown={e => e.preventDefault()}
      >
        {getLanguageFriendlyName(lang)}
      </Dropdown.Toggle>
      <Dropdown.Menu as={MenuAlternateDimension} className={codeStyles.languageDropdown}>
        <div onMouseDown={e => e.stopPropagation()}>
          <input
            className={codeStyles.languageInput}
            value={filter}
            onChange={e => setFilter(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder='search'
          />
        </div>
        {filtered.map(([key, name], i) => (
          <div
            key={key}
            className={classNames(codeStyles.languageOption, i === highlightedIndex && codeStyles.languageOptionHighlighted)}
            onMouseEnter={() => setHighlightedIndex(i)}
            onPointerDown={e => e.preventDefault()}
            onClick={() => selectLanguage(key)}
          >
            {name}
          </div>
        ))}
      </Dropdown.Menu>
    </Dropdown>
  )
}

function CodeActionMenuContainer ({ anchorElem }) {
  const [editor] = useLexicalComposerContext()
  const [lang, setLang] = useState('')
  const [isShown, setShown] = useState(false)
  const [shouldListenMouseMove, setShouldListenMouseMove] = useState(false)
  const [position, setPosition] = useState({ right: '0', top: '0' })
  const isEditable = useLexicalEditable()
  const codeSetRef = useRef(new Set())
  const codeDOMNodeRef = useRef(null)
  const isEditingLangRef = useRef(false)
  const rafRef = useRef(null)
  const mouseEventRef = useRef(null)

  const getCodeContent = useCallback(() => {
    const domNode = codeDOMNodeRef.current
    if (!domNode) return ''
    let content = ''
    editor.read(() => {
      const codeNode = getCodeNodeFromDOMNode(domNode)
      if (codeNode) content = codeNode.getTextContent()
    })
    return content
  }, [editor])

  const handleMouseMove = useCallback((event) => {
    const { codeDOMNode, isOutside } = getMouseInfo(event)
    if (isOutside) {
      if (!isEditingLangRef.current) setShown(false)
      return
    }
    if (!codeDOMNode) return

    codeDOMNodeRef.current = codeDOMNode

    let codeNode = null
    let nodeLang = ''
    editor.read(() => {
      codeNode = getCodeNodeFromDOMNode(codeDOMNode)
      if (codeNode) nodeLang = codeNode.getLanguage() || ''
    })

    if (codeNode) {
      const { y: editorY, right: editorRight } = anchorElem.getBoundingClientRect()
      const { y, right } = codeDOMNode.getBoundingClientRect()
      setLang(nodeLang)
      setShown(true)
      setPosition({
        right: `${editorRight - right + CODE_PADDING}px`,
        top: `${y - editorY}px`
      })
    }
  }, [anchorElem, editor])

  useEffect(() => {
    if (!shouldListenMouseMove) return

    const onMouseMove = (event) => {
      mouseEventRef.current = event
      if (rafRef.current) return

      rafRef.current = window.requestAnimationFrame(() => {
        rafRef.current = null
        if (mouseEventRef.current) handleMouseMove(mouseEventRef.current)
      })
    }

    document.addEventListener('mousemove', onMouseMove)
    return () => {
      setShown(false)
      mouseEventRef.current = null
      if (rafRef.current) {
        window.cancelAnimationFrame(rafRef.current)
        rafRef.current = null
      }
      document.removeEventListener('mousemove', onMouseMove)
    }
  }, [shouldListenMouseMove, handleMouseMove])

  // track code node mutations to toggle mouse listener
  useEffect(() => {
    return editor.registerMutationListener(
      CodeNode,
      (mutations) => {
        editor.getEditorState().read(() => {
          for (const [key, type] of mutations) {
            if (type === 'created') codeSetRef.current.add(key)
            else if (type === 'destroyed') codeSetRef.current.delete(key)
          }
        })
        setShouldListenMouseMove(codeSetRef.current.size > 0)
      },
      { skipInitialization: false }
    )
  }, [editor])

  return (
    <>
      {isShown && (
        <span className={codeStyles.codeActionMenuContainer} style={position}>
          {isEditable
            ? (
              <LanguageSelector
                lang={lang}
                editor={editor}
                codeDOMNodeRef={codeDOMNodeRef}
                isEditingRef={isEditingLangRef}
                onLanguageChange={setLang}
              />
              )
            : <span className={codeStyles.codeActionLanguage}>{getLanguageFriendlyName(lang)}</span>}
          <CopyButton icon value={getCodeContent()} />
        </span>
      )}
    </>
  )
}

export default function CodeActionMenuPlugin ({ anchorElem = document.body }) {
  if (!anchorElem) return null
  return createPortal(<CodeActionMenuContainer anchorElem={anchorElem} />, anchorElem)
}
