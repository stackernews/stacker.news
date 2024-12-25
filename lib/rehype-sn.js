import { visit, SKIP } from 'unist-util-visit'
import { parseEmbedUrl, parseInternalLinks } from './url'
import { slug } from 'github-slugger'
import { toString } from 'mdast-util-to-string'

const userGroup = '[\\w_]+'
const subGroup = '[A-Za-z][\\w_]+'

const mentionRegex = new RegExp('@(' + userGroup + '(?:\\/' + userGroup + ')?)', 'gi')
const subRegex = new RegExp('~(' + subGroup + '(?:\\/' + subGroup + ')?)', 'gi')
const nostrIdRegex = /\b((npub1|nevent1|nprofile1|note1|naddr1)[02-9ac-hj-np-z]+)\b/g

export default function rehypeSN (options = {}) {
  const { stylers = [] } = options

  return function transformer (tree) {
    try {
      // Store transformations to apply later
      const transformations = []
      let currentTransformation = null

      visit(tree, (node, index, parent) => {
        // Start collecting a new transformation
        if (node.type === 'raw' && node.value.includes('<details>')) {
          currentTransformation = {
            parent,
            startIndex: index,
            nodesToRemove: 1,
            detailsNode: {
              type: 'element',
              tagName: 'details',
              properties: {},
              children: [{
                type: 'text',
                value: node.value.replace(/<details>/g, '')
              }]
            }
          }
          return SKIP
        }

        // Collect nodes while inside a details block
        if (currentTransformation) {
          // Handle details closing
          if (node.type === 'raw' && node.value.includes('</details>')) {
            // Add remaining text after removing closing tag
            const remainingText = node.value.replace(/<\/details>/g, '')
            if (remainingText) {
              currentTransformation.detailsNode.children.push({
                type: 'text',
                value: remainingText
              })
            }
            
            currentTransformation.nodesToRemove++
            transformations.push(currentTransformation)
            currentTransformation = null
            return SKIP
          }

          // Collect other nodes
          if (node.type === 'element' || node.type === 'text') {
            currentTransformation.detailsNode.children.push(node)
            currentTransformation.nodesToRemove++
          }
        }
      })

      // Apply all transformations after visiting is complete
      transformations.reverse().forEach(({ parent, startIndex, nodesToRemove, detailsNode }) => {
        parent.children.splice(startIndex, nodesToRemove, detailsNode)
      })

    } catch (error) {
      console.error('Error in rehypeSN transformer:', error)
    }

    return tree
  }
}
