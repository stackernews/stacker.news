import Button from 'react-bootstrap/Button'
import { fixedDecimal, numWithUnits } from '@/lib/format'
import { timeLeft } from '@/lib/time'
import { useMe } from './me'
import styles from './poll.module.css'
import { signIn } from 'next-auth/react'
import ActionTooltip from './action-tooltip'
import { useToast } from './toast'
import usePayInMutation from '@/components/payIn/hooks/use-pay-in-mutation'
import { POLL_VOTE } from '@/fragments/payIn'
import { useState } from 'react'
import classNames from 'classnames'

const PollButton = ({ v, item }) => {
  const pollVote = usePollVote({ query: POLL_VOTE, itemId: item.id })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const toaster = useToast()
  const { me } = useMe()

  return (
    <ActionTooltip placement='left' notForm overlayText='1 sat'>
      <Button
        disabled={isSubmitting}
        variant='outline-info' className={classNames(styles.pollButton, isSubmitting && 'pulse')}
        onClick={me
          ? async () => {
            setIsSubmitting(true)
            const variables = { id: v.id }
            try {
              const { error } = await pollVote({
                variables
              })
              if (error) throw error
            } catch (error) {
              const reason = error?.message || error?.toString?.()
              toaster.danger(reason)
            } finally {
              setIsSubmitting(false)
            }
          }
          : signIn}
      >
        {v.option}
      </Button>
    </ActionTooltip>
  )
}

export default function Poll ({ item }) {
  const { me } = useMe()

  const hasExpiration = !!item.pollExpiresAt
  const timeRemaining = timeLeft(new Date(item.pollExpiresAt))
  const mine = item.user.id === me?.id
  const showPollButton = me && (!hasExpiration || timeRemaining) && !item.poll.meVoted && !mine
  const pollCount = item.poll.count
  return (
    <div className={styles.pollBox}>
      {item.poll.options.map(v =>
        showPollButton
          ? <PollButton key={v.id} v={v} item={item} />
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

export function usePollVote ({ query = POLL_VOTE, itemId }) {
  const update = (cache, { data }) => {
    // the mutation name varies for optimistic retries
    const response = Object.values(data)[0]
    if (!response?.result) return
    const { result } = response
    const { id } = result
    cache.modify({
      id: `Item:${itemId}`,
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

  const [pollVote] = usePayInMutation(query, { update })
  return pollVote
}
