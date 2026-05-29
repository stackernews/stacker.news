import { createContext, useContext, useMemo, useState } from 'react'
import { useHasNewNotes } from './use-has-new-notes'
import Head from 'next/head'
import { useBranding } from './territory-branding'
import { PUBLIC_MEDIA_URL } from '@/lib/constants'

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
  const branding = useBranding()
  const hasNewNotes = useHasNewNotes()
  const [hasNewComments, setHasNewComments] = useState(false)

  const brandFavicon = branding?.faviconId
    ? `${PUBLIC_MEDIA_URL}/${branding.faviconId}`
    : null

  const favicon = useMemo(() => {
    // if a custom favicon is set, exclusively use it
    // XXX: notification and new comment flavors are not available for custom domains
    if (brandFavicon) return brandFavicon
    return getFavicon(hasNewNotes, hasNewComments)
  }, [hasNewNotes, hasNewComments, brandFavicon])

  const contextValue = useMemo(() => ({
    favicon,
    hasNewNotes,
    hasNewComments,
    setHasNewComments
  }), [favicon, hasNewNotes, hasNewComments, setHasNewComments])

  return (
    <FaviconContext.Provider value={contextValue}>
      <Head>
        <link rel='icon' href={favicon} />
      </Head>
      {children}
    </FaviconContext.Provider>
  )
}

export function useFavicon () {
  return useContext(FaviconContext)
}
