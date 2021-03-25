import useSWR from 'swr'
import Header from '../components/header'

const fetcher = (query) =>
  fetch('/api/graphql', {
    method: 'POST',
    headers: {
      'Content-type': 'application/json'
    },
    body: JSON.stringify({ query })
  })
    .then((res) => res.json())
    .then((json) => json.data)

export default function Index () {
  const { data, error } = useSWR('{ users { name } }', fetcher)

  if (error) return <div>Failed to load</div>
  if (!data) return <div>Loading...</div>

  const { users } = data

  return (
    <div>
      <Header />
      {users.map((user, i) => (
        <div key={i}>{user.name}</div>
      ))}
    </div>
  )
}
