// __mocks__/@/lib/nostr.js
const Nostr = {
  get: () => ({
    getSigner: () => ({}),
    publish: jest.fn(async (event, opts) => {
      if (global.__published) global.__published.push(event)
    })
  })
}
export default Nostr
