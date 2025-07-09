import { HAS_NOTIFICATIONS } from '@/fragments/notifications'
import { NORMAL_POLL_INTERVAL, SSR } from '@/lib/constants'
import { useQuery } from '@apollo/client'
import React, { useContext } from 'react'

export const HasNewNotesContext = React.createContext(false)

export function HasNewNotesProvider ({ me, children }) {
  const { data } = useQuery(HAS_NOTIFICATIONS,
    SSR
      ? {}
      : {
          pollInterval: NORMAL_POLL_INTERVAL,
          nextFetchPolicy: 'cache-and-network',
          onCompleted: ({ hasNewNotes }) => {
            if (!hasNewNotes) {
              window.navigator.clearAppBadge?.()
            }
          }
        })

  return (
    <HasNewNotesContext.Provider value={!!data?.hasNewNotes}>
      {children}
    </HasNewNotesContext.Provider>
  )
}

export function useHasNewNotes () {
  return useContext(HasNewNotesContext)
}
