import { gql, useApolloClient } from '@apollo/client'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useAnimation } from '@/components/animation'
import usePayInMutation from '@/components/payIn/hooks/use-pay-in-mutation'
import { ACT_MUTATION } from '@/fragments/payIn'
import { ZAP_DEBOUNCE_MS } from '@/lib/constants'
import { useHasSendWallet } from '@/wallets/client/hooks'
import { ActCanceledError, modifyActCache, updateAncestors, zapUndo, zapUndoTrigger } from './item-act'

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

  // direct mutation — bypasses useAct to avoid double cache writes from getActCachePhases
  // waitFor is passed per-call in fireZap so debounce timer always uses latest hasSendWallet
  const [sendZap] = usePayInMutation(ACT_MUTATION)

  // fire the accumulated zap mutation for a buffer entry
  const fireZap = useCallback(async (entry) => {
    const { totalSats, item, me: entryMe } = entry
    try {
      const { error } = await sendZap({
        variables: { id: item.id, sats: totalSats, act: 'TIP', hasSendWallet },
        // pass waitFor per-call so debounce timer always uses latest hasSendWallet
        waitFor: payIn =>
          hasSendWallet
            ? payIn?.payInState === 'PAID'
            : ['FORWARDING', 'PAID'].includes(payIn?.payInState),
        // no optimisticResponse — cache is already updated via modifyActCache
        cachePhases: {
          // sats/meSats already correct from per-click modifyActCache.
          // Pre-mutation write assumed P2P (skipped credits). If actually non-P2P, add credits now.
          onMutationResult: (cache, { data }) => {
            const response = Object.values(data)[0]
            if (response?.payOutBolt11Public) return // actually P2P — credits correctly skipped
            // non-P2P — add the credit increment
            cache.modify({
              id: `Item:${item.id}`,
              fields: {
                credits: (existing = 0) => existing + totalSats,
                meCredits: (existing = 0) => existing + totalSats
              },
              optimistic: true // inside update() context
            })
          },
          onPaid: (cache, { data }) => {
            const response = Object.values(data)[0]
            if (!response) return
            // build a synthetic response with our accumulated sats for ancestor updates
            updateAncestors(cache, {
              ...response,
              payerPrivates: {
                ...response.payerPrivates,
                result: { id: item.id, sats: totalSats, act: 'TIP', path: item.path, __typename: 'ItemAct' }
              }
            }, { optimistic: false })
          },
          onPayError: (e, cache, { data }) => {
            // revert using real payOutBolt11Public so credit rollback is symmetric:
            // if non-P2P, onMutationResult added credits → need to subtract them
            // if P2P, credits were never added → skip credit subtraction
            const response = Object.values(data)[0]
            modifyActCache(cache, {
              payerPrivates: { result: { id: item.id, sats: -totalSats, act: 'TIP' } },
              payOutBolt11Public: response?.payOutBolt11Public
            }, entryMe, { optimistic: false })
          }
        }
      })
      if (error) {
        // mutation returned an error (GraphQL-level) — revert cache
        // mirror initial P2P assumption (credits were never added)
        console.error('debounced zap error:', error)
        modifyActCache(client.cache, {
          payerPrivates: { result: { id: item.id, sats: -totalSats, act: 'TIP', path: item.path } },
          payOutBolt11Public: true
        }, entryMe, { optimistic: false })
      }
    } catch (error) {
      // mutation threw (network error, etc.) — revert cache
      // mirror initial P2P assumption (credits were never added)
      console.error('debounced zap failed:', error)
      modifyActCache(client.cache, {
        payerPrivates: { result: { id: item.id, sats: -totalSats, act: 'TIP', path: item.path } },
        payOutBolt11Public: true
      }, entryMe, { optimistic: false })
    }
  }, [client, sendZap, hasSendWallet])

  // flush all pending debounced zaps (used on unmount)
  // stored in a ref so the cleanup effect has stable deps (only runs on unmount)
  const flushAllRef = useRef(null)
  flushAllRef.current = () => {
    for (const [, entry] of bufferRef.current) {
      clearTimeout(entry.timer)
      fireZap(entry)
    }
    bufferRef.current.clear()
  }

  // cleanup: flush pending zaps on unmount so we don't lose them
  // empty deps — only runs on mount/unmount, uses ref for latest flushAll
  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      flushAllRef.current?.()
    }
  }, [])

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

    // instant visual feedback — write directly to root cache (not an optimistic layer)
    // pass payOutBolt11Public truthy to assume P2P (skip credits) — reconciled in onMutationResult
    modifyActCache(client.cache, {
      payerPrivates: { result: { id: item.id, sats, act: 'TIP', path: item.path } },
      payOutBolt11Public: true
    }, meProp, { optimistic: false })

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
            // user canceled — revert all accumulated cache changes
            // mirror initial P2P assumption (credits were never added)
            modifyActCache(client.cache, {
              payerPrivates: { result: { id: savedItem.id, sats: -totalSats, act: 'TIP', path: savedItem.path } },
              payOutBolt11Public: true
            }, meProp, { optimistic: false })
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

    // clear all debounce timers and revert cache — use entry.me (click-time identity)
    // mirror initial P2P assumption (credits were never added)
    for (const [, entry] of bufferRef.current) {
      clearTimeout(entry.timer)
      modifyActCache(client.cache, {
        payerPrivates: { result: { id: entry.item.id, sats: -entry.totalSats, act: 'TIP', path: entry.item.path } },
        payOutBolt11Public: true
      }, entry.me, { optimistic: false })
    }
    bufferRef.current.clear()

    if (mountedRef.current) setUndoPending(0)
  }, [client])

  return { zap, pending: undoPending, cancel }
}
