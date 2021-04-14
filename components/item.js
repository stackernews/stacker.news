import UpVote from '../svgs/lightning-arrow.svg'
import styles from './item.module.css'

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

export default function Item ({ item }) {
  return (
    <div className='d-flex justify-content-start align-items-center'>
      <UpVote width={32} height={32} className={styles.upvote} />
      <div>
        <div>
          <span>
            <span className={styles.title}>{item.title}</span>
            <a className={styles.link} href={item.url}>{item.url.replace(/(^\w+:|^)\/\//, '')}</a>
          </span>
        </div>
        <div className={styles.other}>
          <span>{item.sats} sats</span>
          <span> \ </span>
          <span>{item.comments} comments</span>
          <span> </span>
          <a href='/satoshi'>@{item.user.name}</a>
          <span> </span>
          <span>{timeSince(new Date(item.createdAt))}</span>
        </div>
      </div>
    </div>
  )
}
