#!/usr/bin/env node

/**
 * Remove labels starting with "difficulty:" or "priority:" from issues (not PRs).
 *
 * Usage:
 *   GITHUB_TOKEN=... node strip-labels.js OWNER REPO [--state all|open|closed] [--dry-run]
 */

const owner = process.argv[2]
const repo = process.argv[3]

const stateArgIndex = process.argv.indexOf('--state')
const state = stateArgIndex !== -1 ? (process.argv[stateArgIndex + 1] || 'all') : 'all'

const dryRun = process.argv.includes('--dry-run')

if (!owner || !repo) {
  console.error('Usage: GITHUB_TOKEN=... node strip-labels.js OWNER REPO [--state all|open|closed] [--dry-run]')
  process.exit(1)
}

const token = process.env.GITHUB_TOKEN
if (!token) {
  console.error('Missing GITHUB_TOKEN env var.')
  process.exit(1)
}

const PREFIXES = ['difficulty:', 'priority:']

async function gh (path, { method = 'GET', body } = {}) {
  const url = `https://api.github.com${path}`
  const res = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      ...(body ? { 'Content-Type': 'application/json' } : {})
    },
    body: body ? JSON.stringify(body) : undefined
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`${method} ${path} -> ${res.status} ${res.statusText}\n${text}`)
  }

  if (res.status === 204) return { data: null, headers: res.headers }
  const data = await res.json()
  return { data, headers: res.headers }
}

async function * paginate (path) {
  let next = path
  while (next) {
    const { data, headers } = await gh(next)
    yield data

    const link = headers.get('link')
    next = null
    if (link) {
      for (const part of link.split(',').map(s => s.trim())) {
        const m = part.match(/<([^>]+)>;\s*rel="([^"]+)"/)
        if (m && m[2] === 'next') {
          const u = new URL(m[1])
          next = u.pathname + u.search
        }
      }
    }
  }
}

function shouldRemove (label) {
  return PREFIXES.some(prefix => label.startsWith(prefix))
}

(async () => {
  console.log(`Repo: ${owner}/${repo}`)
  console.log(`State: ${state}`)
  console.log(`Mode: ${dryRun ? 'DRY RUN (no changes will be made)' : 'LIVE (labels will be removed)'}`)
  console.log('')

  const base = `/repos/${owner}/${repo}/issues?state=${encodeURIComponent(state)}&per_page=100`

  let scanned = 0
  let matchedIssues = 0
  let totalLabelsToRemove = 0
  let updated = 0

  for await (const page of paginate(base)) {
    for (const item of page) {
      scanned++

      // Skip PRs
      if (item.pull_request) continue

      const labels = (item.labels || []).map(l => (typeof l === 'string' ? l : l.name))
      const toRemove = labels.filter(l => l && shouldRemove(l))

      if (!toRemove.length) continue

      matchedIssues++
      totalLabelsToRemove += toRemove.length

      const title = (item.title || '').replace(/\s+/g, ' ').trim()
      console.log(
        `Issue #${item.number} (${item.state}) — ${title}\n  ${dryRun ? 'would remove' : 'removing'}: [${toRemove.join(', ')}]`
      )

      if (!dryRun) {
        // Delete a set of labels in one call
        await gh(`/repos/${owner}/${repo}/issues/${item.number}/labels`, {
          method: 'DELETE',
          body: { labels: toRemove }
        })
        updated++
      }
    }
  }

  console.log('')
  console.log(
    `Done. Scanned items: ${scanned} (includes PRs). ` +
    `Matched issues: ${matchedIssues}. ` +
    `Labels to remove: ${totalLabelsToRemove}. ` +
    `Updated issues: ${dryRun ? 0 : updated}.`
  )
})().catch(err => {
  console.error(err?.stack || String(err))
  process.exit(1)
})
