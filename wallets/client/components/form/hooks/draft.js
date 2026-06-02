import { isTemplate, protocolFields, protocolKey } from '@/wallets/lib/util'
import { stableObjectHash } from '@/wallets/lib/config'

// The configure screen is one Formik form whose values are keyed by protocolKey,
// e.g. { 'NWC-send': { enabled, url }, 'LN_ADDR-recv': { enabled, address } }.
// Each protocol's slice is its "draft". Values are stored exactly as the backend
// wants them (the LN_ADDR address full, domain included); only its input renders
// it domain-stripped.

// Initial drafts, one per visible protocol — every send + receive candidate, so
// switching connection keeps each method's draft ready.
export function initialDrafts (protocols) {
  return Object.fromEntries(
    protocols.map(protocol => [protocolKey(protocol), initialDraft(protocol, protocols)])
  )
}

function initialDraft (protocol, protocols) {
  const sibling = protocols.find(p => p.name === protocol.name && p.send !== protocol.send)

  return protocolFields(protocol).reduce((acc, field) => {
    let value = protocol.config?.[field.name]
    // Shared fields (e.g. an API key used by both send and receive) fall back to
    // the complementary protocol's saved config.
    if (!value && field.share) value = sibling?.config?.[field.name]
    return { ...acc, [field.name]: value || '' }
  }, { enabled: protocol.enabled ?? defaultEnabled(protocol) })
}

// A draft cleared back to empty: used when switching/cancelling a capability so a
// discarded draft becomes NOT_SET rather than lingering as a dirty form, and when
// "remove" wipes a capability. A fieldless protocol has nothing to wipe, so it
// must reset to disabled here for removal to take effect.
export function emptyDraft (protocol) {
  return protocolFields(protocol).reduce(
    (acc, field) => ({ ...acc, [field.name]: '' }),
    { enabled: defaultEnabled(protocol) }
  )
}

// A fieldless protocol (WebLN) has no inputs, so its `enabled` flag *is* its
// config: it stays opt-in (off until the user toggles it on) rather than being
// auto-enabled the way a protocol you configure by filling fields is.
function defaultEnabled (protocol) {
  return protocolFields(protocol).length > 0
}

// --- reading and comparing a draft (a draft = config + enabled) ---

// The config a draft maps to: field values only, every field present (empty
// string when unset). Used as the save payload and the draftHash basis. `draft`
// is a form draft, or a saved protocol flattened to { enabled, ...config }.
export function draftConfig (protocol, draft) {
  return protocolFields(protocol).reduce(
    (acc, field) => ({ ...acc, [field.name]: draft?.[field.name] || '' }), {})
}

// A content hash of a draft — its config plus enabled flag. Two drafts with the
// same config and enabled flag hash equal regardless of origin — this is how
// "did the draft revert to what's saved / what we tested" is answered.
export function draftHash (protocol, draft) {
  return stableObjectHash({ ...draftConfig(protocol, draft), enabled: draft?.enabled })
}

// Whether a draft has anything worth saving. A fieldless protocol (WebLN) is
// meaningful when enabled; a field-based one when any field has a value.
export function isMeaningfulDraft (protocol, draft) {
  const fields = protocolFields(protocol)
  if (fields.length === 0) return draft?.enabled !== false
  // Shared fields are inherited from the complementary side, so a draft that only
  // carries shared values was never actually configured on this side.
  const ownFields = fields.filter(f => !f.share)
  return (ownFields.length > 0 ? ownFields : fields)
    .some(field => isMeaningfulValue(draft?.[field.name]))
}

export function isSavedProtocol (protocol) {
  return !!protocol?.id && !!protocol?.__typename && !isTemplate(protocol)
}

function isMeaningfulValue (value) {
  return value !== '' && value !== false && value !== undefined && value !== null
}
