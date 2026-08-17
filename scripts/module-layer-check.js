// Gate: every CSS module must wrap its rules in @layer components, so module
// skins stay below utilities in the cascade (see docs/dev/styling.md §1).
// Fails if any *.module.css has rules outside a single top-level layer block.
const { execSync } = require('child_process')
const fs = require('fs')
const postcss = require('postcss')

const files = execSync('git ls-files "*.module.css"').toString().trim().split('\n').filter(Boolean)

let failed = false
for (const file of files) {
  try {
    const root = postcss.parse(fs.readFileSync(file, 'utf8'), { from: file })
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
