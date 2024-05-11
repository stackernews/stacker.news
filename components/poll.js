import { gql, useApolloClient, useMutation } from '@apollo/client'
import Button from 'react-bootstrap/Button'
import { fixedDecimal, numWithUnits } from '@/lib/format'
import { timeLeft } from '@/lib/time'
import { useMe } from './me'
import styles from './poll.module.css'
import Check from '@/svgs/checkbox-circle-fill.svg'
import { signIn } from 'next-auth/react'
import ActionTooltip from './action-tooltip'
import { POLL_COST } from '@/lib/constants'
import { InvoiceCanceledError, usePayment } from './payment'
import { NotificationType, useNotifications } from './notifications'

const pollVoteOptimisticUpdate = (cache, { id: itemId, pollOptionId }) => {
  const updateVote = (vote) => {
    cache.modify({
      id: `Item:${itemId}`,
      fields: {
        poll (existingPoll) {
          const poll = { ...existingPoll }
          poll.meVoted = vote
          poll.count += (vote ? 1 : -1)
          return poll
        }
      }
    })
    cache.modify({
      id: `PollOption:${pollOptionId}`,
      fields: {
        count (existingCount) {
          return existingCount + (vote ? 1 : -1)
        },
        meVoted () {
          return vote
        }
      }
    })
  }

  updateVote(true)

  return () => updateVote(false)
}

export default function Poll ({ item }) {
  const me = useMe()
  const [pollVote] = useMutation(
    gql`
      mutation pollVote($id: ID!, $hash: String, $hmac: String) {
        pollVote(id: $id, hash: $hash, hmac: $hmac)
      }`
  )
  const { notify, unnotify } = useNotifications()

  const PollButton = ({ v }) => {
    const payment = usePayment()
    const cache = useApolloClient().cache
    return (
      <ActionTooltip placement='left' notForm overlayText='1 sat'>
        <Button
          variant='outline-info' className={styles.pollButton}
          onClick={me
            ? async () => {
              let cancel, revert, nid
              try {
                let hash, hmac
                revert = pollVoteOptimisticUpdate(cache, { id: item.id, pollOptionId: v.id })
                nid = notify(NotificationType.PollVotePending, { itemId: item.id }, false);
                [{ hash, hmac }, cancel] = await payment.request(item.pollCost || POLL_COST)
                await pollVote({ variables: { id: v.id, hash, hmac } })
              } catch (err) {
                revert?.()
                if (err instanceof InvoiceCanceledError) {
                  return
                }
                const reason = err.message || err.toString?.()
                notify(NotificationType.PollVoteError, { reason, itemId: item.id })
                cancel?.()
              } finally {
                unnotify(nid)
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
  const showPollButton = (!hasExpiration || timeRemaining) && !item.poll.meVoted && !mine
  return (
    <div className={styles.pollBox}>
      {item.poll.options.map(v =>
        showPollButton
          ? <PollButton key={v.id} v={v} />
          : <PollResult
              key={v.id} v={v}
              progress={item.poll.count ? fixedDecimal(v.count * 100 / item.poll.count, 1) : 0}
            />)}
      <div className='text-muted mt-1'>
        {numWithUnits(item.poll.count, { unitSingular: 'vote', unitPlural: 'votes' })}
        {hasExpiration && ` \\ ${timeRemaining ? `${timeRemaining} left` : 'poll ended'}`}
      </div>
    </div>
  )
}

function PollResult ({ v, progress }) {
  return (
    <div className={styles.pollResult}>
      <span className={styles.pollOption}>{v.option}{v.meVoted && <Check className='fill-grey ms-1 align-self-center flex-shrink-0' width={16} height={16} />}</span>
      <span className='ms-auto me-2 align-self-center'>{progress}%</span>
      <div className={styles.pollProgress} style={{ width: `${progress}%` }} />
    </div>
  )
}
