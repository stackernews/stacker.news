import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/router'
import { MultiSelect, Select } from './form'
import { EXTRA_LONG_POLL_INTERVAL_MS, SSR } from '@/lib/constants'
import { ACTIVE_SUBS, SUB_FULL } from '@/fragments/subs'
import { useApolloClient, useQuery } from '@apollo/client/react'
import styles from './sub-select.module.css'
import { useMe } from './me'
import { useShowModal } from './modal'
import { TerritoryInfo } from './territory-header'
import { subNames, subNamesFromSlug } from '@/lib/subs'
import { cn } from '@/lib/cn'
import { territoryHref } from '@/lib/navigation'

export function SubSelectInitial ({ item, subs }) {
  const router = useRouter()
  const names = item?.subNames || subNames(subs) || subNamesFromSlug(router.query.sub)

  return {
    subNames: names || []
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
        nextFetchPolicy: 'cache-first'
      })

  const { me } = useMe()

  const nsfwMode = !!me?.privates?.nsfwMode
  const previousNsfwMode = useRef(nsfwMode)

  useEffect(() => {
    if (previousNsfwMode.current === nsfwMode) return
    previousNsfwMode.current = nsfwMode
    refetch()
  }, [nsfwMode, refetch])

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

export default function SubSelect ({ prependSubs, sub, onChange, appendSubs, className, ...props }) {
  const subs = useSubs({ prependSubs, sub, appendSubs })
  // A directly visited NSFW territory can be absent from the active list.
  const containsSub = subs.some(s => s === sub || s.items?.includes(sub))
  const subItems = !sub || containsSub ? subs : [sub, ...subs]

  return (
    <Select
      onChange={onChange}
      name='sub'
      noForm
      value={sub}
      {...props}
      className={cn(styles.subSelect, className)}
      items={subItems}
    />
  )
}

export function SubMultiSelect ({ prependSubs, subs, onChange, appendSubs, filterSubs, className, ...props }) {
  const router = useRouter()
  const client = useApolloClient()
  const activeSubs = useSubs({ prependSubs, subs, filterSubs, appendSubs })
  const valueProps = props.noForm
    ? {
        value: subs
      }
    : {
        overrideValue: subs
      }

  const showModal = useShowModal()

  const handleTerritoryClick = async (subName) => {
    try {
      const { data } = await client.query({
        query: SUB_FULL,
        variables: { sub: subName }
      })
      if (data?.sub) {
        showModal(() => <TerritoryInfo sub={data.sub} includeLink />)
      }
    } catch (err) {
      console.error(err)
    }
  }

  return (
    <MultiSelect
      id='subNames'
      emptyText='no territories found'
      onValueClick={handleTerritoryClick}
      onChange={onChange || ((_, names) => router.push(territoryHref(router.asPath, names.join('~'))))}
      name='subNames'
      size='md'
      {...valueProps}
      {...props}
      className={className}
      items={activeSubs}
    />
  )
}
