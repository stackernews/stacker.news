import { useRouter } from 'next/router'
import { USER_ID } from '@/lib/constants'
import { USER } from '@/fragments/users'
import { useQuery } from '@apollo/client'
import { UserListRow } from '@/components/user-list'
import useCookie from '@/components/use-cookie'
import Link from 'next/link'
import AddIcon from '@/svgs/add-fill.svg'
import { cookieOptions, MULTI_AUTH_ANON, MULTI_AUTH_LIST, MULTI_AUTH_POINTER } from '@/lib/auth'

const b64Decode = str => Buffer.from(str, 'base64').toString('utf-8')

export const nextAccount = async () => {
  if (typeof window !== 'undefined') window.logoutInProgress = true
  const { status } = await fetch('/api/next-account', { credentials: 'include' })
  // if status is 302, this means the server was able to switch us to the next available account
  return status === 302
}

export default function SwitchAccountList () {
  const router = useRouter()
  const accounts = useAccounts()
  const [pointerCookie] = useCookie(MULTI_AUTH_POINTER)

  return (
    <>
      <div className='my-2'>
        <div className='d-flex flex-column flex-wrap mt-2 mb-3'>
          <h4 className='text-muted'>Accounts</h4>
          <AccountListRow
            account={{ id: USER_ID.anon, name: 'anon' }}
            selected={pointerCookie === MULTI_AUTH_ANON}
            showHat={false}
          />
          {
            accounts.map((account) =>
              <AccountListRow
                key={account.id}
                account={account}
                selected={Number(pointerCookie) === account.id}
                showHat={false}
              />)
          }
        </div>
        <Link
          href={{
            pathname: '/login',
            query: { callbackUrl: window.location.origin + router.asPath, multiAuth: true }
          }}
          className='text-reset fw-bold'
        >
          <AddIcon height={20} width={20} /> another account
        </Link>
      </div>
    </>
  )
}

const AccountListRow = ({ account, selected, ...props }) => {
  const router = useRouter()
  const [, setPointerCookie] = useCookie(MULTI_AUTH_POINTER)

  // fetch updated names and photo ids since they might have changed since we were issued the JWTs
  const { data, error } = useQuery(USER, { variables: { id: account.id } })
  if (error) console.error(`query for user ${account.id} failed:`, error)

  const name = data?.user?.name || account.name
  const photoId = data?.user?.photoId || account.photoId

  const onClick = async (e) => {
    // prevent navigation
    e.preventDefault()
    if (typeof window !== 'undefined') window.logoutInProgress = true
    // update pointer cookie
    const options = cookieOptions({ httpOnly: false })
    const anon = account.id === USER_ID.anon
    setPointerCookie(anon ? MULTI_AUTH_ANON : account.id, options)

    // reload whatever page we're on to avoid any bugs due to missing authorization etc.
    router.reload()
  }

  return (
    <div className='d-flex flex-row'>
      <UserListRow
        user={{ ...account, photoId, name }}
        className='d-flex align-items-center me-2'
        selected={selected}
        {...props}
        onNymClick={onClick}
      />
    </div>
  )
}

export const useAccounts = () => {
  const [listCookie] = useCookie(MULTI_AUTH_LIST)
  return listCookie ? JSON.parse(b64Decode(listCookie)) : []
}
