import { useRouter } from 'next/router'
import { Select } from './form'
import Info from './info'
import { SUBS, SUBS_NO_JOBS } from '../lib/constants'

export function SubSelectInitial ({ sub }) {
  const router = useRouter()
  sub = sub || router.query.sub || 'pick sub'

  return {
    sub
  }
}

export default function SubSelect ({ label, sub, setSub, item, ...props }) {
  const router = useRouter()

  const SubInfo = () => (
    <Info>
      <div>
        <div className='fw-bold'>The sub your post will go in ...</div>
        <ul>
          <li>If it's bitcoin related, put it in the bitcoin sub.</li>
          <li>If it's nostr related, put it in the nostr sub.</li>
          <li>If it's tech related, put it in the tech sub.</li>
          <li>If it's stacker news related, put it in the meta sub.</li>
          <li>If it's a job, put it in the jobs sub.</li>
        </ul>
      </div>
    </Info>
  )

  sub ||= router.query.sub || 'pick sub'
  const extraProps = props.noForm
    ? {
        value: sub,
        items: ['pick sub', ...SUBS]
      }
    : {
        overrideValue: sub,
        items: item ? SUBS_NO_JOBS : ['pick sub', ...SUBS_NO_JOBS]
      }

  return (
    <Select
      className='w-auto d-flex'
      onChange={(formik, e) => {
        if (!item) {
          router.push({
            pathname: e.target.value === 'pick sub' ? '/post' : `/~${e.target.value}/post`,
            query: router.query?.type ? { type: router.query.type } : undefined
          })
        } else {
          setSub(e.target.value)
        }
      }}
      name='sub'
      size='sm'
      {...extraProps}
      label={label &&
        <>
          {label}
          <SubInfo />
        </>}
      {...props}
    />
  )
}
