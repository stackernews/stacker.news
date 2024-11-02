import { getGetServerSideProps } from '@/api/ssrApollo'
import Layout from '@/components/layout'
import { useToast } from '@/components/toast'
import { useRouter } from 'next/router'
import Text from '@/components/text'
import WalletFields from '@/components/wallet-fields'
import wizards from '@/wallets/wizards'
import { useState, useEffect, useRef } from 'react'
import { Form, SubmitButton } from '@/components/form'
import styles from '@/components/comment.module.css'
import { Button } from 'react-bootstrap'
import { useWallets } from 'wallets'

export const getServerSideProps = getGetServerSideProps({ query: null })

const StepComponent = ({ index, title, name, completed }) => {
  return (
    <div className='fw-bold d-flex align-items-center ml-8'>
      <div
        className={`rounded-circle text-black ${completed ? 'bg-secondary' : 'bg-light'}
           align-items-center justify-content-center d-flex
           `} style={{ width: '1.4rem', height: '1.4rem' }}
      >
        <span>{index + 1}</span>
      </div>
      <div className='ps-2 pe-4'>{title ?? name ?? 'Step ' + (index + 1)}</div>
    </div>
  )
}

export default function WalletWizard () {
  const router = useRouter()
  const { wizard: name } = router.query
  const wizard = wizards[name]
  const stepsData = useRef({})

  const { wallets } = useWallets()
  wallets.connect = async (name, values, label) => {
    values.enabled = true
    console.log(values)
    const wallet = wallets.find(w => w.name === name)
    if (!wallet) {
      throw new Error(`Wallet ${name} not found`)
    }
    await wallet.save(values)
  }

  const [currentStep, setCurrentStep] = useState(null)
  const [currentStepData, setCurrentStepData] = useState({})
  const [currentStepIndex, setCurrentStepIndex] = useState(0)
  const [completedSteps, setCompletedSteps] = useState([])

  const [isLastStep, setIsLastStep] = useState(false)
  const stepTitle = currentStep?.title ?? currentStep?.name ?? 'Step ' + (currentStepIndex + 1)

  const setStep = async (index) => {
    let step = wizard.getStep ? await wizard.getStep(index, stepsData.current, wallets) : wizard.steps[index]
    if (typeof step === 'function') {
      step = await step(stepsData.current, wallets)
    }
    setCurrentStep(step)
    let currentStepData = stepsData.current[step.name]
    if (!currentStepData) {
      currentStepData = {}
      stepsData.current[step.name] = currentStepData
    }
    setCurrentStepData(currentStepData)
    return step
  }

  const nextStep = async () => {
    if (isLastStep) throw new Error('Cannot go forward from last step')
    const index = currentStepIndex + 1
    setCompletedSteps([...completedSteps, stepTitle])
    setCurrentStepIndex(index)
    const step = await setStep(index)
    if (step.last != null) {
      setIsLastStep(step.last)
    } else if (wizard.isLastStep) {
      setIsLastStep(await wizard.isLastStep(index, stepsData.current, wallets))
    } else {
      setIsLastStep(wizard.steps && index === wizard.steps.length - 1)
    }
  }

  const prevStep = async () => {
    if (currentStepIndex === 0) throw new Error('Cannot go back from first step')
    setIsLastStep(false)
    setCompletedSteps(completedSteps.slice(0, -1))
    const index = currentStepIndex - 1
    setCurrentStepIndex(index)
    await setStep(index)
  }

  useEffect(() => {
    setCompletedSteps([])
    setIsLastStep(false)
    setCurrentStepIndex(0)
    setStep(0)
  }, [])

  const validateProps = currentStep && currentStep.fieldValidation
    ? (typeof currentStep.fieldValidation === 'function'
        ? { validate: currentStep.fieldValidation }
        : { schema: currentStep.fieldValidation })
    : {}

  if (!currentStep) return <></>
  return (
    <Layout>
      <div className='py-5 w-100'>

        <h2 className='mb-2 text-center'>configure {wizard.title}</h2>

        <h6 className='text-muted text-center mb-4'><Text>{wizard.description}</Text></h6>
        <div className='pt-4  d-flex align-items-center text-muted small'>
          {completedSteps.map((step, i) => (
            <StepComponent key={i} index={i} name={step} completed />
          )
          )}

          <StepComponent index={currentStepIndex} name={stepTitle} />
        </div>
        <Form
          className='mt-4'
          initial={currentStepData}
          // {...validateProps}
          onSubmit={async (values) => {
            Object.assign(currentStepData, values)
            nextStep()
            console.log(stepsData.current)
            window.scrollTo({ top: 0 })
          }}
        >
          <div className={styles.text}>
            <Text>{currentStep.description}</Text>
          </div>
          <div className='mt-4 mb-4'>
            <WalletFields wallet={{
              config: currentStepData,
              fields: currentStep.fields.map(f => {
                f.key = f.name ?? f.title
                return f
              })
            }}
            />
          </div>
          <div className='mt-4 d-flex align-items-center ms-auto justify-content-end'>

            {
            !isLastStep && currentStepIndex > 0 && (
              <Button className='me-4 text-muted nav-link fw-bold' variant='link' onClick={prevStep}>back</Button>

            )
          }
            {
            !isLastStep
              ? (

                <SubmitButton variant='primary' className='mt-1 px-4'>next</SubmitButton>
                )
              : (
                <Button className='btn btn-primary' onClick={(() => router.back())}>Ok</Button>
                )

          }
          </div>
        </Form>
      </div>
    </Layout>
  )
}
