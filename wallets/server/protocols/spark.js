export const name = 'SPARK'

export async function createInvoice (
  { msats, description, descriptionHash, expiry },
  { address },
  { signal }
) {
  // TODO: implement
}

export async function testCreateInvoice ({ address }, { signal }) {
  return await createInvoice(
    { msats: 1000, description: 'SN test invoice', expiry: 1 },
    { address },
    { signal })
}
