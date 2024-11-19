import { useMemo, useEffect, useState, Fragment } from 'react'
import { createHighlighter, makeSingletonHighlighter } from 'shiki'
import { toJsxRuntime } from 'hast-util-to-jsx-runtime'
import { jsx, jsxs } from 'react/jsx-runtime'
import './codeblock.module.css'

const SHIKI_LIGHT_THEME = 'github-light'
const SHIKI_DARK_THEME = 'github-dark'

const getHighlighter = makeSingletonHighlighter(createHighlighter)

export const codeToHast = async ({ code, language }) => {
  const highlighter = await getHighlighter({
    themes: [SHIKI_LIGHT_THEME, SHIKI_DARK_THEME],
    langs: [language]
  })

  return highlighter.codeToHast(code, {
    lang: language,
    themes: {
      light: SHIKI_LIGHT_THEME,
      dark: SHIKI_DARK_THEME
    }
  })
}

export default function CodeBlock ({ code, language }) {
  const [hast, setHast] = useState(undefined)

  useEffect(() => {
    async function processCode () {
      const hast = await codeToHast({
        code,
        language
      })

      setHast(hast)
    }

    processCode()
  }, [])

  const element = useMemo(() => {
    if (!hast) {
      return <div>...</div>
    }

    return toJsxRuntime(hast, {
      Fragment,
      jsx,
      jsxs,
      components: {
        pre: props => <pre data-custom-codeblock {...props} />
      }
    })
  }, [hast])

  return element
}
