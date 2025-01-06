import { getGetServerSideProps } from '@/api/ssrApollo'
import { Form, Input, SubmitButton } from '@/components/form'
import { CenterLayout } from '@/components/layout'
import { useLightning } from '@/components/lightning'
import { useMe } from '@/components/me'
import { useShowModal } from '@/components/modal'
import { usePaidMutation } from '@/components/use-paid-mutation'
import { BUY_CREDITS } from '@/fragments/paidAction'
import { amountSchema } from '@/lib/validate'
import { Button, Col, InputGroup, Row } from 'react-bootstrap'

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
            <div className='text-muted'>cowboy credits</div>
            <BuyCreditsButton />
          </h2>
        </Col>
        <Col>
          <h2 className='text-start ms-1 ms-md-3'>
            <div className='text-monospace'>
              {me?.privates?.sats - me?.privates?.credits}
            </div>
            <div className='text-muted'>sats</div>
            <Button variant='success mt-3' href='/withdraw'>withdraw sats</Button>
          </h2>
        </Col>
      </Row>
      <Row className='w-100 d-flex d-sm-none justify-content-center my-5'>
        <Row className='mb-5'>
          <h2 className='text-start'>
            <div className='text-monospace'>
              {me?.privates?.credits}
            </div>
            <div className='text-muted'>cowboy credits</div>
            <BuyCreditsButton />
          </h2>
        </Row>
        <Row>
          <h2 className='text-end'>
            <div className='text-monospace'>
              {me?.privates?.sats - me?.privates?.credits}
            </div>
            <div className='text-muted'>sats</div>
            <Button variant='success mt-3' href='/withdraw'>withdraw sats</Button>
          </h2>
        </Row>
      </Row>
    </CenterLayout>
  )
}

export function BuyCreditsButton () {
  const showModal = useShowModal()
  const strike = useLightning()
  const [buyCredits] = usePaidMutation(BUY_CREDITS)

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
                  strike()
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
        className='mt-3'
        variant='secondary'
      >buy credits
      </Button>
    </>
  )
}
