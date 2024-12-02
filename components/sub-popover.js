import { SUB_FULL } from '@/fragments/subs'
import errorStyles from '@/styles/error.module.css'
import { useLazyQuery } from '@apollo/client'
import classNames from 'classnames'
import HoverablePopover from './hoverable-popover'
import { TerritoryInfo, TerritoryInfoSkeleton } from './territory-header'
import { truncateString } from '@/lib/format'

export default function SubPopover ({ sub, children }) {
  const [getSub, { loading, data }] = useLazyQuery(
    SUB_FULL,
    {
      variables: { sub },
      fetchPolicy: 'cache-first'
    }
  )

  return (
    <HoverablePopover
      onShow={getSub}
      trigger={children}
      body={!data || loading
        ? <TerritoryInfoSkeleton />
        : !data.sub
            ? <h1 className={classNames(errorStyles.status, errorStyles.describe)}>SUB NOT FOUND</h1>
            : <TerritoryInfo sub={{ ...data.sub, desc: truncateString(data.sub.desc, 280) }} />}
    />
  )
}
