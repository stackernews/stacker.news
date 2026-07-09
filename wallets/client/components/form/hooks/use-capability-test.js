import { useCallback, useEffect, useRef } from 'react'
import { useFormikContext } from 'formik'
import { isTemplate, protocolFields, protocolKey } from '@/wallets/lib/util'
import { useTestSendPayment, useTestCreateInvoice } from '@/wallets/client/hooks'
import { useSingleFlight } from '@/components/use-single-flight'
import { useProtocolStatus, useTestDispatch, useWallet } from './context'
import { draftHash, draftConfig } from './draft'
import { validateCapability } from './validation'
import { firstValidationError, testErrorDetails } from '../test-status'
import { TestStatus } from './tests'

export function useCapabilityTest (protocol) {
  const dispatch = useTestDispatch()
  const wallet = useWallet()
  const { values, setFieldValue, setFieldTouched, setFieldError } = useFormikContext()
  const testSendPayment = useTestSendPayment(protocol)
  const testCreateInvoice = useTestCreateInvoice(protocol)
  const testProtocol = protocol.send ? testSendPayment : testCreateInvoice
  const key = protocolKey(protocol)
  const fields = protocolFields(protocol)
  const cap = useProtocolStatus(protocol)
  const { error, details } = cap?.testError ?? {}
  const autoTestedRef = useRef(false)

  // Read the latest draft inside the async test, not the snapshot captured when
  // onTest was created.
  const valuesRef = useRef(values)
  useEffect(() => { valuesRef.current = values }, [values])

  const testCapability = useCallback(async () => {
    const draft = valuesRef.current[key]
    const testedHash = draftHash(protocol, draft)
    // A fully generated configuration is created and validated by its test
    // rather than entered by the user.
    const allFieldsGenerated = fields.length > 0 && fields.every(field => field.generated)
    const { ok, errors } = allFieldsGenerated
      ? { ok: true, errors: {} }
      : await validateCapability(protocol, draft)
    for (const field of fields) setFieldTouched(`${key}.${field.name}`, true, false)
    if (!ok) {
      for (const [path, message] of Object.entries(errors)) setFieldError(path, message)
      const { message, details } = testErrorDetails(
        { message: firstValidationError(errors) || 'fix validation errors before testing' },
        protocol
      )
      dispatch({ type: 'RECORD_VALIDATION_FAILURE', key, error: message, details, draftHash: testedHash })
      return
    }

    dispatch({ type: 'TEST_STARTED', key, draftHash: testedHash })
    try {
      const additional = draft.enabled === false
        ? {}
        : (await testProtocol({ enabled: draft.enabled, ...draftConfig(protocol, draft) })) ?? {}
      const sparkSend = protocol.name === 'SPARK' && protocol.send
      const generated = Object.fromEntries(fields
        .filter(field => field.generated && additional[field.name] !== undefined)
        .map(field => [field.name, additional[field.name]]))
      const committed = { ...draft, ...generated }

      // A late result must not overwrite a draft edited while its test ran.
      if (Object.keys(additional).length && draftHash(protocol, valuesRef.current[key]) === testedHash) {
        for (const [name, value] of Object.entries(generated)) {
          setFieldValue(`${key}.${name}`, value, false)
        }
        if (sparkSend) {
          const receiveKey = protocolKey({ name: 'SPARK', send: false })
          if (additional.identityPubkey !== undefined) {
            setFieldValue(`${receiveKey}.identityPubkey`, additional.identityPubkey, false)
          }
        }
      }
      dispatch({
        type: 'TEST_PASSED',
        key,
        testedDraftHash: testedHash,
        committedDraftHash: draftHash(protocol, committed)
      })
    } catch (err) {
      const { message, details } = testErrorDetails(err, protocol)
      dispatch({ type: 'TEST_FAILED', key, error: message, details, draftHash: testedHash })
    }
  }, [dispatch, key, fields, protocol, testProtocol, setFieldValue, setFieldTouched, setFieldError])
  const [onTest] = useSingleFlight(testCapability)

  // New Spark wallets generate from send once, then test the populated receive
  // side once. Saved wallets only test when the user asks.
  useEffect(() => {
    if (!isTemplate(wallet) || protocol.name !== 'SPARK' || autoTestedRef.current) return
    const shouldTest = protocol.send
      ? cap?.status === TestStatus.NOT_SET
      : cap?.status === TestStatus.NEEDS_TEST
    if (!shouldTest) return

    autoTestedRef.current = true
    onTest()
  }, [cap?.status, onTest, protocol.name, protocol.send, wallet])

  return { error, details, onTest }
}
