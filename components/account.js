import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/router'
import * as cookie from 'cookie'
import { useMe } from '@/components/me'
import { USER_ID, SSR } from '@/lib/constants'
import { USER } from '@/fragments/users'
import { useQuery } from '@apollo/client'
import { UserListRow } from '@/components/user-list'
import Link from 'next/link'
import AddIcon from '@/svgs/add-fill.svg'
import { MultiAuthErrorBanner } from '@/components/banners'
import { cookieOptions, MULTI_AUTH_ANON, MULTI_AUTH_LIST, MULTI_AUTH_POINTER } from '@/lib/auth'

const AccountContext = createContext()

const CHECK_ERRORS_INTERVAL_MS = 5_000

const b64Decode = str => Buffer.from(str, 'base64').toString('utf-8')

export const AccountProvider = ({ children }) => {
  const [accounts, setAccounts] = useState([])
  const [meAnon, setMeAnon] = useState(true)
  const [errors, setErrors] = useState([])

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

  const checkErrors = useCallback(() => {
    const {
      [MULTI_AUTH_LIST]: listCookie,
      [MULTI_AUTH_POINTER]: pointerCookie
    } = cookie.parse(document.cookie)

    const errors = []

    if (!listCookie) errors.push(`${MULTI_AUTH_LIST} cookie not found`)
    if (!pointerCookie) errors.push(`${MULTI_AUTH_POINTER} cookie not found`)

    setErrors(errors)
  }, [])

  useEffect(() => {
    if (SSR) return

    updateAccountsFromCookie()

    const { [MULTI_AUTH_POINTER]: pointerCookie } = cookie.parse(document.cookie)
    setMeAnon(pointerCookie === 'anonymous')

    const interval = setInterval(checkErrors, CHECK_ERRORS_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [updateAccountsFromCookie, checkErrors])

  const value = useMemo(
    () => ({
      accounts,
      meAnon,
      setMeAnon,
      nextAccount,
      multiAuthErrors: errors
    }),
    [accounts, meAnon, setMeAnon, nextAccount])
  return <AccountContext.Provider value={value}>{children}</AccountContext.Provider>
}

export const useAccounts = () => useContext(AccountContext)

const AccountListRow = ({ account, ...props }) => {
  const { meAnon, setMeAnon } = useAccounts()
  const { me, refreshMe } = useMe()
  const anonRow = account.id === USER_ID.anon
  const selected = (meAnon && anonRow) || Number(me?.id) === Number(account.id)
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
    document.cookie = cookie.serialize(MULTI_AUTH_POINTER, anonRow ? MULTI_AUTH_ANON : account.id, options)

    // update state
    if (anonRow) {
      // order is important to prevent flashes of no session
      setMeAnon(true)
      await refreshMe()
    } else {
      await refreshMe()
      // order is important to prevent flashes of inconsistent data in switch account dialog
      setMeAnon(account.id === USER_ID.anon)
    }

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
        selected={selected}
      />
    </div>
  )
}

export default function SwitchAccountList () {
  const { accounts, multiAuthErrors } = useAccounts()
  const router = useRouter()

  const hasError = multiAuthErrors.length > 0

  if (hasError) {
    return (
      <>
        <div className='my-2'>
          <div className='d-flex flex-column flex-wrap mt-2 mb-3'>
            <MultiAuthErrorBanner errors={multiAuthErrors} />
          </div>
        </div>
      </>
    )
  }

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
