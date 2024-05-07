import { ITEM } from '@/fragments/items'
import errorStyles from '@/styles/error.module.css'
import { useLazyQuery } from '@apollo/client'
import classNames from 'classnames'
import { useRef, useState } from 'react'
import { Popover } from 'react-bootstrap'
import OverlayTrigger from 'react-bootstrap/OverlayTrigger'
import { ItemSummary, ItemSkeleton } from './item'
import styles from './item-popover.module.css'

export default function ItemPopover ({ id, children }) {
  const [showOverlay, setShowOverlay] = useState(false)

  const [getItem, { loading, data }] = useLazyQuery(
    ITEM,
    {
      variables: { id },
      fetchPolicy: 'cache-first'
    }
  )

  const timeoutId = useRef(null)

  const handleMouseEnter = () => {
    clearTimeout(timeoutId.current)
    getItem()
    timeoutId.current = setTimeout(() => {
      setShowOverlay(true)
    }, 500)
  }

  const handleMouseLeave = () => {
    clearTimeout(timeoutId.current)
    timeoutId.current = setTimeout(() => setShowOverlay(false), 100)
  }

  return (
    <OverlayTrigger
      show={showOverlay}
      placement='bottom'
      onHide={handleMouseLeave}
      overlay={
        <Popover
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
          className={styles.itemPopover}
        >
          <Popover.Body className={styles.itemPopover}>
            {!data || loading
              ? <ItemSkeleton showUpvote={false} />
              : !data.item
                  ? <h1 className={classNames(errorStyles.status, errorStyles.describe)}>ITEM NOT FOUND</h1>
                  : (
                    <ItemSummary item={data.item} />
                    )}
          </Popover.Body>
        </Popover>
      }
    >
      <span
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        {children}
      </span>
    </OverlayTrigger>
  )
}
