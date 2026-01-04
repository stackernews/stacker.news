import { useLexicalRegistry } from '@/components/editor/contexts/lexical'
import { useEffect, useRef } from 'react'
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'

export default function RegisterEditorPlugin ({ itemId, preview }) {
  const [editor] = useLexicalComposerContext()
  const isEditable = editor.isEditable()
  const editorRef = useRef(null)
  const { register, unregister } = useLexicalRegistry()

  useEffect(() => {
    const key = `${itemId ? `${itemId}-` : ''}${isEditable ? 'editor' : preview ? 'editor-preview' : 'reader'}`
    editorRef.current = editor
    console.log('registering editor', key, editorRef)
    register(key, editorRef)

    return () => {
      console.log('unregistering editor', key)
      unregister(key)
    }
  }, [itemId, isEditable, editor, register, unregister, preview])

  return null
}
