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

const AccountContext = createContext()

const b64Decode = str => Buffer.from(str, 'base64').toString('utf-8')
const b64Encode = obj => Buffer.from(JSON.stringify(obj)).toString('base64')

const maybeSecureCookie = cookie => {
  return window.location.protocol === 'https:' ? cookie + '; Secure' : cookie
}

export const AccountProvider = ({ children }) => {
  const { me } = useMe()
  const [accounts, setAccounts] = useState([])
  const [meAnon, setMeAnon] = useState(true)

  const updateAccountsFromCookie = useCallback(() => {
    try {
      const { multi_auth: multiAuthCookie } = cookie.parse(document.cookie)
      const accounts = multiAuthCookie
        ? JSON.parse(b64Decode(multiAuthCookie))
        : me ? [{ id: Number(me.id), name: me.name, photoId: me.photoId }] : []
      setAccounts(accounts)
      // required for backwards compatibility: sync cookie with accounts if no multi auth cookie exists
      // this is the case for sessions that existed before we deployed account switching
      if (!multiAuthCookie && !!me) {
        document.cookie = maybeSecureCookie(`multi_auth=${b64Encode(accounts)}; Path=/`)
      }
    } catch (err) {
      console.error('error parsing cookies:', err)
    }
  }, [])

  useEffect(updateAccountsFromCookie, [])

  const addAccount = useCallback(user => {
    setAccounts(accounts => [...accounts, user])
  }, [])

  const removeAccount = useCallback(userId => {
    setAccounts(accounts => accounts.filter(({ id }) => id !== userId))
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
    const { 'multi_auth.user-id': multiAuthUserIdCookie } = cookie.parse(document.cookie)
    setMeAnon(multiAuthUserIdCookie === 'anonymous')
  }, [])

  const value = useMemo(
    () => ({ accounts, addAccount, removeAccount, meAnon, setMeAnon, nextAccount }),
    [accounts, addAccount, removeAccount, meAnon, setMeAnon, nextAccount])
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
  const [name, setName] = useState(account.name)
  const [photoId, setPhotoId] = useState(account.photoId)
  useQuery(USER,
    {
      variables: { id: account.id },
      onCompleted ({ user: { name, photoId } }) {
        if (photoId) setPhotoId(photoId)
        if (name) setName(name)
      }
    }
  )

  const onClick = async (e) => {
    // prevent navigation
    e.preventDefault()

    // update pointer cookie
    document.cookie = maybeSecureCookie(`multi_auth.user-id=${anonRow ? 'anonymous' : account.id}; Path=/`)

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
