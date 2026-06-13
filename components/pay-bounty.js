import React from 'react'
import styles from './pay-bounty.module.css'
import ActionTooltip from './action-tooltip'
import { useMe } from './me'
import { numWithUnits, satsToMsats } from '@/lib/format'
import { useShowModal } from './modal'
import { useRoot } from './root'
import { useAnimation } from '@/components/animation'
import { useToast } from './toast'
import { Form, SubmitButton } from './form'
import { PAY_BOUNTY_MUTATION } from '@/fragments/payIn'
import usePayInMutation from './payIn/hooks/use-pay-in-mutation'
import { getPayIn } from '@/lib/pay-in'
import { useHasSendWallet } from '@/wallets/client/hooks'
import { toastPayError } from '@/wallets/client/errors'

// add (or, on revert, remove) the paid beneficiary to the root item's bountyPaidTo list
const modifyBountyPaidTo = (cache, { data }, { add, optimistic }) => {
  const response = getPayIn(data)
  if (!response?.payerPrivates.result) return
  const { id, path } = response.payerPrivates.result
  const root = path.split('.')[0]
  cache.modify({
    id: `Item:${root}`,
    fields: {
      bountyPaidTo (existingPaidTo = []) {
        const paidTo = existingPaidTo || []
        return add ? [...paidTo, Number(id)] : paidTo.filter(i => i !== Number(id))
      }
    },
    optimistic
  })
}

// bounty payments are never pessimistic (payer is always logged-in and BOUNTY_PAYMENT is
// optimistic), so the genesis response always carries the result
export const payBountyCachePhases = {
  // runs in Apollo update() under the bounty optimisticResponse (so twice) — optimistic:true writes
  // the optimistic layer on the optimistic pass and root on the real pass, netting one append
  onMutationResult: (cache, args) => modifyBountyPaidTo(cache, args, { add: true, optimistic: true }),
  // runs outside update() context — write to the root cache
  onPayError: (_e, cache, args) => modifyBountyPaidTo(cache, args, { add: false, optimistic: false })
}

export default function PayBounty ({ children, item }) {
  const { me } = useMe()
  const showModal = useShowModal()
  const root = useRoot()
  const animate = useAnimation()
  const toaster = useToast()
  const hasSendWallet = useHasSendWallet()

  const bounty = root.bounty
  const proxyFee = Math.ceil(bounty * 3 / 100)
  const totalCost = bounty + proxyFee

  const variables = { id: item.id }
  const optimisticResponse = {
    payInType: 'BOUNTY_PAYMENT',
    mcost: satsToMsats(totalCost),
    payerPrivates: { result: { path: item.path, id: item.id, __typename: 'Item' } }
  }

  const [payBounty] = usePayInMutation(PAY_BOUNTY_MUTATION, {
    variables,
    optimisticResponse,
    cachePhases: payBountyCachePhases
  })

  const handlePayBounty = async onClose => {
    const onPaid = () => {
      animate()
      onClose?.()
    }

    // bounty payments are always optimistic clientside, so failures never surface through the
    // returned error/payError — toast them here. e is undefined for cache-revert-only calls,
    // and a user-canceled QR isn't news
    const onPayError = (e) => toastPayError(toaster, e)

    const options = { cachePhases: { onPayError } }
    if (hasSendWallet) {
      onPaid()
    } else {
      options.cachePhases.onPaid = onPaid
    }

    try {
      const { error } = await payBounty(options)
      if (error) throw error
    } catch (error) {
      toastPayError(toaster, error)
    }
  }

  if (!me || item.mine || root.user.name !== me.name) {
    return null
  }

  if (!item.user.optional?.hasRecvWallet) {
    return (
      <ActionTooltip
        notForm
        overlayText={`${item.user.name} doesn't have a receive wallet to pay to`}
      >
        <div className={styles.noWallet}>no receive wallet</div>
      </ActionTooltip>
    )
  }

  return (
    <div
      className={styles.pay} onClick={() => {
        showModal(onClose => (
          <>
            <div className='text-center fw-bold text-muted'>
              Pay this bounty to {item.user.name}?
            </div>
            <div className='text-center text-muted mt-2'>
              {numWithUnits(bounty)} + {numWithUnits(proxyFee)} proxy fee
            </div>
            <Form className='text-center' onSubmit={() => handlePayBounty(onClose)} initial={{ id: item.id }}>
              <SubmitButton className='mt-4' variant='primary' submittingText='paying...' appendText={numWithUnits(totalCost)}>
                pay
              </SubmitButton>
            </Form>
          </>
        ))
      }}
    >
      pay bounty
    </div>
  )
}
