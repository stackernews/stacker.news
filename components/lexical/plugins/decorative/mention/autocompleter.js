import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import { $createTextNode, $getSelection, $isRangeSelection, $isTextNode, $isLineBreakNode, $isParagraphNode } from 'lexical'
import { useEffect, useState, useCallback } from 'react'
import { $createUserMentionNode, $isUserMentionNode } from '@/lib/lexical/nodes/decorative/mentions/user'
import { $createTerritoryMentionNode, $isTerritoryMentionNode } from '@/lib/lexical/nodes/decorative/mentions/territory'
import { $isMarkdownMode } from '@/lib/lexical/universal/utils'

function extractTextUpToCursor (selection) {
  const anchor = selection.anchor
  const anchorNode = anchor.getNode()

  if ($isTextNode(anchorNode)) {
    const fullText = anchorNode.getTextContent()
    const cursorOffset = anchor.offset

    // don't trigger autocomplete if cursor is in the middle of a word
    if (cursorOffset < fullText.length) {
      const charAfterCursor = fullText[cursorOffset]
      if (/[a-zA-Z0-9]/.test(charAfterCursor)) {
        return null
      }
    }

    let text = fullText.slice(0, cursorOffset)

    // walk backwards to handle spaces/punctuation
    let prev = anchorNode.getPreviousSibling()
    while (prev && !$isLineBreakNode(prev) && !$isParagraphNode(prev)) {
      if ($isTextNode(prev)) {
        text = prev.getTextContent() + text
      } else if ($isUserMentionNode(prev) || $isTerritoryMentionNode(prev)) {
        break
      }
      prev = prev.getPreviousSibling()
    }

    return text
  }
}

function checkForMentionPattern (text) {
  const mentionRegex = /(^|\s|\()([@~]\w{0,75})$/
  const match = mentionRegex.exec(text)

  if (match && match[2].length >= 2) {
    return {
      matchingString: match[2],
      query: match[2].slice(1), // remove @ or ~
      isUser: match[2].startsWith('@')
    }
  }

  return null
}

export default function useUniversalAutocomplete () {
  const [editor] = useLexicalComposerContext()
  const [entityData, setEntityData] = useState(null)

  const handleSelect = useCallback((item, isUser) => {
    editor.update(() => {
      const selection = $getSelection()
      if (!$isRangeSelection(selection)) return

      // remove trigger (@nym or ~territory)
      const anchor = selection.anchor
      const anchorNode = anchor.getNode()

      if ($isTextNode(anchorNode)) {
        const textContent = anchorNode.getTextContent()
        const cursorOffset = anchor.offset
        const matchLength = entityData.matchLength

        // split text node
        const beforeMatch = textContent.slice(0, cursorOffset - matchLength)
        const afterMatch = textContent.slice(cursorOffset)

        // composing the mention node
        // users: item has { id, name } structure
        // territories: same as users, without id
        console.log('item', item)
        const mentionNode = $isMarkdownMode()
          ? $createTextNode(`${isUser ? '@' : '~'}${item.name || item}`)
          : isUser
            ? $createUserMentionNode(item.id || item, item.name || item)
            : $createTerritoryMentionNode(item.name || item)

        // rebuilding the structure
        if (beforeMatch) {
          anchorNode.setTextContent(beforeMatch)
          anchorNode.insertAfter(mentionNode)
          if (afterMatch) {
            mentionNode.insertAfter($createTextNode(afterMatch))
          }
        } else if (afterMatch) {
          anchorNode.setTextContent(afterMatch)
          anchorNode.insertBefore(mentionNode)
        } else {
          anchorNode.replace(mentionNode)
        }

        // moving cursor after mention
        mentionNode.selectNext()
      }
    })

    setEntityData(null)
  }, [editor, entityData])

  useEffect(() => {
    return editor.registerUpdateListener(({ editorState }) => {
      editorState.read(() => {
        const selection = $getSelection()
        if (!$isRangeSelection(selection) || !selection.isCollapsed()) {
          setEntityData(null)
          return
        }

        const textUpToCursor = extractTextUpToCursor(selection)
        const match = checkForMentionPattern(textUpToCursor)

        if (match) {
          // calculate dropdown position from DOM
          const domSelection = window.getSelection()
          const range = domSelection.getRangeAt(0)
          const rect = range.getBoundingClientRect()

          setEntityData({
            query: match.query,
            isUser: match.isUser,
            matchLength: match.matchingString.length,
            style: {
              position: 'absolute',
              top: `${rect.bottom + window.scrollY}px`,
              left: `${rect.left + window.scrollX}px`
            }
          })
        } else {
          setEntityData(null)
        }
      })
    })
  }, [editor])

  return {
    entityData,
    handleSelect
  }
}
