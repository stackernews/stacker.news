import { createContext, useContext, useMemo, useRef, useCallback, useState } from 'react'

export const LexicalRegistryContext = createContext()

export const LexicalProvider = ({ children }) => {
  const editors = useRef(new Map())
  const [editorVersion, setEditorVersion] = useState(0)

  const register = useCallback((key, editor) => {
    editors.current.set(key, editor)
    setEditorVersion(v => v + 1)
  }, [])

  const unregister = useCallback((key) => {
    editors.current.delete(key)
    setEditorVersion(v => v + 1)
  }, [])

  const getReader = useCallback((id) => {
    return editors.current.get(`${id ? `${id}-` : ''}reader`)?.current
  }, [editorVersion])

  const getEditor = useCallback((id) => {
    return editors.current.get(`${id ? `${id}-` : ''}editor`)?.current
  }, [editorVersion])

  const getAll = useCallback(() => {
    return Object.fromEntries(editors.current.entries())
  }, [editorVersion])

  const contextValue = useMemo(() => ({
    register,
    unregister,
    getReader,
    getEditor,
    getAll,
    editorVersion
  }), [register, unregister, getReader, getEditor, getAll, editorVersion])

  return (
    <LexicalRegistryContext.Provider value={contextValue}>
      {children}
    </LexicalRegistryContext.Provider>
  )
}

export const useLexicalRegistry = () => {
  return useContext(LexicalRegistryContext)
}

export const useEditor = (id) => {
  const { getEditor, editorVersion } = useLexicalRegistry()
  return useMemo(() => getEditor(id), [id, getEditor, editorVersion])
}

export const useReader = (id) => {
  const { getReader, editorVersion } = useLexicalRegistry()
  return useMemo(() => getReader(id), [id, getReader, editorVersion])
}
