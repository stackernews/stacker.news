import { Alert } from 'react-bootstrap'
import { useMe } from './me'
import FeeButton, { FeeButtonProvider } from './fee-button'
import { TERRITORY_BILLING_OPTIONS, TERRITORY_GRACE_DAYS } from '../lib/constants'
import { Form } from './form'
import { datePivot, timeSince } from '../lib/time'
import { LongCountdown } from './countdown'
import { useCallback } from 'react'
import { useApolloClient, useMutation } from '@apollo/client'
import { SUB_PAY } from '../fragments/subs'

const billingDueDate = (sub, grace) => {
  if (!sub || sub.billingType === 'ONCE') return null

  const pivot = sub.billingType === 'MONTHLY'
    ? { months: 1 }
    : { years: 1 }

  pivot.days = grace ? TERRITORY_GRACE_DAYS : 0

  return datePivot(new Date(sub.billedLastAt), pivot)
}

export default function TerritoryPaymentDue ({ sub }) {
  const me = useMe()
  const client = useApolloClient()
  const [paySub] = useMutation(SUB_PAY)

  const onSubmit = useCallback(
    async ({ ...variables }) => {
      const { error } = await paySub({
        variables
      })

      if (error) {
        throw new Error({ message: error.toString() })
      }
    }, [client, paySub])

  if (!sub || sub.userId !== Number(me?.id) || sub.status === 'ACTIVE') return null

  const dueDate = billingDueDate(sub, true)

  if (!dueDate) return null

  return (
    <Alert key='danger' variant='danger'>
      {sub.status === 'STOPPED'
        ? (
          <>
            <Alert.Heading>
              Your ~{sub.name} territory has been archived!
            </Alert.Heading>
            <div>
              Make a payment to reactivate it.
            </div>
          </>)
        : (
          <>
            <Alert.Heading>
              Your ~{sub.name} territory payment is due!
            </Alert.Heading>
            <div>
              Your territory will be archived in <LongCountdown date={dueDate} />otherwise.
            </div>
          </>
          )}

      <FeeButtonProvider baseLineItems={{ territory: TERRITORY_BILLING_OPTIONS('one')[sub.billingType.toLowerCase()] }}>
        <Form
          invoiceable
          initial={{
            name: sub.name
          }}
          onSubmit={onSubmit}
        >
          <div className='d-flex justify-content-end'>
            <FeeButton
              text='pay'
              variant='success'
            />
          </div>
        </Form>
      </FeeButtonProvider>
    </Alert>
  )
}

export function TerritoryBillingLine ({ sub }) {
  const me = useMe()
  if (!sub || sub.userId !== Number(me?.id)) return null

  const dueDate = billingDueDate(sub, false)

  return (
    <div className='text-muted'>
      <span>billing {sub.billingAutoRenew ? 'automatically renews' : 'due'} on </span>
      <span className='fw-bold'>{dueDate ? timeSince(dueDate) : 'never again'}</span>
    </div>
  )
}
