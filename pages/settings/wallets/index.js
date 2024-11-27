import { getGetServerSideProps } from '@/api/ssrApollo'
import Layout from '@/components/layout'
import styles from '@/styles/wallet.module.css'
import Link from 'next/link'
import { useWallets } from '@/wallets/index'
import { useCallback, useState } from 'react'
import { useIsClient } from '@/components/use-client'
import WalletCard from '@/components/wallet-card'
import { useToast } from '@/components/toast'
import BootstrapForm from 'react-bootstrap/Form'
import RecvIcon from '@/svgs/arrow-left-down-line.svg'
import SendIcon from '@/svgs/arrow-right-up-line.svg'
import { useRouter } from 'next/router'
import { supportsReceive, supportsSend } from '@/wallets/common'

export const getServerSideProps = getGetServerSideProps({ authRequired: true })

export default function Wallet ({ ssrData }) {
  const { wallets, setPriorities } = useWallets()
  const toast = useToast()
  const isClient = useIsClient()
  const [sourceIndex, setSourceIndex] = useState(null)
  const [targetIndex, setTargetIndex] = useState(null)

  const router = useRouter()
  const [filter, setFilter] = useState({
    send: router.query.send === 'true',
    receive: router.query.receive === 'true'
  })

  const reorder = useCallback(async (sourceIndex, targetIndex) => {
    const newOrder = [...wallets.filter(w => w.config?.enabled)]
    const [source] = newOrder.splice(sourceIndex, 1)

    const priorities = newOrder.slice(0, targetIndex)
      .concat(source)
      .concat(newOrder.slice(targetIndex))
      .map((w, i) => ({ wallet: w, priority: i }))

    await setPriorities(priorities)
  }, [setPriorities, wallets])

  const onDragStart = useCallback((i) => (e) => {
    // e.dataTransfer.dropEffect = 'move'
    // We can only use the DataTransfer API inside the drop event
    // see https://html.spec.whatwg.org/multipage/dnd.html#security-risks-in-the-drag-and-drop-model
    // e.dataTransfer.setData('text/plain', name)
    // That's why we use React state instead
    setSourceIndex(i)
  }, [setSourceIndex])

  const onDragEnter = useCallback((i) => (e) => {
    setTargetIndex(i)
  }, [setTargetIndex])

  const onReorderError = useCallback((err) => {
    console.error(err)
    toast.danger('failed to reorder wallets')
  }, [toast])

  const onDragEnd = useCallback((e) => {
    setSourceIndex(null)
    setTargetIndex(null)

    if (sourceIndex === targetIndex) return

    reorder(sourceIndex, targetIndex).catch(onReorderError)
  }, [sourceIndex, targetIndex, reorder, onReorderError])

  const onTouchStart = useCallback((i) => (e) => {
    if (sourceIndex !== null) {
      reorder(sourceIndex, i).catch(onReorderError)
      setSourceIndex(null)
    } else {
      setSourceIndex(i)
    }
  }, [sourceIndex, reorder, onReorderError])

  const onFilterChange = useCallback((key) => {
    return e => {
      setFilter(old => ({ ...old, [key]: e.target.checked }))
      router.replace({ query: { ...router.query, [key]: e.target.checked } }, undefined, { shallow: true })
    }
  }, [router])

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
          <div className={styles.walletFilters}>
            <BootstrapForm.Check
              inline
              label={<span><RecvIcon width={16} height={16} /> receive</span>}
              onChange={onFilterChange('receive')}
              checked={filter.receive}
            />
            <BootstrapForm.Check
              inline
              label={<span><SendIcon width={16} height={16} /> send</span>}
              onChange={onFilterChange('send')}
              checked={filter.send}
            />
          </div>
          {wallets
            .filter(w => {
              return (!filter.send || (filter.send && supportsSend(w))) &&
              (!filter.receive || (filter.receive && supportsReceive(w)))
            })
            .map((w, i) => {
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
