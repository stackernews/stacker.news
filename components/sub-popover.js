import { SUB_FULL } from '@/fragments/subs'
import errorStyles from '@/styles/error.module.css'
import { useLazyQuery } from '@apollo/client/react'
import classNames from 'classnames'
import HoverablePopover from './hoverable-popover'
import { TerritoryInfo, TerritoryInfoSkeleton } from './territory-header'
import { truncateString } from '@/lib/format'
import { useCallback } from 'react'

export default function SubPopover ({ sub, children }) {
  const [execute, { loading, data }] = useLazyQuery(
    SUB_FULL,
    {
      fetchPolicy: 'cache-first'
    }
  )

  const getSub = useCallback(() => {
    execute({ variables: { sub } })
  }, [execute, sub])

  return (
    <HoverablePopover
      onShow={getSub}
      trigger={children}
      body={!data || loading
        ? <TerritoryInfoSkeleton />
        : !data.sub
            ? <h1 className={classNames(errorStyles.status, errorStyles.describe)}>SUB NOT FOUND</h1>
            : <TerritoryInfo truncated sub={{ ...data.sub, desc: truncateString(data.sub.desc, 280) }} />}
    />
  )
}
