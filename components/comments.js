import { useQuery } from '@apollo/client'
import Comment, { CommentSkeleton } from './comment'

export default function Comments ({ comments, ...props }) {
  return comments.map(item => (
    <Comment key={item.id} item={item} {...props} />
  ))
}

export function CommentsSkeleton () {
  return <CommentSkeleton skeletonChildren={7} />
}

export function CommentsQuery ({ query, ...props }) {
  const { loading, error, data } = useQuery(query)

  if (error) return <div>Failed to load!</div>
  if (loading) {
    return <CommentsSkeleton />
  }

  return <Comments comments={data.comments} {...props} />
}
