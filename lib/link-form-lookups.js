// Lookup planning for the link post form. When the URL is typed or pasted the
// input's onChange handler fires these lookups immediately, but a URL that
// arrives prefilled (web share target, or ?url= query parameter) produces no
// change event, so the same lookups have to be replayed once on mount.
//
// Mirrors the conditions in LinkForm's url onChange handler:
//   - the page title lookup only runs when the form has no title yet (the
//     looked-up title is used to fill it),
//   - the dupes lookup always runs for a meaningful URL.
//
// A URL is meaningful when it parses and its hostname has a dot (or is
// localhost), matching getMeaningfulUrl in the form component.

const LOCALHOST = 'localhost'

export function isMeaningfulUrl (value) {
  try {
    const url = new URL(value.trim().startsWith('http') ? value.trim() : 'http://' + value.trim())
    return url.hostname.includes('.') || url.hostname === LOCALHOST
  } catch {
    return false
  }
}

// hasTitle mirrors the form's check: a current title (typed, shared, or
// already on the item being edited) or a stored draft title counts.
export function hasExistingTitle (title, draftTitle) {
  return !!(title && title.trim().length) || !!(draftTitle && draftTitle.trim().length)
}

export function planInitialUrlLookups ({ url, title, draftTitle, isEditing }) {
  if (isEditing || !url) return null
  if (!isMeaningfulUrl(url)) return null

  return {
    url,
    needsTitleLookup: !hasExistingTitle(title, draftTitle)
  }
}
