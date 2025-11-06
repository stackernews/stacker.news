import { useMutation, useQuery } from '@apollo/client'
import { gql } from 'graphql-tag'
import Dropdown from 'react-bootstrap/Dropdown'
import { useToast } from './toast'
import { useCallback, useMemo, useEffect, useState } from 'react'
import { DndProvider, useDndHandlers } from '@/wallets/client/context/dnd'
import { ListItem, ItemsSkeleton } from './items'
import MoreFooter from './more-footer'
import { useData } from './use-data'
import { SUB_ITEMS } from '@/fragments/subs'
import styles from './items.module.css'
import bookmarkStyles from '@/styles/bookmark.module.css'
import DragIcon from '@/svgs/draggable.svg'

export default function BookmarkDropdownItem ({ item: { id, meBookmark } }) {
  const toaster = useToast()
  const [bookmarkItem] = useMutation(
    gql`
      mutation bookmarkItem($id: ID!) {
        bookmarkItem(id: $id) {
          meBookmark
        }
      }`, {
      update (cache, { data: { bookmarkItem } }) {
        cache.modify({
          id: `Item:${id}`,
          fields: {
            meBookmark: () => bookmarkItem.meBookmark
          },
          optimistic: true
        })
      }
    }
  )
  return (
    <Dropdown.Item
      onClick={async () => {
        try {
          await bookmarkItem({ variables: { id } })
          toaster.success(meBookmark ? 'bookmark removed' : 'bookmark added')
        } catch (err) {
          console.error(err)
          toaster.danger(meBookmark ? 'failed to remove bookmark' : 'failed to bookmark')
        }
      }}
    >
      {meBookmark ? 'remove bookmark' : 'bookmark'}
    </Dropdown.Item>
  )
}

const REORDER_BOOKMARKS = gql`
  mutation reorderBookmarks($itemIds: [ID!]!) {
    reorderBookmarks(itemIds: $itemIds)
  }
`

function DraggableBookmarkItem ({ item, index, children, ...props }) {
  const handlers = useDndHandlers(index)
  return (
    <div
      draggable
      onDragStart={handlers.handleDragStart}
      onDragOver={handlers.handleDragOver}
      onDragEnter={handlers.handleDragEnter}
      onDragLeave={handlers.handleDragLeave}
      onDrop={handlers.handleDrop}
      onDragEnd={handlers.handleDragEnd}
      onTouchStart={handlers.handleTouchStart}
      onTouchMove={handlers.handleTouchMove}
      onTouchEnd={handlers.handleTouchEnd}
      data-index={index}
      className={`${bookmarkStyles.draggableBookmark} ${handlers.isBeingDragged ? bookmarkStyles.dragging : ''} ${handlers.isDragOver ? bookmarkStyles.dragOver : ''}`}
      {...props}
    >
      <DragIcon className={bookmarkStyles.dragHandle} width={14} height={14} />
      {children}
    </div>
  )
}

export function CustomBookmarkList ({ ssrData, variables = {}, query }) {
  const toaster = useToast()
  const [reorderBookmarks] = useMutation(REORDER_BOOKMARKS)

  const { data, fetchMore } = useQuery(query || SUB_ITEMS, { variables })
  const dat = useData(data, ssrData)

  const { items, cursor } = useMemo(() => dat?.items ?? { items: [], cursor: null }, [dat])

  const [orderedItems, setOrderedItems] = useState(items || [])
  useEffect(() => { setOrderedItems(items || []) }, [items])

  const Skeleton = useCallback(() =>
    <ItemsSkeleton startRank={items?.length} limit={variables.limit} Footer={MoreFooter} />, [items])

  if (!dat) return <Skeleton />

  const handleReorder = useCallback(async (newItems) => {
    try {
      const itemIds = newItems.map(item => item.id.toString())
      await reorderBookmarks({ variables: { itemIds } })
      toaster.success('bookmarks reordered')
    } catch (err) {
      console.error(err)
      toaster.danger('failed to reorder bookmarks')
      setOrderedItems(items || [])
    }
  }, [reorderBookmarks, toaster])

  const visibleItems = useMemo(() => (orderedItems || []).filter(item => item?.meBookmark === true), [orderedItems])

  return (
    <DndProvider items={visibleItems} onReorder={(newItems) => { setOrderedItems(newItems); handleReorder(newItems) }}>
      <div className={styles.grid}>
        {visibleItems.map((item, i) => (
          <DraggableBookmarkItem key={item.id} item={item} index={i}>
            <ListItem item={item} itemClassName={variables.includeComments ? 'py-2' : ''} pinnable={false} />
          </DraggableBookmarkItem>
        ))}
      </div>
      <MoreFooter
        cursor={cursor} fetchMore={fetchMore}
        count={visibleItems.length}
        Skeleton={Skeleton}
      />
    </DndProvider>
  )
}
