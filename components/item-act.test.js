/** @jest-environment ./jest.linkedom-env.js */
/* eslint-env jest, browser */
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { Formik, Form, useFormikContext } from 'formik'
import { Tips } from './item-act'

jest.mock('@/svgs/bolt.svg', () => () => null)
jest.mock('@apollo/client/react', () => ({ useApolloClient: () => ({}) }))
jest.mock('./form', () => ({
  Form: ({ children }) => children,
  Input: () => null,
  SubmitButton: () => null
}))
jest.mock('./me', () => ({ useMe: () => ({ me: null }) }))
jest.mock('./upvote', () => ({ defaultTipIncludingRandom: () => 100 }))
jest.mock('@/lib/validate', () => ({ amountSchema: {} }))
jest.mock('@/lib/constants', () => ({ ZAP_UNDO_DELAY_MS: 0 }))
jest.mock('@/fragments/payIn', () => ({ ACT_MUTATION: 'mutation ACT' }))
jest.mock('@/lib/pay-in', () => ({ actWaitFor: () => () => {}, getPayIn: () => undefined }))
jest.mock('@/lib/apollo', () => ({ meAnonSats: {} }))
jest.mock('@/lib/compose-callbacks', () => ({ composeCallbacks: (...fns) => fns }))
jest.mock('@/wallets/client/hooks', () => ({ useHasSendWallet: () => false }))
jest.mock('@/wallets/client/errors', () => ({ toastPayError: () => {}, isTransientNetworkError: () => false }))
jest.mock('@/components/animation', () => ({ useAnimation: () => () => {} }))
jest.mock('@/components/toast', () => ({ useToast: () => ({}) }))
jest.mock('@/components/payIn/hooks/use-pay-in-mutation', () => ({ __esModule: true, default: () => [() => {}, {}] }))

let formik
const Probe = () => {
  formik = useFormikContext()
  return null
}

let roots = []
beforeEach(() => {
  window.IS_REACT_ACT_ENVIRONMENT = true
  window.localStorage.clear()
})
afterEach(async () => {
  await act(async () => {
    roots.forEach(root => root.unmount())
  })
  roots = []
  document.body.innerHTML = ''
})

const renderTips = async () => {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  roots.push(root)
  await act(async () => {
    root.render(
      <Formik
        initialValues={{ amount: 100 }}
        onSubmit={() => {}}
      >
        <Form>
          <Tips />
          <Probe />
        </Form>
      </Formik>
    )
  })
  return container
}

const tipButtons = container => [...container.querySelectorAll('button')]

describe('Tips', () => {
  it('renders the default suggestions', async () => {
    const container = await renderTips()
    expect(tipButtons(container).map(b => b.textContent.trim()))
      .toEqual(['100', '1000', '10000', '100000'])
  })

  it('sets the form amount when a suggestion is clicked', async () => {
    const container = await renderTips()
    await act(async () => {
      tipButtons(container).find(b => b.textContent.trim() === '1000').click()
    })
    expect(formik.values.amount).toBe(1000)
  })

  it('applies a clicked suggestion even after the amount changed elsewhere (issue #2703)', async () => {
    const container = await renderTips()
    const hundred = tipButtons(container).find(b => b.textContent.trim() === '100')
    expect(hundred).toBeDefined()

    // simulate the user typing a different amount in the input
    await act(async () => {
      formik.setFieldValue('amount', 500)
    })
    expect(formik.values.amount).toBe(500)

    // clicking the same suggestion again must override it (regression: no-op before fix)
    await act(async () => {
      tipButtons(container).find(b => b.textContent.trim() === '100').click()
    })
    expect(formik.values.amount).toBe(100)
  })

  it('renders custom tips from localStorage before defaults', async () => {
    window.localStorage.setItem('custom-tips', JSON.stringify([100, 500]))
    const container = await renderTips()
    expect(tipButtons(container).map(b => b.textContent.trim()))
      .toEqual(['100', '500', '1000', '10000', '100000'])
  })
})
