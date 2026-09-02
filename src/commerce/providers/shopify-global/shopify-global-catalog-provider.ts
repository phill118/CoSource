import type {
  CatalogContext,
  CatalogLookupId,
  CatalogLookupResult,
  CatalogProductInput,
  CatalogProductResult,
  CatalogProvider,
  CatalogSearchInput,
  CatalogSearchResult,
} from '../catalog-provider'
import { CommerceProviderError } from '../errors'
import { mapMessages, mapProduct, safeHttpsUrl } from './mapping'
import {
  jsonRpcResponseSchema,
  lookupContentSchema,
  productContentSchema,
  searchContentSchema,
} from './schemas'

export const SHOPIFY_GLOBAL_CATALOG_ENDPOINT =
  'https://catalog.shopify.com/api/ucp/mcp'

const MAX_QUERY_LENGTH = 500
const MAX_SEARCH_RESULTS = 50
const MAX_LOOKUP_IDS = 50
const DEFAULT_TIMEOUT_MS = 10_000

type FetchImplementation = typeof fetch

export interface ShopifyGlobalCatalogConfig {
  /** Controlled, hosted HTTPS UCP profile selected by the application owner. */
  agentProfileUrl: string
  timeoutMs?: number
  fetchImplementation?: FetchImplementation
}

interface JsonRpcResult {
  structuredContent?: unknown
}

function validateCountry(value: string | undefined, label: string): void {
  if (value !== undefined && !/^[A-Z]{2}$/.test(value)) {
    throw new CommerceProviderError('invalid_request', `${label} must be an ISO alpha-2 country code`)
  }
}

function validateContext(context: CatalogContext | undefined): void {
  validateCountry(context?.country, 'Context country')
  if (context?.currency !== undefined && !/^[A-Z]{3}$/.test(context.currency)) {
    throw new CommerceProviderError('invalid_request', 'Context currency must be an uppercase ISO 4217 code')
  }
  if (context?.intent !== undefined && (context.intent.length < 1 || context.intent.length > 1_000)) throw new CommerceProviderError('invalid_request', 'Context intent must contain 1 to 1000 characters')
}

function parseRetryAfter(value: string | null): number | undefined {
  if (!value) return undefined
  const seconds = Number(value)
  return Number.isFinite(seconds) && seconds >= 0 ? seconds : undefined
}

export class ShopifyGlobalCatalogProvider implements CatalogProvider {
  readonly #agentProfileUrl: string
  readonly #timeoutMs: number
  readonly #fetch: FetchImplementation
  #nextRequestId = 1

  constructor(config: ShopifyGlobalCatalogConfig) {
    if (!safeHttpsUrl(config.agentProfileUrl)) {
      throw new CommerceProviderError('invalid_request', 'Agent profile must be a valid HTTPS URL')
    }
    if (
      config.timeoutMs !== undefined &&
      (!Number.isSafeInteger(config.timeoutMs) || config.timeoutMs < 100 || config.timeoutMs > 60_000)
    ) {
      throw new CommerceProviderError('invalid_request', 'Timeout must be between 100 and 60000 milliseconds')
    }

    this.#agentProfileUrl = config.agentProfileUrl
    this.#timeoutMs = config.timeoutMs ?? DEFAULT_TIMEOUT_MS
    this.#fetch = config.fetchImplementation ?? fetch
  }

  async search(input: CatalogSearchInput): Promise<CatalogSearchResult> {
    const query = input.query.trim()
    if (query.length === 0 || query.length > MAX_QUERY_LENGTH) {
      throw new CommerceProviderError('invalid_request', `Query must contain 1 to ${MAX_QUERY_LENGTH} characters`)
    }
    validateContext(input.context)
    validateCountry(input.filters?.shipsToCountry, 'Ships-to country')

    const pageSize = input.pageSize ?? 10
    if (!Number.isSafeInteger(pageSize) || pageSize < 1 || pageSize > MAX_SEARCH_RESULTS) {
      throw new CommerceProviderError('invalid_request', 'Page size must be between 1 and 50')
    }
    if (
      input.filters?.maximumPrice &&
      input.context?.currency !== input.filters.maximumPrice.currency
    ) {
      throw new CommerceProviderError(
        'invalid_request',
        'Maximum price currency must match the explicit request context currency',
      )
    }

    const filters: Record<string, unknown> = {}
    if (input.filters?.available !== undefined) filters.available = input.filters.available
    if (input.filters?.shipsToCountry) {
      filters.ships_to = { country: input.filters.shipsToCountry }
    }
    if (input.filters?.maximumPrice) {
      filters.price = { max: input.filters.maximumPrice.minorAmount }
    }
    if (input.filters?.condition) filters.condition = [input.filters.condition]
    if (input.filters?.attributes?.length) filters.attributes = input.filters.attributes

    const structuredContent = await this.#call('search_catalog', {
      catalog: {
        query,
        context: mapContext(input.context),
        filters,
        view: input.view,
        pagination: { limit: pageSize, cursor: input.cursor },
      },
    })
    const parsed = searchContentSchema.safeParse(structuredContent)
    if (!parsed.success) {
      throw new CommerceProviderError('invalid_response', 'Shopify returned an invalid search response')
    }

    return {
      products: parsed.data.products.map((product) => mapProduct(product, 'featured_only')),
      messages: mapMessages(parsed.data.messages),
      pagination: {
        cursor: parsed.data.pagination?.cursor,
        hasMore: parsed.data.pagination?.has_next_page ?? false,
        estimatedTotal: parsed.data.pagination?.total_count,
      },
    }
  }

  async lookup(
    ids: CatalogLookupId[],
    context?: CatalogContext,
  ): Promise<CatalogLookupResult> {
    if (ids.length < 1 || ids.length > MAX_LOOKUP_IDS) {
      throw new CommerceProviderError('invalid_request', 'Lookup requires between 1 and 50 identifiers')
    }
    validateContext(context)
    for (const id of ids) {
      const pattern =
        id.type === 'product'
          ? /^gid:\/\/shopify\/p\/[A-Za-z0-9]+$/
          : /^gid:\/\/shopify\/ProductVariant\/\d+$/
      if (!pattern.test(id.value)) {
        throw new CommerceProviderError('invalid_request', `Invalid Shopify ${id.type} identifier`)
      }
    }

    const structuredContent = await this.#call('lookup_catalog', {
      catalog: { ids: ids.map((id) => id.value), context: mapContext(context) },
    })
    const parsed = lookupContentSchema.safeParse(structuredContent)
    if (!parsed.success) {
      throw new CommerceProviderError('invalid_response', 'Shopify returned an invalid lookup response')
    }
    const messages = mapMessages(parsed.data.messages)

    return {
      products: parsed.data.products.map((product) =>
        mapProduct(product, 'provider_returned_unknown'),
      ),
      missingIds: messages
        .filter((message) => message.code === 'not_found')
        .map((message) => message.text),
      messages,
    }
  }

  async getProduct(input: CatalogProductInput): Promise<CatalogProductResult> {
    if (!/^gid:\/\/shopify\/p\/[A-Za-z0-9]+$/.test(input.productId)) {
      throw new CommerceProviderError('invalid_request', 'Invalid Shopify product identifier')
    }
    validateContext(input.context)
    if ((input.selectedOptions?.length ?? 0) > 100) {
      throw new CommerceProviderError('invalid_request', 'Too many selected options')
    }

    const structuredContent = await this.#call('get_product', {
      catalog: {
        id: input.productId,
        selected: input.selectedOptions?.map((option) => ({
          name: option.name,
          label: option.value,
        })),
        preferences: input.preferenceOrder,
        context: mapContext(input.context),
      },
    })
    const parsed = productContentSchema.safeParse(structuredContent)
    if (!parsed.success) {
      throw new CommerceProviderError('invalid_response', 'Shopify returned an invalid product response')
    }

    return {
      product: mapProduct(parsed.data.product, 'selection_scoped'),
      selectedOptions: (parsed.data.product.selected ?? []).map((option) => ({
        name: option.name,
        value: option.label,
      })),
      messages: mapMessages(parsed.data.messages),
    }
  }

  async #call(toolName: string, payload: Record<string, unknown>): Promise<unknown> {
    const controller = new AbortController()
    const timeout = globalThis.setTimeout(() => controller.abort(), this.#timeoutMs)
    let response: Response

    try {
      response = await this.#fetch(SHOPIFY_GLOBAL_CATALOG_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'tools/call',
          id: this.#nextRequestId++,
          params: {
            name: toolName,
            arguments: {
              meta: { 'ucp-agent': { profile: this.#agentProfileUrl } },
              ...payload,
            },
          },
        }),
        signal: controller.signal,
      })
    } catch (error) {
      throw new CommerceProviderError('transport', 'Shopify catalog request failed', {
        cause: error,
      })
    } finally {
      globalThis.clearTimeout(timeout)
    }

    if (response.status === 429) {
      throw new CommerceProviderError('throttled', 'Shopify catalog request was throttled', {
        status: 429,
        retryAfterSeconds: parseRetryAfter(response.headers.get('Retry-After')),
      })
    }
    if (!response.ok) {
      const kind = response.status >= 400 && response.status < 500 ? 'invalid_request' : 'transport'
      throw new CommerceProviderError(kind, 'Shopify catalog request was not successful', {
        status: response.status,
      })
    }

    let raw: unknown
    try {
      raw = await response.json()
    } catch (error) {
      throw new CommerceProviderError('invalid_response', 'Shopify returned non-JSON content', {
        cause: error,
      })
    }
    const envelope = jsonRpcResponseSchema.safeParse(raw)
    if (!envelope.success) {
      throw new CommerceProviderError('invalid_response', 'Shopify returned an invalid JSON-RPC envelope')
    }
    if (envelope.data.error || envelope.data.result?.isError) {
      throw new CommerceProviderError('provider_error', 'Shopify catalog tool reported an error')
    }
    const result = envelope.data.result as JsonRpcResult | undefined
    if (result?.structuredContent === undefined) {
      throw new CommerceProviderError('invalid_response', 'Shopify response omitted structured content')
    }
    return result.structuredContent
  }
}

function mapContext(context: CatalogContext | undefined): Record<string, string> | undefined {
  if (!context) return undefined
  const mapped: Record<string, string> = {}
  if (context.country) mapped.address_country = context.country
  if (context.language) mapped.language = context.language
  if (context.currency) mapped.currency = context.currency
  if (context.intent) mapped.intent = context.intent
  return mapped
}
