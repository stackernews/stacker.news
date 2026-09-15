import { useCallback, useContext } from 'react'
import { StorageKeyPrefixContext } from './form'
import { fieldDraftKey } from '@/lib/form-draft'

// draft storage is disabled without a prefix; Form clears drafts after submission
export function useFieldDraft (name) {
  const storageKeyPrefix = useContext(StorageKeyPrefixContext)
  const storageKey = fieldDraftKey(storageKeyPrefix, name)

  const getDraft = useCallback(() => {
    return storageKey ? window.localStorage.getItem(storageKey) : null
  }, [storageKey])

  const clearDraft = useCallback(() => {
    if (storageKey) window.localStorage.removeItem(storageKey)
  }, [storageKey])

  const setDraft = useCallback((value) => {
    if (!storageKey) return

    // discard empty drafts but preserve whitespace in nonempty values
    if (value == null || value.trim?.() === '') {
      clearDraft()
    } else {
      window.localStorage.setItem(storageKey, value)
    }
  }, [storageKey, clearDraft])

  return { getDraft, setDraft, clearDraft }
}
