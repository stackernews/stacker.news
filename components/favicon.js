import { createContext, useContext, useMemo, useState } from 'react'
import { useHasNewNotes } from './use-has-new-notes'
import Head from 'next/head'

const FAVICONS = {
  default: '/favicon.png',
  notify: '/favicon-notify.png',
  comments: '/favicon-comments.png',
  notifyWithComments: '/favicon-notify-with-comments.png'
}

const getFavicon = (hasNewNotes, hasNewComments) => {
  if (hasNewNotes && hasNewComments) return FAVICONS.notifyWithComments
  if (hasNewNotes) return FAVICONS.notify
  if (hasNewComments) return FAVICONS.comments
  return FAVICONS.default
}

export const FaviconContext = createContext()

export default function FaviconProvider ({ children }) {
  const hasNewNotes = useHasNewNotes()
  const [hasNewComments, setHasNewComments] = useState(false)

  const favicon = useMemo(() =>
    getFavicon(hasNewNotes, hasNewComments),
  [hasNewNotes, hasNewComments])

  const contextValue = useMemo(() => ({
    favicon,
    hasNewNotes,
    hasNewComments,
    setHasNewComments
  }), [favicon, hasNewNotes, hasNewComments, setHasNewComments])

  return (
    <FaviconContext.Provider value={contextValue}>
      <Head>
        <link rel='shortcut icon' href={favicon} />
      </Head>
      {children}
    </FaviconContext.Provider>
  )
}

export function useFavicon () {
  return useContext(FaviconContext)
}
