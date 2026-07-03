#!/usr/bin/env node
// Bootstrap → Tailwind utility codemod (PR1, commits 3–5 of
// docs/dev/tailwind-migration-plan.md).
//
// Usage:
//   node scripts/codemods/bs-to-tw.js                    dry run (default): report only
//   node scripts/codemods/bs-to-tw.js --write            apply changes in place
//   node scripts/codemods/bs-to-tw.js [--write] dir...   override scanned dirs
//
// Scope — AST-driven (@babel/parser), format-preserving source splices:
//   - JSX attributes matching /className$/i (className, groupClassName, hintClassName…)
//   - arguments of classNames(...) calls, including object literal KEYS
//   - conditional/logical/concat branches inside the above
//     (`selected ? 'fw-bold' : 'text-muted'`, `cond && 'd-flex'`)
//   - template-literal static chunks; a token touching a ${…} boundary is never
//     rewritten — it's reported as a dynamic site for manual review
//   - `const fooClassName = '…'`, `({ className = '…' })`, `{ className: '…' }`
//
// Never descends into: comparison operands (x === 'grey'), object property values,
// arguments of other calls, tagged templates (gql`…`).

const fs = require('fs')
const path = require('path')
const parser = require('@babel/parser')
const { MAP, IDENTITY, DEFERRED, DELETE, SN_CUSTOM, BREAKPOINTS, AMBIGUOUS } = require('./bs-tw-map')

const DEFAULT_DIRS = ['components', 'pages', 'lib', 'svgs', 'wallets']
const CLASSNAME_PROP = /className$/i
const INFIX = /^(.+?)-(sm|md|lg|xl|xxl)-(.+)$/
const PARSE_OPTS = { sourceType: 'unambiguous', plugins: ['jsx'], attachComment: false }

function listFiles (dirs, root) {
  const out = []
  const walk = dir => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue
      const full = path.join(dir, entry.name)
      if (entry.isDirectory()) walk(full)
      else if (/\.jsx?$/.test(entry.name)) out.push(full)
    }
  }
  for (const dir of dirs) {
    const full = path.resolve(root, dir)
    if (fs.existsSync(full)) walk(full)
  }
  return out
}

// resolve a single whitespace-delimited class token
function resolveToken (token) {
  if (DELETE.has(token)) return { action: 'delete' }
  if (Object.prototype.hasOwnProperty.call(MAP, token)) return { action: 'replace', to: MAP[token] }
  if (IDENTITY.has(token)) return { action: 'keep', category: 'identity' }
  if (DEFERRED.has(token)) return { action: 'keep', category: 'deferred' }
  if (SN_CUSTOM.has(token) || token.startsWith('fill-')) {
    return { action: 'keep', category: 'custom' }
  }
  const m = token.match(INFIX)
  if (m) {
    const base = `${m[1]}-${m[3]}`
    const bp = BREAKPOINTS[m[2]]
    if (DELETE.has(base)) return { action: 'delete' }
    if (Object.prototype.hasOwnProperty.call(MAP, base)) {
      return { action: 'replace', to: MAP[base].split(' ').map(t => `${bp}:${t}`).join(' ') }
    }
    if (IDENTITY.has(base)) return { action: 'replace', to: `${bp}:${base}` }
  }
  return { action: 'keep', category: 'unknown' }
}

// generic AST walk (no @babel/traverse dependency)
function walkAst (node, visit) {
  if (!node || typeof node.type !== 'string') return
  visit(node)
  for (const key of Object.keys(node)) {
    if (key === 'loc' || key === 'extra') continue
    const child = node[key]
    if (Array.isArray(child)) {
      for (const c of child) walkAst(c, visit)
    } else if (child && typeof child.type === 'string') {
      walkAst(child, visit)
    }
  }
}

// collect string/template nodes that carry class lists
function collectTargets (ast) {
  const seen = new Set()
  const targets = []
  const add = (kind, node) => {
    if (node && !seen.has(node)) {
      seen.add(node)
      targets.push({ kind, node })
    }
  }

  function walkClassExpr (node) {
    if (!node) return
    switch (node.type) {
      case 'StringLiteral': return add('string', node)
      case 'TemplateLiteral': {
        add('template', node)
        // also walk string literals inside ${…} (`${cond ? 'ms-2 d-flex' : 'd-flex'}`),
        // but ONLY when the interpolation is whitespace-delimited on both sides —
        // otherwise its strings are token FRAGMENTS (`btn-${cond ? 'grey' : 'primary'}`)
        node.expressions.forEach((expr, i) => {
          const left = node.quasis[i].value.raw
          const right = node.quasis[i + 1].value.raw
          const leftSafe = left === '' ? i === 0 : /\s$/.test(left)
          const rightSafe = right === '' ? i === node.expressions.length - 1 : /^\s/.test(right)
          if (leftSafe && rightSafe) walkClassExpr(expr)
        })
        return
      }
      case 'JSXExpressionContainer': return walkClassExpr(node.expression)
      case 'ParenthesizedExpression': return walkClassExpr(node.expression)
      case 'ConditionalExpression':
        walkClassExpr(node.consequent)
        walkClassExpr(node.alternate)
        return
      case 'LogicalExpression':
        walkClassExpr(node.left)
        walkClassExpr(node.right)
        return
      case 'BinaryExpression':
        if (node.operator === '+') {
          walkClassExpr(node.left)
          walkClassExpr(node.right)
        }
        return
      case 'ObjectExpression':
        for (const prop of node.properties) {
          if (prop.type === 'ObjectProperty' && !prop.computed && prop.key.type === 'StringLiteral') {
            add('string', prop.key)
          }
        }
        return
      case 'ArrayExpression':
        for (const el of node.elements) walkClassExpr(el)
    }
  }

  walkAst(ast, node => {
    if (node.type === 'JSXAttribute' && node.name.type === 'JSXIdentifier' &&
        // `variant` because a few sites stuff utility classes into react-bootstrap's
        // variant prop (they land verbatim in the rendered className); plain variant
        // names (primary, outline-grey…) are not map keys, so they pass through
        (CLASSNAME_PROP.test(node.name.name) || node.name.name === 'variant') && node.value) {
      if (node.value.type === 'StringLiteral') add('string', node.value)
      else walkClassExpr(node.value)
    } else if (node.type === 'CallExpression' && node.callee.type === 'Identifier' &&
        node.callee.name === 'classNames') {
      for (const arg of node.arguments) walkClassExpr(arg)
    } else if (node.type === 'CallExpression' && node.callee.type === 'MemberExpression' &&
        !node.callee.computed && node.callee.property.type === 'Identifier') {
      // direct DOM inside Lexical createDOM(): el.setAttribute('class', '…'),
      // el.classList.add/remove/toggle('…')
      const prop = node.callee.property.name
      if (prop === 'setAttribute' && node.arguments[0]?.type === 'StringLiteral' &&
          /^class(Name)?$/.test(node.arguments[0].value)) {
        walkClassExpr(node.arguments[1])
      } else if (['add', 'remove', 'toggle'].includes(prop) &&
          node.callee.object.type === 'MemberExpression' && !node.callee.object.computed &&
          node.callee.object.property.type === 'Identifier' &&
          node.callee.object.property.name === 'classList') {
        for (const arg of node.arguments) walkClassExpr(arg)
      }
    } else if (node.type === 'AssignmentExpression' && node.operator === '=' &&
        node.left.type === 'MemberExpression' && !node.left.computed &&
        node.left.property.type === 'Identifier' && CLASSNAME_PROP.test(node.left.property.name)) {
      walkClassExpr(node.right)
    } else if (node.type === 'VariableDeclarator' && node.id.type === 'Identifier' &&
        CLASSNAME_PROP.test(node.id.name)) {
      walkClassExpr(node.init)
    } else if (node.type === 'AssignmentPattern' && node.left.type === 'Identifier' &&
        CLASSNAME_PROP.test(node.left.name)) {
      walkClassExpr(node.right)
    } else if (node.type === 'ObjectProperty' && !node.computed && (
      (node.key.type === 'Identifier' && CLASSNAME_PROP.test(node.key.name)) ||
      (node.key.type === 'StringLiteral' && CLASSNAME_PROP.test(node.key.value)))) {
      walkClassExpr(node.value)
    }
  })
  return targets
}

// tokenize a raw class-string chunk; returns [{ text, start, end }] (chunk-relative)
function tokenize (raw) {
  const tokens = []
  const re = /\S+/g
  let m
  while ((m = re.exec(raw)) !== null) {
    tokens.push({ text: m[0], start: m.index, end: m.index + m[0].length })
  }
  return tokens
}

// build edits for one raw chunk at absolute offset `base`.
// hasExprBefore/After: a template ${…} directly borders this chunk.
function transformChunk (raw, base, hasExprBefore, hasExprAfter, report) {
  const edits = []
  for (const tok of tokenize(raw)) {
    const abuts = (hasExprBefore && tok.start === 0) || (hasExprAfter && tok.end === raw.length)
    if (abuts) {
      // token is glued to an interpolation (`text-${color}`) — manual review only
      if (tok.text !== '') report.dynamic.push({ offset: base + tok.start, token: tok.text })
      continue
    }
    const res = resolveToken(tok.text)
    if (res.action === 'replace') {
      edits.push({ start: base + tok.start, end: base + tok.end, text: res.to })
      report.changes.push({ offset: base + tok.start, from: tok.text, to: res.to })
    } else if (res.action === 'delete') {
      // eat the preceding whitespace run too (or the following one if first token)
      let start = base + tok.start
      let end = base + tok.end
      if (tok.start > 0 && /\s/.test(raw[tok.start - 1])) {
        let i = tok.start
        while (i > 0 && /\s/.test(raw[i - 1])) i--
        start = base + i
      } else if (tok.end < raw.length && /\s/.test(raw[tok.end])) {
        let i = tok.end
        while (i < raw.length && /\s/.test(raw[i])) i++
        end = base + i
      }
      edits.push({ start, end, text: '' })
      report.changes.push({ offset: base + tok.start, from: tok.text, to: '(deleted)' })
    } else if (res.category === 'deferred' || res.category === 'unknown') {
      report[res.category].push({ offset: base + tok.start, token: tok.text })
    }
  }
  return edits
}

function transformSource (code) {
  const ast = parser.parse(code, PARSE_OPTS)
  const report = { changes: [], dynamic: [], deferred: [], unknown: [] }
  const edits = []
  for (const { kind, node } of collectTargets(ast)) {
    if (kind === 'string') {
      const raw = code.slice(node.start + 1, node.end - 1)
      edits.push(...transformChunk(raw, node.start + 1, false, false, report))
    } else {
      node.quasis.forEach((quasi, i) => {
        const raw = code.slice(quasi.start, quasi.end)
        edits.push(...transformChunk(raw, quasi.start, i > 0, !quasi.tail, report))
      })
    }
  }
  let out = code
  for (const edit of edits.sort((a, b) => b.start - a.start)) {
    out = out.slice(0, edit.start) + edit.text + out.slice(edit.end)
  }
  return { out, report }
}

function lineOf (code, offset) {
  let line = 1
  for (let i = 0; i < offset; i++) if (code[i] === '\n') line++
  return line
}

function main () {
  const args = process.argv.slice(2)
  const write = args.includes('--write')
  const dirs = args.filter(a => !a.startsWith('--'))
  const root = process.cwd() // run from the repo root
  const files = listFiles(dirs.length ? dirs : DEFAULT_DIRS, root)

  const totals = { files: 0, changed: 0, replacements: new Map(), deletions: 0, unambiguous: 0, ambiguous: 0 }
  const results = []
  const dynamicSites = []
  const parseFailures = []

  for (const file of files) {
    const code = fs.readFileSync(file, 'utf8')
    const rel = path.relative(root, file)
    let result
    try {
      result = transformSource(code)
    } catch (err) {
      parseFailures.push({ rel, message: err.message })
      continue
    }
    totals.files++
    const { out, report } = result

    for (const d of report.dynamic) {
      dynamicSites.push({ rel, line: lineOf(code, d.offset), token: d.token })
    }
    if (!report.changes.length) continue

    totals.changed++
    results.push({ file, rel, code, out, report })
    for (const c of report.changes) {
      if (AMBIGUOUS.has(c.from)) totals.ambiguous++
      else totals.unambiguous++
      if (c.to === '(deleted)') totals.deletions++
      else totals.replacements.set(`${c.from} → ${c.to}`, (totals.replacements.get(`${c.from} → ${c.to}`) || 0) + 1)
    }
  }

  // Double-application guard. The map is one-shot: BS mt-3 → TW mt-4, but BS
  // mt-4 is itself a key (→ mt-6), so a second run would corrupt spacing. A
  // legitimate first run is dominated by unambiguous Bootstrap-only names
  // (d-flex, fw-bold…); if ONLY ambiguous *-4 spacing changes remain, this is
  // almost certainly a re-run over already-transformed code.
  const suspectedRerun = totals.ambiguous > 0 && totals.unambiguous === 0
  if (suspectedRerun && write) {
    console.error('ABORT: every pending change is an ambiguous *-4 spacing bump — this looks')
    console.error('like a second run over already-transformed code, which would corrupt spacing')
    console.error('(mt-4 is both the output of BS mt-3 and the Bootstrap key for 1.5rem).')
    console.error('Nothing was written. If these really are untransformed Bootstrap classes,')
    console.error('rewrite them by hand or restore the files and run the codemod once.')
    process.exitCode = 1
    return
  }

  for (const { file, rel, code, out, report } of results) {
    console.log(`\n== ${rel}`)
    for (const c of report.changes) {
      console.log(`  L${lineOf(code, c.offset)}: ${c.from} → ${c.to}`)
    }
    if (write) fs.writeFileSync(file, out)
  }

  console.log(`\n${'='.repeat(60)}`)
  console.log(`${write ? 'WROTE' : 'DRY RUN (pass --write to apply)'}: ${totals.changed}/${totals.files} files with changes`)
  console.log(`token replacements: ${[...totals.replacements.values()].reduce((a, b) => a + b, 0)}, deletions: ${totals.deletions}`)
  if (suspectedRerun) {
    console.log('\nWARNING: only ambiguous *-4 spacing changes found — if this codebase was')
    console.log('already transformed, these are Tailwind values and must NOT be re-mapped.')
  }

  const pairs = [...totals.replacements.entries()].sort((a, b) => b[1] - a[1])
  if (pairs.length) {
    console.log('\nby mapping:')
    for (const [pair, n] of pairs) console.log(`  ${String(n).padStart(4)}  ${pair}`)
  }

  if (dynamicSites.length) {
    console.log('\ndynamic sites skipped (token glued to a template interpolation — review manually):')
    for (const d of dynamicSites) console.log(`  ${d.rel}:${d.line}  …${d.token}…`)
  }

  if (parseFailures.length) {
    console.log('\nPARSE FAILURES (not transformed):')
    for (const f of parseFailures) console.log(`  ${f.rel}: ${f.message}`)
    process.exitCode = 1
  }
}

if (require.main === module) main()

module.exports = { PARSE_OPTS, listFiles, resolveToken, walkAst, collectTargets, tokenize, transformSource, DEFAULT_DIRS }
