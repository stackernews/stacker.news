import { timeSince } from '@/lib/time'
import styles from './item.module.css'
import Text from './text'
import { Dropdown } from 'react-bootstrap'
import { useShowModal } from './modal'

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

export default function HistoryDropdown ({ item }) {
  const showModal = useShowModal()
  const lastEdited = new Date(item.oldVersions[0].cloneDiedAt)

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
        <Dropdown.Item
          title={lastEdited}
          // onClick={handleLastEdit}
        >
          edited {timeSince(lastEdited)} ago (most recent)
        </Dropdown.Item>
        {item.oldVersions.map((version) => (
          <Dropdown.Item
            key={version.id}
            title={version.cloneBornAt}
            onClick={() => showModal((onClose) => <OldItem version={version} onClose={onClose} />)}
          >
            {!version.cloneBornAt ? 'created' : 'edited'} {timeSince(new Date(version.cloneBornAt || version.createdAt))} ago
          </Dropdown.Item>
        ))}
      </Dropdown.Menu>
    </Dropdown>
  )
}
