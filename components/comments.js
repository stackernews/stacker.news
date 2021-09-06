import { useQuery } from '@apollo/client'
import { useRouter } from 'next/router'
import { useEffect } from 'react'
import Comment, { CommentSkeleton } from './comment'

export default function Comments ({ comments, ...props }) {
  useEffect(() => {
    // Your code here
    const hash = window.location.hash
    if (hash) {
      document.querySelector(hash).scrollIntoView({ behavior: 'smooth' })
    }
  }, [])

  return comments.map(item => (
    <Comment key={item.id} item={item} {...props} />
  ))
}

export function CommentsSkeleton () {
  return <CommentSkeleton skeletonChildren={7} />
}

export function CommentsQuery ({ query, ...props }) {
  const router = useRouter()
  const { error, data } = useQuery(query, {
    fetchPolicy: router.query.cache ? 'cache-first' : undefined
  })

  if (error) return <div>Failed to load!</div>
  if (!data) {
    return <CommentsSkeleton />
  }

  return <Comments comments={data.comments} {...props} />
}
