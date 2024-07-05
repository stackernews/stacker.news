import { getGetServerSideProps } from '@/api/ssrApollo'
import Layout from '@/components/layout'
import styles from '@/styles/wallet.module.css'
import { WALLETS as WALLETS_QUERY } from '@/fragments/wallet'
import Link from 'next/link'
import { WALLET_DEFS } from '@/components/wallet'
import { useState } from 'react'
import dynamic from 'next/dynamic'

const WalletCard = dynamic(() => import('@/components/wallet-card'), { ssr: false })

export const getServerSideProps = getGetServerSideProps({ query: WALLETS_QUERY, authRequired: true })

export default function Wallet ({ ssrData }) {
  const [wallets, setWallets] = useState(WALLET_DEFS)
  const [sourceIndex, setSourceIndex] = useState()
  const [targetIndex, setTargetIndex] = useState()

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

  const onDragEnd = (e) => {
    setSourceIndex(null)
    setTargetIndex(null)
    if (sourceIndex === targetIndex) return
    setWallets(wallets => {
      const copy = [...wallets]

      const [source] = copy.splice(sourceIndex, 1)
      const newTargetIndex = sourceIndex < targetIndex ? targetIndex - 1 : targetIndex
      const append = sourceIndex < targetIndex

      copy.splice(newTargetIndex + (append ? 1 : 0), 0, source)
      return copy
    })
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
          {wallets
            .map((def, i) =>
              <div
                key={def.name}
                draggable
                onDragStart={onDragStart(i)}
                onDragEnter={onDragEnter(i)}
                className={`${sourceIndex === i ? styles.drag : ''} ${targetIndex === i ? styles.drop : ''}`}
              >
                <WalletCard name={def.name} {...def.card} />
              </div>
            )}
        </div>
      </div>
    </Layout>
  )
}
