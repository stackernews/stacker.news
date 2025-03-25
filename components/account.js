import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/router'
import * as cookie from 'cookie'
import { USER_ID, SSR } from '@/lib/constants'
import { USER } from '@/fragments/users'
import { useQuery } from '@apollo/client'
import { UserListRow } from '@/components/user-list'
import Link from 'next/link'
import AddIcon from '@/svgs/add-fill.svg'
import { cookieOptions, MULTI_AUTH_ANON, MULTI_AUTH_LIST, MULTI_AUTH_POINTER } from '@/lib/auth'
import { signIn } from 'next-auth/react'

const AccountContext = createContext()

const b64Decode = str => Buffer.from(str, 'base64').toString('utf-8')

export const AccountProvider = ({ children }) => {
  const [accounts, setAccounts] = useState([])
  const [selected, setSelected] = useState(null)
  const router = useRouter()

  // TODO: alternative to this, for test only
  useEffect(() => {
    console.log(router.query)
    if (router.query.type === 'sync') {
      console.log('signing in with sync')
      signIn('sync', { token: router.query.token, callbackUrl: router.query.callbackUrl, multiAuth: router.query.multiAuth, redirect: false })
    }
  }, [])

  const updateAccountsFromCookie = useCallback(() => {
    const { [MULTI_AUTH_LIST]: listCookie } = cookie.parse(document.cookie)
    const accounts = listCookie
      ? JSON.parse(b64Decode(listCookie))
      : []
    setAccounts(accounts)
  }, [])

  const nextAccount = useCallback(async () => {
    const { status } = await fetch('/api/next-account', { credentials: 'include' })
    // if status is 302, this means the server was able to switch us to the next available account
    // and the current account was simply removed from the list of available accounts including the corresponding JWT.
    const switchSuccess = status === 302
    if (switchSuccess) updateAccountsFromCookie()
    return switchSuccess
  }, [updateAccountsFromCookie])

  useEffect(() => {
    if (SSR) return

    updateAccountsFromCookie()

    const { [MULTI_AUTH_POINTER]: pointerCookie } = cookie.parse(document.cookie)
    setSelected(pointerCookie === MULTI_AUTH_ANON ? USER_ID.anon : Number(pointerCookie))
  }, [updateAccountsFromCookie])

  const value = useMemo(
    () => ({
      accounts,
      selected,
      nextAccount
    }),
    [accounts, selected, nextAccount])
  return <AccountContext.Provider value={value}>{children}</AccountContext.Provider>
}

export const useAccounts = () => useContext(AccountContext)

const AccountListRow = ({ account, ...props }) => {
  const { selected } = useAccounts()
  const router = useRouter()

  // fetch updated names and photo ids since they might have changed since we were issued the JWTs
  const { data, error } = useQuery(USER,
    {
      variables: { id: account.id }
    }
  )
  if (error) console.error(`query for user ${account.id} failed:`, error)

  const name = data?.user?.name || account.name
  const photoId = data?.user?.photoId || account.photoId

  const onClick = async (e) => {
    // prevent navigation
    e.preventDefault()

    // update pointer cookie
    const options = cookieOptions({ httpOnly: false })
    const anon = account.id === USER_ID.anon
    document.cookie = cookie.serialize(MULTI_AUTH_POINTER, anon ? MULTI_AUTH_ANON : account.id, options)

    // reload whatever page we're on to avoid any bugs due to missing authorization etc.
    router.reload()
  }

  return (
    <div className='d-flex flex-row'>
      <UserListRow
        user={{ ...account, photoId, name }}
        className='d-flex align-items-center me-2'
        {...props}
        onNymClick={onClick}
        selected={selected === account.id}
      />
    </div>
  )
}

export default function SwitchAccountList () {
  const { accounts } = useAccounts()
  const router = useRouter()

  // can't show hat since the streak is not included in the JWT payload
  return (
    <>
      <div className='my-2'>
        <div className='d-flex flex-column flex-wrap mt-2 mb-3'>
          <h4 className='text-muted'>Accounts</h4>
          <AccountListRow account={{ id: USER_ID.anon, name: 'anon' }} showHat={false} />
          {
            accounts.map((account) => <AccountListRow key={account.id} account={account} showHat={false} />)
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
