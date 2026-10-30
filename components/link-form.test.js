import assert from 'node:assert/strict'
import { after, afterEach, beforeEach, mock, test } from 'node:test'
import { createRequire, registerHooks } from 'node:module'
import { fileURLToPath } from 'node:url'
import { parseHTML } from 'linkedom'
import * as mockReact from 'react'
import { createRoot } from 'react-dom/client'

// The normal Node test runner does not parse JSX. Use the project's existing
// Next compiler for this component only; no extra test dependency is needed.
const require = createRequire(import.meta.url)
const { transformSync } = require('next/dist/build/swc')
const componentUrl = new URL('./link-form.js', import.meta.url).href
const moduleMocks = new Map()
const mockSymbol = Symbol.for('stacker-link-form-test-modules')
globalThis[mockSymbol] = moduleMocks
const mockModule = (specifier, exports) => moduleMocks.set(specifier, exports)
const jsxHook = registerHooks({
  resolve (specifier, context, nextResolve) {
    if (context.parentURL === componentUrl && moduleMocks.has(specifier)) {
      const exports = moduleMocks.get(specifier)
      const accessor = `globalThis[Symbol.for('stacker-link-form-test-modules')].get(${JSON.stringify(specifier)})`
      const source = [
        ...Object.keys(exports.namedExports || {}).map(name => `export const ${name} = ${accessor}.namedExports.${name}`),
        ...('defaultExport' in exports ? [`export default ${accessor}.defaultExport`] : [])
      ].join('\n')
      return { url: `data:text/javascript,${encodeURIComponent(source)}`, shortCircuit: true }
    }
    return nextResolve(specifier, context)
  },
  load (url, context, nextLoad) {
    if (url !== componentUrl) return nextLoad(url, context)
    const loaded = nextLoad(url, { ...context, format: 'module' })
    const source = typeof loaded.source === 'string' ? loaded.source : Buffer.from(loaded.source).toString('utf8')
    return {
      format: 'module',
      source: transformSync(source, {
        filename: fileURLToPath(url),
        jsc: {
          parser: { syntax: 'ecmascript', jsx: true },
          transform: { react: { runtime: 'automatic' } }
        },
        module: { type: 'es6' }
      }).code,
      shortCircuit: true
    }
  }
})
after(() => {
  jsxHook.deregister()
  delete globalThis[mockSymbol]
})

const mockFormContext = mockReact.createContext()
const mockState = {}
const mockGetDupes = mock.fn(() => Promise.resolve())
const mockGetPageTitle = mock.fn(() => Promise.resolve())
const mockCacheModify = mock.fn()

mockModule('next/router', { namedExports: { useRouter: () => mockState.router } })
mockModule('@apollo/client', { namedExports: { gql: (parts) => parts.join('') } })
mockModule('@apollo/client/react', { namedExports: {
  useLazyQuery: (query) => [query.includes('query Dupes') ? mockGetDupes : mockGetPageTitle, { loading: false }]
} })
mockModule('@/lib/error', { namedExports: { isAbortError: () => false } })
mockModule('@/lib/validate', { namedExports: { linkSchema: () => ({}) } })
mockModule('@/lib/constants', { namedExports: { MAX_TITLE_LENGTH: 200 } })
mockModule('@/lib/url', { namedExports: { ensureProtocol: value => value.includes('://') ? value : `https://${value}` } })
mockModule('@/fragments/items', { namedExports: { ITEM_FIELDS: '' } })
mockModule('@/fragments/payIn', { namedExports: { UPSERT_LINK: '' } })
mockModule('@/svgs/moon-fill.svg', { defaultExport: () => null })
mockModule('./item', { defaultExport: () => null })
mockModule('./accordian-item', { defaultExport: () => null })
mockModule('./adv-post-form', { defaultExport: ({ children }) => children })
mockModule('./post', { namedExports: { ItemButtonBar: ({ children }) => children } })
mockModule('./use-post-form-shared', { namedExports: {
  usePostFormShared: ({ item, extraInitialValues }) => ({
    initial: { title: item?.title || mockState.router.query.title || '', ...extraInitialValues },
    client: { cache: { modify: mockCacheModify } },
    storageKeyPrefix: item ? undefined : 'link'
  })
} })

// The input fixture preserves the real Input's draft replay and change contract.
// The component, React effects and useDebounceCallback are not mocked.
mockModule('@/components/form', { namedExports: {
  Form: ({ initial, storageKeyPrefix, children }) => mockReact.createElement(
    mockFormContext.Provider, { value: { initial, storageKeyPrefix } }, children
  ),
  Input: ({ name, onChange, overrideValue }) => {
    const form = mockReact.useContext(mockFormContext)
    const [value, setValue] = mockReact.useState(form.initial[name] || '')
    const change = (nextValue) => {
      if (form.storageKeyPrefix) window.localStorage.setItem(`${form.storageKeyPrefix}-${name}`, nextValue)
      setValue(nextValue)
      onChange?.({ values: form.initial }, { target: { value: nextValue } })
    }
    mockState.change[name] = change
    mockReact.useEffect(() => {
      const draft = form.storageKeyPrefix && window.localStorage.getItem(`${form.storageKeyPrefix}-${name}`)
      if (overrideValue || draft) change(overrideValue || draft)
    }, [overrideValue])
    return mockReact.createElement('input', { name, value, readOnly: true })
  },
  SNInput: () => null
} })

const { LinkForm } = await import('./link-form.js')
const url = 'https://example.com/article'
const draftUrl = 'https://example.com/saved-draft'
const editedUrl = 'https://example.com/manual-edit'
let root

async function render (props = {}) {
  await mockReact.act(async () => {
    root.render(mockReact.createElement(LinkForm, props))
  })
}

async function advance () {
  await mockReact.act(async () => {
    mock.timers.tick(500)
  })
}

async function changeUrl (value) {
  await mockReact.act(async () => mockState.change.url(value))
}

function requestedUrls () {
  return mockGetDupes.mock.calls.map(({ arguments: [options] }) => options.variables.url)
}

beforeEach(() => {
  const { window } = parseHTML('<html><body><div id="root"></div></body></html>')
  const storage = new Map()
  Object.defineProperty(window, 'localStorage', {
    configurable: true,
    value: {
      getItem: key => storage.get(key) ?? null,
      setItem: (key, value) => storage.set(key, String(value)),
      removeItem: key => storage.delete(key)
    }
  })
  global.window = window
  global.document = window.document
  global.IS_REACT_ACT_ENVIRONMENT = true
  mockState.router = { isReady: true, query: { url, title: 'A supplied title' } }
  mockState.change = {}
  for (const fn of [mockGetDupes, mockGetPageTitle, mockCacheModify]) fn.mock.resetCalls()
  mock.timers.enable({ apis: ['setTimeout'] })
  root = createRoot(document.getElementById('root'))
})

afterEach(async () => {
  if (root) await mockReact.act(async () => root.unmount())
  mock.timers.reset()
  delete global.IS_REACT_ACT_ENVIRONMENT
  delete global.window
  delete global.document
})

test('checks an initial query URL without editing or replacing its supplied title', async () => {
  await render()
  await advance()
  assert.deepEqual(requestedUrls(), [url])
  assert.equal(mockGetPageTitle.mock.callCount(), 0)
  assert.equal(document.querySelector('input[name="title"]').value, 'A supplied title')
})

test('does not query a late router URL when the form still displays its original empty URL', async () => {
  mockState.router = { isReady: false, query: {} }
  await render()
  await advance()
  assert.deepEqual(requestedUrls(), [])
  mockState.router = { isReady: true, query: { url, title: 'Hydrated title' } }
  await render()
  await advance()
  assert.deepEqual(requestedUrls(), [])
  assert.equal(document.querySelector('input[name="url"]').value, '')
})

test('the restored draft wins over the query URL without two lookups', async () => {
  window.localStorage.setItem('link-url', draftUrl)
  await render()
  await advance()
  assert.deepEqual(requestedUrls(), [draftUrl])
  assert.equal(document.querySelector('input[name="url"]').value, draftUrl)
})

test('manual input before router hydration wins over the later query URL', async () => {
  mockState.router = { isReady: false, query: {} }
  await render()
  await changeUrl(editedUrl)
  mockState.router = { isReady: true, query: { url } }
  await render()
  await advance()
  assert.deepEqual(requestedUrls(), [editedUrl])
  assert.equal(document.querySelector('input[name="url"]').value, editedUrl)
})

test('a manual edit replaces a queued initial lookup', async () => {
  await render()
  await changeUrl(editedUrl)
  await advance()
  assert.deepEqual(requestedUrls(), [editedUrl])
})

test('clearing the URL cancels a queued initial lookup', async () => {
  await render()
  await changeUrl('')
  await advance()
  assert.deepEqual(requestedUrls(), [])
})

for (const value of ['', 'not-a-host', ' ']) {
  test(`does not look up an unusable initial URL: ${JSON.stringify(value)}`, async () => {
    mockState.router.query.url = value
    await render()
    await advance()
    assert.deepEqual(requestedUrls(), [])
  })
}

test('does not look up duplicates while editing an existing item', async () => {
  await render({ item: { id: 1, url, title: 'Existing title' } })
  await advance()
  assert.deepEqual(requestedUrls(), [])
})

test('unmounting cancels the initial lookup', async () => {
  await render()
  await mockReact.act(async () => root.unmount())
  root = null
  await advance()
  assert.deepEqual(requestedUrls(), [])
})

test('does not repeat the initial lookup on unrelated renders', async () => {
  await render()
  await advance()
  await render()
  await advance()
  assert.deepEqual(requestedUrls(), [url])
  await changeUrl(editedUrl)
  await advance()
  assert.deepEqual(requestedUrls(), [url, editedUrl])
})

test('React StrictMode leaves one live initial lookup after its effect replay', async () => {
  await mockReact.act(async () => root.render(mockReact.createElement(
    mockReact.StrictMode, null, mockReact.createElement(LinkForm)
  )))
  await advance()
  assert.deepEqual(requestedUrls(), [url])
})

test('React StrictMode restores one draft lookup instead of the prefilled URL', async () => {
  window.localStorage.setItem('link-url', draftUrl)
  await mockReact.act(async () => root.render(mockReact.createElement(
    mockReact.StrictMode, null, mockReact.createElement(LinkForm)
  )))
  await advance()
  assert.deepEqual(requestedUrls(), [draftUrl])
  assert.equal(document.querySelector('input[name="url"]').value, draftUrl)
})

test('a prefilled URL without a title checks duplicates without fetching a title', async () => {
  mockState.router.query.title = ''
  await render()
  await advance()
  assert.deepEqual(requestedUrls(), [url])
  assert.equal(mockGetPageTitle.mock.callCount(), 0)
})

test('a saved draft is not queried again when router readiness changes later', async () => {
  mockState.router = { isReady: false, query: {} }
  window.localStorage.setItem('link-url', draftUrl)
  await render()
  await advance()
  assert.deepEqual(requestedUrls(), [draftUrl])
  mockState.router = { isReady: true, query: { url } }
  await render()
  await advance()
  assert.deepEqual(requestedUrls(), [draftUrl])
  assert.equal(document.querySelector('input[name="url"]').value, draftUrl)
})
