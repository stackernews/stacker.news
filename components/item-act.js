import Button from 'react-bootstrap/Button'
import InputGroup from 'react-bootstrap/InputGroup'
import React, { useState, useRef, useEffect, useCallback } from 'react'
import { Form, Input, SubmitButton } from './form'
import { useMe } from './me'
import UpBolt from '@/svgs/bolt.svg'
import { amountSchema, boostSchema } from '@/lib/validate'
import { useToast } from './toast'
import { nextTip, defaultTipIncludingRandom } from './upvote'
import { ZAP_UNDO_DELAY_MS } from '@/lib/constants'
import { ACT_MUTATION } from '@/fragments/payIn'
import { meAnonSats } from '@/lib/apollo'
import { BoostItemInput } from './adv-post-form'
import { useHasSendWallet } from '@/wallets/client/hooks'
import { useAnimation } from '@/components/animation'
import usePayInMutation from '@/components/payIn/hooks/use-pay-in-mutation'
import { getOperationName } from '@apollo/client/utilities'
import { satsToMsats } from '@/lib/format'

const defaultTips = [100, 1000, 10_000, 100_000]

const Tips = ({ setOValue }) => {
  const customTips = getCustomTips()
  const defaultNoCustom = defaultTips.filter(d => !customTips.includes(d))
  const tips = [...customTips, ...defaultNoCustom].slice(0, 7).sort((a, b) => a - b)

  return tips.map((num, i) =>
    <Button
      size='sm'
      className={`${i > 0 ? 'ms-2' : ''} mb-2`}
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

function BoostForm ({ step, onSubmit, children, item, oValue, inputRef, act = 'BOOST' }) {
  return (
    <Form
      initial={{
        amount: step
      }}
      schema={boostSchema}
      onSubmit={onSubmit}
    >
      <BoostItemInput
        label='add boost'
        act
        name='amount'
        type='number'
        innerRef={inputRef}
        sub={item.sub}
        step={step}
        required
        autoFocus
        item={item}
      />
      <div className='d-flex mt-3'>
        <SubmitButton variant='success' className='ms-auto mt-1 px-4' value={act}>
          boost
        </SubmitButton>
      </div>
      {children}
    </Form>
  )
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

    const onPaid = () => {
      animate()
      onClose?.()
      if (!me) setItemMeAnonSats({ id: item.id, amount })
    }

    const closeImmediately = hasSendWallet || me?.privates?.sats > Number(amount)
    if (closeImmediately) {
      onPaid()
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
      onPaid: closeImmediately ? undefined : onPaid
    })
    if (error) throw error
    addCustomTip(Number(amount))
  }, [me, actor, hasSendWallet, act, item.id, onClose, abortSignal, animate])

  return act === 'BOOST'
    ? <BoostForm step={step} onSubmit={onSubmit} item={item} inputRef={inputRef} act={act}>{children}</BoostForm>
    : (
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

        <div>
          <Tips setOValue={setOValue} />
        </div>
        <div className='d-flex mt-3'>
          <SubmitButton variant={act === 'DONT_LIKE_THIS' ? 'danger' : 'success'} className='ms-auto mt-1 px-4' value={act}>
            {act === 'DONT_LIKE_THIS' ? 'downzap' : 'zap'}
          </SubmitButton>
        </div>
        {children}
      </Form>)
}

function modifyActCache (cache, { payerPrivates, payOutBolt11Public }, me) {
  const result = payerPrivates?.result
  console.log('modifyActCache', payerPrivates, payOutBolt11Public, result)
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
        },
        optimistic: true
      })
    })
  }
}

export function useAct ({ query = ACT_MUTATION, ...options } = {}) {
  const { me } = useMe()
  // because the mutation name we use varies,
  // we need to extract the result/invoice from the response
  const getPayInResult = data => data[getOperationName(query)]
  const hasSendWallet = useHasSendWallet()

  const [act] = usePayInMutation(query, {
    waitFor: payIn =>
      // if we have attached wallets, we might be paying a wrapped invoice in which case we need to make sure
      // we don't prematurely consider the payment as successful (important for receiver fallbacks)
      hasSendWallet
        ? payIn?.payInState === 'PAID'
        : ['FORWARDING', 'PAID'].includes(payIn?.payInState),
    ...options,
    update: (cache, { data }) => {
      console.log('update', data)
      const response = getPayInResult(data)
      if (!response) return
      modifyActCache(cache, response, me)
      options?.update?.(cache, { data })
    },
    onPayError: (e, cache, { data }) => {
      const response = getPayInResult(data)
      if (!response || !response.payerPrivates.result) return
      const { payerPrivates: { result: { sats } } } = response
      const negate = { ...response, payerPrivates: { ...response.payerPrivates, result: { ...response.payerPrivates.result, sats: -1 * sats } } }
      modifyActCache(cache, negate, me)
      options?.onPayError?.(e, cache, { data })
    },
    onPaid: (cache, { data }) => {
      const response = getPayInResult(data)
      if (!response) return
      updateAncestors(cache, response)
      options?.onPaid?.(cache, { data })
    }
  })
  return act
}

export function useZap () {
  const hasSendWallet = useHasSendWallet()
  const act = useAct()
  const animate = useAnimation()
  const toaster = useToast()

  return useCallback(async ({ item, me, abortSignal }) => {
    const meSats = (item?.meSats || 0)

    // add current sats to next tip since idempotent zaps use desired total zap not difference
    const sats = nextTip(meSats, { ...me?.privates })

    const variables = { id: item.id, sats, act: 'TIP', hasSendWallet }
    const optimisticResponse = { payInType: 'ZAP', mcost: satsToMsats(sats), payerPrivates: { result: { path: item.path, ...variables, __typename: 'ItemAct' } } }

    try {
      await abortSignal.pause({ me, amount: sats })
      animate()
      // batch zaps if wallet is enabled or using fee credits so they can be executed serially in a single request
      const { error } = await act({ variables, optimisticResponse, context: { batch: hasSendWallet || me?.privates?.sats > sats } })
      if (error) throw error
    } catch (error) {
      if (error instanceof ActCanceledError) {
        return
      }

      // TODO: we should selectively toast based on error type
      // but right now this toast is noisy for optimistic zaps
      console.error(error)
    }
  }, [act, toaster, animate, hasSendWallet])
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
