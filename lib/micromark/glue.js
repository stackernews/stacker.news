/** creates a delimited span from markdown
 * @param {string} name - name of the span
 * @returns {Object} delimited span
 */
export function delimitedSpanFromMarkdown (name) {
  return {
    enter: {
      [name]: function (token) { this.enter({ type: name, children: [] }, token) },
      [name + 'Text']: function () {}
    },
    exit: {
      [name + 'Text']: function () {},
      [name]: function (token) { this.exit(token) }
    }
  }
}

/** creates a delimited span to markdown
 * @param {string} name - name of the span
 * @param {string} fence - fence of the span
 * @returns {Object} delimited span
 */
export function delimitedSpanToMarkdown (name, fence) {
  return {
    unsafe: [{ character: fence[0], inConstruct: 'phrasing' }],
    handlers: {
      [name] (node, _, state, info) {
        const exit = state.enter(name)
        const value = state.containerPhrasing(node, info)
        exit()
        return fence + value + fence
      }
    }
  }
}
