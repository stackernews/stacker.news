import { signOut, signIn, useSession } from 'next-auth/client'

export default function Header () {
  const [session, loading] = useSession()

  if (loading) {
    return <p>Validating session ...</p>
  }

  if (session) {
    return (
      <>
        <p>
          {session.user.name} ({session.user.email})
        </p>
        <button onClick={() => signOut()}>
          <a>Log out</a>
        </button>
      </>
    )
  }

  return (
    <button onClick={() => signIn()}>
      <a>Log in</a>
    </button>
  )
}
