import { useQuery } from '@apollo/client'
import { MORE_FLAT_COMMENTS } from '../fragments/comments'
import { CommentFlat, CommentSkeleton } from './comment'
import MoreFooter from './more-footer'

export default function CommentsFlat ({ variables, query, destructureData, comments, cursor, ...props }) {
  const { data, fetchMore } = useQuery(query || MORE_FLAT_COMMENTS, {
    variables
  })

  if (!data && !comments) {
    return <CommentsFlatSkeleton />
  }

  if (data) {
    if (destructureData) {
      ({ comments, cursor } = destructureData(data))
    } else {
      ({ moreFlatComments: { comments, cursor } } = data)
    }
  }

  return (
    <>
      {comments.map(item =>
        <CommentFlat key={item.id} item={item} {...props} />
      )}
      <MoreFooter cursor={cursor} fetchMore={fetchMore} Skeleton={CommentsFlatSkeleton} />
    </>
  )
}

function CommentsFlatSkeleton () {
  const comments = new Array(21).fill(null)

  return (
    <div>{comments.map((_, i) => (
      <CommentSkeleton key={i} skeletonChildren={0} />
    ))}
    </div>
  )
}
