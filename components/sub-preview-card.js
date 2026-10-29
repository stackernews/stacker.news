import { SUB_FULL } from '@/fragments/subs'
import { isAbortError } from '@/lib/error'
import errorStyles from '@/styles/error.module.css'
import { useLazyQuery, useQuery } from '@apollo/client/react'
import classNames from 'classnames'
import { PreviewCardRoot, PreviewCardTrigger, PreviewCardContent } from './ui/preview-card'
import { TerritoryInfo, TerritoryInfoSkeleton } from './territory-header'
import { truncateString } from '@/lib/format'
import { useCallback } from 'react'

export function SubPreviewTrigger ({ sub, ...props }) {
  const [execute] = useLazyQuery(SUB_FULL, { fetchPolicy: 'cache-first' })

  const getSub = useCallback(() => {
    execute({ variables: { sub } }).catch(err => !isAbortError(err) && console.error(err))
  }, [execute, sub])

  return <PreviewCardTrigger {...props} onShow={getSub} />
}

export function SubPreviewBody ({ sub }) {
  const { loading, data } = useQuery(SUB_FULL, { variables: { sub }, fetchPolicy: 'cache-first' })

  if (!data || loading) return <TerritoryInfoSkeleton />
  if (!data.sub) return <h1 className={classNames(errorStyles.status, errorStyles.describe)}>SUB NOT FOUND</h1>
  return <TerritoryInfo truncated sub={{ ...data.sub, desc: truncateString(data.sub.desc, 280) }} />
}

export default function SubPreviewCard ({ sub, children }) {
  return (
    <PreviewCardRoot>
      <SubPreviewTrigger sub={sub}>{children}</SubPreviewTrigger>
      <PreviewCardContent>
        <SubPreviewBody sub={sub} />
      </PreviewCardContent>
    </PreviewCardRoot>
  )
}
