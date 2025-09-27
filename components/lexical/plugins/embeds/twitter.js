import { useEffect } from 'react'
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import { $createTweetNode } from '@/lib/lexical/nodes/embeds/tweet'
import { createCommand, COMMAND_PRIORITY_EDITOR, $insertNodes } from 'lexical'

export const INSERT_TWEET_COMMAND = createCommand('INSERT_TWEET_COMMAND')

export default function TwitterPlugin () {
  const [editor] = useLexicalComposerContext()

  useEffect(() => {
    return editor.registerCommand(INSERT_TWEET_COMMAND, (id) => {
      const node = $createTweetNode(id)
      $insertNodes([node])
      return true
    }, COMMAND_PRIORITY_EDITOR)
  }, [editor])
}
