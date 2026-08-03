const { parseHTML } = require('linkedom')
const { TestEnvironment: NodeEnvironment } = require('jest-environment-node')

// custom DOM test environment built on linkedom, which is already a
// dependency of this repo, so component tests don't need jest-environment-jsdom
class LinkedomEnvironment extends NodeEnvironment {
  constructor (config, context) {
    super(config, context)
    this.dom = parseHTML('<!doctype html><html><head></head><body></body></html>')
  }

  async setup () {
    await super.setup()
    const { window, document } = this.dom

    // localStorage is missing in linkedom
    const storage = new Map()
    window.localStorage = {
      getItem: (key) => (storage.has(key) ? storage.get(key) : null),
      setItem: (key, value) => storage.set(key, String(value)),
      removeItem: (key) => storage.delete(key),
      clear: () => storage.clear(),
      key: (index) => [...storage.keys()][index] ?? null,
      get length () { return storage.size }
    }

    // React DOM expects a handful of browser APIs linkedom doesn't ship
    window.location = {
      protocol: 'http:',
      host: 'localhost',
      hostname: 'localhost',
      href: 'http://localhost/',
      origin: 'http://localhost',
      pathname: '/',
      hash: '',
      search: '',
      port: ''
    }
    window.matchMedia = () => ({
      matches: false,
      addEventListener: () => {},
      removeEventListener: () => {}
    })
    window.requestAnimationFrame = (cb) => setTimeout(cb, 0)
    window.cancelAnimationFrame = (id) => clearTimeout(id)
    window.getComputedStyle = () => ({
      getPropertyValue: () => '',
      getPropertyPriority: () => ''
    })
    window.getSelection = () => ({})
    window.Range = window.Range || window.document.defaultView?.Range || class {}

    const globals = this.global
    globals.window = window
    globals.document = document
    globals.navigator = window.navigator || { userAgent: 'linkedom' }
    // drop Chrome/Firefox markers so React skips the devtools console.info
    globals.navigator.userAgent = 'linkedom'
    globals.localStorage = window.localStorage
    globals.IS_REACT_ACT_ENVIRONMENT = true

    for (const key of [
      'Event', 'CustomEvent', 'Element', 'Node', 'Document', 'HTMLElement',
      'MutationObserver', 'DOMParser', 'Range', 'getComputedStyle'
    ]) {
      if (window[key] !== undefined) globals[key] = window[key]
    }
  }

  async teardown () {
    await super.teardown()
  }
}

module.exports = LinkedomEnvironment
