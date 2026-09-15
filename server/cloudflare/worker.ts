import {
  COSOURCE_UCP_AGENT_PROFILE_JSON,
  COSOURCE_UCP_PROFILE_PATH,
} from '../commerce/agent-profile'
import {
  createCatalogGateway,
  MAX_REQUEST_BODY_BYTES,
  type GatewayRequest,
} from '../commerce/gateway'
import { ShopifyGlobalCatalogProvider } from '../../src/commerce/providers/shopify-global/shopify-global-catalog-provider'
import { canonicalRequestPath, InvalidRequestPathError } from '../http/request-path'
import { SECURITY_HEADERS } from '../http/security-headers'

export interface CloudflareWorkerEnvironment {
  ASSETS: { fetch(request: Request): Promise<Response> }
}

type Gateway = (request: GatewayRequest) => Promise<{
  status: number
  headers: Record<string, string>
  body: string
}>
type GatewayFactory = (profileUrl: string) => Gateway

const defaultGatewayFactory: GatewayFactory = (profileUrl) =>
  createCatalogGateway(new ShopifyGlobalCatalogProvider({ agentProfileUrl: profileUrl }))

class RequestBodyTooLargeError extends Error {}

async function readBoundedRequestBody(request: Request): Promise<string> {
  const declared = request.headers.get('content-length')
  if (declared !== null && /^\d+$/.test(declared)) {
    const declaredBytes = Number(declared)
    if (!Number.isSafeInteger(declaredBytes) || declaredBytes > MAX_REQUEST_BODY_BYTES) {
      await request.body?.cancel().catch(() => undefined)
      throw new RequestBodyTooLargeError()
    }
  }
  if (!request.body) return ''

  const reader = request.body.getReader()
  const chunks: Uint8Array[] = []
  let size = 0
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      size += value.byteLength
      if (size > MAX_REQUEST_BODY_BYTES) {
        await reader.cancel().catch(() => undefined)
        throw new RequestBodyTooLargeError()
      }
      chunks.push(value)
    }
  } finally {
    reader.releaseLock()
  }

  const body = new Uint8Array(size)
  let offset = 0
  for (const chunk of chunks) {
    body.set(chunk, offset)
    offset += chunk.byteLength
  }
  return new TextDecoder().decode(body)
}

function secure(response: Response): Response {
  const headers = new Headers(response.headers)
  for (const [name, value] of Object.entries(SECURITY_HEADERS)) headers.set(name, value)
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers })
}

function json(status: number, payload: unknown, cacheControl = 'no-store', head = false): Response {
  return secure(
    new Response(head ? null : JSON.stringify(payload), {
      status,
      headers: {
        'content-type': 'application/json; charset=utf-8',
        'cache-control': cacheControl,
      },
    }),
  )
}

function methodNotAllowed(): Response {
  return json(405, {
    ok: false,
    error: { code: 'method_not_allowed', message: 'Only GET and HEAD are supported' },
  })
}

export function createCloudflareWorker(gatewayFactory: GatewayFactory = defaultGatewayFactory) {
  return async function fetch(request: Request, environment: CloudflareWorkerEnvironment) {
    try {
      const pathname = canonicalRequestPath(request.url)
      if (pathname === COSOURCE_UCP_PROFILE_PATH) {
        if (request.method !== 'GET' && request.method !== 'HEAD') return methodNotAllowed()
        return secure(
          new Response(request.method === 'HEAD' ? null : COSOURCE_UCP_AGENT_PROFILE_JSON, {
            status: 200,
            headers: {
              'content-type': 'application/json; charset=utf-8',
              'cache-control': 'public, max-age=300',
            },
          }),
        )
      }
      if (pathname === '/health') {
        if (request.method !== 'GET' && request.method !== 'HEAD') return methodNotAllowed()
        return json(200, { ok: true, status: 'healthy' }, 'no-store', request.method === 'HEAD')
      }
      if (pathname === '/api' || pathname.startsWith('/api/')) {
        const url = new URL(request.url)
        if (url.protocol !== 'https:') {
          return json(400, {
            ok: false,
            error: { code: 'invalid_origin', message: 'The public origin must use HTTPS' },
          })
        }
        const gateway = gatewayFactory(new URL(COSOURCE_UCP_PROFILE_PATH, url.origin).href)
        const result = await gateway({
          method: request.method,
          path: pathname,
          contentType: request.headers.get('content-type') ?? undefined,
          body: await readBoundedRequestBody(request),
        })
        return secure(
          new Response(result.body, {
            status: result.status,
            headers: { ...result.headers, 'cache-control': 'no-store' },
          }),
        )
      }
      return secure(await environment.ASSETS.fetch(request))
    } catch (error) {
      if (error instanceof RequestBodyTooLargeError) {
        return json(413, {
          ok: false,
          error: { code: 'request_too_large', message: 'Request body is too large' },
        })
      }
      if (error instanceof InvalidRequestPathError) {
        return json(400, {
          ok: false,
          error: { code: 'invalid_path', message: 'Request path is invalid' },
        })
      }
      return json(500, {
        ok: false,
        error: { code: 'internal_error', message: 'The request could not be completed' },
      })
    }
  }
}

export default { fetch: createCloudflareWorker() }
