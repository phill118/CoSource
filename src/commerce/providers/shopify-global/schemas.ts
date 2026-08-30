import { z } from 'zod'

const boundedText = z.string().max(20_000)
const optionalHttpsUrl = z.string().max(4_096).optional()

const priceSchema = z.object({
  amount: z.number().int().safe(),
  currency: z.string().regex(/^[A-Z]{3}$/),
})

const mediaSchema = z.object({
  type: z.string().optional(),
  url: z.string().max(4_096),
  alt_text: boundedText.optional(),
})

const selectedOptionSchema = z.object({
  name: boundedText,
  label: boundedText,
})

const sellerSchema = z.object({
  id: z.string().optional(),
  name: boundedText.optional(),
  url: optionalHttpsUrl,
  domain: z.string().max(253).optional(),
  links: z
    .array(z.object({ type: z.string().max(100), url: z.string().max(4_096) }))
    .max(20)
    .optional(),
})

const variantSchema = z.object({
  id: z.string().min(1),
  title: boundedText,
  description: z.object({ plain: boundedText.optional() }).optional(),
  url: optionalHttpsUrl,
  checkout_url: optionalHttpsUrl,
  price: priceSchema,
  availability: z.object({ available: z.boolean().optional() }).optional(),
  options: z.array(selectedOptionSchema).max(100).optional(),
  media: z.array(mediaSchema).max(100).optional(),
  seller: sellerSchema.optional(),
  condition: z.array(z.string().max(100)).max(20).optional(),
  eligible: z.object({ native_checkout: z.boolean().optional() }).optional(),
  inputs: z
    .array(z.object({ id: z.string(), match: z.string().optional() }))
    .max(100)
    .optional(),
})

const optionSchema = z.object({
  name: boundedText,
  values: z
    .array(
      z.object({
        label: boundedText,
        available: z.boolean().optional(),
        exists: z.boolean().optional(),
      }),
    )
    .max(100),
})

const attributeSchema = z.object({
  name: boundedText,
  value: boundedText,
})

export const productSchema = z.object({
  id: z.string().min(1),
  title: boundedText,
  description: z.object({ plain: boundedText.optional() }).optional(),
  options: z.array(optionSchema).max(100).optional(),
  metadata: z
    .object({
      attributes: z.array(attributeSchema).max(100).optional(),
      tech_specs: z.union([boundedText, z.array(boundedText).max(100)]).optional(),
      top_features: z.union([boundedText, z.array(boundedText).max(100)]).optional(),
      unique_selling_points: z.array(boundedText).max(100).optional(),
    })
    .optional(),
  media: z.array(mediaSchema).max(100).optional(),
  variants: z.array(variantSchema).max(250),
  selected: z.array(selectedOptionSchema).max(100).optional(),
})

const messageSchema = z.object({
  type: z.string().optional(),
  code: z.string().max(200).optional(),
  path: z.string().max(1_000).optional(),
  content: boundedText,
})

const ucpSchema = z.object({
  version: z.string(),
  status: z.string().optional(),
})

export const searchContentSchema = z.object({
  ucp: ucpSchema,
  products: z.array(productSchema).max(50),
  messages: z.array(messageSchema).max(100).optional(),
  pagination: z
    .object({
      cursor: z.string().max(4_096).optional(),
      has_next_page: z.boolean().optional(),
      total_count: z.number().int().nonnegative().safe().optional(),
    })
    .optional(),
})

export const lookupContentSchema = z.object({
  ucp: ucpSchema,
  products: z.array(productSchema).max(50),
  messages: z.array(messageSchema).max(100).optional(),
})

export const productContentSchema = z.object({
  ucp: ucpSchema,
  product: productSchema,
  messages: z.array(messageSchema).max(100).optional(),
})

export const jsonRpcResponseSchema = z.object({
  jsonrpc: z.literal('2.0'),
  id: z.union([z.string(), z.number(), z.null()]).optional(),
  result: z
    .object({
      structuredContent: z.unknown().optional(),
      isError: z.boolean().optional(),
      content: z
        .array(z.object({ type: z.string().optional(), text: boundedText.optional() }))
        .max(20)
        .optional(),
    })
    .optional(),
  error: z
    .object({ code: z.number().optional(), message: boundedText.optional() })
    .optional(),
})

export type ShopifyProduct = z.infer<typeof productSchema>
export type ShopifyMessage = z.infer<typeof messageSchema>
