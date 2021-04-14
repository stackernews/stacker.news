import itemStyles from './item.module.css'
import styles from './comment.module.css'
import UpVote from '../svgs/lightning-arrow.svg'
import Text from './text'
import Link from 'next/link'
import Reply from './reply'
import { useState } from 'react'

function timeSince (timeStamp) {
  const now = new Date()
  const secondsPast = (now.getTime() - timeStamp) / 1000
  if (secondsPast < 60) {
    return parseInt(secondsPast) + 's'
  }
  if (secondsPast < 3600) {
    return parseInt(secondsPast / 60) + 'm'
  }
  if (secondsPast <= 86400) {
    return parseInt(secondsPast / 3600) + 'h'
  }
  if (secondsPast > 86400) {
    const day = timeStamp.getDate()
    const month = timeStamp.toDateString().match(/ [a-zA-Z]*/)[0].replace(' ', '')
    const year = timeStamp.getFullYear() === now.getFullYear() ? '' : ' ' + timeStamp.getFullYear()
    return day + ' ' + month + year
  }
}

export default function Comment ({ item, children }) {
  const [reply, setReply] = useState(false)

  return (
    <>
      <div className={`${itemStyles.item} ${styles.item}`}>
        <UpVote width={24} height={24} className={`${itemStyles.upvote} ${styles.upvote}`} />
        <div className={itemStyles.hunk}>
          <div className={itemStyles.other}>
            <Link href={`/@${item.user.name}`} passHref>
              <a>@{item.user.name}</a>
            </Link>
            <span> </span>
            <span>{timeSince(new Date(item.createdAt))}</span>
            <span> \ </span>
            <span>{item.sats} sats</span>
            <span> \ </span>
            <span>{item.ncomments} replies</span>
          </div>
          <div className={styles.text}>
            <Text>{item.text}</Text>
          </div>
        </div>
      </div>
      <div className={`${itemStyles.children} ${styles.children}`}>
        <div
          className={`${itemStyles.other} ${styles.reply}`}
          onClick={() => setReply(!reply)}
        >
          {reply ? 'cancel' : 'reply'}
        </div>
        {reply && <Reply parentId={item.id} />}
        {children}
        {item.comments
          ? item.comments.map((item) => (
            <Comment key={item.id} item={item} />
            ))
          : null}
      </div>
    </>
  )
}
