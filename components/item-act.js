import Button from 'react-bootstrap/Button'
import InputGroup from 'react-bootstrap/InputGroup'
import React, { useState, useRef, useEffect, useCallback } from 'react'
import { Form, Input, SubmitButton } from './form'
import { useMe } from './me'
import UpBolt from '@/svgs/bolt.svg'
import { amountSchema, boostSchema } from '@/lib/validate'
import { useToast } from './toast'
import { useLightning } from './lightning'
import { nextTip, defaultTipIncludingRandom } from './upvote'
import { ZAP_UNDO_DELAY_MS } from '@/lib/constants'
import { usePaidMutation } from './use-paid-mutation'
import { ACT_MUTATION } from '@/fragments/paidAction'
import { meAnonSats } from '@/lib/apollo'
import { BoostItemInput } from './adv-post-form'
import { useSendWallets } from '@/wallets/client/hooks'

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
  const wallets = useSendWallets()
  const [oValue, setOValue] = useState()

  useEffect(() => {
    inputRef.current?.focus()
  }, [onClose, item.id])

  const actor = useAct()
  const strike = useLightning()

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
      strike()
      onClose?.()
      if (!me) setItemMeAnonSats({ id: item.id, amount })
    }

    const closeImmediately = wallets.length > 0 || me?.privates?.sats > Number(amount)
    if (closeImmediately) {
      onPaid()
    }

    const { error } = await actor({
      variables: {
        id: item.id,
        sats: Number(amount),
        act,
        hasSendWallet: wallets.length > 0
      },
      optimisticResponse: me
        ? {
            act: {
              __typename: 'ItemActPaidAction',
              result: {
                id: item.id, sats: Number(amount), act, path: item.path
              }
            }
          }
        : undefined,
      // don't close modal immediately because we want the QR modal to stack
      onPaid: closeImmediately ? undefined : onPaid
    })
    if (error) throw error
    addCustomTip(Number(amount))
  }, [me, actor, wallets.length, act, item.id, onClose, abortSignal, strike])

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

function modifyActCache (cache, { result, invoice }, me) {
  if (!result) return
  const { id, sats, act } = result
  const p2p = invoice?.invoiceForward

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
function updateAncestors (cache, { result, invoice }) {
  if (!result) return
  const { id, sats, act, path } = result
  const p2p = invoice?.invoiceForward

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
  const getPaidActionResult = data => Object.values(data)[0]
  const wallets = useSendWallets()

  const [act] = usePaidMutation(query, {
    waitFor: inv =>
      // if we have attached wallets, we might be paying a wrapped invoice in which case we need to make sure
      // we don't prematurely consider the payment as successful (important for receiver fallbacks)
      wallets.length > 0
        ? inv?.actionState === 'PAID'
        : inv?.satsReceived > 0,
    ...options,
    update: (cache, { data }) => {
      const response = getPaidActionResult(data)
      if (!response) return
      modifyActCache(cache, response, me)
      options?.update?.(cache, { data })
    },
    onPayError: (e, cache, { data }) => {
      const response = getPaidActionResult(data)
      if (!response || !response.result) return
      const { result: { sats } } = response
      const negate = { ...response, result: { ...response.result, sats: -1 * sats } }
      modifyActCache(cache, negate, me)
      options?.onPayError?.(e, cache, { data })
    },
    onPaid: (cache, { data }) => {
      const response = getPaidActionResult(data)
      if (!response) return
      updateAncestors(cache, response)
      options?.onPaid?.(cache, { data })
    }
  })
  return act
}

export function useZap () {
  const wallets = useSendWallets()
  const act = useAct()
  const strike = useLightning()
  const toaster = useToast()

  return useCallback(async ({ item, me, abortSignal }) => {
    const meSats = (item?.meSats || 0)

    // add current sats to next tip since idempotent zaps use desired total zap not difference
    const sats = nextTip(meSats, { ...me?.privates })

    const variables = { id: item.id, sats, act: 'TIP', hasSendWallet: wallets.length > 0 }
    const optimisticResponse = { act: { __typename: 'ItemActPaidAction', result: { path: item.path, ...variables } } }

    try {
      await abortSignal.pause({ me, amount: sats })
      strike()
      // batch zaps if wallet is enabled or using fee credits so they can be executed serially in a single request
      const { error } = await act({ variables, optimisticResponse, context: { batch: wallets.length > 0 || me?.privates?.sats > sats } })
      if (error) throw error
    } catch (error) {
      if (error instanceof ActCanceledError) {
        return
      }

      // TODO: we should selectively toast based on error type
      // but right now this toast is noisy for optimistic zaps
      console.error(error)
    }
  }, [act, toaster, strike, wallets])
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
