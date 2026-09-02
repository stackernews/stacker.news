// every CSS module must wrap its rules in @layer components so utilities can override them
// (see docs/dev/styling.md)
const { execSync } = require('child_process')
const fs = require('fs')
const path = require('path')
const postcss = require('postcss')

const ROOT = path.resolve(__dirname, '..')
const files = execSync('git ls-files "*.module.css"', { cwd: ROOT }).toString().trim().split('\n').filter(Boolean)

if (files.length === 0) {
  console.error('no *.module.css files found; refusing to pass an empty check')
  process.exit(1)
}

let failed = false
for (const file of files) {
  try {
    const root = postcss.parse(fs.readFileSync(path.join(ROOT, file), 'utf8'), { from: file })
    const top = root.nodes.filter(n => n.type !== 'comment')
    const single = top.length === 1 && top[0].type === 'atrule' && top[0].name === 'layer' &&
      top[0].params === 'components'
    if (!single) {
      console.error(`${file}: rules outside a single top-level "@layer components" block`)
      failed = true
    }
  } catch (e) {
    console.error(`${file}: ${e.message}`)
    failed = true
  }
}

if (failed) process.exit(1)
console.log(`${files.length} CSS modules wrapped in @layer components`)
