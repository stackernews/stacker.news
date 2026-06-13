import { gql } from '@apollo/client'
import { useApolloClient } from '@apollo/client/react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useAnimation } from '@/components/animation'
import usePayInMutation from '@/components/payIn/hooks/use-pay-in-mutation'
import { ACT_MUTATION } from '@/fragments/payIn'
import { ZAP_DEBOUNCE_MS } from '@/lib/constants'
import { useHasSendWallet } from '@/wallets/client/hooks'
import { isTransientNetworkError } from '@/wallets/client/errors'
import { ActCanceledError, bumpActCache, getActCachePhases, revertActBump, zapUndo, zapUndoTrigger } from './item-act'
import { actWaitFor } from '@/lib/pay-in'

const ZAP_ME_SATS_FRAGMENT = gql`
  fragment ZapMeSats on Item { meSats }
`

export function useZap ({ nextTip }) {
  const hasSendWallet = useHasSendWallet()
  const client = useApolloClient()
  const animate = useAnimation()

  // per-item accumulation buffer: itemId -> { totalSats, timer, item }
  const bufferRef = useRef(new Map())
  // undo state — exposed via return value for bolt UI
  const [undoPending, setUndoPending] = useState(0)
  const undoControllerRef = useRef(null)
  const mountedRef = useRef(true)
  const fireZapRef = useRef()
  const flushAllRef = useRef()

  // direct mutation — bypasses useAct to avoid double cache writes from getActCachePhases
  // waitFor is passed per-call in fireZap so debounce timer always uses latest send-wallet availability
  const [sendZap] = usePayInMutation(ACT_MUTATION)

  // fire the accumulated zap mutation for a buffer entry
  fireZapRef.current = async (entry) => {
    const { totalSats, item, me: entryMe } = entry
    // the per-click bumps already wrote sats to the root cache; the act phases reconcile credits,
    // ancestors, and the reversal off the response (its result.sats equals totalSats). entryMe is
    // the click-time identity. no optimisticResponse — the bump is the optimistic write.
    const result = { id: item.id, sats: totalSats, act: 'TIP', path: item.path }
    try {
      const { error } = await sendZap({
        variables: { id: item.id, sats: totalSats, act: 'TIP' },
        // waitFor passed per-call so the debounce timer uses the latest send-wallet availability
        waitFor: actWaitFor(hasSendWallet),
        cachePhases: getActCachePhases(entryMe)
      })
      // a returned error has a payIn (getActCachePhases.onPayError reverted it); just log
      if (error) console.error('debounced zap error:', error)
    } catch (error) {
      if (isTransientNetworkError(error)) {
        // a gateway timeout means the zap is likely still being processed (it falls back to credits
        // or persists and auto-retries) — keep the optimistic bump instead of reverting it
        console.warn('debounced zap timed out (still processing):', error)
      } else {
        // mutation threw before creating a payIn — no phase reverts, so undo the bump here
        console.error('debounced zap failed:', error)
        revertActBump(client.cache, result, entryMe)
      }
    }
  }
  const fireZap = useCallback((entry) => fireZapRef.current(entry), [])

  // flush all pending debounced zaps (used on unmount)
  flushAllRef.current = () => {
    for (const [, entry] of bufferRef.current) {
      clearTimeout(entry.timer)
      fireZap(entry)
    }
    bufferRef.current.clear()
  }
  const flushAll = useCallback(() => flushAllRef.current(), [])

  // cleanup: flush pending zaps on unmount so we don't lose them
  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      flushAll()
    }
  }, [flushAll])

  // the per-click zap function — synchronous from the caller's perspective
  const zap = useCallback(({ item, me: meProp }) => {
    if (!nextTip) return

    // read latest meSats from cache to avoid stale props between rapid clicks
    const cached = client.cache.readFragment({
      id: `Item:${item.id}`,
      fragment: ZAP_ME_SATS_FRAGMENT
    })
    const meSats = cached?.meSats ?? item?.meSats ?? 0
    const sats = nextTip(meSats, { ...meProp?.privates })

    // instant visual feedback — bump the root cache (survives navigation; credits reconciled by
    // the act phases on the mutation response)
    bumpActCache(client.cache, { id: item.id, sats, act: 'TIP', path: item.path }, meProp)

    animate()

    // accumulate
    let entry = bufferRef.current.get(item.id)
    if (entry) {
      entry.totalSats += sats
      clearTimeout(entry.timer)
    } else {
      entry = { totalSats: sats, item, me: meProp }
      bufferRef.current.set(item.id, entry)
    }

    // debounce — fire after ZAP_DEBOUNCE_MS of inactivity
    entry.timer = setTimeout(async () => {
      const { totalSats, item: savedItem } = entry
      bufferRef.current.delete(savedItem.id)

      // zap undo check on the accumulated total
      if (zapUndoTrigger({ me: meProp, amount: totalSats })) {
        // show undo UI
        if (mountedRef.current) setUndoPending(totalSats)
        const controller = new AbortController()
        undoControllerRef.current = controller

        try {
          await zapUndo(controller.signal, totalSats)
        } catch (error) {
          if (error instanceof ActCanceledError) {
            // user canceled before the mutation fired — undo the accumulated bump
            revertActBump(client.cache, { id: savedItem.id, sats: totalSats, act: 'TIP', path: savedItem.path }, meProp)
            if (mountedRef.current) setUndoPending(0)
            undoControllerRef.current = null
            return
          }
        }

        if (mountedRef.current) setUndoPending(0)
        undoControllerRef.current = null
      }

      // fire the single accumulated mutation
      await fireZap({ totalSats, item: savedItem, me: meProp })
    }, ZAP_DEBOUNCE_MS)
  }, [client, animate, fireZap, nextTip])

  // cancel: abort undo + revert accumulated cache changes + clear debounce timer
  const cancel = useCallback(() => {
    // abort undo if active
    if (undoControllerRef.current) {
      undoControllerRef.current.abort()
      undoControllerRef.current = null
    }

    // clear all debounce timers and undo each pending bump — use entry.me (click-time identity)
    for (const [, entry] of bufferRef.current) {
      clearTimeout(entry.timer)
      revertActBump(client.cache, { id: entry.item.id, sats: entry.totalSats, act: 'TIP', path: entry.item.path }, entry.me)
    }
    bufferRef.current.clear()

    if (mountedRef.current) setUndoPending(0)
  }, [client])

  return { zap, pending: undoPending, cancel }
}
