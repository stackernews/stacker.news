import { useEffect } from 'react'
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import { CLICK_COMMAND, COMMAND_PRIORITY_HIGH } from 'lexical'
import { useRouter } from 'next/router'

/**
 * intercepts clicks on links and uses next/router for client-side navigation.
 *
 * handles hash links with shallow routing and internal links
 *
 * - external links are opened in a new tab
 * - links with a target attribute are ignored
 * - links with a rel attribute are ignored
 *
 * XXX: Lexical doesn't support custom link handling, this plugin is a workaround.
 */
export default function NextLinkPlugin () {
  const [editor] = useLexicalComposerContext()
  const router = useRouter()

  useEffect(() => {
    return editor.registerCommand(CLICK_COMMAND, (e) => {
      if (e.defaultPrevented) return false
      if (e.button !== 0) return false
      if (e.metaKey || e.altKey || e.ctrlKey || e.shiftKey) return false

      const a = e.target?.closest('a')
      if (!a) return false

      const rawHref = a.getAttribute('href')
      if (!rawHref) return false

      // don't intercept links with target blank
      if (a.getAttribute('target') === '_blank') return false

      // handle hash links
      if (rawHref.startsWith('#')) {
        e.preventDefault()
        const base = router.asPath.split('#')[0]
        router.push(`${base}${rawHref}`, undefined, { shallow: true })
        return true
      }

      // handle internal links (both absolute URLs and paths)
      let isInternal = false
      let targetPath = rawHref

      try {
        const url = new URL(rawHref, window.location.href)
        if (url.origin === window.location.origin) {
          isInternal = true
          targetPath = `${url.pathname}${url.search}${url.hash}`
        }
      } catch {
        // if URL parsing fails but it starts with '/', it's still an internal path
        if (rawHref.startsWith('/')) {
          isInternal = true
          targetPath = rawHref
        }
      }

      if (isInternal) {
        e.preventDefault()
        router.push(targetPath)
        return true
      }

      return false
    }, COMMAND_PRIORITY_HIGH)
  }, [editor, router])

  return null
}
