// @vitest-environment jsdom
import { screen,waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom/vitest'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { z } from 'zod'

afterEach(() => {
  document.body.innerHTML = ''
  Reflect.deleteProperty(document, 'modelContext')
  vi.unstubAllGlobals()
  vi.resetModules()
})

describe('browser bootstrap', () => {
  it('configures Zod as jitless before rendering and registering application tools', async () => {
    z.config({ jitless: false })
    vi.stubGlobal('indexedDB',undefined)
    document.body.innerHTML = '<div id="root"></div>'
    const tools = new Map<string, WebMCPToolDefinition>()
    Object.defineProperty(document, 'modelContext', {
      configurable: true,
      value: Object.assign(new EventTarget(), {
        async registerTool(
          tool: WebMCPToolDefinition,
          options?: { signal?: AbortSignal },
        ) {
          tools.set(tool.name, tool)
          options?.signal?.addEventListener('abort', () => tools.delete(tool.name), {
            once: true,
          })
        },
      }),
    })

    await import('./main.tsx')

    await waitFor(() => expect(document.body).toHaveTextContent('CoSource'),{timeout:3000})
    await waitFor(() => expect(tools.size).toBe(13),{timeout:3000})
    expect(z.config().jitless).toBe(true)
    expect(document.body).toHaveTextContent('Local persistence is unavailable in this browser')
    expect(screen.queryByRole('button',{name:'Retry local storage'})).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('link',{name:'Discover'}))
    await userEvent.click(screen.getByText('Exploratory catalog search'))
    expect(document.querySelector('#product-search')).toBeInTheDocument()
  })
})
