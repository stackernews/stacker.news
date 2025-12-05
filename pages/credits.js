import { getGetServerSideProps } from '@/api/ssrApollo'
import CCInfo from '@/components/info/cc'
import { Form, Input, SubmitButton } from '@/components/form'
import { CenterLayout } from '@/components/layout'
import { useAnimation } from '@/components/animation'
import { useMe } from '@/components/me'
import { useShowModal } from '@/components/modal'
import usePayInMutation from '@/components/payIn/hooks/use-pay-in-mutation'
import { BUY_CREDITS } from '@/fragments/payIn'
import { amountSchema } from '@/lib/validate'
import classNames from 'classnames'
import { Button, Col, InputGroup, Row } from 'react-bootstrap'
import RewardSatsInfo from '@/components/info/reward-sats'

export const getServerSideProps = getGetServerSideProps({ authRequired: true })

export default function Credits () {
  const { me } = useMe()
  return (
    <CenterLayout footer footerLinks>
      <Row className='w-100 d-none d-sm-flex justify-content-center'>
        <Col>
          <h2 className='text-end me-1 me-md-3'>
            <div className='text-monospace'>
              {me?.privates?.credits}
            </div>
            <div className='text-muted d-flex align-items-baseline justify-content-end'><CCInfo size={16} /> cowboy credits</div>
            <BuyCreditsButton className='ms-auto' />
          </h2>
        </Col>
        <Col>
          <h2 className='text-start ms-1 ms-md-3'>
            <div className='text-monospace'>
              {me?.privates?.sats - me?.privates?.credits}
            </div>
            <div className='text-muted d-flex align-items-baseline justify-content-start'>sats <RewardSatsInfo size={16} /></div>
            <WithdrawButton className='me-auto' />
          </h2>
        </Col>
      </Row>
      <Row className='w-100 d-flex d-sm-none justify-content-center my-5'>
        <Row className='mb-5'>
          <h2 className='text-start'>
            <div className='text-monospace'>
              {me?.privates?.credits}
            </div>
            <div className='text-muted d-flex align-items-baseline justify-content-start'>cowboy credits <CCInfo size={16} /></div>
            <BuyCreditsButton className='me-auto' />
          </h2>
        </Row>
        <Row>
          <h2 className='text-end'>
            <div className='text-monospace'>
              {me?.privates?.sats - me?.privates?.credits}
            </div>
            <div className='text-muted d-flex align-items-baseline justify-content-end'><RewardSatsInfo size={16} /> sats</div>
            <WithdrawButton className='ms-auto' />
          </h2>
        </Row>
      </Row>
    </CenterLayout>
  )
}

function WithdrawButton ({ className }) {
  return (
    <Button
      variant='success'
      className={classNames('mt-3 d-block', className)}
      style={{ width: 'fit-content' }}
      href='/withdraw'
    >withdraw sats
    </Button>
  )
}

export function BuyCreditsButton ({ className }) {
  const showModal = useShowModal()
  const animate = useAnimation()
  const [buyCredits] = usePayInMutation(BUY_CREDITS)

  return (
    <>
      <Button
        onClick={() => showModal(onClose => (
          <Form
            initial={{
              amount: 10000
            }}
            schema={amountSchema}
            onSubmit={async ({ amount }) => {
              const { error } = await buyCredits({
                variables: {
                  credits: Number(amount)
                },
                onCompleted: () => {
                  animate()
                }
              })
              onClose()
              if (error) throw error
            }}
          >
            <Input
              label='amount'
              name='amount'
              type='number'
              required
              autoFocus
              append={<InputGroup.Text className='text-monospace'>sats</InputGroup.Text>}
            />
            <div className='d-flex'>
              <SubmitButton variant='secondary' className='ms-auto mt-1 px-4'>buy</SubmitButton>
            </div>
          </Form>
        ))}
        className={classNames('mt-3 d-block', className)}
        variant='secondary'
      >buy credits
      </Button>
    </>
  )
}
