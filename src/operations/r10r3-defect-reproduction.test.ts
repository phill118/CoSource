import {describe,expect,it} from 'vitest'
import {activeActualCosts,activeFulfilmentRecords} from './domain/operational-case'

const at='2026-09-12T10:00:00.000Z',evidence={strength:'source_explicit' as const,source:'human'}

describe('R10R3 correction integrity regressions',()=>{
 it('projects only deterministic active leaves through a linear receipt correction chain',()=>{const records=[{id:'receipt-2',lineId:'line',kind:'receipt' as const,quantity:1,externalReference:'receipt-reference',supersedesId:'receipt-1',representedAt:at,recordedAt:at,evidence},{id:'receipt-1',lineId:'line',kind:'receipt' as const,quantity:2,externalReference:'receipt-reference',representedAt:at,recordedAt:at,evidence},{id:'receipt-3',lineId:'line',kind:'receipt' as const,quantity:1,externalReference:'receipt-reference',supersedesId:'receipt-2',representedAt:at,recordedAt:at,evidence}];expect(activeFulfilmentRecords(records).map(item=>[item.id,item.quantity])).toEqual([['receipt-3',1]]);expect(activeFulfilmentRecords([...records].reverse()).map(item=>item.id)).toEqual(['receipt-3'])})
 it('projects only the active settlement correction leaf',()=>{const records=[{id:'cost-old',kind:'charged' as const,amount:{minorAmount:1200,currency:'GBP'},externalReference:'charge-reference',representedAt:at,recordedAt:at,evidence},{id:'cost-new',kind:'charged' as const,amount:{minorAmount:1000,currency:'GBP'},externalReference:'charge-reference',supersedesId:'cost-old',representedAt:at,recordedAt:at,evidence}];expect(activeActualCosts(records)).toEqual([records[1]])})
})
