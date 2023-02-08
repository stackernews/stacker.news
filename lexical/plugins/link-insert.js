import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import { $createTextNode, $getSelection, $insertNodes, $setSelection, COMMAND_PRIORITY_EDITOR, createCommand } from 'lexical'
import { $wrapNodeInElement, mergeRegister } from '@lexical/utils'
import { $createLinkNode, $isLinkNode } from '@lexical/link'
import { Modal } from 'react-bootstrap'
import React, { useState, useCallback, useContext, useRef, useEffect } from 'react'
import { Form, Input, SubmitButton } from '../../components/form'
import { ensureProtocol } from '../../lib/url'
import { getSelectedNode } from '../utils/selected-node'
import { namedUrlSchema } from '../../lib/validate'

export const INSERT_LINK_COMMAND = createCommand('INSERT_LINK_COMMAND')

export default function LinkInsertPlugin () {
  const [editor] = useLexicalComposerContext()

  useEffect(() => {
    return mergeRegister(
      editor.registerCommand(
        INSERT_LINK_COMMAND,
        (payload) => {
          const selection = $getSelection()
          const node = getSelectedNode(selection)
          const parent = node.getParent()
          if ($isLinkNode(parent)) {
            parent.remove()
          } else if ($isLinkNode(node)) {
            node.remove()
          }
          const textNode = $createTextNode(payload.text)
          $insertNodes([textNode])
          const linkNode = $createLinkNode(payload.url)
          $wrapNodeInElement(textNode, () => linkNode)
          $setSelection(textNode.select())
          return true
        },
        COMMAND_PRIORITY_EDITOR
      )
    )
  }, [editor])

  return null
}

export const LinkInsertContext = React.createContext({
  link: null,
  setLink: () => {}
})

export function LinkInsertProvider ({ children }) {
  const [link, setLink] = useState(null)

  const contextValue = {
    link,
    setLink: useCallback(link => setLink(link), [])
  }

  return (
    <LinkInsertContext.Provider value={contextValue}>
      <LinkInsertModal />
      {children}
    </LinkInsertContext.Provider>
  )
}

export function useLinkInsert () {
  const { link, setLink } = useContext(LinkInsertContext)
  return { link, setLink }
}

export function LinkInsertModal () {
  const [editor] = useLexicalComposerContext()
  const { link, setLink } = useLinkInsert()
  const inputRef = useRef(null)

  useEffect(() => {
    if (link) {
      inputRef.current?.focus()
    }
  }, [link])

  return (
    <Modal
      show={!!link}
      onHide={() => {
        setLink(null)
        setTimeout(() => editor.focus(), 100)
      }}
    >
      <div
        className='modal-close' onClick={() => {
          setLink(null)
          // I think bootstrap messes with the focus on close so we have to do this ourselves
          setTimeout(() => editor.focus(), 100)
        }}
      >X
      </div>
      <Modal.Body>
        <Form
          initial={{
            text: link?.text,
            url: link?.url
          }}
          schema={namedUrlSchema}
          onSubmit={async ({ text, url }) => {
            editor.dispatchCommand(INSERT_LINK_COMMAND, { url: ensureProtocol(url), text })
            await setLink(null)
            setTimeout(() => editor.focus(), 100)
          }}
        >
          <Input
            label='text'
            name='text'
            innerRef={inputRef}
            required
          />
          <Input
            label='url'
            name='url'
            required
          />
          <div className='d-flex'>
            <SubmitButton variant='success' className='ml-auto mt-1 px-4'>ok</SubmitButton>
          </div>
        </Form>
      </Modal.Body>
    </Modal>
  )
}
