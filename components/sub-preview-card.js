import { SUB_FULL } from '@/fragments/subs'
import errorStyles from '@/styles/error.module.css'
import { useApolloClient, useQuery } from '@apollo/client/react'
import classNames from 'classnames'
import { PreviewCardRoot, PreviewCardTrigger, PreviewCardContent } from './ui/preview-card'
import { TerritoryInfo, TerritoryInfoSkeleton } from './territory-header'
import { truncateString } from '@/lib/format'

export function SubPreviewTrigger ({ sub, ...props }) {
  const client = useApolloClient()

  const getSub = () => {
    client.query({ query: SUB_FULL, variables: { sub }, fetchPolicy: 'cache-first' }).catch(console.error)
  }

  return <PreviewCardTrigger {...props} payload={sub} onShow={getSub} />
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
