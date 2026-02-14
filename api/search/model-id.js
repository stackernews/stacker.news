const DEFAULT_OPENSEARCH_MODEL_NAME = process.env.OPENSEARCH_MODEL_NAME || 'huggingface/sentence-transformers/all-mpnet-base-v2'
const MODEL_ID_HIT_TTL_MS = 60 * 1000
const MODEL_ID_MISS_TTL_MS = 10 * 1000

let modelIdCache = { value: null, expiresAt: 0 }
let modelIdLookupPromise = null

export async function resolveOpensearchModelId (search) {
  if (process.env.OPENSEARCH_MODEL_ID) {
    return process.env.OPENSEARCH_MODEL_ID
  }

  if (process.env.NODE_ENV !== 'development' || !search?.transport?.request) {
    return null
  }

  if (Date.now() < modelIdCache.expiresAt) {
    return modelIdCache.value
  }

  if (!modelIdLookupPromise) {
    modelIdLookupPromise = (async () => {
      try {
        const response = await search.transport.request({
          method: 'POST',
          path: '/_plugins/_ml/models/_search',
          body: {
            size: 1,
            query: {
              bool: {
                must: [
                  {
                    term: {
                      'name.keyword': DEFAULT_OPENSEARCH_MODEL_NAME
                    }
                  },
                  {
                    term: {
                      model_state: 'DEPLOYED'
                    }
                  }
                ]
              }
            }
          }
        })
        const modelId = response?.body?.hits?.hits?.[0]?._id || null
        modelIdCache = {
          value: modelId,
          expiresAt: Date.now() + (modelId ? MODEL_ID_HIT_TTL_MS : MODEL_ID_MISS_TTL_MS)
        }
        return modelId
      } catch (err) {
        console.log('unable to resolve OPENSEARCH_MODEL_ID from model registry', err?.message)
        modelIdCache = {
          value: null,
          expiresAt: Date.now() + MODEL_ID_MISS_TTL_MS
        }
        return null
      } finally {
        modelIdLookupPromise = null
      }
    })()
  }

  return modelIdLookupPromise
}
