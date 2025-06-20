import React from 'react'
import styles from './pay-bounty.module.css'
import ActionTooltip from './action-tooltip'
import { useMe } from './me'
import { numWithUnits } from '@/lib/format'
import { useShowModal } from './modal'
import { useRoot } from './root'
import { ActCanceledError, useAct } from './item-act'
import { useLightning } from './lightning'
import { useToast } from './toast'
import { useSendWallets } from '@/wallets/client/hooks'
import { Form, SubmitButton } from './form'

export const payBountyCacheMods = {
  onPaid: (cache, { data }) => {
    const response = Object.values(data)[0]
    if (!response?.result) return
    const { id, path } = response.result
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
    if (!response?.result) return
    const { id, path } = response.result
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
  const strike = useLightning()
  const toaster = useToast()
  const wallets = useSendWallets()

  const variables = { id: item.id, sats: root.bounty, act: 'TIP', hasSendWallet: wallets.length > 0 }
  const act = useAct({
    variables,
    optimisticResponse: { act: { __typename: 'ItemActPaidAction', result: { ...variables, path: item.path } } },
    ...payBountyCacheMods
  })

  const handlePayBounty = async onCompleted => {
    try {
      strike()
      const { error } = await act({ onCompleted })
      if (error) throw error
    } catch (error) {
      if (error instanceof ActCanceledError) {
        return
      }

      const reason = error?.message || error?.toString?.()
      toaster.danger(reason)
    }
  }

  if (!me || item.mine || root.user.name !== me.name) {
    return null
  }

  return (
    <ActionTooltip
      notForm
      overlayText={numWithUnits(root.bounty)}
    >
      <div
        className={styles.pay} onClick={() => {
          showModal(onClose => (
            <>
              <div className='text-center fw-bold text-muted'>
                Pay this bounty to {item.user.name}?
              </div>
              {/* initial={{ id: item.id }} is a hack to allow SubmitButton to be used as a button */}
              <Form className='text-center' onSubmit={() => handlePayBounty(onClose)} initial={{ id: item.id }}>
                <SubmitButton className='mt-4' variant='primary' submittingText='paying...' appendText={numWithUnits(root.bounty)}>
                  pay
                </SubmitButton>
              </Form>
            </>
          ))
        }}
      >
        pay bounty
      </div>
    </ActionTooltip>
  )
}
