import { timeSince } from '@/lib/time'
import styles from './item.module.css'
import Text from './text'
import { Dropdown } from 'react-bootstrap'
import { useShowModal } from './modal'
import { EDIT } from '@/fragments/items'
import { useQuery } from '@apollo/client'
import PageLoading from './page-loading'

// OldItem: takes a versionId and shows the old item
export function OldItem ({ versionId }) {
  const { data } = useQuery(EDIT, { variables: { id: versionId } })
  if (!data) return <PageLoading />

  const actionType = data?.oldItem?.cloneBornAt ? 'edited' : 'created'
  const timestamp = data?.oldItem?.cloneBornAt
    ? data?.oldItem?.cloneDiedAt
    : data?.oldItem?.createdAt

  return (
    <>
      <div className={styles.other}>
        {actionType} {timeSince(new Date(timestamp))} ago
      </div>
      <div>
        <h5>{data?.oldItem?.title}</h5>
        <Text
          itemId={data?.oldItem?.originalItemId}
          topLevel
          imgproxyUrls={data?.oldItem?.imgproxyUrls}
        >
          {data?.oldItem?.text}
        </Text>
      </div>
    </>
  )
}

export const HistoryDropdownItem = ({ version }) => {
  const showModal = useShowModal()

  const actionType = !version.cloneBornAt ? 'created' : 'edited'
  const timestamp = version.cloneBornAt
    ? version.cloneDiedAt
    : version.createdAt

  return (
    <Dropdown.Item
      key={version.id}
      title={version.cloneBornAt || version.createdAt}
      onClick={() => showModal((onClose) => <OldItem versionId={version.id} />)}
    >
      {actionType} {timeSince(new Date(timestamp))} ago
    </Dropdown.Item>
  )
}

// History dropdown: takes an item and maps over the oldVersions
export default function HistoryDropdown ({ item }) {
  const mostRecentTimestamp = item.cloneBornAt || item.oldVersions[0].createdAt

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
        <Dropdown.Item title={mostRecentTimestamp}>
          edited {timeSince(new Date(mostRecentTimestamp))} ago (most recent)
        </Dropdown.Item>
        {item.oldVersions.map((version) => (
          <HistoryDropdownItem key={version.id} version={version} />
        ))}
      </Dropdown.Menu>
    </Dropdown>
  )
}
