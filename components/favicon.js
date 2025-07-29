import { createContext, useContext, useMemo, useState } from 'react'
import { useHasNewNotes } from './use-has-new-notes'
import Head from 'next/head'

const FAVICONS = {
  default: '/favicon.png',
  notify: '/favicon-notify.png',
  comments: '/favicon-comments.png',
  notifyWithComments: '/favicon-notify-with-comments.png'
}

const getFavicon = (hasNewNotes, hasLiveComments) => {
  if (hasNewNotes && hasLiveComments.length > 0) return FAVICONS.notifyWithComments
  if (hasNewNotes) return FAVICONS.notify
  if (hasLiveComments.length > 0) return FAVICONS.comments
  return FAVICONS.default
}

export const FaviconContext = createContext()

export function FaviconProvider ({ children }) {
  const hasNewNotes = useHasNewNotes()
  const [hasLiveComments, setHasLiveComments] = useState([])
  console.log('hasLiveComments', hasLiveComments)

  const favicon = useMemo(() =>
    getFavicon(hasNewNotes, hasLiveComments),
  [hasNewNotes, hasLiveComments])

  const contextValue = useMemo(() => ({
    favicon,
    hasNewNotes,
    hasLiveComments,
    setHasLiveComments
  }), [favicon, hasNewNotes, hasLiveComments, setHasLiveComments])

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
