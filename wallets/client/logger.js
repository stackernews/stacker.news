import { Fragment, useState } from 'react'
import { Button } from 'react-bootstrap'
import { useShowModal } from '@/components/modal'
import { useToast } from '@/components/toast'
import { timeSince } from '@/lib/time'
import styles from '@/styles/log.module.css'

export function useWalletLogger (wallet) {
  // TODO(wallet-v2): will we still need this?
  //
  // I want to put all wallet logs on the server, so I think we don't need a logger on the client anymore.
}

export function WalletLogs ({ wallet, embedded }) {
  // TODO(wallet-v2): make sure this still works as intended
  const { logs, setLogs, hasMore, loadMore, loading } = useWalletLogs(wallet)

  const showModal = useShowModal()

  return (
    <>
      <div className='d-flex w-100 align-items-center mb-3'>
        <span
          style={{ cursor: 'pointer' }}
          className='text-muted fw-bold nav-link ms-auto' onClick={() => {
            showModal(onClose => <DeleteWalletLogsObstacle wallet={wallet} setLogs={setLogs} onClose={onClose} />)
          }}
        >clear logs
        </span>
      </div>
      <div className={`${styles.tableContainer} ${embedded ? styles.embedded : ''}`}>
        <table>
          <colgroup>
            <col span='1' style={{ width: '1rem' }} />
            <col span='1' style={{ width: '1rem' }} />
            <col span='1' style={{ width: '1rem' }} />
            <col span='1' style={{ width: '100%' }} />
            <col span='1' style={{ width: '1rem' }} />
          </colgroup>
          <tbody>
            {logs.map((log, i) => (
              <LogMessage
                key={i}
                showWallet={!wallet}
                {...log}
              />
            ))}
          </tbody>
        </table>
        {loading
          ? <div className='w-100 text-center'>loading...</div>
          : logs.length === 0 && <div className='w-100 text-center'>empty</div>}
        {hasMore
          ? <div className='w-100 text-center'><Button onClick={loadMore} size='sm' className='mt-3'>more</Button></div>
          : <div className='w-100 text-center'>------ start of logs ------</div>}
      </div>
    </>
  )
}

function DeleteWalletLogsObstacle ({ wallet, setLogs, onClose }) {
  function deleteLogs (wallet) {
    // TODO(wallet-v2): implement this
  }

  const toaster = useToast()

  let prompt = 'Do you really want to delete all wallet logs?'
  if (wallet) {
    prompt = 'Do you really want to delete all logs of this wallet?'
  }

  return (
    <div className='text-center'>
      {prompt}
      <div className='d-flex justify-center align-items-center mt-3 mx-auto'>
        <span style={{ cursor: 'pointer' }} className='d-flex ms-auto text-muted fw-bold nav-link mx-3' onClick={onClose}>cancel</span>
        <Button
          className='d-flex me-auto mx-3' variant='danger'
          onClick={
            async () => {
              try {
                await deleteLogs(wallet)
                onClose()
                toaster.success('deleted wallet logs')
              } catch (err) {
                console.error(err)
                toaster.danger('failed to delete wallet logs')
              }
            }
          }
        >delete
        </Button>
      </div>
    </div>
  )
}

export function useWalletLogs (wallet, initialPage = 1, logsPerPage = 10) {
  // TODO(wallet-v2): implement this
}

export default function LogMessage ({ showWallet, wallet, level, message, context, ts }) {
  const [show, setShow] = useState(false)

  let className
  switch (level.toLowerCase()) {
    case 'ok':
    case 'success':
      level = 'ok'
      className = 'text-success'; break
    case 'error':
      className = 'text-danger'; break
    case 'warn':
      className = 'text-warning'; break
    default:
      className = 'text-info'
  }

  const filtered = context
    ? Object.keys(context)
      .filter(key => !['send', 'recv', 'status'].includes(key))
      .reduce((obj, key) => {
        obj[key] = context[key]
        return obj
      }, {})
    : {}

  const hasContext = context && Object.keys(filtered).length > 0

  const handleClick = () => {
    if (hasContext) { setShow(show => !show) }
  }

  const style = hasContext ? { cursor: 'pointer' } : { cursor: 'inherit' }
  const indicator = hasContext ? (show ? '-' : '+') : <></>

  return (
    <>
      <tr className={styles.tableRow} onClick={handleClick} style={style}>
        <td className={styles.timestamp}>{timeSince(new Date(ts))}</td>
        {showWallet ? <td className={styles.wallet}>[{wallet}]</td> : <td className='mx-1' />}
        <td className={`${styles.level} ${className}`}>{level}</td>
        <td>{message}</td>
        <td>{indicator}</td>
      </tr>
      {show && hasContext && Object.entries(filtered)
        .map(([key, value], i) => {
          const last = i === Object.keys(filtered).length - 1
          return (
            <tr className={styles.line} key={i}>
              <td />
              <td className={last ? 'pb-2 pe-1' : 'pe-1'} colSpan='2'>{key}</td>
              <td className={last ? 'text-break pb-2' : 'text-break'}>{value}</td>
            </tr>
          )
        })}
    </>
  )
}
