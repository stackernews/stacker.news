module.exports = () => ({
  id: 'credentials',
  name: 'Credentials',
  type: 'credentials',
  credentials: {},
  authorize: () => jest.fn().mockReturnedValue({})
})
