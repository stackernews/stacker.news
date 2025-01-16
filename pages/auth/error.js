import Image from 'react-bootstrap/Image'
import { StaticLayout } from '@/components/layout'
import styles from '@/styles/error.module.css'
import LightningIcon from '@/svgs/bolt.svg'
import { useRouter } from 'next/router'
import Button from 'react-bootstrap/Button'

export function getServerSideProps ({ query }) {
  return {
    props: {
      error: query.error
    }
  }
}

export default function AuthError ({ error }) {
  const router = useRouter()

  if (error === 'AccessDenied') {
    return (
      <StaticLayout>
        <Image className='rounded-1 shadow-sm' width='500' height='381' src={`${process.env.NEXT_PUBLIC_ASSET_PREFIX}/forbidden.gif`} fluid />
        <h1 className={[styles.status, styles.smaller].join(' ')}><span>ACCESS DENIED</span></h1>
      </StaticLayout>
    )
  } else if (error === 'Verification') {
    return (
      <StaticLayout>
        <Image className='rounded-1 shadow-sm' width='500' height='375' src={`${process.env.NEXT_PUBLIC_ASSET_PREFIX}/double.gif`} fluid />
        <h2 className='pt-4'>Where did the magic go?</h2>
        <h4 className='text-muted pt-2'>Get another magic code by logging in or try again by going back.</h4>
        <Button
          className='align-items-center my-3'
          style={{ borderWidth: '2px' }}
          id='login'
          onClick={() => router.push('/login')}
          size='lg'
        >
          <LightningIcon
            width={24}
            height={24}
            className='me-2'
          />login
        </Button>
      </StaticLayout>
    )
  } else if (error === 'Configuration') {
    return (
      <StaticLayout>
        <Image className='rounded-1 shadow-sm' width='500' height='375' src={`${process.env.NEXT_PUBLIC_ASSET_PREFIX}/double.gif`} fluid />
        <h1 className={[styles.status, styles.smaller].join(' ')}><span>configuration error</span></h1>
      </StaticLayout>
    )
  }

  return (
    <StaticLayout>
      <Image className='rounded-1 shadow-sm' width='500' height='375' src={`${process.env.NEXT_PUBLIC_ASSET_PREFIX}/double.gif`} fluid />
      <h1 className={[styles.status, styles.smaller].join(' ')}><span>auth error</span></h1>
    </StaticLayout>

  )
}
