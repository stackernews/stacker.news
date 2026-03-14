import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import { useEffect, useCallback } from 'react'
import { useField, useFormikContext } from 'formik'
import { $isTextEmpty, $getMarkdown } from '@/lib/lexical/utils'
import { COMMAND_PRIORITY_HIGH, createCommand, BLUR_COMMAND } from 'lexical'
import { useFeeButton } from '@/components/fee-button'
import { isMarkdownMode } from '@/lib/lexical/commands/utils'
import useDebounceCallback from '@/components/use-debounce-callback'
import { useToast } from '@/components/toast'

/** instantly syncs Formik with the latest markdown resulting from the editor */
export const SYNC_FORMIK_COMMAND = createCommand('SYNC_FORMIK_COMMAND')
export const SUBMIT_FORMIK_COMMAND = createCommand('SUBMIT_FORMIK_COMMAND')

// submit disabled reason for debounced formik
const DEBOUNCED_SUBMIT_DISABLED_REASON = 'debouncedFormik'

/** syncs lexical with formik values */
export default function FormikBridgePlugin ({ name = 'text' }) {
  const [editor] = useLexicalComposerContext()
  const [,, textHelpers] = useField({ name })
  const { submitForm } = useFormikContext() ?? {}
  const toaster = useToast()
  const { setDisabled, disabled = false } = useFeeButton() ?? {}

  const disableSubmit = useCallback((value) => setDisabled?.(DEBOUNCED_SUBMIT_DISABLED_REASON, value), [setDisabled])

  const debouncedRichSave = useDebounceCallback(() => {
    if (isMarkdownMode(editor)) return
    editor.getEditorState().read(() => {
      textHelpers.setValue($getMarkdown(editor))
      disableSubmit(false)
    })
  }, 500, [editor, textHelpers, disableSubmit])

  const syncFormik = useCallback((flush = false) => {
    editor.getEditorState().read(() => {
      if ($isTextEmpty()) {
        textHelpers.setValue('')
        disableSubmit(false) // always enable submit if text is empty
        return
      }

      if (!isMarkdownMode(editor) && !flush) {
        disableSubmit(true) // disable submit during debounced rich save
        debouncedRichSave()
        return
      }

      if (flush) disableSubmit(false) // always enable submit on flush

      textHelpers.setValue($getMarkdown(editor))
    })
  }, [editor, textHelpers, debouncedRichSave, disableSubmit])

  // keep formik in sync
  // markdown mode: instant
  // rich mode: debounced
  useEffect(() => {
    return editor.registerUpdateListener(({ dirtyElements, dirtyLeaves }) => {
      // skip non-content updates
      if (dirtyElements.size === 0 && dirtyLeaves.size === 0) return
      syncFormik()
    })
  }, [editor, syncFormik])

  // instant sync on blur
  useEffect(() => {
    return editor.registerCommand(
      BLUR_COMMAND,
      () => {
        syncFormik(true)
        return false
      },
      COMMAND_PRIORITY_HIGH
    )
  }, [editor, syncFormik])

  useEffect(() => {
    return editor.registerCommand(
      SYNC_FORMIK_COMMAND,
      (flush = true) => {
        syncFormik(flush)
        return true
      },
      COMMAND_PRIORITY_HIGH
    )
  }, [editor, syncFormik])

  useEffect(() => {
    return editor.registerCommand(
      SUBMIT_FORMIK_COMMAND,
      () => {
        if (disabled) {
          toaster?.warning('content is still being processed, please wait')
          return false
        }
        submitForm?.()
        return true
      },
      COMMAND_PRIORITY_HIGH
    )
  }, [editor, disabled, toaster, submitForm])

  // toggling mode will unmount and remount the Lexical editor
  useEffect(() => {
    // on unmount, re-enable submission
    return () => disableSubmit(false)
  }, [disableSubmit])

  return null
}
