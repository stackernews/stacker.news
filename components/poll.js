import Button from 'react-bootstrap/Button'
import { fixedDecimal, numWithUnits } from '@/lib/format'
import { timeLeft } from '@/lib/time'
import { useMe } from './me'
import styles from './poll.module.css'
import { signIn } from 'next-auth/react'
import ActionTooltip from './action-tooltip'
import useQrPayment from './use-qr-payment'
import { useToast } from './toast'
import { usePaidMutation } from './use-paid-mutation'
import { POLL_VOTE, RETRY_PAID_ACTION } from '@/fragments/paidAction'

export default function Poll ({ item }) {
  const { me } = useMe()
  const pollVote = usePollVote({ query: POLL_VOTE, itemId: item.id })
  const toaster = useToast()
  const shuffleOptions = (options) => {
    return options
      .map(value => ({ value, sort: Math.random() }))
      .sort((a, b) => a.sort - b.sort)
      .map(({ value }) => value)
  }
  const pollOptions = item.poll.randPollOptions ? shuffleOptions(item.poll.options) : item.poll.options

  const PollButton = ({ v }) => {
    return (
      <ActionTooltip placement='left' notForm overlayText='1 sat'>
        <Button
          variant='outline-info' className={styles.pollButton}
          onClick={me
            ? async () => {
              const variables = { id: v.id }
              const optimisticResponse = { pollVote: { __typename: 'PollVotePaidAction', result: { id: v.id } } }
              try {
                const { error } = await pollVote({
                  variables,
                  optimisticResponse
                })
                if (error) throw error
              } catch (error) {
                const reason = error?.message || error?.toString?.()
                toaster.danger(reason)
              }
            }
            : signIn}
        >
          {v.option}
        </Button>
      </ActionTooltip>
    )
  }

  const RetryVote = () => {
    const retryVote = usePollVote({ query: RETRY_PAID_ACTION, itemId: item.id })
    const waitForQrPayment = useQrPayment()

    if (item.poll.meInvoiceActionState === 'PENDING') {
      return (
        <span
          className='ms-2 fw-bold text-info pointer'
          onClick={() => waitForQrPayment(
            { id: parseInt(item.poll.meInvoiceId) }, null, { cancelOnClose: false }).catch(console.error)}
        >vote pending
        </span>
      )
    }
    return (
      <span
        className='ms-2 fw-bold text-warning pointer'
        onClick={() => retryVote({ variables: { invoiceId: parseInt(item.poll.meInvoiceId) } })}
      >
        retry vote
      </span>
    )
  }

  const hasExpiration = !!item.pollExpiresAt
  const timeRemaining = timeLeft(new Date(item.pollExpiresAt))
  const mine = item.user.id === me?.id
  const meVotePending = item.poll.meInvoiceActionState && item.poll.meInvoiceActionState !== 'PAID'
  const showPollButton = me && (!hasExpiration || timeRemaining) && !item.poll.meVoted && !meVotePending && !mine
  const pollCount = item.poll.count
  return (
    <div className={styles.pollBox}>
      {pollOptions.map(v =>
        showPollButton
          ? <PollButton key={v.id} v={v} />
          : <PollResult
              key={v.id} v={v}
              progress={pollCount
                ? fixedDecimal((v.count) * 100 / pollCount, 1)
                : 0}
            />)}
      <div className='text-muted mt-1'>
        {numWithUnits(item.poll.count, { unitSingular: 'vote', unitPlural: 'votes' })}
        {hasExpiration && ` \\ ${timeRemaining ? `${timeRemaining} left` : 'poll ended'}`}
        {!showPollButton && meVotePending && <RetryVote />}
      </div>
    </div>
  )
}

function PollResult ({ v, progress }) {
  return (
    <div className={styles.pollResult}>
      <span className={styles.pollOption}>{v.option}</span>
      <span className='ms-auto me-2 align-self-center'>{progress}%</span>
      <div className={styles.pollProgress} style={{ width: `${progress}%` }} />
    </div>
  )
}

export function usePollVote ({ query = POLL_VOTE, itemId }) {
  const update = (cache, { data }) => {
    // the mutation name varies for optimistic retries
    const response = Object.values(data)[0]
    if (!response) return
    const { result, invoice } = response
    const { id } = result
    cache.modify({
      id: `Item:${itemId}`,
      fields: {
        poll (existingPoll) {
          const poll = { ...existingPoll }
          poll.meVoted = true
          if (invoice) {
            poll.meInvoiceActionState = 'PENDING'
            poll.meInvoiceId = invoice.id
          }
          poll.count += 1
          return poll
        }
      },
      optimistic: true
    })
    cache.modify({
      id: `PollOption:${id}`,
      fields: {
        count (existingCount) {
          return existingCount + 1
        }
      },
      optimistic: true
    })
  }

  const onPayError = (e, cache, { data }) => {
    // the mutation name varies for optimistic retries
    const response = Object.values(data)[0]
    if (!response) return
    const { result, invoice } = response
    const { id } = result
    cache.modify({
      id: `Item:${itemId}`,
      fields: {
        poll (existingPoll) {
          const poll = { ...existingPoll }
          poll.meVoted = false
          if (invoice) {
            poll.meInvoiceActionState = 'FAILED'
            poll.meInvoiceId = invoice?.id
          }
          poll.count -= 1
          return poll
        }
      },
      optimistic: true
    })
    cache.modify({
      id: `PollOption:${id}`,
      fields: {
        count (existingCount) {
          return existingCount - 1
        }
      },
      optimistic: true
    })
  }

  const onPaid = (cache, { data }) => {
    // the mutation name varies for optimistic retries
    const response = Object.values(data)[0]
    if (!response?.invoice) return
    const { invoice } = response
    cache.modify({
      id: `Item:${itemId}`,
      fields: {
        poll (existingPoll) {
          const poll = { ...existingPoll }
          poll.meVoted = true
          poll.meInvoiceActionState = 'PAID'
          poll.meInvoiceId = invoice.id
          return poll
        }
      }
    })
  }

  const [pollVote] = usePaidMutation(query, { update, onPayError, onPaid })
  return pollVote
}
