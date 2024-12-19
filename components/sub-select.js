import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { Select } from './form'
import { EXTRA_LONG_POLL_INTERVAL, SSR } from '@/lib/constants'
import { SUBS } from '@/fragments/subs'
import { useQuery } from '@apollo/client'
import styles from './sub-select.module.css'
import { useMe } from './me'

export function SubSelectInitial ({ sub }) {
  const router = useRouter()
  sub = sub || router.query.sub || 'pick territory'

  return {
    sub
  }
}

const DEFAULT_PREPEND_SUBS = []
const DEFAULT_APPEND_SUBS = []
const DEFAULT_FILTER_SUBS = () => true

export function useSubs ({ prependSubs = DEFAULT_PREPEND_SUBS, sub, filterSubs = DEFAULT_FILTER_SUBS, appendSubs = DEFAULT_APPEND_SUBS }) {
  const { data, refetch } = useQuery(SUBS, SSR
    ? {}
    : {
        pollInterval: EXTRA_LONG_POLL_INTERVAL,
        nextFetchPolicy: 'cache-and-network'
      })

  const { me } = useMe()

  useEffect(() => {
    refetch()
  }, [me?.privates?.nsfwMode])

  const [subs, setSubs] = useState([
    ...prependSubs.filter(s => s !== sub),
    ...(sub ? [sub] : []),
    ...appendSubs.filter(s => s !== sub)])

  useEffect(() => {
    if (!data) return

    const joined = data.subs.filter(filterSubs).filter(s => !s.meMuteSub).map(s => s.name)
    const muted = data.subs.filter(filterSubs).filter(s => s.meMuteSub).map(s => s.name)
    const mutedSection = muted.length ? [{ label: 'muted', items: muted }] : []
    setSubs([
      ...prependSubs,
      ...joined,
      ...mutedSection,
      ...appendSubs])
  }, [data])

  return subs
}

export default function SubSelect ({ prependSubs, sub, onChange, size, appendSubs, filterSubs, className, ...props }) {
  const router = useRouter()
  const subs = useSubs({ prependSubs, sub, filterSubs, appendSubs })
  const valueProps = props.noForm
    ? {
        value: sub
      }
    : {
        overrideValue: sub
      }

  // If logged out user directly visits a nsfw sub, subs will not contain `sub`, so manually add it
  // to display the correct sub name in the sub selector
  const subItems = !sub || subs.find((s) => s === sub) ? subs : [sub].concat(subs)

  return (
    <Select
      onChange={onChange || ((_, e) => {
        const sub = ['home', 'pick territory'].includes(e.target.value) ? undefined : e.target.value
        if (sub === 'create') {
          router.push('/territory')
          return
        }

        let asPath
        // are we currently in a sub (ie not home)
        if (router.query.sub) {
          // are we going to a sub or home?
          const subReplace = sub ? `/~${sub}` : ''

          // if we are going to a sub, replace the current sub with the new one
          asPath = router.asPath.replace(`/~${router.query.sub}`, subReplace)
          // if we're going to home, just go there directly
          if (asPath === '') {
            router.push('/')
            return
          }
        } else {
          // we're currently on the home sub
          // are we in a sub aware route?
          if (router.pathname.startsWith('/~')) {
            // if we are, go to the same path but in the sub
            asPath = `/~${sub}` + router.asPath
          } else {
            // otherwise, just go to the sub
            router.push(sub ? `/~${sub}` : '/')
            return
          }
        }
        const query = {
          ...router.query,
          sub
        }
        delete query.nodata
        router.push({
          pathname: router.pathname,
          query
        }, asPath)
      })}
      name='sub'
      size='sm'
      {...valueProps}
      {...props}
      className={`${className} ${styles.subSelect} ${size === 'large' ? styles.subSelectLarge : size === 'medium' ? styles.subSelectMedium : ''}`}
      items={subItems}
    />
  )
}
