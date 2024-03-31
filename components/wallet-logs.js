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

export default function WalletLogs () {
  const { logs } = useWalletLogger()

  const router = useRouter()
  const { follow: defaultFollow } = router.query
  const [follow, setFollow] = useState(defaultFollow ?? true)
  const tableRef = useRef()
  const scrollY = useRef()
  const tableEndRef = useRef()

  useEffect(() => {
    if (follow) {
      tableEndRef.current?.scrollIntoView({ behavior: 'smooth' })
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

  // TODO add filter by wallet
  return (
    <>
      <Form initial={{ follow: true }}>
        <FollowCheckbox
          label='follow' name='follow' value={follow}
          handleChange={setFollow}
        />
      </Form>
      <div ref={tableRef} className={styles.logTable}>
        <table>
          <tbody>
            <tr><td colSpan='4' className='text-center'>------ start of logs ------</td></tr>
            {logs.map((log, i) => <LogMessage key={i} {...log} />)}
            <tr><td colSpan='4' ref={tableEndRef} /></tr>
          </tbody>
        </table>
      </div>
    </>
  )
}
