import { describe, expect, it, vi } from 'vitest'
import { COSOURCE_UCP_AGENT_PROFILE } from '../commerce/agent-profile'
import { MAX_REQUEST_BODY_BYTES } from '../commerce/gateway'
import { createCloudflareWorker, type CloudflareWorkerEnvironment } from './worker'

function environment(): CloudflareWorkerEnvironment {
  return {
    ASSETS: {
      fetch: vi.fn(async (request: Request) => {
        const pathname = new URL(request.url).pathname
        const type = pathname.endsWith('.js')
          ? 'text/javascript; charset=utf-8'
          : pathname.endsWith('.css')
            ? 'text/css; charset=utf-8'
            : 'text/html; charset=utf-8'
        return new Response(type.startsWith('text/html') ? '<main>CoSource shell</main>' : 'asset', {
          status: 200,
          headers: { 'content-type': type },
        })
      }),
    },
  }
}

describe('Cloudflare Worker deployment adapter', () => {
  it('serves health and the exact catalog-only profile with security headers', async () => {
    const fetch = createCloudflareWorker()
    const env = environment()
    const health = await fetch(new Request('https://cosource.workers.dev/health'), env)
    expect(health.status).toBe(200)
    expect(await health.json()).toEqual({ ok: true, status: 'healthy' })

    const profile = await fetch(new Request('https://cosource.workers.dev/.well-known/ucp'), env)
    expect(profile.status).toBe(200)
    expect(profile.headers.get('content-type')).toBe('application/json; charset=utf-8')
    expect(profile.headers.get('cache-control')).toBe('public, max-age=300')
    expect(profile.headers.get('content-security-policy')).toContain("script-src 'self'")
    expect(await profile.json()).toEqual(COSOURCE_UCP_AGENT_PROFILE)
    expect(Object.keys(COSOURCE_UCP_AGENT_PROFILE.ucp.capabilities)).toHaveLength(3)
    expect(COSOURCE_UCP_AGENT_PROFILE.ucp.payment_handlers).toEqual({})

    const head = await fetch(
      new Request('https://cosource.workers.dev/.well-known/ucp', { method: 'HEAD' }),
      env,
    )
    expect(head.status).toBe(200)
    expect(head.headers.get('content-type')).toBe('application/json; charset=utf-8')
    expect(await head.text()).toBe('')
  })

  it('keeps reserved methods and encoded paths out of SPA fallback', async () => {
    const env = environment()
    const fetch = createCloudflareWorker()
    const method = await fetch(
      new Request('https://cosource.workers.dev/.well-known/ucp', { method: 'POST' }),
      env,
    )
    expect(method.status).toBe(405)
    expect(await method.text()).not.toContain('CoSource shell')

    const encoded = await fetch(new Request('https://cosource.workers.dev/api%2Fcatalog'), env)
    expect(encoded.status).toBe(400)
    expect(await encoded.text()).toContain('invalid_path')
    expect(env.ASSETS.fetch).not.toHaveBeenCalled()
  })

  it('delegates static assets and SPA routes while preserving security headers', async () => {
    const env = environment()
    const fetch = createCloudflareWorker()
    for (const path of ['/', '/assets/application-12345678.js', '/assets/application-12345678.css', '/workspace/goals']) {
      const response = await fetch(new Request(`https://cosource.workers.dev${path}`), env)
      expect(response.status).toBe(200)
      expect(response.headers.get('content-security-policy')).toContain("default-src 'self'")
    }
    expect(env.ASSETS.fetch).toHaveBeenCalledTimes(4)
  })

  it('reuses the canonical gateway with a profile derived from the HTTPS request origin', async () => {
    const gateway = vi.fn(async () => ({
      status: 404,
      headers: { 'content-type': 'application/json; charset=utf-8' },
      body: JSON.stringify({ ok: false, error: { code: 'not_found', message: 'Route not found' } }),
    }))
    const factory = vi.fn(() => gateway)
    const response = await createCloudflareWorker(factory)(
      new Request('https://cosource.workers.dev/api/not-a-route'),
      environment(),
    )
    expect(factory).toHaveBeenCalledWith('https://cosource.workers.dev/.well-known/ucp')
    expect(gateway).toHaveBeenCalledWith(expect.objectContaining({ path: '/api/not-a-route' }))
    expect(response.status).toBe(404)
    expect(response.headers.get('content-type')).toContain('application/json')
  })

  it('rejects an oversized declared body before gateway or asset invocation', async () => {
    const gateway = vi.fn()
    const env = environment()
    const response = await createCloudflareWorker(() => gateway)(
      new Request('https://cosource.workers.dev/api/catalog/search', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'content-length': String(MAX_REQUEST_BODY_BYTES + 1),
        },
        body: '{}',
      }),
      env,
    )
    expect(response.status).toBe(413)
    expect(response.headers.get('content-type')).toBe('application/json; charset=utf-8')
    expect(response.headers.get('cache-control')).toBe('no-store')
    expect(response.headers.get('content-security-policy')).toContain("default-src 'self'")
    expect(await response.json()).toEqual({
      ok: false,
      error: { code: 'request_too_large', message: 'Request body is too large' },
    })
    expect(gateway).not.toHaveBeenCalled()
    expect(env.ASSETS.fetch).not.toHaveBeenCalled()
  })

  it('enforces streamed bytes when content length is absent or false and cancels overflow', async () => {
    const gateway = vi.fn()
    const env = environment()
    const cancelled = vi.fn()
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array(MAX_REQUEST_BODY_BYTES))
        controller.enqueue(new Uint8Array([1]))
      },
      cancel: cancelled,
    })
    const response = await createCloudflareWorker(() => gateway)(
      new Request('https://cosource.workers.dev/api/catalog/search', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'content-length': '1' },
        body: stream,
        duplex: 'half',
      } as RequestInit & { duplex: 'half' }),
      env,
    )
    expect(response.status).toBe(413)
    expect(cancelled).toHaveBeenCalledOnce()
    expect(gateway).not.toHaveBeenCalled()
    expect(env.ASSETS.fetch).not.toHaveBeenCalled()
  })

  it('passes an exact-limit Unicode-safe body to the canonical gateway', async () => {
    const body = `${'a'.repeat(MAX_REQUEST_BODY_BYTES - 4)}🌍`
    expect(new TextEncoder().encode(body)).toHaveLength(MAX_REQUEST_BODY_BYTES)
    const gateway = vi.fn(async () => ({
      status: 400,
      headers: { 'content-type': 'application/json; charset=utf-8' },
      body: JSON.stringify({ ok: false, error: { code: 'invalid_json', message: 'test' } }),
    }))
    const response = await createCloudflareWorker(() => gateway)(
      new Request('https://cosource.workers.dev/api/catalog/search', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body,
      }),
      environment(),
    )
    expect(response.status).toBe(400)
    expect(gateway).toHaveBeenCalledWith(expect.objectContaining({ body }))
  })
})
