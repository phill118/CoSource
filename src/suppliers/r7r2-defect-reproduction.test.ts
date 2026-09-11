import {describe,expect,it} from 'vitest'
import {addQuotation,addReliability,assessSupplier,createSupplier,type SupplierRecord} from './domain/supplier-intelligence'

const observedAt='2026-09-01T00:00:00.000Z'
const now='2026-09-02T00:00:00.000Z'
const requirement={id:'goal',revision:1}
const subject={kind:'offer' as const,source:'source-a',externalId:'offer-a'}
const explicit={strength:'source_explicit' as const,source:'supplier_record'}

function addEvidence(supplier:SupplierRecord,operation:(value:SupplierRecord)=>ReturnType<typeof addQuotation>|ReturnType<typeof addReliability>){
 const result=operation(supplier)
 expect(result.ok).toBe(true)
 return result.ok?result.value:supplier
}

function supplierWithReliability(entries:Array<{id:string;outcome:'positive'|'negative'|'unknown';strength:'source_explicit'|'source_inferred'|'unknown'}>){
 let supplier=createSupplier({id:'supplier',name:'Supplier'},observedAt)
 supplier=addEvidence(supplier,value=>addQuotation(value,{id:'quote',supplierId:value.id,requirementId:requirement.id,requirementRevision:requirement.revision,subject,status:'active',observedAt,components:[],coverage:{status:'complete',evidence:explicit},evidence:explicit},now))
 for(const entry of entries)supplier=addEvidence(supplier,value=>addReliability(value,{id:entry.id,supplierId:value.id,category:'delivery_outcome',outcome:entry.outcome,observedAt,summary:entry.id,evidence:{strength:entry.strength,source:'supplier_record'}},now))
 return supplier
}

describe('R7R2 supplier verification precedence reproduction',()=>{
 it.each([
  [[{id:'positive',outcome:'positive',strength:'source_explicit'},{id:'negative-report',outcome:'negative',strength:'source_inferred'}]],
  [[{id:'positive',outcome:'positive',strength:'source_explicit'},{id:'unknown-outcome',outcome:'unknown',strength:'source_explicit'}]],
  [[{id:'positive',outcome:'positive',strength:'source_explicit'},{id:'unknown-strength',outcome:'positive',strength:'unknown'}]],
 ] as const)('keeps applicable mixed-strength or unknown reliability verification-bound regardless of order',(entries)=>{
  for(const ordered of [entries,[...entries].reverse()]){
   const result=assessSupplier(supplierWithReliability([...ordered]),requirement,now,subject)
   expect(result).toMatchObject({quotationState:'current_complete',reliability:'verification_required',readiness:'verification_required'})
   expect(result.reasons).toContain('Reliability evidence requires verification.')
  }
 })

 it('preserves known-negative and known-conflict precedence',()=>{
  expect(assessSupplier(supplierWithReliability([{id:'negative',outcome:'negative',strength:'source_explicit'},{id:'weak',outcome:'unknown',strength:'unknown'}]),requirement,now,subject)).toMatchObject({reliability:'negative',readiness:'blocked_by_known_failure'})
  expect(assessSupplier(supplierWithReliability([{id:'positive',outcome:'positive',strength:'source_explicit'},{id:'negative',outcome:'negative',strength:'source_explicit'},{id:'weak',outcome:'unknown',strength:'unknown'}]),requirement,now,subject)).toMatchObject({reliability:'conflicting',readiness:'blocked_by_known_conflict'})
 })
})
