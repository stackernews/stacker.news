import { useApolloClient } from '@apollo/client'
import { useMe } from './me'
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { datePivot, timeSince } from '@/lib/time'
import { ANON_USER_ID, JIT_INVOICE_TIMEOUT_MS } from '@/lib/constants'
import { HAS_NOTIFICATIONS } from '@/fragments/notifications'
import Item from './item'
import { RootProvider } from './root'
import Comment from './comment'

const toType = t => ({ ERROR: `${t}_ERROR`, PENDING: `${t}_PENDING` })

export const Types = {
  Zap: toType('ZAP'),
  Reply: toType('REPLY'),
  Bounty: toType('BOUNTY'),
  PollVote: toType('POLL_VOTE')
}

const ClientNotificationContext = createContext()

export function ClientNotificationProvider ({ children }) {
  const [notifications, setNotifications] = useState([])
  const client = useApolloClient()
  const me = useMe()
  // anons don't have access to /notifications
  // but we'll store client notifications anyway for simplicity's sake
  const storageKey = `client-notifications:${me?.id || ANON_USER_ID}`

  useEffect(() => {
    const loaded = loadNotifications(storageKey, client)
    setNotifications(loaded)
  }, [storageKey])

  const notify = useCallback((type, props) => {
    const id = crypto.randomUUID()
    const sortTime = new Date()
    const expiresAt = +datePivot(sortTime, { milliseconds: JIT_INVOICE_TIMEOUT_MS })
    const isError = type.endsWith('ERROR')
    const n = { __typename: type, id, sortTime: +sortTime, pending: !isError, expiresAt, ...props }

    setNotifications(notifications => [n, ...notifications])
    saveNotification(storageKey, n)

    if (isError) {
      client?.writeQuery({
        query: HAS_NOTIFICATIONS,
        data: {
          hasNewNotes: true
        }
      })
    }

    return id
  }, [storageKey, client])

  const unnotify = useCallback((id) => {
    setNotifications(notifications => notifications.filter(n => n.id !== id))
    removeNotification(storageKey, id)
  }, [storageKey])

  const value = useMemo(() => ({ notifications, notify, unnotify }), [notifications, notify, unnotify])
  return (
    <ClientNotificationContext.Provider value={value}>
      {children}
    </ClientNotificationContext.Provider>
  )
}

export function ClientNotifyProvider ({ children, additionalProps }) {
  const ctx = useClientNotifications()

  const notify = useCallback((type, props) => {
    return ctx.notify(type, { ...props, ...additionalProps })
  }, [ctx.notify])

  const value = useMemo(() => ({ ...ctx, notify }), [ctx, notify])
  return (
    <ClientNotificationContext.Provider value={value}>
      {children}
    </ClientNotificationContext.Provider>
  )
}

export function useClientNotifications () {
  return useContext(ClientNotificationContext)
}

function ClientNotification ({ n, message }) {
  if (n.pending) {
    const expired = n.expiresAt < +new Date()
    if (!expired) return null
    n.reason = 'invoice expired'
  }

  return (
    <div className='ms-2'>
      <small className='fw-bold text-danger'>
        {n.reason ? `${message}: ${n.reason}` : message}
        <small className='text-muted ms-1 fw-normal' suppressHydrationWarning>{timeSince(new Date(n.sortTime))}</small>
      </small>
      {!n.item
        ? null
        : n.item.title
          ? <Item item={n.item} />
          : (
            <div className='pb-2'>
              <RootProvider root={n.item.root}>
                <Comment item={n.item} noReply includeParent noComments clickToContext />
              </RootProvider>
            </div>
            )}
    </div>
  )
}

export function ClientZap ({ n }) {
  const message = `failed to zap ${n.sats || n.amount} sats`
  return <ClientNotification n={n} message={message} />
}

export function ClientReply ({ n }) {
  const message = 'failed to submit reply'
  return <ClientNotification n={n} message={message} />
}

export function ClientBounty ({ n }) {
  const message = 'failed to pay bounty'
  return <ClientNotification n={n} message={message} />
}

export function ClientPollVote ({ n }) {
  const message = 'failed to submit poll vote'
  return <ClientNotification n={n} message={message} />
}

function loadNotifications (storageKey, client) {
  const stored = window.localStorage.getItem(storageKey)
  if (!stored) return []

  const filtered = JSON.parse(stored).filter(({ sortTime }) => {
    // only keep notifications younger than 24 hours
    return new Date(sortTime) >= datePivot(new Date(), { hours: -24 })
  })

  let hasNewNotes = false
  const mapped = filtered.map((n) => {
    if (!n.pending) return n
    // anything that is still pending when we load the page was interrupted
    // so we immediately mark it as failed instead of waiting until it expired
    const type = n.__typename.replace('PENDING', 'ERROR')
    const reason = 'payment was interrupted'
    hasNewNotes = true
    return { ...n, __typename: type, pending: false, reason }
  })

  if (hasNewNotes) {
    client?.writeQuery({
      query: HAS_NOTIFICATIONS,
      data: {
        hasNewNotes: true
      }
    })
  }

  window.localStorage.setItem(storageKey, JSON.stringify(mapped))
  return filtered
}

function saveNotification (storageKey, n) {
  const stored = window.localStorage.getItem(storageKey)
  if (stored) {
    window.localStorage.setItem(storageKey, JSON.stringify([...JSON.parse(stored), n]))
  } else {
    window.localStorage.setItem(storageKey, JSON.stringify([n]))
  }
}

function removeNotification (storageKey, id) {
  const stored = window.localStorage.getItem(storageKey)
  if (stored) {
    window.localStorage.setItem(storageKey, JSON.stringify(JSON.parse(stored).filter(n => n.id !== id)))
  }
}
