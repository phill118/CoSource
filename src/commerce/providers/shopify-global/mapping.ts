import {
  COMMERCE_PROVIDERS,
  type Evidenced,
  type ExternalMedia,
  type MerchantOffer,
  type ProductCluster,
  type ProviderMessage,
  type Provenance,
} from '../../domain/commerce'
import { createMoney } from '../../domain/money'
import type { ShopifyMessage, ShopifyProduct } from './schemas'

const provider = COMMERCE_PROVIDERS.shopifyGlobalCatalog

function provenance(
  kind: Provenance['kind'],
  sourcePath?: string,
): Provenance {
  return { kind, provider, sourcePath }
}

function evidenced<T>(
  value: T,
  kind: Provenance['kind'],
  sourcePath: string,
): Evidenced<T> {
  return { value, provenance: provenance(kind, sourcePath) }
}

export function safeHttpsUrl(value: string | undefined): string | undefined {
  if (!value) return undefined

  try {
    const url = new URL(value)
    return url.protocol === 'https:' ? url.toString() : undefined
  } catch {
    return undefined
  }
}

function mapMedia(
  media: ShopifyProduct['media'] | NonNullable<ShopifyProduct['variants'][number]['media']>,
  path: string,
): ExternalMedia[] {
  return (media ?? []).flatMap((item, index) => {
    const url = safeHttpsUrl(item.url)
    return url
      ? [{ url, altText: item.alt_text, provenance: provenance('provider_explicit', `${path}[${index}]`) }]
      : []
  })
}

function mapOffer(
  variant: ShopifyProduct['variants'][number],
  index: number,
): MerchantOffer {
  const base = `variants[${index}]`
  const sellerUrl = safeHttpsUrl(variant.seller?.url)
  const policyLinks = (variant.seller?.links ?? []).flatMap((link) => {
    const url = safeHttpsUrl(link.url)
    return url ? [{ type: link.type, url }] : []
  })

  return {
    identity: { provider, id: variant.id },
    title: evidenced(variant.title, 'provider_explicit', `${base}.title`),
    description: variant.description?.plain
      ? evidenced(variant.description.plain, 'unknown', `${base}.description.plain`)
      : undefined,
    merchant: variant.seller
      ? {
          identity: variant.seller.id
            ? { provider, id: variant.seller.id }
            : undefined,
          name: variant.seller.name,
          domain: variant.seller.domain,
          url: sellerUrl,
          policyLinks,
          provenance: provenance('provider_explicit', `${base}.seller`),
        }
      : undefined,
    productUrl: safeHttpsUrl(variant.url),
    handoffUrl: safeHttpsUrl(variant.checkout_url),
    price: createMoney(variant.price.amount, variant.price.currency),
    availability: {
      state:
        variant.availability?.available === true
          ? 'available'
          : variant.availability?.available === false
            ? 'unavailable'
            : 'unknown',
      basis: 'catalog_signal',
      provenance: provenance('provider_explicit', `${base}.availability`),
    },
    selectedOptions: (variant.options ?? []).map((option) => ({
      name: option.name,
      value: option.label,
    })),
    condition: variant.condition
      ? evidenced(variant.condition, 'provider_inferred', `${base}.condition`)
      : undefined,
    nativeCheckoutEligible:
      variant.eligible?.native_checkout === undefined
        ? undefined
        : evidenced(
            variant.eligible.native_checkout,
            'provider_explicit',
            `${base}.eligible.native_checkout`,
          ),
    media: mapMedia(variant.media, `${base}.media`),
    correlations: (variant.inputs ?? []).map((input) => ({
      inputId: input.id,
      match:
        input.match === 'exact' || input.match === 'featured'
          ? input.match
          : 'unknown',
    })),
    provenance: provenance('provider_explicit', base),
  }
}

export function mapProduct(
  product: ShopifyProduct,
  offerCompleteness: ProductCluster['offerCompleteness'],
): ProductCluster {
  const offers = product.variants.map(mapOffer)
  const featuredOfferIds = offers
    .filter((offer) =>
      offer.correlations.some((correlation) => correlation.match === 'featured'),
    )
    .map((offer) => offer.identity.id)
  const featuredOfferId =
    featuredOfferIds.length === 1 ? featuredOfferIds[0] : undefined

  return {
    identity: { provider, id: product.id },
    title: evidenced(product.title, 'provider_explicit', 'title'),
    description: product.description?.plain
      ? evidenced(product.description.plain, 'provider_inferred', 'description.plain')
      : undefined,
    options: product.options
      ? evidenced(
          product.options.map((option) => ({
            name: option.name,
            values: option.values.map((value) => ({
              value: value.label,
              available: value.available,
              exists: value.exists,
            })),
          })),
          'provider_inferred',
          'options',
        )
      : undefined,
    attributes: product.metadata?.attributes
      ? evidenced(
          product.metadata.attributes.map((attribute) => ({
            name: attribute.name,
            value: attribute.value,
          })),
          'provider_inferred',
          'metadata.attributes',
        )
      : undefined,
    technicalSpecifications: product.metadata?.tech_specs
      ? evidenced(product.metadata.tech_specs, 'provider_inferred', 'metadata.tech_specs')
      : undefined,
    topFeatures: product.metadata?.top_features
      ? evidenced(product.metadata.top_features, 'provider_inferred', 'metadata.top_features')
      : undefined,
    uniqueSellingPoints: product.metadata?.unique_selling_points
      ? evidenced(
          product.metadata.unique_selling_points,
          'provider_inferred',
          'metadata.unique_selling_points',
        )
      : undefined,
    media: mapMedia(product.media, 'media'),
    offers,
    featuredOfferId,
    offerCompleteness,
    provenance: provenance('provider_explicit'),
  }
}

export function mapMessages(messages: ShopifyMessage[] = []): ProviderMessage[] {
  return messages.map((message) => ({
    level:
      message.type === 'info' ||
      message.type === 'warning' ||
      message.type === 'error'
        ? message.type
        : 'unknown',
    code: message.code,
    path: message.path,
    text: message.content,
  }))
}
