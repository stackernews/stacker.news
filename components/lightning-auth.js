import { gql, useMutation, useQuery } from '@apollo/client'
import { signIn } from 'next-auth/client'
import { useEffect } from 'react'
import LnQR, { LnQRSkeleton } from './lnqr'

function LnQRAuth ({ k1, encodedUrl, callbackUrl }) {
  const query = gql`
  {
    lnAuth(k1: "${k1}") {
      pubkey
      k1
    }
  }`
  const { data } = useQuery(query, { pollInterval: 1000 })

  if (data && data.lnAuth.pubkey) {
    signIn('credentials', { ...data.lnAuth, callbackUrl })
  }

  // output pubkey and k1
  return (
    <>
      <small className='mb-2'>
        <a className='text-muted text-underline' href='https://github.com/fiatjaf/lnurl-rfc#lnurl-documents' target='_blank' rel='noreferrer' style={{ textDecoration: 'underline' }}>Does my wallet support lnurl-auth?</a>
      </small>
      <LnQR value={encodedUrl} status='waiting for you' />
    </>
  )
}

export function LightningAuth ({ callbackUrl }) {
  // query for challenge
  const [createAuth, { data, error }] = useMutation(gql`
    mutation createAuth {
      createAuth {
        k1
        encodedUrl
      }
    }`)

  useEffect(() => {
    createAuth()
  }, [])

  if (error) return <div>error</div>

  if (!data) {
    return <LnQRSkeleton status='generating' />
  }

  return <LnQRAuth {...data.createAuth} callbackUrl={callbackUrl} />
}
