import Button from 'react-bootstrap/Button'
import InputGroup from 'react-bootstrap/InputGroup'
import React, { useState, useRef, useEffect, useCallback } from 'react'
import { useApolloClient } from '@apollo/client/react'
import { Form, Input, SubmitButton } from './form'
import { useMe } from './me'
import UpBolt from '@/svgs/bolt.svg'
import { amountSchema } from '@/lib/validate'
import { defaultTipIncludingRandom } from './upvote'
import { ZAP_UNDO_DELAY_MS } from '@/lib/constants'
import { ACT_MUTATION } from '@/fragments/payIn'
import { meAnonSats } from '@/lib/apollo'
import { useHasSendWallet } from '@/wallets/client/hooks'
import { InvoiceCanceledError } from '@/wallets/client/errors'
import { useAnimation } from '@/components/animation'
import { useToast } from '@/components/toast'
import usePayInMutation from '@/components/payIn/hooks/use-pay-in-mutation'
import { composeCallbacks } from '@/lib/compose-callbacks'

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
  const hasReadySendWallet = useHasSendWallet()
  const toaster = useToast()
  const client = useApolloClient()
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

    // onPayError only fires for failures that won't be auto-retried; e is undefined when it's
    // invoked purely to revert a retry successor's cache, and a user-canceled QR isn't news
    const onPayError = (e) => {
      if (e && !(e instanceof InvoiceCanceledError)) {
        toaster.danger(e?.message || e?.toString?.())
      }
    }

    const options = { cachePhases: { onPayError } }
    if (hasReadySendWallet || me?.privates?.sats > Number(amount)) {
      onPaid()
    } else {
      // we want to close the modal only after paid so the modal can stack
      options.cachePhases.onPaid = onPaid
    }

    // instant feedback: bump the item's counters directly in the root cache (assume p2p — the act
    // cache phases add credits later if the response says otherwise). this is the same root bump
    // the bolt uses; it survives navigation (maxMerge) and is reverted on terminal payment failure
    // by getActCachePhases.onPayError, or here if the mutation never creates a payIn.
    const result = { id: item.id, sats: Number(amount), act, path: item.path }
    bumpActCache(client.cache, result, me)

    let error
    try {
      ({ error } = await actor({
        variables: {
          id: item.id,
          sats: Number(amount),
          act
        },
        // don't close modal immediately because we want the QR modal to stack
        ...options
      }))
    } catch (mutationError) {
      // the mutation failed before creating a payIn — no cache phase will revert, so undo the bump
      revertActBump(client.cache, result, me)
      throw mutationError
    }
    if (error) throw error
    addCustomTip(Number(amount))
  }, [me, actor, client, hasReadySendWallet, act, item.id, item.path, onClose, abortSignal, animate, toaster])

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

function modifyActCache (cache, { payerPrivates, payOutBolt11Public }, me) {
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
    }
    // cache.modify writes the root cache by default (optimistic: false) — act bumps (genesis and
    // retry alike) are written at click time to the root cache, so they survive navigation under
    // maxMerge and never need an optimistic layer
  })
}

// doing this onPaid fixes issue #1695 because optimistically updating all ancestors
// conflicts with the writeQuery on navigation from SSR
function updateAncestors (cache, { payerPrivates, payOutBolt11Public }) {
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
        }
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
        }
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
        }
      })
    })
  }
}

// the optimistic act bump: write an item's counters to the ROOT cache (survives navigation under
// maxMerge), assuming p2p so credits are skipped — getActCachePhases.onMutationResult adds them if
// the response turns out non-p2p. both the modal (item-act) and the bolt (use-zap) use this.
export function bumpActCache (cache, result, me) {
  modifyActCache(cache, { payerPrivates: { result }, payOutBolt11Public: true }, me)
}

// reverse a bump. payOutBolt11Public defaults to the bump's p2p assumption (no credits were added);
// pass the response's real value when reverting after the credit reconcile below may have run.
export function revertActBump (cache, result, me, payOutBolt11Public = true) {
  modifyActCache(cache, { payerPrivates: { result: { ...result, sats: -result.sats } }, payOutBolt11Public }, me)
}

// the bump already wrote sats/meSats to the root cache; these phases only reconcile what the bump
// couldn't know up front: credits (if the act turned out non-p2p), ancestors (on payment), and the
// reversal (on terminal failure). there is no onMutationResult bump and no onPaidMissingResult —
// the bump is client-driven at action time, not derived from the mutation response.
export function getActCachePhases (me) {
  return {
    onMutationResult: (cache, { data }) => {
      const response = Object.values(data)[0]
      const result = response?.payerPrivates?.result
      if (!result || response.payOutBolt11Public) return // no result, or actually p2p — credit skip was correct
      cache.modify({
        id: `Item:${result.id}`,
        fields: {
          credits: (existing = 0) => existing + result.sats,
          meCredits: (existing = 0) => me ? existing + result.sats : existing
        }
      })
    },
    onPayError: (e, cache, { data }) => {
      const response = Object.values(data)[0]
      const result = response?.payerPrivates?.result
      if (result) revertActBump(cache, result, me, response.payOutBolt11Public)
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
      onPayError: composeCallbacks(phases.onPayError, callerCachePhases.onPayError),
      onPaid: composeCallbacks(phases.onPaid, callerCachePhases.onPaid)
    }
  })
  return act
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

export const zapUndoTrigger = ({ me, amount }) => {
  if (!me) return false
  const enabled = me.privates.zapUndos !== null
  return enabled ? amount >= me.privates.zapUndos : false
}

export const zapUndo = async (signal, amount) => {
  return await new Promise((resolve, reject) => {
    signal.start?.(amount)
    const abortHandler = () => {
      reject(new ActCanceledError())
      signal.done?.()
      signal.removeEventListener('abort', abortHandler)
    }
    signal.addEventListener('abort', abortHandler)
    setTimeout(() => {
      resolve()
      signal.done?.()
      signal.removeEventListener('abort', abortHandler)
    }, ZAP_UNDO_DELAY_MS)
  })
}
