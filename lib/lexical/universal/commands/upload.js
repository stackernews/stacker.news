import { createCommand } from 'lexical'

/** command to trigger file upload dialog in markdown and rich text mode
 * @returns {boolean} true if command was handled
 */
export const SN_UPLOAD_FILES_COMMAND = createCommand('SN_UPLOAD_FILES_COMMAND')
