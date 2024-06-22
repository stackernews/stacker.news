import { gql, useMutation } from '@apollo/client'
import Button from 'react-bootstrap/Button'
import { fixedDecimal, numWithUnits } from '@/lib/format'
import { timeLeft } from '@/lib/time'
import { useMe } from './me'
import styles from './poll.module.css'
import { signIn } from 'next-auth/react'
import ActionTooltip from './action-tooltip'
import { POLL_COST } from '@/lib/constants'
import { InvoiceCanceledError, usePayment } from './payment'
import { useToast } from './toast'
import { Types as ClientNotification, useClientNotifications } from './client-notifications'
import { useItemContext } from './item'

export default function Poll ({ item }) {
  const me = useMe()
  const POLL_VOTE_MUTATION = gql`
    mutation pollVote($id: ID!, $hash: String, $hmac: String) {
      pollVote(id: $id, hash: $hash, hmac: $hmac)
    }`
  const [pollVote] = useMutation(POLL_VOTE_MUTATION)
  const toaster = useToast()
  const { notify, unnotify } = useClientNotifications()
  const { pendingVote, setPendingVote } = useItemContext()

  const update = (cache, { data: { pollVote } }) => {
    cache.modify({
      id: `Item:${item.id}`,
      fields: {
        poll (existingPoll) {
          const poll = { ...existingPoll }
          poll.meVoted = true
          poll.count += 1
          return poll
        }
      }
    })
    cache.modify({
      id: `PollOption:${pollVote}`,
      fields: {
        count (existingCount) {
          return existingCount + 1
        }
      }
    })
  }

  const PollButton = ({ v }) => {
    const payment = usePayment()
    return (
      <ActionTooltip placement='left' notForm overlayText='1 sat'>
        <Button
          variant='outline-info' className={styles.pollButton}
          onClick={me
            ? async () => {
              const variables = { id: v.id }
              const notifyProps = { itemId: item.id }
              const optimisticResponse = { pollVote: v.id }
              let cancel, nid
              try {
                setPendingVote(v.id)

                if (me) {
                  nid = notify(ClientNotification.PollVote.PENDING, notifyProps)
                }

                let hash, hmac;
                [{ hash, hmac }, cancel] = await payment.request(item.pollCost || POLL_COST)

                await pollVote({ variables: { hash, hmac, ...variables }, optimisticResponse, update })
              } catch (error) {
                if (error instanceof InvoiceCanceledError) {
                  return
                }

                const reason = error?.message || error?.toString?.()
                if (me) {
                  notify(ClientNotification.PollVote.ERROR, { ...notifyProps, reason })
                } else {
                  toaster.danger('poll vote failed: ' + reason)
                }

                cancel?.()
              } finally {
                setPendingVote(undefined)
                if (nid) unnotify(nid)
              }
            }
            : signIn}
        >
          {v.option}
        </Button>
      </ActionTooltip>
    )
  }

  const hasExpiration = !!item.pollExpiresAt
  const timeRemaining = timeLeft(new Date(item.pollExpiresAt))
  const mine = item.user.id === me?.id
  const showPollButton = (!hasExpiration || timeRemaining) && !item.poll.meVoted && !mine && !pendingVote
  const pollCount = item.poll.count + (pendingVote ? 1 : 0)
  return (
    <div className={styles.pollBox}>
      {item.poll.options.map(v =>
        showPollButton
          ? <PollButton key={v.id} v={v} />
          : <PollResult
              key={v.id} v={v}
              progress={pollCount
                ? fixedDecimal((v.count + (pendingVote === v.id ? 1 : 0)) * 100 / pollCount, 1)
                : 0}
            />)}
      <div className='text-muted mt-1'>
        {numWithUnits(pollCount, { unitSingular: 'vote', unitPlural: 'votes' })}
        {hasExpiration && ` \\ ${timeRemaining ? `${timeRemaining} left` : 'poll ended'}`}
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
