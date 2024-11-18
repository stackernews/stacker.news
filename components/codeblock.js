import { useEffect, useState } from 'react'
import { createHighlighter, makeSingletonHighlighter } from 'shiki'
import './codeblock.module.css'

const SHIKI_LIGHT_THEME = 'github-light'
const SHIKI_DARK_THEME = 'github-dark'

const getHighlighter = makeSingletonHighlighter(createHighlighter)

export const codeToHtml = async ({ code, language }) => {
  const highlighter = await getHighlighter({
    themes: [SHIKI_LIGHT_THEME, SHIKI_DARK_THEME],
    langs: [language]
  })

  return highlighter.codeToHtml(code, {
    lang: language,
    themes: {
      light: SHIKI_LIGHT_THEME,
      dark: SHIKI_DARK_THEME
    }
  })
}

export default function CodeBlock ({ code, language }) {
  const [html, setHtml] = useState(undefined)

  useEffect(() => {
    async function getCode () {
      const newHtml = await codeToHtml({
        code,
        language
      })
      setHtml(newHtml)
    }

    getCode()
  }, [])

  return html ? <div dangerouslySetInnerHTML={{ __html: html }} /> : <div>...</div>
}
