import { useRouter } from 'next/router'
import LogMessage from './log-message'
import { useWalletLogger, useWalletLogs } from './logger'
import { useEffect, useRef, useState } from 'react'
import { Checkbox, Form } from './form'
import { useField } from 'formik'
import styles from '@/styles/log.module.css'
import { Button } from 'react-bootstrap'
import { useToast } from './toast'
import { useShowModal } from './modal'

const FollowCheckbox = ({ value, ...props }) => {
  const [,, helpers] = useField(props.name)

  useEffect(() => {
    helpers.setValue(value)
  }, [value])

  return (
    <Checkbox {...props} />
  )
}

export default function WalletLogs ({ wallet, embedded }) {
  const logs = useWalletLogs(wallet)

  const router = useRouter()
  const { follow: defaultFollow } = router.query
  const [follow, setFollow] = useState(defaultFollow ?? true)
  const tableRef = useRef()
  const scrollY = useRef()
  const showModal = useShowModal()

  useEffect(() => {
    if (follow) {
      tableRef.current?.scroll({ top: tableRef.current.scrollHeight, behavior: 'smooth' })
    }
  }, [logs, follow])

  useEffect(() => {
    function onScroll (e) {
      const y = e.target.scrollTop

      const down = y - scrollY.current >= -1
      if (!!scrollY.current && !down) {
        setFollow(false)
      }

      const maxY = e.target.scrollHeight - e.target.clientHeight
      const dY = maxY - y
      const isBottom = dY >= -1 && dY <= 1
      if (isBottom) {
        setFollow(true)
      }

      scrollY.current = y
    }
    tableRef.current?.addEventListener('scroll', onScroll)
    return () => tableRef.current?.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <>
      <div className='d-flex w-100 align-items-center mb-3'>
        <Form initial={{ follow: true }}>
          <FollowCheckbox
            label='follow logs' name='follow' value={follow}
            handleChange={setFollow} groupClassName='mb-0'
          />
        </Form>
        <Button
          className='text-muted fw-bold nav-link' onClick={() => {
            showModal(onClose => <DeleteWalletLogsObstacle wallet={wallet} onClose={onClose} />)
          }}
          variant='link'
        >clear
        </Button>
      </div>
      <div ref={tableRef} className={`${styles.logTable} ${embedded ? styles.embedded : ''}`}>
        <div className='w-100 text-center'>------ start of logs ------</div>
        {logs.length === 0 && <div className='w-100 text-center'>empty</div>}
        <table>
          <tbody>
            {logs.map((log, i) => <LogMessage key={i} {...log} />)}
          </tbody>
        </table>
      </div>
    </>
  )
}

function DeleteWalletLogsObstacle ({ wallet, onClose }) {
  const toaster = useToast()
  const { deleteLogs } = useWalletLogger(wallet)

  return (
    <div className='text-center'>
      {/* TODO: this shows ugly wallet name to user */}
      Do you really want to delete all {wallet} wallet logs?
      <div className='d-flex justify-center align-items-center mt-3 mx-auto'>
        <Button className='d-flex ms-auto text-muted fw-bold nav-link mx-3' variant='link' onClick={onClose}>cancel</Button>
        <Button
          className='d-flex me-auto mx-3' variant='danger'
          onClick={
            async () => {
              try {
                await deleteLogs()
                onClose()
                toaster.success('deleted wallet logs')
              } catch (err) {
                console.error(err)
                toaster.danger('failed to delete logs')
              }
            }
          }
        >delete
        </Button>
      </div>
    </div>
  )
}
