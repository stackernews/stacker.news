import Image from 'react-bootstrap/Image'
import { StaticLayout } from '@/components/layout'
import styles from '@/styles/error.module.css'

export default function offline () {
  return (
    <StaticLayout>
      <Image width='499' height='293' className='rounded-1 shadow-sm' src={`${process.env.NEXT_PUBLIC_ASSET_PREFIX}/waiting.webp`} fluid />
      <h1 className={styles.status}><span>Offline</span></h1>
    </StaticLayout>
  )
}
