import { SourceMapConsumer } from 'source-map'

// FUN@FILE:LINE:COLUMN
const STACK_TRACE_LINE_REGEX = /^([A-Za-z0-9]*)@(.*):([0-9]+):([0-9]+)/

/**
 * Decode a minified stack trace using source maps
 * @param {string} stack - the minified stack trace
 * @param {Object<string, SourceMapConsumer>} [sourceMaps] - an object used to cache source maps
 * @returns {Promise<string>} Decoded stack trace
 */
export async function decodeMinifiedStackTrace (stack, sourceMaps = {}) {
  let decodedStack = ''
  let decoded = false
  for (const line of stack.split('\n')) {
    try {
      const stackLine = line.trim()
      const stackLineParts = stackLine?.match(STACK_TRACE_LINE_REGEX)
      if (stackLineParts) {
        const [stackFile, stackLine, stackColumn] = stackLineParts.slice(2)
        if (!stackFile || !stackLine || !stackColumn) throw new Error('Unsupported stack line')
        if (
          (
            !stackFile.startsWith(process.env.NEXT_PUBLIC_ASSET_PREFIX) &&
        !stackFile.startsWith(process.env.NEXT_PUBLIC_URL)
          ) ||
            !stackFile.endsWith('.js')
        ) throw new Error('Unsupported file url ' + stackFile)
        const sourceMapUrl = stackFile + '.map'
        if (!sourceMaps[sourceMapUrl]) {
          sourceMaps[sourceMapUrl] = await new SourceMapConsumer(await fetch(sourceMapUrl).then(res => res.text()))
        }
        const sourceMapper = sourceMaps[sourceMapUrl]
        const map = sourceMapper.originalPositionFor({
          line: parseInt(stackLine),
          column: parseInt(stackColumn)
        })
        const { source, name, line, column } = map
        if (!source || line === undefined) throw new Error('Unsupported stack line')
        decodedStack += `${name || ''}@${source}:${line}:${column}\n`
        decoded = true
        continue
      }
    } catch (e) {
      console.error('Cannot decode stack line', e)
    }
    decodedStack += `${line}\n`
  }

  if (decoded) {
    decodedStack = `Decoded stacktrace:\n${decodedStack}\n\nOriginal stack trace:\n${stack}`
  }

  return decodedStack
}
