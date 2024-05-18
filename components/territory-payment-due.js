import { Alert } from 'react-bootstrap'
import { useMe } from './me'
import FeeButton, { FeeButtonProvider } from './fee-button'
import { TERRITORY_BILLING_OPTIONS } from '@/lib/constants'
import { Form } from './form'
import { timeSince } from '@/lib/time'
import { LongCountdown } from './countdown'
import { useCallback } from 'react'
import { useApolloClient, useMutation } from '@apollo/client'
import { SUB_PAY } from '@/fragments/subs'
import { nextBillingWithGrace } from '@/lib/territory'

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

  const dueDate = nextBillingWithGrace(sub)
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
          prepaid
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

  const dueDate = sub.billPaidUntil && new Date(sub.billPaidUntil)
  const pastDue = dueDate && dueDate < new Date()

  return (
    <div className='text-muted'>
      <span>billing {sub.billingAutoRenew ? 'automatically renews' : 'due'} </span>
      <span className='fw-bold'>{pastDue ? 'past due' : dueDate ? timeSince(dueDate) : 'never again'}</span>
    </div>
  )
}
