import Button from 'react-bootstrap/Button'
import InputGroup from 'react-bootstrap/InputGroup'
import React, { useState, useRef, useEffect, useCallback } from 'react'
import { Form, Input, SubmitButton } from './form'
import { useMe } from './me'
import UpBolt from '@/svgs/bolt.svg'
import { amountSchema } from '@/lib/validate'
import { nextTip, defaultTipIncludingRandom } from './upvote'
import { ZAP_UNDO_DELAY_MS, ZAP_DEBOUNCE_MS } from '@/lib/constants'
import { ACT_MUTATION } from '@/fragments/payIn'
import { meAnonSats } from '@/lib/apollo'
import { useHasSendWallet } from '@/wallets/client/hooks'
import { useAnimation } from '@/components/animation'
import usePayInMutation from '@/components/payIn/hooks/use-pay-in-mutation'
import { satsToMsats } from '@/lib/format'
import { composeCallbacks } from '@/lib/compose-callbacks'
import { useApolloClient, gql } from '@apollo/client'

const defaultTips = [100, 1000, 10_000, 100_000]

const Tips = ({ setOValue }) => {
  const customTips = getCustomTips()
  const defaultNoCustom = defaultTips.filter(d => !customTips.includes(d))
  const tips = [...customTips, ...defaultNoCustom].slice(0, 7).sort((a, b) => a - b)

  return tips.map((num, i) =>
    <Button
      size='sm'
      key={num}
      onClick={() => { setOValue(num) }}
    >
      <UpBolt
        className='me-1'
        width={14}
        height={14}
      />{num}
    </Button>)
}

const getCustomTips = () => JSON.parse(window.localStorage.getItem('custom-tips')) || []

const addCustomTip = (amount) => {
  const customTips = Array.from(new Set([amount, ...getCustomTips()])).slice(0, 7)
  window.localStorage.setItem('custom-tips', JSON.stringify(customTips))
}

const setItemMeAnonSats = ({ id, amount }) => {
  const reactiveVar = meAnonSats[id]
  const existingAmount = reactiveVar()
  reactiveVar(existingAmount + amount)

  // save for next page load
  const storageKey = `TIP-item:${id}`
  window.localStorage.setItem(storageKey, existingAmount + amount)
}

export default function ItemAct ({ onClose, item, act = 'TIP', step, children, abortSignal }) {
  const inputRef = useRef(null)
  const { me } = useMe()
  const hasSendWallet = useHasSendWallet()
  const [oValue, setOValue] = useState()

  useEffect(() => {
    inputRef.current?.focus()
  }, [onClose, item.id])

  const actor = useAct()
  const animate = useAnimation()

  const onSubmit = useCallback(async ({ amount }) => {
    if (abortSignal && zapUndoTrigger({ me, amount })) {
      onClose?.()
      try {
        await abortSignal.pause({ me, amount })
      } catch (error) {
        if (error instanceof ActCanceledError) {
          return
        }
      }
    }

    const onPaid = (cache, { data } = {}) => {
      animate()
      onClose?.()
      if (!me) setItemMeAnonSats({ id: item.id, amount })
    }

    const options = {}
    if (hasSendWallet || me?.privates?.sats > Number(amount)) {
      onPaid()
    } else {
      // we want to close the modal only after paid so the modal can stack
      options.cachePhases = { onPaid }
    }

    const { error } = await actor({
      variables: {
        id: item.id,
        sats: Number(amount),
        act,
        hasSendWallet
      },
      optimisticResponse: me
        ? {
            payInType: act === 'DONT_LIKE_THIS' ? 'DOWN_ZAP' : act === 'BOOST' ? 'BOOST' : 'ZAP',
            mcost: satsToMsats(Number(amount)),
            payerPrivates: {
              result: { path: item.path, id: item.id, sats: Number(amount), act, __typename: 'ItemAct' }
            }
          }
        : undefined,
      // don't close modal immediately because we want the QR modal to stack
      ...options
    })
    if (error) throw error
    addCustomTip(Number(amount))
  }, [me, actor, hasSendWallet, act, item.id, onClose, abortSignal, animate])

  return (
    <Form
      initial={{
        amount: defaultTipIncludingRandom(me?.privates) || defaultTips[0]
      }}
      schema={amountSchema}
      onSubmit={onSubmit}
    >
      <Input
        label='amount'
        name='amount'
        type='number'
        innerRef={inputRef}
        overrideValue={oValue}
        step={step}
        required
        autoFocus
        append={<InputGroup.Text className='text-monospace'>sats</InputGroup.Text>}
      />

      <div className='d-flex flex-wrap gap-2'>
        <Tips setOValue={setOValue} />
      </div>
      <div className='d-flex mt-3'>
        <SubmitButton variant={act === 'DONT_LIKE_THIS' ? 'danger' : 'success'} className='ms-auto mt-1 px-4' value={act}>
          {act === 'DONT_LIKE_THIS' ? 'downzap' : act === 'BOOST' ? 'boost' : 'zap'}
        </SubmitButton>
      </div>
      {children}
    </Form>
  )
}

export function modifyActCache (cache, { payerPrivates, payOutBolt11Public }, me) {
  const result = payerPrivates?.result
  if (!result) return
  const { id, sats, act } = result
  const p2p = !!payOutBolt11Public

  cache.modify({
    id: `Item:${id}`,
    fields: {
      sats (existingSats = 0) {
        if (act === 'TIP') {
          return existingSats + sats
        }
        return existingSats
      },
      credits (existingCredits = 0) {
        if (act === 'TIP' && !p2p) {
          return existingCredits + sats
        }
        return existingCredits
      },
      meSats: (existingSats = 0) => {
        if (act === 'TIP' && me) {
          return existingSats + sats
        }
        return existingSats
      },
      meCredits: (existingCredits = 0) => {
        if (act === 'TIP' && !p2p && me) {
          return existingCredits + sats
        }
        return existingCredits
      },
      meDontLikeSats: (existingSats = 0) => {
        if (act === 'DONT_LIKE_THIS') {
          return existingSats + sats
        }
        return existingSats
      },
      downSats: (existingSats = 0) => {
        if (act === 'DONT_LIKE_THIS') {
          return existingSats + sats
        }
        return existingSats
      },
      boost: (existingBoost = 0) => {
        if (act === 'BOOST') {
          return existingBoost + sats
        }
        return existingBoost
      }
    },
    optimistic: true
  })
}

// doing this onPaid fixes issue #1695 because optimistically updating all ancestors
// conflicts with the writeQuery on navigation from SSR
export function updateAncestors (cache, { payerPrivates, payOutBolt11Public }) {
  const result = payerPrivates?.result
  if (!result) return
  const { id, sats, act, path } = result
  const p2p = !!payOutBolt11Public

  if (act === 'TIP') {
    // update all ancestors
    path.split('.').forEach(aId => {
      if (Number(aId) === Number(id)) return
      cache.modify({
        id: `Item:${aId}`,
        fields: {
          commentCredits (existingCommentCredits = 0) {
            if (p2p) {
              return existingCommentCredits
            }
            return existingCommentCredits + sats
          },
          commentSats (existingCommentSats = 0) {
            return existingCommentSats + sats
          }
        },
        optimistic: true
      })
    })
  }
  if (act === 'DONT_LIKE_THIS') {
    // update all ancestors
    path.split('.').forEach(aId => {
      if (Number(aId) === Number(id)) return
      cache.modify({
        id: `Item:${aId}`,
        fields: {
          commentDownSats (existingCommentDownSats = 0) {
            return existingCommentDownSats + sats
          }
        },
        optimistic: true
      })
    })
  }
  if (act === 'BOOST') {
    // update all ancestors
    path.split('.').forEach(aId => {
      if (Number(aId) === Number(id)) return
      cache.modify({
        id: `Item:${aId}`,
        fields: {
          commentBoost (existingCommentBoost = 0) {
            return existingCommentBoost + sats
          }
        },
        optimistic: true
      })
    })
  }
}

export function getActCachePhases (me) {
  return {
    onMutationResult: (cache, { data }) => {
      const response = Object.values(data)[0]
      if (!response) return
      modifyActCache(cache, response, me)
    },
    onPayError: (e, cache, { data }) => {
      const response = Object.values(data)[0]
      if (!response?.payerPrivates?.result) return
      const { payerPrivates: { result: { sats } } } = response
      const negate = { ...response, payerPrivates: { ...response.payerPrivates, result: { ...response.payerPrivates.result, sats: -1 * sats } } }
      modifyActCache(cache, negate, me)
    },
    onPaid: (cache, { data }) => {
      const response = Object.values(data)[0]
      if (!response) return
      updateAncestors(cache, response)
    }
  }
}

export function useAct ({ query = ACT_MUTATION, ...options } = {}) {
  const { me } = useMe()
  const hasSendWallet = useHasSendWallet()
  const phases = getActCachePhases(me)
  const { cachePhases: callerCachePhases = {}, ...restOptions } = options

  const [act] = usePayInMutation(query, {
    waitFor: payIn =>
      // if we have attached wallets, we might be paying a wrapped invoice in which case we need to make sure
      // we don't prematurely consider the payment as successful (important for receiver fallbacks)
      hasSendWallet
        ? payIn?.payInState === 'PAID'
        : ['FORWARDING', 'PAID'].includes(payIn?.payInState),
    ...restOptions,
    cachePhases: {
      ...callerCachePhases,
      onMutationResult: composeCallbacks(phases.onMutationResult, callerCachePhases.onMutationResult),
      // If the initial mutation response had no result payload, run the direct-item
      // cache modification now so optimistic and pessimistic paths converge.
      onPaidMissingResult: composeCallbacks(phases.onMutationResult, callerCachePhases.onPaidMissingResult),
      onPayError: composeCallbacks(phases.onPayError, callerCachePhases.onPayError),
      onPaid: composeCallbacks(phases.onPaid, callerCachePhases.onPaid)
    }
  })
  return act
}

const ZAP_ME_SATS_FRAGMENT = gql`
  fragment ZapMeSats on Item { meSats }
`

export function useZap () {
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
  const [sendZap] = usePayInMutation(ACT_MUTATION, {
    waitFor: payIn =>
      hasSendWallet
        ? payIn?.payInState === 'PAID'
        : ['FORWARDING', 'PAID'].includes(payIn?.payInState)
  })

  // fire the accumulated zap mutation for a buffer entry
  const fireZap = useCallback(async (entry) => {
    const { totalSats, item, me: entryMe } = entry
    try {
      const { error } = await sendZap({
        variables: { id: item.id, sats: totalSats, act: 'TIP', hasSendWallet },
        // no optimisticResponse — cache is already updated via modifyActCache
        cachePhases: {
          // onMutationResult: omitted — cache is already correct from per-click modifyActCache
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
            })
          },
          onPayError: (e, cache) => {
            // revert the entire accumulated amount — use entryMe (click-time identity)
            modifyActCache(cache, {
              payerPrivates: { result: { id: item.id, sats: -totalSats, act: 'TIP' } }
            }, entryMe)
          }
        }
      })
      if (error) {
        console.error('debounced zap error:', error)
      }
    } catch (error) {
      console.error('debounced zap failed:', error)
    }
  }, [sendZap, hasSendWallet])

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
    // read latest meSats from cache to avoid stale props between rapid clicks
    const cached = client.cache.readFragment({
      id: `Item:${item.id}`,
      fragment: ZAP_ME_SATS_FRAGMENT
    })
    const meSats = cached?.meSats ?? item?.meSats ?? 0
    const sats = nextTip(meSats, { ...meProp?.privates })

    // instant visual feedback — write directly to root cache (not an optimistic layer)
    modifyActCache(client.cache, {
      payerPrivates: { result: { id: item.id, sats, act: 'TIP', path: item.path } }
    }, meProp)

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
          await new Promise((resolve, reject) => {
            const abortHandler = () => {
              reject(new ActCanceledError())
              controller.signal.removeEventListener('abort', abortHandler)
            }
            controller.signal.addEventListener('abort', abortHandler)
            setTimeout(() => {
              resolve()
              controller.signal.removeEventListener('abort', abortHandler)
            }, ZAP_UNDO_DELAY_MS)
          })
        } catch (error) {
          if (error instanceof ActCanceledError) {
            // user canceled — revert all accumulated cache changes
            modifyActCache(client.cache, {
              payerPrivates: { result: { id: savedItem.id, sats: -totalSats, act: 'TIP', path: savedItem.path } }
            }, meProp)
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
  }, [client, animate, fireZap])

  // cancel: abort undo + revert accumulated cache changes + clear debounce timer
  const cancel = useCallback(() => {
    // abort undo if active
    if (undoControllerRef.current) {
      undoControllerRef.current.abort()
      undoControllerRef.current = null
    }

    // clear all debounce timers and revert cache — use entry.me (click-time identity)
    for (const [, entry] of bufferRef.current) {
      clearTimeout(entry.timer)
      modifyActCache(client.cache, {
        payerPrivates: { result: { id: entry.item.id, sats: -entry.totalSats, act: 'TIP', path: entry.item.path } }
      }, entry.me)
    }
    bufferRef.current.clear()

    if (mountedRef.current) setUndoPending(0)
  }, [client])

  return { zap, pending: undoPending, cancel }
}

export class ActCanceledError extends Error {
  constructor () {
    super('act canceled')
    this.name = 'ActCanceledError'
  }
}

export class ZapUndoController extends AbortController {
  constructor ({ onStart = () => {}, onDone = () => {} }) {
    super()
    this.signal.start = onStart
    this.signal.done = onDone
    this.signal.pause = async ({ me, amount }) => {
      if (zapUndoTrigger({ me, amount })) {
        await zapUndo(this.signal, amount)
      }
    }
  }
}

const zapUndoTrigger = ({ me, amount }) => {
  if (!me) return false
  const enabled = me.privates.zapUndos !== null
  return enabled ? amount >= me.privates.zapUndos : false
}

const zapUndo = async (signal, amount) => {
  return await new Promise((resolve, reject) => {
    signal.start(amount)
    const abortHandler = () => {
      reject(new ActCanceledError())
      signal.done()
      signal.removeEventListener('abort', abortHandler)
    }
    signal.addEventListener('abort', abortHandler)
    setTimeout(() => {
      resolve()
      signal.done()
      signal.removeEventListener('abort', abortHandler)
    }, ZAP_UNDO_DELAY_MS)
  })
}
