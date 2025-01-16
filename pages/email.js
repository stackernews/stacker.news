import Image from 'react-bootstrap/Image'
import { StaticLayout } from '@/components/layout'
import { getGetServerSideProps } from '@/api/ssrApollo'
import { useRouter } from 'next/router'
import { useState, useEffect, useCallback } from 'react'
import { Form, SubmitButton, PasswordInput } from '@/components/form'
import { emailTokenSchema } from '@/lib/validate'

// force SSR to include CSP nonces
export const getServerSideProps = getGetServerSideProps({ query: null })

export default function Email () {
  const router = useRouter()
  const [callback, setCallback] = useState(null) // callback.email, callback.callbackUrl
  const [isPWA, setIsPWA] = useState(false)

  const checkPWA = () => {
    const androidPWA = window.matchMedia('(display-mode: standalone)').matches
    const iosPWA = window.navigator.standalone === true
    setIsPWA(androidPWA || iosPWA)
  }

  useEffect(() => {
    checkPWA()
    setCallback(JSON.parse(window.sessionStorage.getItem('callback')))
  }, [])

  // build and push the final callback URL
  const pushCallback = useCallback((token) => {
    const url = `/api/auth/callback/email?${callback.callbackUrl ? `callbackUrl=${callback.callbackUrl}` : ''}&token=${token}&email=${encodeURIComponent(callback.email)}`
    router.push(url)
  }, [callback, router])

  return (
    <StaticLayout>
      <div className='p-4 text-center'>
        <video width='640' height='302' loop autoPlay muted preload='auto' playsInline style={{ maxWidth: '100%' }}>
          <source src={`${process.env.NEXT_PUBLIC_ASSET_PREFIX}/cowboy-saloon.mp4`} type='video/mp4' />
          <Image className='rounded-1 shadow-sm' width='640' height='302' src={`${process.env.NEXT_PUBLIC_ASSET_PREFIX}/cowboy-saloon.gif`} fluid />
        </video>
        <h2 className='pt-4'>Check your email</h2>
        <h4 className='text-muted pt-2 pb-4'>a 5-minutes {isPWA ? 'magic code' : 'sign in link'} has been sent to {callback ? callback.email : 'your email address'}</h4>
        {isPWA && <MagicCodeForm onSubmit={(token) => pushCallback(token)} />}
      </div>
    </StaticLayout>
  )
}

export const MagicCodeForm = ({ onSubmit }) => {
  return (
    <Form
      initial={{
        token: ''
      }}
      schema={emailTokenSchema}
      onSubmit={({ token }) => { onSubmit(token.toLowerCase()) }}
    >
      <PasswordInput name='token' required placeholder='input your 6-digit magic code' />
      <SubmitButton variant='primary' className='px-4'>verify</SubmitButton>
    </Form>
  )
}
