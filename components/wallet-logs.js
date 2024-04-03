import { useRouter } from 'next/router'
import LogMessage from './log-message'
import { useWalletLogger } from './logger'
import { useEffect, useRef, useState } from 'react'
import { Checkbox, Form } from './form'
import { useField } from 'formik'
import styles from '@/styles/log.module.css'

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
  const { logs } = useWalletLogger()

  const router = useRouter()
  const { follow: defaultFollow } = router.query
  const [follow, setFollow] = useState(defaultFollow ?? true)
  const tableRef = useRef()
  const scrollY = useRef()

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

  const filtered = logs.filter(l => !wallet || l.wallet === wallet)

  return (
    <>
      <Form initial={{ follow: true }}>
        <FollowCheckbox
          label='follow logs' name='follow' value={follow}
          handleChange={setFollow}
        />
      </Form>
      <div ref={tableRef} className={`${styles.logTable} ${embedded ? styles.embedded : ''}`}>
        <div className='w-100 text-center'>------ start of logs ------</div>
        {filtered.length === 0 && <div className='w-100 text-center'>empty</div>}
        <table>
          <tbody>
            {filtered.map((log, i) => <LogMessage key={i} {...log} />)}
          </tbody>
        </table>
      </div>
    </>
  )
}
