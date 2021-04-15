import { useQuery, gql } from '@apollo/client'
import Comment from './comment'

export default function Comments ({ parentId, baseDepth }) {
  const { data } = useQuery(
    gql`{
      comments(parentId: ${parentId}) {
        id
        createdAt
        text
        user {
          name
        }
        depth
        sats
        ncomments
      }
    }`
  )

  if (!data) return null

  return (
    <div className='mt-5'>
      {data.comments.map(item => (
        <div
          key={item.id} className='mt-2'
          style={{ marginLeft: `${42 * (item.depth - baseDepth - 1)}px` }}
        >
          <Comment item={item} />
        </div>
      ))}
    </div>
  )
}
