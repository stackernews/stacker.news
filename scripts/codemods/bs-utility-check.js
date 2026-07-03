#!/usr/bin/env node
// Bootstrap utility leftover checker (PR1/PR3 gate; see
// docs/dev/tailwind-migration-plan.md).
//
// Usage:
//   node scripts/codemods/bs-utility-check.js               gate: exit 1 on leftovers
//   node scripts/codemods/bs-utility-check.js --inventory   census: classify every token
//   node scripts/codemods/bs-utility-check.js [flags] dir...
//
// Two sweeps:
//   1. class contexts (same scope as the codemod): a token that is still a
//      bs-tw-map MAP/DELETE key, matches a Bootstrap-only pattern, or hits the
//      spacing-step heuristic is a leftover.
//   2. ALL string literals/template chunks in every file (helpers that build
//      class strings outside className-shaped code): flagged only on
//      unambiguous Bootstrap-only patterns, so prose strings can't false-positive.
//
// Spacing-step heuristic: the codemod's output never contains steps 3/5
// (BS 0,1,2,3,4,5 → TW 0,1,2,4,6,12), so a surviving `mt-3`/`gap-5` means a
// missed transform. `mt-4` is ambiguous (valid TW output) and NOT flagged —
// accepted residual, mitigated by the cascade (Tailwind's important layer wins).
//
// Component classes (btn-*, nav-link, form-control, modal-*…) are PR2/PR3 scope
// and never flagged. DEFERRED color/bg utilities are reported informationally.

const fs = require('fs')
const path = require('path')
const parser = require('@babel/parser')
const { MAP, IDENTITY, DEFERRED, DELETE, SN_CUSTOM, AMBIGUOUS } = require('./bs-tw-map')
const { PARSE_OPTS, listFiles, resolveToken, walkAst, collectTargets, tokenize, DEFAULT_DIRS } = require('./bs-to-tw')

// unambiguous Bootstrap-only shapes — safe to flag in ANY string
const BS_PATTERNS = [
  /^d-(none|inline|inline-block|block|grid|inline-grid|flex|inline-flex|table|table-row|table-cell)$/,
  /^d-(sm|md|lg|xl|xxl)-/,
  /^(m|p)(t|b|s|e|x|y)?-(sm|md|lg|xl|xxl)-/,
  /^gap-(sm|md|lg|xl|xxl)-/,
  /^(row-gap|column-gap)-[0-5]$/,
  /^fw-(bold|bolder|semibold|medium|normal|light|lighter)$/,
  /^fst-(italic|normal)$/,
  /^fs-[1-6]$/,
  /^font-monospace$/,
  /^align-items-/, /^align-self-/, /^align-content-/, /^justify-content-/,
  /^flex-(column|column-reverse|fill|grow-[01]|shrink-[01]|shrink)$/,
  /^flex-(sm|md|lg|xl|xxl)-/,
  /^position-(static|relative|absolute|fixed|sticky)$/,
  /^visually-hidden/,
  /^text-(nowrap|wrap|truncate|break|uppercase|lowercase|capitalize|left|right)$/,
  /^text-decoration-/,
  /^text-opacity-/,
  /^(w|h)-(25|50|75|100)$/,
  /^(mw|mh|vw|vh)-100$/, /^min-v(w|h)-100$/,
  /^rounded$/, /^rounded-(0|1|2|3|4|5|circle|pill)$/, /^rounded-(top|end|bottom|start)(-|$)/,
  /^pe-(none|auto)$/,
  /^(top|bottom|start|end)-(50|100)$/,
  /^translate-middle/,
  /^border$/, /^border-(top|end|bottom|start)(-[0-5])?$/,
  /^float-(start|end|none)$/,
  /^user-select-(all|auto|none)$/,
  /^lh-(1|sm|base|lg)$/,
  /^stretched-link$/, /^fixed-(top|bottom)$/, /^sticky-((sm|md|lg|xl|xxl)-)?(top|bottom)$/,
  /^order-(first|last|sm|md|lg|xl|xxl)/,
  /^ratio(-|$)/
]

// heuristic: spacing steps the codemod never emits
const SPACING_HEURISTIC = /^((m|p)(t|b|s|e|x|y)?|gap)-[35]$/

// PR2/PR3 component/state classes — informational only
const COMPONENT_PATTERN = /^(btn|button|nav|navbar|modal|form|dropdown|dropup|badge|alert|toast|popover|tooltip|accordion|offcanvas|carousel|card|input-group|list-group|spinner|table|container|container-fluid|row|col|invalid|valid|is|was-validated|show|fade|active|disabled|collapse|collapsing|close|outline)(-|$)/

function matchesBsPattern (token) {
  return BS_PATTERNS.some(re => re.test(token))
}

// strip Tailwind variant prefixes so `md:d-flex` (should never exist) still flags
function baseToken (token) {
  return token.includes(':') ? token.split(':').pop() : token
}

function classify (token) {
  // AMBIGUOUS (*-4 spacing) is both a BS key and a codemod output — post-codemod
  // these names are Tailwind-intent, so they can't be flagged by name (accepted
  // residual; the cascade resolves any true stray to the Tailwind value)
  if (AMBIGUOUS.has(token)) return 'identity'
  if (DELETE.has(token) || Object.prototype.hasOwnProperty.call(MAP, token)) return 'leftover-mapped'
  if (IDENTITY.has(token)) return 'identity'
  if (DEFERRED.has(token)) return 'deferred'
  if (SN_CUSTOM.has(token) || token.startsWith('fill-')) return 'custom'
  if (COMPONENT_PATTERN.test(token)) return 'component'
  if (matchesBsPattern(baseToken(token))) return 'leftover-pattern'
  if (SPACING_HEURISTIC.test(baseToken(token))) return 'leftover-spacing-heuristic'
  // resolvable responsive infix that the codemod would have rewritten
  const res = resolveToken(token)
  if (res.action !== 'keep' || res.category !== 'unknown') return 'leftover-mapped'
  return 'other'
}

function collectAllStrings (ast) {
  const nodes = []
  walkAst(ast, node => {
    if (node.type === 'StringLiteral') nodes.push({ kind: 'string', node })
    else if (node.type === 'TemplateLiteral') nodes.push({ kind: 'template', node })
  })
  return nodes
}

function chunksOf (code, { kind, node }) {
  if (kind === 'string') return [{ raw: code.slice(node.start + 1, node.end - 1), base: node.start + 1 }]
  return node.quasis.map(q => ({ raw: code.slice(q.start, q.end), base: q.start }))
}

function lineOf (code, offset) {
  let line = 1
  for (let i = 0; i < offset; i++) if (code[i] === '\n') line++
  return line
}

function main () {
  const args = process.argv.slice(2)
  const inventory = args.includes('--inventory')
  const dirs = args.filter(a => !a.startsWith('--'))
  const root = process.cwd() // run from the repo root (or any tree to verify)
  const files = listFiles(dirs.length ? dirs : DEFAULT_DIRS, root)

  const leftovers = [] // { rel, line, token, category, sweep }
  const deferred = new Map() // token → count
  const census = new Map() // token → { category, count }
  const parseFailures = []

  for (const file of files) {
    const code = fs.readFileSync(file, 'utf8')
    const rel = path.relative(root, file)
    let ast
    try {
      ast = parser.parse(code, PARSE_OPTS)
    } catch (err) {
      parseFailures.push({ rel, message: err.message })
      continue
    }

    const classTargets = collectTargets(ast)
    const classNodes = new Set(classTargets.map(t => t.node))

    // sweep 1: class contexts — full classification
    for (const target of classTargets) {
      for (const chunk of chunksOf(code, target)) {
        for (const tok of tokenize(chunk.raw)) {
          const category = classify(tok.text)
          if (inventory) {
            const entry = census.get(tok.text) || { category, count: 0 }
            entry.count++
            census.set(tok.text, entry)
          }
          if (category.startsWith('leftover')) {
            leftovers.push({ rel, line: lineOf(code, chunk.base + tok.start), token: tok.text, category, sweep: 'class-context' })
          } else if (category === 'deferred') {
            deferred.set(tok.text, (deferred.get(tok.text) || 0) + 1)
          }
        }
      }
    }

    // sweep 2: every other string — unambiguous patterns only. Skip single-token
    // hyphen-less strings: plain words like 'border' in data (e.g. the bip39
    // word list) aren't class lists.
    for (const target of collectAllStrings(ast)) {
      if (classNodes.has(target.node)) continue
      for (const chunk of chunksOf(code, target)) {
        const tokens = tokenize(chunk.raw)
        if (tokens.length === 1 && !tokens[0].text.includes('-')) continue
        for (const tok of tokens) {
          if (matchesBsPattern(baseToken(tok.text))) {
            leftovers.push({ rel, line: lineOf(code, chunk.base + tok.start), token: tok.text, category: 'leftover-pattern', sweep: 'any-string' })
          }
        }
      }
    }
  }

  if (inventory) {
    const byCategory = new Map()
    for (const [token, { category, count }] of census) {
      if (!byCategory.has(category)) byCategory.set(category, [])
      byCategory.get(category).push({ token, count })
    }
    for (const category of ['leftover-mapped', 'leftover-pattern', 'leftover-spacing-heuristic', 'identity', 'deferred', 'custom', 'component', 'other']) {
      const tokens = byCategory.get(category)
      if (!tokens) continue
      console.log(`\n## ${category} (${tokens.length} distinct, ${tokens.reduce((a, t) => a + t.count, 0)} uses)`)
      for (const { token, count } of tokens.sort((a, b) => b.count - a.count)) {
        console.log(`  ${String(count).padStart(4)}  ${token}`)
      }
    }
    return
  }

  if (deferred.size) {
    console.log('deferred (Bootstrap keeps owning these until PR2/PR3 — informational):')
    for (const [token, count] of [...deferred.entries()].sort((a, b) => b[1] - a[1])) {
      console.log(`  ${String(count).padStart(4)}  ${token}`)
    }
  }

  if (parseFailures.length) {
    console.log('\nPARSE FAILURES (cannot verify):')
    for (const f of parseFailures) console.log(`  ${f.rel}: ${f.message}`)
  }

  if (leftovers.length) {
    console.log('\nLEFTOVER BOOTSTRAP UTILITIES:')
    for (const l of leftovers) {
      console.log(`  ${l.rel}:${l.line}  ${l.token}  [${l.category}${l.sweep === 'any-string' ? ', outside className context' : ''}]`)
    }
    console.log(`\n${leftovers.length} leftover(s) found`)
    process.exitCode = 1
  } else if (!parseFailures.length) {
    console.log('\nno leftover Bootstrap utilities found')
  } else {
    process.exitCode = 1
  }
}

if (require.main === module) main()
