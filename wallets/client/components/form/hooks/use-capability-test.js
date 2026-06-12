import { useCallback, useEffect, useRef } from 'react'
import { useFormikContext } from 'formik'
import { protocolFields, protocolKey } from '@/wallets/lib/util'
import { useTestSendPayment, useTestCreateInvoice } from '@/wallets/client/hooks'
import { useProtocolStatus, useTestDispatch } from './context'
import { draftHash, draftConfig } from './draft'
import { validateCapability } from './validation'
import { firstValidationError, testErrorDetails } from '../test-status'

// Imperative test orchestration for one protocol, kept out of the render
// component: validate the draft, run the protocol test, fold any enrichment
// (e.g. LNC credentials) back into the form, and record the outcome. The
// valuesRef + draftHash re-check guard a late ack from clobbering edits the
// user made while the test was running. Returns the latest failure plus onTest.
export function useCapabilityTest (protocol) {
  const dispatch = useTestDispatch()
  const formik = useFormikContext()
  const testSendPayment = useTestSendPayment(protocol)
  const testCreateInvoice = useTestCreateInvoice(protocol)
  const key = protocolKey(protocol)
  const fields = protocolFields(protocol)
  const { error, details } = useProtocolStatus(protocol)?.testError ?? {}

  // Read the latest draft inside the async test, not the snapshot captured when
  // onTest was created.
  const valuesRef = useRef(formik.values)
  useEffect(() => { valuesRef.current = formik.values }, [formik.values])

  const runTest = useCallback(async (draft) => {
    if (draft.enabled === false) return {}
    const values = { enabled: draft.enabled, ...draftConfig(protocol, draft) }
    if (protocol.send) return (await testSendPayment(values)) ?? {}
    await testCreateInvoice(values)
    return {}
  }, [protocol, testSendPayment, testCreateInvoice])

  const onTest = useCallback(async () => {
    const draft = valuesRef.current[key]
    const { ok, errors } = await validateCapability(protocol, draft)
    for (const field of fields) formik.setFieldTouched(`${key}.${field.name}`, true, false)
    const testedHash = draftHash(protocol, draft)
    if (!ok) {
      for (const [path, message] of Object.entries(errors)) formik.setFieldError(path, message)
      const { message, details } = testErrorDetails(
        { message: firstValidationError(errors) || 'fix validation errors before testing' },
        protocol
      )
      dispatch({ type: 'RECORD_VALIDATION_FAILURE', key, error: message, details, draftHash: testedHash })
      return
    }

    dispatch({ type: 'TEST_STARTED', key, draftHash: testedHash })
    try {
      const additional = await runTest(draft)
      const committed = { ...draft, ...additional }
      // Only write enrichment back if the form still matches what we tested, so
      // a late ack can't clobber edits the user made while the test was running.
      if (Object.keys(additional).length && draftHash(protocol, valuesRef.current[key]) === testedHash) {
        formik.setFieldValue(key, committed)
      }
      dispatch({ type: 'TEST_PASSED', key, testedDraftHash: testedHash, committedDraftHash: draftHash(protocol, committed) })
    } catch (err) {
      const { message, details } = testErrorDetails(err, protocol)
      dispatch({ type: 'TEST_FAILED', key, error: message, details, draftHash: testedHash })
    }
  }, [dispatch, key, fields, protocol, runTest, formik])

  return { error, details, onTest }
}
