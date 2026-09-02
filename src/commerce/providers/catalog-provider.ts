import type {
  Money,
  Pagination,
  ProductCluster,
  ProviderMessage,
  SelectedOption,
} from '../domain/commerce'

export interface CatalogContext {
  country?: string
  language?: string
  currency?: string
  intent?: string
}
export type CatalogProductCondition='new'|'secondhand'
export type CatalogTaxonomyAttributeName='Color'|'Size'|'Target gender'

export interface CatalogSearchInput {
  query: string
  context?: CatalogContext
  pageSize?: number
  cursor?: string
  filters?: {
    available?: boolean
    shipsToCountry?: string
    maximumPrice?: Money
    condition?: CatalogProductCondition
    attributes?: Array<{name:CatalogTaxonomyAttributeName;values:string[]}>
  }
  view?: 'offer'
}

export interface CatalogSearchResult {
  products: ProductCluster[]
  messages: ProviderMessage[]
  pagination: Pagination
}

export type CatalogLookupId =
  | { type: 'product'; value: string }
  | { type: 'variant'; value: string }

export interface CatalogLookupResult {
  products: ProductCluster[]
  missingIds: string[]
  messages: ProviderMessage[]
}

export interface CatalogProductInput {
  productId: string
  selectedOptions?: SelectedOption[]
  preferenceOrder?: string[]
  context?: CatalogContext
}

export interface CatalogProductResult {
  product: ProductCluster
  selectedOptions: SelectedOption[]
  messages: ProviderMessage[]
}

export interface CatalogProvider {
  search(input: CatalogSearchInput): Promise<CatalogSearchResult>
  lookup(ids: CatalogLookupId[], context?: CatalogContext): Promise<CatalogLookupResult>
  getProduct(input: CatalogProductInput): Promise<CatalogProductResult>
}
