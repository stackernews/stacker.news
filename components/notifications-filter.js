import { useState, useEffect, useCallback, useMemo } from 'react'
import { useShowModal } from './modal'
import { useRouter } from 'next/router'
import { NOTIFICATION_CATEGORIES } from '../lib/constants'
import { Checkbox, Form, SubmitButton } from './form'
import FilterIcon from '@/svgs/equalizer-line.svg'
import styles from './notifications-filter.module.css'

export function NotificationsFilter ({ onClose }) {
  const router = useRouter()

  const appliedFilters = useMemo(() => {
    const filters = new Set(router.query.inc?.split(',') || [])
    filters.delete('')
    return filters
  }, [router.query.inc])

  const [filters, setFilters] = useState(appliedFilters)

  useEffect(() => {
    setFilters(appliedFilters)
  }, [appliedFilters])

  const handleFilters = useCallback((filter, add) => {
    setFilters(prev => {
      const newFilters = new Set(prev)
      if (add) {
        newFilters.add(filter)
      } else {
        newFilters.delete(filter)
      }
      return newFilters
    })
  }, [])

  const filterRoutePush = useCallback(() => {
    const incstr = [...filters].join(',')
    router.replace( // replace is necessary as lastChecked needs to stay to avoid re-refreshes
      {
        pathname: '/notifications',
        query: {
          ...router.query,
          inc: incstr || undefined
        }
      },
      `/notifications${incstr ? `?inc=${incstr}` : ''}`, // inc can stay visible in the URL
      { shallow: true }
    )
  }, [filters, router])

  return (
    <div>
      <h2 className='mb-2 text-start'>notifications filter</h2>
      <p className='mt-2 text-muted'>
        filtering by:
        {filters.size ? ` ${[...filters].join(', ')}` : ' all'}
      </p>
      <Form
        initial={filters || []}
        onSubmit={() => {
          filterRoutePush()
          onClose?.()
        }}
      >
        <div className='d-flex flex-row flex-wrap mt-4'>
          {NOTIFICATION_CATEGORIES.map((category) => (
            <Checkbox
              key={category}
              label={category}
              name={category}
              inline
              checked={filters?.has(category)}
              handleChange={(c) => handleFilters(category, c)}
            />
          ))}
        </div>
        <div className='d-flex flex-row gap-2 mt-4 justify-content-end'>
          {filters.size ? <SubmitButton variant='secondary' className='mt-1 px-4' onClick={() => setFilters(new Set())}>reset</SubmitButton> : null}
          <SubmitButton variant='primary' className='mt-1 px-4'>apply filters</SubmitButton>
        </div>
      </Form>
    </div>
  )
}

export default function NotificationsHeader () {
  const showModal = useShowModal()
  const router = useRouter()
  const [active, setActive] = useState(router.query.inc?.length)

  useEffect(() => {
    setActive(router.query.inc?.length)
  }, [router.query.inc])

  return (
    <div className='d-flex align-items-center gap-2'>
      <h2 className='mt-1 text-start'>notifications</h2>
      <FilterIcon
        width={20}
        height={20}
        className={active ? styles.filterIconActive : styles.filterIcon}
        onClick={() => {
          showModal((onClose) => (
            <NotificationsFilter onClose={onClose} />
          ))
        }}
      />
    </div>
  )
}
