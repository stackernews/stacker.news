import { useQuery, gql } from '@apollo/client'
import Comment from './comment'
import { COMMENTS } from '../fragments'

export default function Comments ({ parentId }) {
  const { data } = useQuery(
    gql`
    ${COMMENTS}

    {
      comments(parentId: ${parentId}) {
        ...CommentsRecursive
      }
    }`
  )

  if (!data) return null

  return (
    <div className='mt-5'>
      {data.comments.map(item => (
        <div key={item.id} className='mt-2'>
          <Comment item={item} />
        </div>
      ))}
    </div>
  )
}
