import LoopVideo from '@/components/loop-video'
import { StaticLayout } from '@/components/layout'
import styles from '@/styles/error.module.css'

export default function offline () {
  return (
    <StaticLayout>
      <LoopVideo src={`${process.env.NEXT_PUBLIC_ASSET_PREFIX}/sleeping.mp4`} width='498' height='292' />
      <h1 className={styles.status}><span>Offline</span></h1>
    </StaticLayout>
  )
}
