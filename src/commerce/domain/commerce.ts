export const COMMERCE_PROVIDERS = {
  shopifyGlobalCatalog: 'shopify_global_catalog',
} as const

export type CommerceProviderId =
  (typeof COMMERCE_PROVIDERS)[keyof typeof COMMERCE_PROVIDERS]

export type ProvenanceKind =
  | 'provider_explicit'
  | 'provider_inferred'
  | 'cosource_derived'
  | 'unknown'

export interface Provenance {
  kind: ProvenanceKind
  provider?: CommerceProviderId
  sourcePath?: string
}

export interface Evidenced<T> {
  value: T
  provenance: Provenance
}

export interface ProviderIdentity {
  provider: CommerceProviderId
  id: string
}

/** Exact integer amount in the provider's ISO 4217 minor units. */
export interface Money {
  minorAmount: number
  currency: string
}

export interface ExternalMedia {
  url: string
  altText?: string
  provenance: Provenance
}

export interface MerchantPolicyLink {
  type: string
  url: string
}

export interface Merchant {
  identity?: ProviderIdentity
  name?: string
  domain?: string
  url?: string
  policyLinks: MerchantPolicyLink[]
  provenance: Provenance
}

export interface SelectedOption {
  name: string
  value: string
}

export interface ProductOptionValue {
  value: string
  available?: boolean
  exists?: boolean
}

export interface ProductOption {
  name: string
  values: ProductOptionValue[]
}

export interface ProductAttribute {
  name: string
  value: string
}

export interface CatalogAvailability {
  state: 'available' | 'unavailable' | 'unknown'
  basis: 'catalog_signal'
  provenance: Provenance
}

export interface LookupCorrelation {
  inputId: string
  match: 'exact' | 'featured' | 'unknown'
}

export interface MerchantOffer {
  identity: ProviderIdentity
  title: Evidenced<string>
  description?: Evidenced<string>
  merchant?: Merchant
  productUrl?: string
  handoffUrl?: string
  price: Money
  availability: CatalogAvailability
  selectedOptions: SelectedOption[]
  condition?: Evidenced<string[]>
  nativeCheckoutEligible?: Evidenced<boolean>
  media: ExternalMedia[]
  correlations: LookupCorrelation[]
  provenance: Provenance
}

export type OfferCompleteness =
  | 'featured_only'
  | 'selection_scoped'
  | 'provider_returned_unknown'

export interface ProductCluster {
  identity: ProviderIdentity
  title: Evidenced<string>
  description?: Evidenced<string>
  options?: Evidenced<ProductOption[]>
  attributes?: Evidenced<ProductAttribute[]>
  technicalSpecifications?: Evidenced<string | string[]>
  topFeatures?: Evidenced<string | string[]>
  uniqueSellingPoints?: Evidenced<string[]>
  media: ExternalMedia[]
  offers: MerchantOffer[]
  featuredOfferId?: string
  offerCompleteness: OfferCompleteness
  provenance: Provenance
}

export interface ProviderMessage {
  level: 'info' | 'warning' | 'error' | 'unknown'
  code?: string
  path?: string
  text: string
}

export interface Pagination {
  cursor?: string
  hasMore: boolean
  /** Provider estimate only; never an exact result count. */
  estimatedTotal?: number
}
