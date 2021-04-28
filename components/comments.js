import { useQuery } from '@apollo/client'
import Comment, { CommentSkeleton } from './comment'

export default function Comments ({ comments, ...props }) {
  return comments.map(item => (
    <Comment key={item.id} item={item} {...props} />
  ))
}

export function CommentsSkeleton () {
  const comments = new Array(1).fill(null)

  return comments.map((_, i) => (
    <CommentSkeleton key={i} skeletonChildren={2} />
  ))
}

export function CommentsQuery ({ query, ...props }) {
  const { loading, error, data } = useQuery(query)

  if (error) return <div>Failed to load!</div>
  if (loading) {
    return <CommentsSkeleton />
  }

  return <Comments comments={data.comments} {...props} />
}
