import { StaticLayout } from '@/components/layout'
import styles from '@/styles/error.module.css'
import { useRouter } from 'next/router'
import Button from 'react-bootstrap/Button'
import LoopVideo from '@/components/loop-video'

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
        <LoopVideo src={`${process.env.NEXT_PUBLIC_ASSET_PREFIX}/blink-look.mp4`} width='640' height='288' />
        <h1 className={[styles.status, styles.smaller].join(' ')}><span>ACCESS DENIED</span></h1>
      </StaticLayout>
    )
  } else if (error === 'Verification') {
    return (
      <StaticLayout>
        <LoopVideo src={`${process.env.NEXT_PUBLIC_ASSET_PREFIX}/blink-look.mp4`} width='640' height='288' />
        <h2 className='pt-4'>Incorrect magic code</h2>
        <Button
          className='align-items-center my-3'
          style={{ borderWidth: '2px' }}
          id='login'
          onClick={() => router.back()}
          size='lg'
        >
          try again
        </Button>
      </StaticLayout>
    )
  } else if (error === 'Configuration') {
    return (
      <StaticLayout>
        <LoopVideo src={`${process.env.NEXT_PUBLIC_ASSET_PREFIX}/blink-look.mp4`} width='640' height='288' />
        <h1 className={[styles.status, styles.smaller].join(' ')}><span>configuration error</span></h1>
      </StaticLayout>
    )
  }

  return (
    <StaticLayout>
      <LoopVideo src={`${process.env.NEXT_PUBLIC_ASSET_PREFIX}/blink-look.mp4`} width='640' height='288' />
      <h1 className={[styles.status, styles.smaller].join(' ')}><span>auth error</span></h1>
    </StaticLayout>

  )
}
