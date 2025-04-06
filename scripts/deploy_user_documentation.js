#!/usr/bin/env node

const path = require('path')
const fs = require('fs')

const SN_API_URL = process.env.SN_API_URL ?? 'http://localhost:3000'
const SN_API_KEY = process.env.SN_API_KEY

const parseFrontMatter = (content) => {
  const lines = content.split('\n')
  if (lines[0] !== '---') {
    throw new Error('failed to parse front matter: start delimiter not found')
  }

  const endIndex = lines.findIndex((line, i) => i > 0 && line === '---')
  if (endIndex === -1) {
    throw new Error('failed to parse front matter: end delimiter not found')
  }

  const meta = {}
  for (let i = 1; i < endIndex; i++) {
    const line = lines[i]
    const [key, ...valueParts] = line.split(':')
    if (key && valueParts.length) {
      meta[key.trim()] = valueParts.join(':').trim()
    }
  }

  return meta
}

const readItem = (name) => {
  const content = fs.readFileSync(path.join(__dirname, name), 'utf8')
  const lines = content.split('\n')
  const startIndex = lines.findIndex((line, i) => i > 0 && line.startsWith('---')) + 1
  return {
    ...parseFrontMatter(content),
    text: lines.slice(startIndex).join('\n')
  }
}

async function upsertDiscussion (variables) {
  if (!SN_API_KEY) {
    throw new Error('SN_API_KEY is not set')
  }

  const response = await fetch(`${SN_API_URL}/api/graphql`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': SN_API_KEY
    },
    body: JSON.stringify({
      query: `
        mutation upsertDiscussion($id: ID!, $sub: String!, $title: String!, $text: String!) {
          upsertDiscussion(id: $id, sub: $sub, title: $title, text: $text) {
            result {
              id
            }
          }
        }
      `,
      variables
    })
  })

  if (response.status !== 200) {
    throw new Error(`failed to upsert discussion: ${response.statusText}`)
  }

  const json = await response.json()
  if (json.errors) {
    throw new Error(json.errors[0].message)
  }

  return json.data
}

const faq = readItem('../docs/user/faq.md')

upsertDiscussion(faq)
