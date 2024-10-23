import { getGetServerSideProps } from '@/api/ssrApollo'
import Layout from '@/components/layout'
import styles from '@/styles/wallet.module.css'
import Link from 'next/link'
import { useWallets } from '@/wallets/index'
import { useState } from 'react'
import { useIsClient } from '@/components/use-client'
import WalletCard from '@/components/wallet-card'

export const getServerSideProps = getGetServerSideProps({ authRequired: true })

async function reorder (wallets, sourceIndex, targetIndex) {
  const newOrder = [...wallets]

  const [source] = newOrder.splice(sourceIndex, 1)
  const newTargetIndex = sourceIndex < targetIndex ? targetIndex - 1 : targetIndex
  const append = sourceIndex < targetIndex

  newOrder.splice(newTargetIndex + (append ? 1 : 0), 0, source)

  await Promise.all(
    newOrder.map((w, i) =>
      w.setPriority(i).catch(console.error)
    )
  )
}

export default function Wallet ({ ssrData }) {
  const { wallets } = useWallets()

  const isClient = useIsClient()
  const [sourceIndex, setSourceIndex] = useState(null)
  const [targetIndex, setTargetIndex] = useState(null)

  const onDragStart = (i) => (e) => {
    // e.dataTransfer.dropEffect = 'move'
    // We can only use the DataTransfer API inside the drop event
    // see https://html.spec.whatwg.org/multipage/dnd.html#security-risks-in-the-drag-and-drop-model
    // e.dataTransfer.setData('text/plain', name)
    // That's why we use React state instead
    setSourceIndex(i)
  }

  const onDragEnter = (i) => (e) => {
    setTargetIndex(i)
  }

  const onDragEnd = async (e) => {
    setSourceIndex(null)
    setTargetIndex(null)

    if (sourceIndex === targetIndex) return

    await reorder(wallets, sourceIndex, targetIndex)
  }

  const onTouchStart = (i) => async (e) => {
    if (sourceIndex !== null) {
      await reorder(wallets, sourceIndex, i)
      setSourceIndex(null)
    } else {
      setSourceIndex(i)
    }
  }

  return (
    <Layout>
      <div className='py-5 w-100'>
        <h2 className='mb-2 text-center'>attach wallets</h2>
        <h6 className='text-muted text-center'>attach wallets to supplement your SN wallet</h6>
        <div className='text-center'>
          <Link href='/wallet/logs' className='text-muted fw-bold text-underline'>
            wallet logs
          </Link>
        </div>
        <div className={styles.walletGrid} onDragEnd={onDragEnd}>
          {wallets.map((w, i) => {
            const draggable = isClient && w.config?.enabled

            return (
              <div
                key={w.def.name}
                className={
                    !draggable
                      ? ''
                      : (`${sourceIndex === i ? styles.drag : ''} ${draggable && targetIndex === i ? styles.drop : ''}`)
                    }
                suppressHydrationWarning
              >
                <WalletCard
                  wallet={w}
                  draggable={draggable}
                  onDragStart={draggable ? onDragStart(i) : undefined}
                  onTouchStart={draggable ? onTouchStart(i) : undefined}
                  onDragEnter={draggable ? onDragEnter(i) : undefined}
                  sourceIndex={sourceIndex}
                  targetIndex={targetIndex}
                  index={i}
                />
              </div>
            )
          }
          )}

        </div>
      </div>
    </Layout>
  )
}
