import { useRouter } from 'next/router'
import { useApolloClient } from '@apollo/client/react'
import { MultiSelect } from './multi-select'
import { SUB_FULL } from '@/fragments/subs'
import { useShowModal } from './modal'
import { TerritoryInfo } from './territory-header'
import { useSubs } from './sub-select'
import styles from './sub-select.module.css'

export function SubMultiSelect ({ prependSubs, subs, onChange, size, appendSubs, filterSubs, className, ...props }) {
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
