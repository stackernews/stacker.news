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

export const payBountyCacheMods = {
  update: (cache, { data }) => {
    const response = Object.values(data)[0]
    if (!response?.payerPrivates.result) return
    const { id, path } = response.payerPrivates.result
    const root = path.split('.')[0]
    cache.modify({
      id: `Item:${root}`,
      fields: {
        bountyPaidTo (existingPaidTo = []) {
          return [...(existingPaidTo || []), Number(id)]
        }
      },
      optimistic: true
    })
  },
  onPayError: (e, cache, { data }) => {
    const response = Object.values(data)[0]
    if (!response?.payerPrivates.result) return
    const { id, path } = response.payerPrivates.result
    const root = path.split('.')[0]
    cache.modify({
      id: `Item:${root}`,
      fields: {
        bountyPaidTo (existingPaidTo = []) {
          return (existingPaidTo || []).filter(i => i !== Number(id))
        }
      },
      optimistic: true
    })
  }
}

export default function PayBounty ({ children, item }) {
  const { me } = useMe()
  const showModal = useShowModal()
  const root = useRoot()
  const animate = useAnimation()
  const toaster = useToast()

  const bounty = root.bounty
  const proxyFee = Math.ceil(bounty * 3 / 100)
  const totalCost = bounty + proxyFee

  const variables = { id: item.id }
  const optimisticResponse = {
    payInType: 'BOUNTY_PAYMENT',
    mcost: satsToMsats(totalCost),
    payerPrivates: { result: { path: item.path, id: item.id, sats: bounty, act: 'TIP', __typename: 'ItemAct' } }
  }

  const [payBounty] = usePayInMutation(PAY_BOUNTY_MUTATION, {
    variables,
    optimisticResponse,
    ...payBountyCacheMods
  })

  const handlePayBounty = async onCompleted => {
    try {
      animate()
      const { error } = await payBounty({ onCompleted })
      if (error) throw error
    } catch (error) {
      const reason = error?.message || error?.toString?.()
      toaster.danger(reason)
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
