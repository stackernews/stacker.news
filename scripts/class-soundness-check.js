// fails on class names built with template interpolation, raw hex colors in
// bracket utilities and references to the removed --theme-* and --bs-* custom properties
const { execSync } = require('child_process')
const fs = require('fs')
const path = require('path')

const ROOT = path.resolve(__dirname, '..')
const files = execSync('git ls-files components pages lib wallets styles', { cwd: ROOT })
  .toString().trim().split('\n').filter(f => /\.(js|jsx|css)$/.test(f))

if (files.length === 0) {
  console.error('no source files found; refusing to pass an empty check')
  process.exit(1)
}

const RULES = [
  {
    name: 'class fragment interpolation',
    test: line => /(className=\{|\b(?:cn|classNames|\w+Classes)\()[^\n]*`[^`\n]*-\$\{/.test(line)
  },
  {
    name: 'raw hex color utility',
    test: line => /(?:^|[^\w-])(?:bg|text|border|fill|stroke|from|via|to|ring|outline|shadow|decoration|accent|caret|divide|placeholder)-\[#/.test(line)
  },
  {
    name: 'retired custom property',
    test: line => /var\(--(?:theme|bs)-/.test(line)
  }
]

let failed = 0
for (const file of files) {
  const lines = fs.readFileSync(path.join(ROOT, file), 'utf8').split('\n')
  lines.forEach((line, i) => {
    for (const rule of RULES) {
      if (rule.test(line)) {
        console.error(`${file}:${i + 1}: ${rule.name}: ${line.trim()}`)
        failed++
      }
    }
  })
}

if (failed) {
  console.error(`${failed} class soundness violation(s)`)
  process.exit(1)
}
console.log(`${files.length} source files pass class soundness`)
