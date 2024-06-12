import { gql } from '@apollo/client'
import Button from 'react-bootstrap/Button'
import { fixedDecimal, numWithUnits } from '@/lib/format'
import { timeLeft } from '@/lib/time'
import { useMe } from './me'
import styles from './poll.module.css'
import { signIn } from 'next-auth/react'
import ActionTooltip from './action-tooltip'
import { InvoiceCanceledError } from './payment'
import { useToast } from './toast'
import { usePaidMutation } from './use-paid-mutation'

export default function Poll ({ item }) {
  const me = useMe()
  const POLL_VOTE_MUTATION = gql`
    mutation pollVote($id: ID!, $hash: String, $hmac: String) {
      pollVote(id: $id, hash: $hash, hmac: $hmac) {
        id
      }
    }`
  const [pollVote] = usePaidMutation(POLL_VOTE_MUTATION)
  const toaster = useToast()

  const update = (cache, { data: { pollVote: { result } } }) => {
    if (!result) return
    const { id } = result
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
      id: `PollOption:${id}`,
      fields: {
        count (existingCount) {
          return existingCount + 1
        }
      }
    })
  }

  const PollButton = ({ v }) => {
    return (
      <ActionTooltip placement='left' notForm overlayText='1 sat'>
        <Button
          variant='outline-info' className={styles.pollButton}
          onClick={me
            ? async () => {
              const variables = { id: v.id }
              const optimisticResponse = { pollVote: { result: { id: v.id } } }
              try {
                await pollVote({ variables, optimisticResponse, update })
              } catch (error) {
                if (error instanceof InvoiceCanceledError) {
                  return
                }

                const reason = error?.message || error?.toString?.()

                toaster.danger('poll vote failed: ' + reason)
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
  const pollCount = item.poll.count
  return (
    <div className={styles.pollBox}>
      {item.poll.options.map(v =>
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
