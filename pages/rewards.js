import { gql } from 'apollo-server-micro'
import { useEffect, useRef, useState } from 'react'
import { Button, InputGroup, Modal } from 'react-bootstrap'
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import { getGetServerSideProps } from '../api/ssrApollo'
import { Form, Input, SubmitButton } from '../components/form'
import LayoutCenter from '../components/layout-center'
import * as Yup from 'yup'
import { useMutation, useQuery } from '@apollo/client'
import Link from 'next/link'

const REWARDS = gql`
{
  expectedRewards {
    total
    sources {
      name
      value
    }
  }
}
`

export const getServerSideProps = getGetServerSideProps(REWARDS)

export default function Rewards ({ data: { expectedRewards: { total, sources } } }) {
  const { data } = useQuery(REWARDS, { pollInterval: 1000 })

  if (data) {
    ({ expectedRewards: { total, sources } } = data)
  }

  return (
    <LayoutCenter footerLinks>
      <h4 className='font-weight-bold text-muted text-center'>
        <div>{total} sats to be rewarded today</div>
        <Link href='/faq#how-do-i-earn-sats-on-stacker-news' passHref>
          <a className='text-reset'><small><small><small>learn about rewards</small></small></small></a>
        </Link>
      </h4>
      <div className='my-3 w-100'>
        <GrowthPieChart data={sources} />
      </div>
      <DonateButton />
    </LayoutCenter>
  )
}

const COLORS = [
  'var(--secondary)',
  'var(--info)',
  'var(--success)',
  'var(--boost)',
  'var(--grey)'
]

function GrowthPieChart ({ data }) {
  return (
    <ResponsiveContainer width='100%' height={250} minWidth={200}>
      <PieChart margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
        <Pie
          dataKey='value'
          isAnimationActive={false}
          data={data}
          cx='50%'
          cy='50%'
          outerRadius={80}
          fill='var(--secondary)'
          label
        >
          {
            data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={COLORS[index]} />
            ))
          }
        </Pie>
        <Tooltip />
      </PieChart>
    </ResponsiveContainer>
  )
}

export const DonateSchema = Yup.object({
  amount: Yup.number().typeError('must be a number').required('required')
    .positive('must be positive').integer('must be whole')
})

export function DonateButton () {
  const [show, setShow] = useState(false)
  const inputRef = useRef(null)
  const [donateToRewards] = useMutation(
    gql`
      mutation donateToRewards($sats: Int!) {
        donateToRewards(sats: $sats)
      }`)

  useEffect(() => {
    inputRef.current?.focus()
  }, [show])

  return (
    <>
      <Button onClick={() => setShow(true)}>DONATE TO REWARDS</Button>
      <Modal
        show={show}
        onHide={() => {
          setShow(false)
        }}
      >
        <div className='modal-close' onClick={() => setShow(false)}>X</div>
        <Modal.Body>
          <Form
            initial={{
              amount: 1000
            }}
            schema={DonateSchema}
            onSubmit={async ({ amount }) => {
              await donateToRewards({
                variables: {
                  sats: Number(amount)
                }
              })
              setShow(false)
            }}
          >
            <Input
              label='amount'
              name='amount'
              innerRef={inputRef}
              required
              autoFocus
              append={<InputGroup.Text className='text-monospace'>sats</InputGroup.Text>}
            />
            <div className='d-flex'>
              <SubmitButton variant='success' className='ml-auto mt-1 px-4' value='TIP'>donate</SubmitButton>
            </div>
          </Form>
        </Modal.Body>
      </Modal>
    </>
  )
}
