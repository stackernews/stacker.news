import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { MultiSelect, Select } from './form'
import { EXTRA_LONG_POLL_INTERVAL_MS, SSR } from '@/lib/constants'
import { ACTIVE_SUBS, SUB } from '@/fragments/subs'
import { useLazyQuery, useQuery } from '@apollo/client'
import styles from './sub-select.module.css'
import { useMe } from './me'
import { useShowModal } from './modal'
import { TerritoryInfo } from './territory-header'

export function SubSelectInitial ({ item, subs }) {
  const router = useRouter()
  const subNames = item?.subNames || subs?.map(s => s.name) || router.query.sub?.split('~').filter(Boolean)

  return {
    subNames: subNames || []
  }
}

const DEFAULT_PREPEND_SUBS = []
const DEFAULT_APPEND_SUBS = []
const DEFAULT_FILTER_SUBS = () => true

export function useSubs ({ prependSubs = DEFAULT_PREPEND_SUBS, sub, filterSubs = DEFAULT_FILTER_SUBS, appendSubs = DEFAULT_APPEND_SUBS }) {
  const { data, refetch } = useQuery(ACTIVE_SUBS, SSR
    ? {}
    : {
        pollInterval: EXTRA_LONG_POLL_INTERVAL_MS,
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

    const joined = data.activeSubs.filter(filterSubs).filter(s => !s.meMuteSub).map(s => s.name)
    const muted = data.activeSubs.filter(filterSubs).filter(s => s.meMuteSub).map(s => s.name)
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
          // if in /top/cowboys, /top/territories, or /top/stackers
          // and a territory is selected, go to /~sub/top/posts/day
          if (router.pathname.startsWith('/~/top/cowboys')) {
            router.push(sub ? `/~${sub}/top/posts/day` : '/top/cowboys')
            return
          } else if (router.pathname.startsWith('/~/top/stackers')) {
            router.push(sub ? `/~${sub}/top/posts/day` : 'top/stackers/day')
            return
          } else if (router.pathname.startsWith('/~/top/territories')) {
            router.push(sub ? `/~${sub}/top/posts/day` : '/top/territories/day')
            return
          } else if (router.pathname.startsWith('/~')) {
            // are we in a sub aware route?
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

export function SubMultiSelect ({ prependSubs, subs, onChange, size, appendSubs, filterSubs, className, ...props }) {
  const router = useRouter()
  const activeSubs = useSubs({ prependSubs, subs, filterSubs, appendSubs })
  const valueProps = props.noForm
    ? {
        value: subs
      }
    : {
        overrideValue: subs
      }

  const showModal = useShowModal()
  const [getSub] = useLazyQuery(SUB)

  const handleTerritoryClick = async (subName) => {
    const { data } = await getSub({ variables: { sub: subName } })
    if (data?.sub) {
      showModal(() => <TerritoryInfo sub={data.sub} includeLink />)
    }
  }

  // If logged out user directly visits a nsfw sub, subs will not contain `sub`, so manually add it
  // to display the correct sub name in the sub selector
  // const subItems = !sub || subs.find((s) => s === sub) ? subs : [sub].concat(subs)

  return (
    <MultiSelect
      id='subNames'
      onValueClick={handleTerritoryClick}
      onChange={onChange || ((_, e) => {
        // NOTE: a lot of this is not used yet, because this component is only used in PostForm,
        // but we'll keep it here for future use
        if (e.length === 1 && e.includes('create')) {
          router.push('/territory')
          return
        }
        const sub = e.length ? e.join('~') : undefined

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
          // if in /top/cowboys, /top/territories, or /top/stackers
          // and a territory is selected, go to /~sub/top/posts/day
          if (router.pathname.startsWith('/~/top/cowboys')) {
            router.push(sub ? `/~${sub}/top/posts/day` : '/top/cowboys')
            return
          } else if (router.pathname.startsWith('/~/top/stackers')) {
            router.push(sub ? `/~${sub}/top/posts/day` : 'top/stackers/day')
            return
          } else if (router.pathname.startsWith('/~/top/territories')) {
            router.push(sub ? `/~${sub}/top/posts/day` : '/top/territories/day')
            return
          } else if (router.pathname.startsWith('/~')) {
            // are we in a sub aware route?
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
      name='subNames'
      size='md'
      {...valueProps}
      {...props}
      className={`${className} ${styles.subSelect} ${size === 'large' ? styles.subSelectLarge : size === 'medium' ? styles.subSelectMedium : ''}`}
      items={activeSubs}
    />
  )
}
