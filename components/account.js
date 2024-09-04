import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import cookie from 'cookie'
import { useMe } from '@/components/me'
import { USER_ID, SSR } from '@/lib/constants'
import { USER } from '@/fragments/users'
import { useApolloClient, useQuery } from '@apollo/client'
import { UserListRow } from '@/components/user-list'

const AccountContext = createContext()

const b64Decode = str => Buffer.from(str, 'base64').toString('utf-8')
const b64Encode = obj => Buffer.from(JSON.stringify(obj)).toString('base64')

const secureCookie = cookie => {
  return window.location.protocol === 'https:' ? cookie + '; Secure' : cookie
}

export const AccountProvider = ({ children }) => {
  const { me } = useMe()
  const [accounts, setAccounts] = useState([])
  const [isAnon, setIsAnon] = useState(true)

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
        document.cookie = secureCookie(`multi_auth=${b64Encode(accounts)}; Path=/`)
      }
    } catch (err) {
      console.error('error parsing cookies:', err)
    }
  }, [setAccounts])

  useEffect(() => {
    updateAccountsFromCookie()
  }, [])

  const addAccount = useCallback(user => {
    setAccounts(accounts => [...accounts, user])
  }, [setAccounts])

  const removeAccount = useCallback(userId => {
    setAccounts(accounts => accounts.filter(({ id }) => id !== userId))
  }, [setAccounts])

  const multiAuthSignout = useCallback(async () => {
    // switch to next available account
    const { status } = await fetch('/api/signout', { credentials: 'include' })
    // if status is 201, this mean the server was able to switch us to the next available account
    // and the current account was simply removed from the list of available accounts including the corresponding JWT.
    // -> update needed to sync state with cookies
    if (status === 201) updateAccountsFromCookie()
    return status
  }, [updateAccountsFromCookie])

  useEffect(() => {
    // document not defined on server
    if (SSR) return
    const { 'multi_auth.user-id': multiAuthUserIdCookie } = cookie.parse(document.cookie)
    setIsAnon(multiAuthUserIdCookie === 'anonymous')
  }, [])

  return <AccountContext.Provider value={{ accounts, addAccount, removeAccount, isAnon, setIsAnon, multiAuthSignout }}>{children}</AccountContext.Provider>
}

export const useAccounts = () => useContext(AccountContext)

const AccountListRow = ({ account, ...props }) => {
  const { isAnon, setIsAnon } = useAccounts()
  const { me, refreshMe } = useMe()
  const anonRow = account.id === USER_ID.anon
  const selected = (isAnon && anonRow) || Number(me?.id) === Number(account.id)
  const client = useApolloClient()

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
    document.cookie = secureCookie(`multi_auth.user-id=${anonRow ? 'anonymous' : account.id}; Path=/`)
    if (anonRow) {
      // order is important to prevent flashes of no session
      setIsAnon(true)
      await refreshMe()
    } else {
      await refreshMe()
      // order is important to prevent flashes of inconsistent data in switch account dialog
      setIsAnon(account.id === USER_ID.anon)
    }
    await client.refetchQueries({ include: 'active' })
  }

  return (
    <div className='d-flex flex-row'>
      <UserListRow user={{ ...account, photoId, name }} className='d-flex align-items-center me-2' {...props} onNymClick={onClick} />
      {selected && <div className='text-muted fst-italic text-muted'>selected</div>}
    </div>
  )
}

export default function SwitchAccountList () {
  const { accounts } = useAccounts()
  const router = useRouter()
  const addAccount = () => {
    router.push({
      pathname: '/login',
      query: { callbackUrl: window.location.origin + router.asPath, multiAuth: true }
    })
  }
  // can't show hat since the streak is not included in the JWT payload
  return (
    <>
      <div className='my-2'>
        <div className='d-flex flex-column flex-wrap'>
          <AccountListRow account={{ id: USER_ID.anon, name: 'anon' }} showHat={false} />
          {
            accounts.map((account) => <AccountListRow key={account.id} account={account} showHat={false} />)
          }
          <div style={{ cursor: 'pointer' }} onClick={addAccount}>+ add account</div>
        </div>
      </div>
    </>
  )
}
