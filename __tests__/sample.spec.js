import { render, screen } from 'test-utils'
import Home from '../pages/~'
import { waitFor } from '@testing-library/react'

describe('Sample Test', () => {
  it('should be true', () => {
    expect(true).toBe(true)
  })

  it('should render "Hello World"', () => {
    render(<div>Hello World</div>)
    expect(screen.getByText('Hello World')).toBeInTheDocument()
  })

  it('should create snapshot', () => {
    const { container } = render(<div>Hello World</div>)
    expect(container).toMatchSnapshot('Hello World snapshot should render')
  })

  it('should render the loading screen', async () => {
    const { container } = render(<Home />)
    const loading = await waitFor(() => screen.getByTestId('page-loading'))
    expect(loading).toBeInTheDocument()
    expect(container).toMatchSnapshot('Loading Screen should render')
  })
})
