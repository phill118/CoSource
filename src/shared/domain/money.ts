import {z} from 'zod'

export const moneySchema=z.object({minorAmount:z.number().int().safe().min(0),currency:z.string().regex(/^[A-Z]{3}$/)}).strict()
export type Money=z.infer<typeof moneySchema>

export function createMoney(minorAmount:number,currency:string):Money{if(!Number.isSafeInteger(minorAmount))throw new TypeError('Money minor amount must be a safe integer');if(!/^[A-Z]{3}$/.test(currency))throw new TypeError('Money currency must be an uppercase ISO 4217 code');return moneySchema.parse({minorAmount,currency})}
export function assertSameCurrency(left:Money,right:Money):void{if(left.currency!==right.currency)throw new TypeError('Cross-currency arithmetic requires an explicit FX source')}
