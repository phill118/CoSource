import { z } from 'zod'
import { COMMERCE_PROVIDERS, type ProviderIdentity } from '../domain/commerce'
import type { CatalogProductResult, CatalogSearchResult } from '../providers/catalog-provider'
import {costComponentSchema,costCoverageSchema} from '../../costing/domain/cost'

const provenance = z.object({ kind: z.enum(['provider_explicit', 'provider_inferred', 'cosource_derived', 'unknown']), provider: z.literal('shopify_global_catalog').optional(), sourcePath: z.string().optional() })
const evidencedString = z.object({ value: z.string(), provenance })
const media = z.object({ url: z.string().url().refine((url) => url.startsWith('https:')), altText: z.string().optional(), provenance })
const selectedOption = z.object({ name: z.string(), value: z.string() })
const offer = z.object({
  identity: z.object({ provider: z.literal('shopify_global_catalog'), id: z.string() }), title: evidencedString,
  merchant: z.object({ name: z.string().optional(), domain: z.string().optional(), url: z.string().url().optional(), provenance }).passthrough().optional(),
  productUrl: z.string().url().optional(), handoffUrl: z.string().url().optional(),
  price: z.object({ minorAmount: z.number().int().safe(), currency: z.string().regex(/^[A-Z]{3}$/) }),
  costComponents:z.array(costComponentSchema).max(50).optional(),oneTimeCostCoverage:costCoverageSchema.optional(),
  availability: z.object({ state: z.enum(['available', 'unavailable', 'unknown']), basis: z.literal('catalog_signal'), provenance }),
  selectedOptions: z.array(selectedOption), media: z.array(media),
  correlations: z.array(z.object({ inputId: z.string(), match: z.enum(['exact', 'featured', 'unknown']) })), provenance,
}).passthrough().superRefine((value,ctx)=>{if(value.costComponents?.some(component=>component.category==='base_price'))ctx.addIssue({code:'custom',message:'Offer cost components duplicate listing price'})})
const option = z.object({ name: z.string(), values: z.array(z.object({ value: z.string(), available: z.boolean().optional(), exists: z.boolean().optional() })) })
const cluster = z.object({
  identity: z.object({ provider: z.literal('shopify_global_catalog'), id: z.string() }), title: evidencedString, description: evidencedString.optional(),
  options: z.object({ value: z.array(option), provenance }).optional(), media: z.array(media), offers: z.array(offer), featuredOfferId: z.string().optional(),
  offerCompleteness: z.enum(['featured_only', 'selection_scoped', 'provider_returned_unknown']), provenance,
}).passthrough()
const message = z.object({ level: z.enum(['info', 'warning', 'error', 'unknown']), code: z.string().optional(), path: z.string().optional(), text: z.string() })
const searchResult = z.object({ products: z.array(cluster), messages: z.array(message), pagination: z.object({ cursor: z.string().optional(), hasMore: z.boolean(), estimatedTotal: z.number().optional() }) })
const productResult = z.object({ product: cluster, selectedOptions: z.array(selectedOption), messages: z.array(message) })
const errorEnvelope = z.object({ ok: z.literal(false), error: z.object({ code: z.string(), message: z.string(), retryAfterSeconds: z.number().optional() }) })

export class CatalogClientError extends Error {
  readonly code: string
  readonly retryAfterSeconds?: number

  constructor(code: string, message: string, retryAfterSeconds?: number) {
    super(message)
    this.code = code
    this.retryAfterSeconds = retryAfterSeconds
  }
}

async function post<T>(path: string, body: unknown, schema: z.ZodType<T>): Promise<T> {
  let response: Response
  try { response = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }) }
  catch { throw new CatalogClientError('network_error', 'Could not reach the live catalog') }
  let json: unknown
  try { json = await response.json() } catch { throw new CatalogClientError('malformed_response', 'The catalog returned an unreadable response') }
  if (!response.ok) {
    const parsed = errorEnvelope.safeParse(json)
    throw parsed.success ? new CatalogClientError(parsed.data.error.code, parsed.data.error.message, parsed.data.error.retryAfterSeconds) : new CatalogClientError('malformed_response', 'The catalog returned an invalid error response')
  }
  const parsed = z.object({ ok: z.literal(true), data: schema }).safeParse(json)
  if (!parsed.success) throw new CatalogClientError('malformed_response', 'The catalog returned malformed product data')
  return parsed.data.data
}

export interface SearchRequest { query:string;country:string;currency:string;intent?:string;limit?:number;cursor?:string;available?:boolean;shipsTo?:string;maximumPrice?:{minorAmount:number;currency:string};condition?:'new'|'secondhand';attributes?:Array<{name:'Color'|'Size'|'Target gender';values:string[]}>;view?:'offer' }
export interface ProductRequest { product:ProviderIdentity;country:string;currency:string;selectedOptions?:Array<{name:string;value:string}> }
export const catalogClient = {
  search: (input: SearchRequest) => post<CatalogSearchResult>('/api/catalog/search', input, searchResult as z.ZodType<CatalogSearchResult>),
  product: (input: ProductRequest) => {
    if(input.product.provider!==COMMERCE_PROVIDERS.shopifyGlobalCatalog)throw new CatalogClientError('unsupported_provider','The selected commerce provider is not supported by this catalog gateway')
    return post<CatalogProductResult>('/api/catalog/product',{productId:input.product.id,selectedOptions:input.selectedOptions,country:input.country,currency:input.currency},productResult as z.ZodType<CatalogProductResult>)
  },
}
