import { createHighlighterCoreSync, isSpecialLang, isSpecialTheme } from '@shikijs/core'
import { createJavaScriptRegexEngine } from '@shikijs/engine-javascript'
import { bundledLanguagesInfo } from 'shiki/langs'
import { bundledThemesInfo } from 'shiki/themes'
import { $getNodeByKey } from 'lexical'
import { $isCodeNode } from '@lexical/code-core'

// singleton shiki highlighter started empty. Languages and themes are loaded
// on-demand: bundledLanguagesInfo[i].import is `() => import('@shikijs/langs/<id>')`,
// which webpack code-splits into a per-language chunk and only fetches the first
// time a code block uses that language. Same for themes.
const shiki = createHighlighterCoreSync({
  engine: createJavaScriptRegexEngine(),
  langs: [],
  themes: []
})

// dedupe concurrent loads so two code blocks asking for the same language at the
// same time share a single import() call and a single highlighter.loadLanguage
const inflight = new Map()

function findLanguageInfo (id) {
  return bundledLanguagesInfo.find(
    info => info.id === id || (info.aliases && info.aliases.includes(id))
  )
}

function findThemeInfo (id) {
  return bundledThemesInfo.find(info => info.id === id)
}

// extract the inner language from "diff-xxxx" so we tokenize as that language
// and apply diff prefix decorations on top
function getDiffedLanguage (language) {
  const match = /^diff-([\w-]+)/i.exec(language)
  return match ? match[1] : null
}

export function isCodeLanguageLoaded (language) {
  const diffed = getDiffedLanguage(language)
  const id = diffed || language
  // shiki reserves these: ansi, '', plaintext, txt, text, plain
  if (isSpecialLang(id)) return true
  // getLoadedLanguages() includes aliases of loaded languages
  return shiki.getLoadedLanguages().includes(id)
}

export function isCodeThemeLoaded (theme) {
  if (isSpecialTheme(theme)) return true
  return shiki.getLoadedThemes().includes(theme)
}

// kicks off a dynamic import for the language grammar, then marks the matching
// CodeNode as highlight-supported so the transform pipeline repaints it.
// returns undefined when the language is already loaded or unknown.
export function loadCodeLanguage (language, editor, codeNodeKey) {
  const diffed = getDiffedLanguage(language)
  const id = diffed || language
  if (isCodeLanguageLoaded(id)) return
  const info = findLanguageInfo(id)
  if (!info) return
  const key = `lang:${info.id}`
  let promise = inflight.get(key)
  if (!promise) {
    promise = info.import().then(mod => shiki.loadLanguage(mod.default))
    inflight.set(key, promise)
  }
  return promise.then(() => {
    if (!editor || !codeNodeKey) return
    editor.update(() => {
      const codeNode = $getNodeByKey(codeNodeKey)
      if (
        $isCodeNode(codeNode) &&
        codeNode.getLanguage() === language &&
        !codeNode.getIsSyntaxHighlightSupported()
      ) {
        codeNode.setIsSyntaxHighlightSupported(true)
      }
    })
  })
}

export function loadCodeTheme (theme, editor, codeNodeKey) {
  if (isCodeThemeLoaded(theme)) return
  const info = findThemeInfo(theme)
  if (!info) return
  const key = `theme:${theme}`
  let promise = inflight.get(key)
  if (!promise) {
    promise = info.import().then(mod => shiki.loadTheme(mod.default))
    inflight.set(key, promise)
  }
  return promise.then(() => {
    if (!editor || !codeNodeKey) return
    editor.update(() => {
      const codeNode = $getNodeByKey(codeNodeKey)
      if ($isCodeNode(codeNode)) codeNode.markDirty()
    })
  })
}

export function getCodeLanguageOptions () {
  return bundledLanguagesInfo.map(i => [i.id, i.name])
}

export function getCodeThemeOptions () {
  return bundledThemesInfo.map(i => [i.id, i.displayName])
}

// maps an alias (e.g. 'js') to its canonical id (e.g. 'javascript').
// returns the input unchanged when the language is unknown.
export function normalizeCodeLanguage (language) {
  const info = findLanguageInfo(language)
  return info ? info.id : language
}

// passthrough so tokenizer.js doesn't need to touch the singleton directly
export function shikiCodeToTokens (code, opts) {
  return shiki.codeToTokens(code, opts)
}
