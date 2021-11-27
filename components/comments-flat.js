import { useQuery } from '@apollo/client'
import { MORE_FLAT_COMMENTS } from '../fragments/comments'
import Comment, { CommentSkeleton } from './comment'
import { useRouter } from 'next/router'
import MoreFooter from './more-footer'

export default function CommentsFlat ({ variables, comments, cursor, ...props }) {
  const router = useRouter()
  const { data, fetchMore } = useQuery(MORE_FLAT_COMMENTS, {
    variables
  })

  if (!data && !comments) {
    return <CommentsFlatSkeleton />
  }

  if (data) {
    ({ moreFlatComments: { comments, cursor } } = data)
  }

  return (
    <>
      {comments.map(item => (
        <div
          key={item.id}
          className='clickToContext py-2'
          onClick={() => {
            router.push({
              pathname: '/items/[id]',
              query: { id: item.root.id, commentId: item.id }
            }, `/items/${item.root.id}`)
          }}
        >
          <Comment item={item} {...props} />
        </div>
      ))}
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
