import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import App from './App'

describe('CoSource application shell', () => {
  it('renders its identity and honest foundation status', () => {
    const markup = renderToStaticMarkup(<App />)

    expect(markup).toContain('<main')
    expect(markup).toContain('CoSource')
    expect(markup).toContain('Agent-native commerce intelligence')
    expect(markup).toContain('preparing a focused workspace')
  })
})
