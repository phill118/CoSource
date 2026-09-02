import type { CatalogProvider } from '../../src/commerce/providers/catalog-provider'
import { CommerceProviderError } from '../../src/commerce/providers/errors'
import {
  lookupRequestSchema,
  productRequestSchema,
  searchRequestSchema,
} from './contracts'

export const MAX_REQUEST_BODY_BYTES = 32 * 1024

export interface GatewayRequest {
  method: string
  path: string
  contentType?: string
  body: string
}

export interface GatewayResponse {
  status: number
  headers: Record<string, string>
  body: string
}

interface ErrorResponse {
  ok: false
  error: { code: string; message: string; retryAfterSeconds?: number }
}

const jsonHeaders = { 'content-type': 'application/json; charset=utf-8' }

function response(
  status: number,
  payload: unknown,
  headers: Record<string, string> = jsonHeaders,
): GatewayResponse {
  return { status, headers, body: JSON.stringify(payload) }
}

function errorResponse(
  status: number,
  code: string,
  message: string,
  options: { retryAfterSeconds?: number } = {},
): GatewayResponse {
  const payload: ErrorResponse = {
    ok: false,
    error: { code, message, retryAfterSeconds: options.retryAfterSeconds },
  }
  const headers: Record<string, string> = { ...jsonHeaders }
  if (options.retryAfterSeconds !== undefined) {
    headers['retry-after'] = String(options.retryAfterSeconds)
  }
  return response(status, payload, headers)
}

function mapProviderError(error: unknown): GatewayResponse {
  if (!(error instanceof CommerceProviderError)) {
    return errorResponse(500, 'internal_error', 'The request could not be completed')
  }

  switch (error.kind) {
    case 'invalid_request':
      return errorResponse(400, 'invalid_request', 'The catalog request was invalid')
    case 'throttled':
      return errorResponse(429, 'provider_throttled', 'The catalog is temporarily busy', {
        retryAfterSeconds: error.retryAfterSeconds,
      })
    case 'transport':
      return errorResponse(502, 'provider_unavailable', 'The catalog is temporarily unavailable')
    case 'invalid_response':
      return errorResponse(502, 'invalid_provider_response', 'The catalog returned an invalid response')
    case 'provider_error':
      return errorResponse(502, 'provider_error', 'The catalog could not complete the request')
  }
}

function contextFrom(input: {
  country?: string
  language?: string
  currency?: string
  intent?:string
}) {
  if (!input.country && !input.language && !input.currency && !input.intent) return undefined
  return {
    country: input.country,
    language: input.language,
    currency: input.currency,
    intent:input.intent,
  }
}

export function createCatalogGateway(provider: CatalogProvider) {
  return async function handle(request: GatewayRequest): Promise<GatewayResponse> {
    if (request.method !== 'POST') {
      return errorResponse(405, 'method_not_allowed', 'Only POST is supported')
    }
    if (!request.contentType?.toLowerCase().startsWith('application/json')) {
      return errorResponse(415, 'unsupported_media_type', 'Content-Type must be application/json')
    }
    if (new TextEncoder().encode(request.body).byteLength > MAX_REQUEST_BODY_BYTES) {
      return errorResponse(413, 'request_too_large', 'Request body is too large')
    }

    let raw: unknown
    try {
      raw = JSON.parse(request.body)
    } catch {
      return errorResponse(400, 'invalid_json', 'Request body must be valid JSON')
    }

    try {
      switch (request.path) {
        case '/api/catalog/search': {
          const parsed = searchRequestSchema.safeParse(raw)
          if (!parsed.success) {
            return errorResponse(400, 'invalid_request', 'Search request is invalid')
          }
          const input = parsed.data
          const data = await provider.search({
            query: input.query,
            context: contextFrom(input),
            pageSize: input.limit,
            cursor: input.cursor,
            filters: {
              available: input.available,
              shipsToCountry: input.shipsTo,
              maximumPrice: input.maximumPrice,
              condition:input.condition,
              attributes:input.attributes,
            },
            view:input.view,
          })
          return response(200, { ok: true, data })
        }
        case '/api/catalog/lookup': {
          const parsed = lookupRequestSchema.safeParse(raw)
          if (!parsed.success) {
            return errorResponse(400, 'invalid_request', 'Lookup request is invalid')
          }
          const data = await provider.lookup(parsed.data.ids, contextFrom(parsed.data))
          return response(200, { ok: true, data })
        }
        case '/api/catalog/product': {
          const parsed = productRequestSchema.safeParse(raw)
          if (!parsed.success) {
            return errorResponse(400, 'invalid_request', 'Product request is invalid')
          }
          const data = await provider.getProduct({
            productId: parsed.data.productId,
            selectedOptions: parsed.data.selectedOptions,
            preferenceOrder: parsed.data.preferenceOrder,
            context: contextFrom(parsed.data),
          })
          return response(200, { ok: true, data })
        }
        default:
          return errorResponse(404, 'not_found', 'Route not found')
      }
    } catch (error) {
      return mapProviderError(error)
    }
  }
}
