// resolve hook so `node --test` resolves imports with @ aliases

import { registerHooks } from 'node:module'

const ROOT = new URL('../', import.meta.url)
const EXTENSIONS = ['.js', '.mjs', '.cjs']
const SUFFIXES = [...EXTENSIONS, ...EXTENSIONS.map(ext => `/index${ext}`)]
// builtins and bare package roots ('pkg', '@scope/pkg') are left to node
const PACKAGE_ROOT = /^(@[^/]+\/)?[^/]+$/
const PROBE_ERRORS = ['ERR_MODULE_NOT_FOUND', 'ERR_UNSUPPORTED_DIR_IMPORT', 'ERR_PACKAGE_PATH_NOT_EXPORTED']

registerHooks({
  resolve (specifier, context, nextResolve) {
    if (specifier.startsWith('@/')) specifier = new URL(specifier.slice(2), ROOT).href
    try {
      return nextResolve(specifier, context)
    } catch (err) {
      if (!PROBE_ERRORS.includes(err.code) || specifier.startsWith('node:') || (!specifier.startsWith('.') && PACKAGE_ROOT.test(specifier))) throw err
      for (const suffix of SUFFIXES) {
        try { return nextResolve(specifier + suffix, context) } catch {}
      }
      throw err
    }
  }
})
