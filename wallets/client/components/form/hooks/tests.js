export const TestStatus = {
  SAVED: 'saved',
  TESTED: 'tested',
  NEEDS_TEST: 'needs_test',
  TESTING: 'testing',
  FAILED: 'failed',
  NOT_SET: 'not_set',
  DISABLED: 'disabled'
}

export const SAVEABLE_TEST_STATUSES = new Set([
  TestStatus.SAVED,
  TestStatus.TESTED,
  TestStatus.DISABLED
])

export const DIRTY_TEST_STATUSES = new Set([
  TestStatus.NEEDS_TEST,
  TestStatus.TESTING,
  TestStatus.FAILED
])

// Formik owns the form values; the only thing that isn't in Formik is the test
// bookkeeping, and that's a single map: per protocolKey, the latest test attempt
// — the draftHash it ran against plus an outcome (testing | passed | failed).
// Status is derived by comparing this against the live draft's draftHash
// (status.js): a match means the current draft is the one tested. SAVED is
// derived from wallet.protocols, and "removed" is just an emptied draft, so
// neither needs its own map.
export function initialConfigureState () {
  return { tests: new Map() }
}

export function configureReducer (state, action) {
  switch (action.type) {
    case 'TEST_STARTED':
      return setTest(state, action.key, { draftHash: action.draftHash, outcome: 'testing' })

    case 'TEST_PASSED':
      // Ignore a late ack if the user started a newer test for this protocol.
      if (state.tests.get(action.key)?.draftHash !== action.testedDraftHash) return state
      return setTest(state, action.key, { draftHash: action.committedDraftHash, outcome: 'passed' })

    case 'TEST_FAILED':
      if (state.tests.get(action.key)?.draftHash !== action.draftHash) return state
      return setTest(state, action.key, failed(action))

    case 'RECORD_VALIDATION_FAILURE':
      return setTest(state, action.key, failed(action))

    default:
      return state
  }
}

function failed ({ draftHash, error, details }) {
  return { draftHash, outcome: 'failed', error, details }
}

function setTest (state, key, record) {
  const tests = new Map(state.tests)
  tests.set(key, record)
  return { ...state, tests }
}
