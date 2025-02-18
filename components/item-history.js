import { timeSince } from '@/lib/time'
import styles from './item.module.css'
import Text from './text'

// TODO: PAID add a button to restore the item to the version
// TODO: styling
// TODO: render it as Item

export default function OldItem ({ version }) {
  return (
    <>
      <div className={styles.other}>
        {!version.cloneBornAt ? 'created' : 'edited'} {timeSince(new Date(version.cloneBornAt || version.createdAt))} ago
      </div>
      <div>
        <h5>{version.title}</h5>
        <Text itemId={version.originalItemId} topLevel imgproxyUrls={version.imgproxyUrls}>{version.text}</Text>
      </div>
    </>
  )
}
