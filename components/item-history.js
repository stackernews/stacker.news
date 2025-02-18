import { timeSince } from '@/lib/time'
import styles from './item.module.css'

// TODO: PAID add a button to restore the item to the version
// TODO: styling
// TODO: render it as Item

export default function ItemHistory ({ item }) {
  return (
    <div className={styles.other}>
      {item.oldVersions.map(version => (
        <div key={version.id}>
          <span className='text-muted' title={version.cloneBornAt || version.createdAt}>{timeSince(new Date(version.cloneBornAt || version.createdAt))}</span>
          <h3>{version.title}</h3>
          <p>{version.text}</p>
          <p>{version.url}</p>
        </div>
      ))}
    </div>
  )
}
