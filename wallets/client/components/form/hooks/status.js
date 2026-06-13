import { isWallet, protocolKey } from '@/wallets/lib/util'
import { DIRTY_TEST_STATUSES, SAVEABLE_TEST_STATUSES, TestStatus } from './tests'
import { draftHash, isMeaningfulDraft, isSavedProtocol, draftConfig } from './draft'

// One protocolStatus per visible protocol. Saved protocols are always visible
// (you configure from a template), so this covers removals too.
export function protocolStatuses (wallet, values, tests, protocols) {
  return protocols.map(protocol =>
    protocolStatus(wallet, values?.[protocolKey(protocol)] ?? {}, protocol, tests))
}

// protocolStatus is the ONE join: it resolves a protocol against its draft, the
// tests map, and the saved baseline into everything the UI and save path read.
// There is no mirrored copy of the config: a stored test applies only while its
// draftHash still matches the live draft; SAVED is derived straight from
// wallet.protocols.
export function protocolStatus (wallet, draft, protocol, tests) {
  const key = protocolKey(protocol)
  const config = draftConfig(protocol, draft)
  const enabled = draft.enabled
  const meaningful = isMeaningfulDraft(protocol, draft)
  const hash = draftHash(protocol, draft)
  const test = tests.get(key)
  // Baselines the live draft might equal. `tested` is a snapshot frozen in the
  // test map when the user ran a test; `saved` is recomputed from the immutable
  // wallet, since SAVED is never mirrored into the test map.
  const tested = test?.draftHash === hash
  const saved = hash === savedDraftHash(wallet, key)

  const status = (() => {
    if (enabled === false && meaningful) return TestStatus.DISABLED
    if (!meaningful) return TestStatus.NOT_SET
    if (tested && test.outcome === 'testing') return TestStatus.TESTING
    if (saved) return TestStatus.SAVED
    if (tested && test.outcome === 'passed') return TestStatus.TESTED
    if (tested && test.outcome === 'failed') return TestStatus.FAILED
    return TestStatus.NEEDS_TEST
  })()

  return {
    protocol,
    enabled,
    config,
    meaningful,
    status,
    canSave: SAVEABLE_TEST_STATUSES.has(status),
    // Kept independent of the status ladder: a freshly-failed test whose hash
    // matches the saved one derives SAVED, yet its error still surfaces.
    testError: meaningful && tested && test.outcome === 'failed'
      ? { error: test.error, details: test.details }
      : null,
    isSaved: isSavedProtocol(protocol),
    // A persisted protocol is removed on save when its draft has no meaningful
    // config — cleared via "remove", or a fieldless protocol toggled off. A
    // template protocol is never "removed".
    willRemove: isSavedProtocol(protocol) && !meaningful
  }
}

// Folds the protocolStatuses into the save bar's state and the save payload. The
// single integrity gate: blocks unless every meaningful protocol is saveable,
// and hands back which protocols to upsert (saveable) and which ids to remove,
// so untested drafts living in Formik never reach the payload.
export function summarize (statuses) {
  const meaningful = statuses.filter(s => s.status !== TestStatus.NOT_SET)
  const configured = meaningful.filter(s => s.status !== TestStatus.DISABLED)
  const saved = statuses.filter(s => s.isSaved)
  const pendingRemoval = statuses.filter(s => s.willRemove)
  // Saving deletes the wallet when every persisted protocol is being removed and
  // nothing configured remains. (pendingRemoval ⊆ saved.)
  const willDeleteWallet =
    saved.length > 0 && saved.length === pendingRemoval.length && configured.length === 0

  const blocker = (() => {
    // Any meaningful protocol that isn't saveable is in a dirty test state
    // (NEEDS_TEST/TESTING/FAILED), so the dirty check covers "untested" too.
    const dirty = statuses.find(s => DIRTY_TEST_STATUSES.has(s.status))
    if (dirty) return statusBlockerMessage(dirty.status)
    if (meaningful.length === 0 && pendingRemoval.length === 0) {
      return 'configure at least one capability'
    }
    return null
  })()

  const saveStatus = blocker ??
    (willDeleteWallet ? 'saving will delete this wallet because no capabilities remain' : 'ready to save')

  return {
    canSave: !blocker,
    blocker,
    saveable: statuses.filter(s => s.canSave),
    removeIds: pendingRemoval.map(s => s.protocol.id),
    willDeleteWallet,
    saveStatus,
    saveButtonLabel: willDeleteWallet ? 'save and delete wallet' : 'save wallet'
  }
}

// The draftHash of this protocolKey's persisted draft, or undefined. The saved
// config is immutable, so SAVED is derived straight from wallet.protocols. A
// saved protocol comes from the DB possibly-sparse, so flatten it to a draft
// ({ enabled, ...config }) before hashing.
function savedDraftHash (wallet, key) {
  if (!isWallet(wallet)) return undefined
  const saved = wallet.protocols.find(p => protocolKey(p) === key)
  if (!saved) return undefined
  const draft = { enabled: saved.enabled, ...saved.config }
  if (!isMeaningfulDraft(saved, draft)) return undefined
  return draftHash(saved, draft)
}

function statusBlockerMessage (status) {
  if (status === TestStatus.TESTING) return 'wait for test to finish'
  if (status === TestStatus.FAILED) return 'fix failed test before saving'
  return 'run capability tests before saving'
}
