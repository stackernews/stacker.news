import Button from 'react-bootstrap/Button'
import InputGroup from 'react-bootstrap/InputGroup'
import React, { useState, useRef, useEffect, useCallback } from 'react'
import { Form, Input, SubmitButton } from './form'
import { useMe } from './me'
import UpBolt from '@/svgs/bolt.svg'
import { amountSchema } from '@/lib/validate'
import { defaultTipIncludingRandom } from './upvote'
import { ZAP_UNDO_DELAY_MS } from '@/lib/constants'
import { ACT_MUTATION } from '@/fragments/payIn'
import { meAnonSats } from '@/lib/apollo'
import { useHasSendWallet } from '@/wallets/client/hooks'
import { useAnimation } from '@/components/animation'
import usePayInMutation from '@/components/payIn/hooks/use-pay-in-mutation'
import { satsToMsats } from '@/lib/format'
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

export function modifyActCache (cache, { payerPrivates, payOutBolt11Public }, me, { optimistic = true } = {}) {
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
    optimistic
  })
}

// doing this onPaid fixes issue #1695 because optimistically updating all ancestors
// conflicts with the writeQuery on navigation from SSR
export function updateAncestors (cache, { payerPrivates, payOutBolt11Public }, { optimistic = true } = {}) {
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
        optimistic
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
        optimistic
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
        optimistic
      })
    })
  }
}

export function getActCachePhases (me) {
  return {
    // runs as Apollo update() callback — optimistic: true (default) is correct
    onMutationResult: (cache, { data }) => {
      const response = Object.values(data)[0]
      if (!response) return
      modifyActCache(cache, response, me)
    },
    // runs outside update() context — write to root cache
    onPaidMissingResult: (cache, { data }) => {
      const response = Object.values(data)[0]
      if (!response) return
      modifyActCache(cache, response, me, { optimistic: false })
    },
    onPayError: (e, cache, { data }) => {
      const response = Object.values(data)[0]
      if (!response?.payerPrivates?.result) return
      const { payerPrivates: { result: { sats } } } = response
      const negate = { ...response, payerPrivates: { ...response.payerPrivates, result: { ...response.payerPrivates.result, sats: -1 * sats } } }
      modifyActCache(cache, negate, me, { optimistic: false })
    },
    onPaid: (cache, { data }) => {
      const response = Object.values(data)[0]
      if (!response) return
      updateAncestors(cache, response, { optimistic: false })
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
      onPaidMissingResult: composeCallbacks(phases.onPaidMissingResult, callerCachePhases.onPaidMissingResult),
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
