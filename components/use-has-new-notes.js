import { HAS_NOTIFICATIONS } from '@/fragments/notifications'
import { clearNotifications } from '@/lib/badge'
import { SSR } from '@/lib/constants'
import { useQuery } from '@apollo/client'
import React, { useContext } from 'react'

export const HasNewNotesContext = React.createContext(false)

export function HasNewNotesProvider ({ me, children }) {
  const { data } = useQuery(HAS_NOTIFICATIONS,
    SSR
      ? {}
      : {
          pollInterval: 30000,
          nextFetchPolicy: 'cache-and-network',
          onCompleted: ({ hasNewNotes }) => {
            if (!hasNewNotes) {
              clearNotifications()
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
