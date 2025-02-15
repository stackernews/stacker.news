import { useMemo, useEffect, useState, Fragment } from 'react'
import { createHighlighter, makeSingletonHighlighter } from 'shiki'
import { toJsxRuntime } from 'hast-util-to-jsx-runtime'
import { jsx, jsxs } from 'react/jsx-runtime'
import useDarkMode from './dark-mode'

const SHIKI_LIGHT_THEME = 'github-light'
const SHIKI_DARK_THEME = 'github-dark'

const getHighlighter = makeSingletonHighlighter(createHighlighter)

const codeToHast = async ({ code, language, dark }) => {
  const highlighter = await getHighlighter({
    themes: [SHIKI_LIGHT_THEME, SHIKI_DARK_THEME],
    langs: [language]
  })

  return highlighter.codeToHast(code, {
    lang: language,
    theme: dark ? SHIKI_DARK_THEME : SHIKI_LIGHT_THEME
  })
}

export default function CodeBlock ({ code, language }) {
  const [hast, setHast] = useState(undefined)
  const [darkMode] = useDarkMode()

  useEffect(() => {
    async function processCode () {
      const hast = await codeToHast({
        code,
        language,
        dark: darkMode
      })

      setHast(hast)
    }

    processCode()
  }, [darkMode])

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
