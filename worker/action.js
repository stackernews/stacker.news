import { handleActionError } from './wallet'

export async function finalizeAction ({ data: { type, id }, models }) {
  const queries = handleActionError({ data: { actionType: type, actionId: id }, models })
  if (queries.length === 0) return

  await models.$transaction(queries)
}
