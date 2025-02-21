import { timeSince } from '@/lib/time'
import styles from './item.module.css'
import Text from './text'
import { Dropdown } from 'react-bootstrap'
import { useShowModal } from './modal'

// OldItem: takes a version and shows the old item
export function OldItem ({ version }) {
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

// History dropdown: takes an item and by mapping over the oldVersions, it will show the history of the item
export default function HistoryDropdown ({ item }) {
  const showModal = useShowModal()

  return (
    <Dropdown className='pointer' as='span'>
      <Dropdown.Toggle as='span' onPointerDown={e => e.preventDefault()}>
        edited
      </Dropdown.Toggle>
      <Dropdown.Menu style={{ maxHeight: '15rem', overflowY: 'auto' }}>
        <Dropdown.Header className='text-muted'>
          edited {item.oldVersions.length} times
        </Dropdown.Header>
        <hr className='dropdown-divider' />
        <Dropdown.Item title={item.oldVersions[0].cloneDiedAt}>
          edited {timeSince(new Date(item.oldVersions[0].cloneDiedAt))} ago (most recent)
        </Dropdown.Item>
        {item.oldVersions.map((version) => (
          <Dropdown.Item
            key={version.id}
            title={version.cloneBornAt || version.createdAt}
            onClick={() => showModal((onClose) => <OldItem version={version} />)}
          >
            {!version.cloneBornAt ? 'created' : 'edited'} {timeSince(new Date(version.cloneBornAt || version.createdAt))} ago
          </Dropdown.Item>
        ))}
      </Dropdown.Menu>
    </Dropdown>
  )
}
