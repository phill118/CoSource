import { z } from 'zod'

const countrySchema = z.string().regex(/^[A-Z]{2}$/)
const currencySchema = z.string().regex(/^[A-Z]{3}$/)
const languageSchema = z.string().min(1).max(35)
const cursorSchema = z.string().min(1).max(4_096)

const contextShape = {
  country: countrySchema.optional(),
  language: languageSchema.optional(),
  currency: currencySchema.optional(),
  intent:z.string().trim().min(1).max(1_000).optional(),
}
const attributeSchema=z.object({name:z.enum(['Color','Size','Target gender']),values:z.array(z.string().trim().min(1).max(200)).min(1).max(20)}).strict()

export const searchRequestSchema = z
  .object({
    query: z.string().trim().min(1).max(500),
    ...contextShape,
    limit: z.number().int().min(1).max(50).optional(),
    cursor: cursorSchema.optional(),
    available: z.boolean().optional(),
    shipsTo: countrySchema.optional(),
    maximumPrice: z
      .object({
        minorAmount: z.number().int().safe(),
        currency: currencySchema,
      })
      .strict()
      .optional(),
    condition:z.enum(['new','secondhand']).optional(),
    attributes:z.array(attributeSchema).max(3).optional(),
    view:z.literal('offer').optional(),
  })
  .strict()

const lookupIdSchema = z.discriminatedUnion('type', [
  z
    .object({
      type: z.literal('product'),
      value: z.string().regex(/^gid:\/\/shopify\/p\/[A-Za-z0-9]+$/),
    })
    .strict(),
  z
    .object({
      type: z.literal('variant'),
      value: z.string().regex(/^gid:\/\/shopify\/ProductVariant\/\d+$/),
    })
    .strict(),
])

export const lookupRequestSchema = z
  .object({
    ids: z.array(lookupIdSchema).min(1).max(50),
    ...contextShape,
  })
  .strict()

const selectedOptionSchema = z
  .object({
    name: z.string().min(1).max(200),
    value: z.string().min(1).max(2_000),
  })
  .strict()

export const productRequestSchema = z
  .object({
    productId: z.string().regex(/^gid:\/\/shopify\/p\/[A-Za-z0-9]+$/),
    selectedOptions: z.array(selectedOptionSchema).max(100).optional(),
    preferenceOrder: z.array(z.string().min(1).max(200)).max(100).optional(),
    ...contextShape,
  })
  .strict()
