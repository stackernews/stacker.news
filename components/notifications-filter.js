import { useState, useCallback, useMemo } from 'react'
import { useShowModal } from './modal'
import { useRouter } from 'next/router'
import { NOTIFICATION_CATEGORIES } from '../lib/constants'
import { Checkbox, Form, SubmitButton } from './form'
import FilterIcon from '@/svgs/equalizer-line.svg'
import styles from './notifications-filter.module.css'

export const getFiltersFromInc = (inc) => {
  const filters = new Set(inc?.split(',') || [])
  filters.delete('')
  return filters
}

export const getSavedFilters = () => {
  const savedFilters = JSON.parse(window.localStorage.getItem('notificationFilters'))
  return savedFilters ? new Set(savedFilters) : new Set()
}

export function NotificationsFilter ({ onClose }) {
  const router = useRouter()

  const appliedFilters = useMemo(() => {
    const incFilters = getFiltersFromInc(router.query.inc)
    return incFilters.size ? incFilters : getSavedFilters()
  }, [router.query.inc])

  const [filters, setFilters] = useState(appliedFilters)

  const handleFilters = useCallback((filter, add) => {
    setFilters(prev => {
      const newFilters = new Set(prev)
      add ? newFilters.add(filter) : newFilters.delete(filter)
      return newFilters
    })
  }, [])

  const filterRoutePush = useCallback(() => {
    window.localStorage.setItem('notificationFilters', JSON.stringify([...filters]))
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
        filter by:
        {filters.size ? ` ${[...filters].join(', ')}` : ' all'}
      </p>
      <Form
        initial={filters}
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
              checked={filters.has(category)}
              handleChange={(c) => handleFilters(category, c)}
            />
          ))}
        </div>
        <div className='d-flex flex-row gap-2 mt-4 justify-content-end'>
          {filters.size ? <SubmitButton variant='secondary' className='px-4' onClick={() => setFilters(new Set())}>reset</SubmitButton> : null}
          <SubmitButton variant='primary' className='px-4'>apply filters</SubmitButton>
        </div>
      </Form>
    </div>
  )
}

export default function NotificationsHeader () {
  const showModal = useShowModal()
  const router = useRouter()

  const hasActiveFilters = useMemo(() => {
    const incFilters = getFiltersFromInc(router.query.inc)
    return incFilters.size > 0
  })

  return (
    <div className='d-flex align-items-center gap-2'>
      <h2 className='mt-1 text-start'>notifications</h2>
      <FilterIcon
        width={20}
        height={20}
        className={hasActiveFilters ? styles.filterIconActive : styles.filterIcon}
        onClick={() => {
          showModal((onClose) => (
            <NotificationsFilter onClose={onClose} />
          ))
        }}
      />
    </div>
  )
}
