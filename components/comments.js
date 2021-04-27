import { useQuery } from '@apollo/client'
import Comment, { CommentSkeleton } from './comment'

export default function Comments ({ comments, ...props }) {
  return comments.map(item => (
    <div key={item.id} className='mt-2'>
      <Comment item={item} {...props} />
    </div>
  ))
}

export function CommentsSkeleton () {
  const comments = new Array(3).fill(null)

  return comments.map((_, i) => (
    <div key={i} className='mt-2'>
      <CommentSkeleton skeletonChildren />
    </div>
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
