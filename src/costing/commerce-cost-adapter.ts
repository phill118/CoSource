import type {MerchantOffer} from '../commerce/domain/commerce'
import type {CostComponent,CostLineInput} from './domain/cost'

const merchantScope=(offer:MerchantOffer)=>offer.merchant?.identity?`${offer.merchant.identity.provider}:${offer.merchant.identity.id}`:offer.merchant?.domain?.trim().toLowerCase()

export function offerCostLine(line:{id:string;quantity:number;unitSemantics:'single_item'|'unknown'},offer:MerchantOffer):CostLineInput{
 const orderScope=merchantScope(offer)
 const base:CostComponent={id:'listing-price',category:'base_price',effect:'addition',basis:'per_unit',applicability:'applies',knowledge:{kind:'exact',amount:offer.price},timing:'one_time',evidence:{strength:offer.provenance.kind==='provider_explicit'?'source_explicit':offer.provenance.kind==='provider_inferred'?'source_inferred':offer.provenance.kind,source:offer.identity.provider},label:'Listing price'}
 if(offer.costComponents?.some(component=>component.category==='base_price'))throw new TypeError('Additional offer costs cannot contain duplicate base-price evidence')
 const extras=(offer.costComponents??[]).map(component=>component.basis==='per_order'?{...component,orderScope:component.orderScope??orderScope}:component)
 return{id:line.id,quantity:line.quantity,unitSemantics:line.unitSemantics==='single_item'?'single_unit':'unknown',components:[base,...extras],coverage:offer.oneTimeCostCoverage??{status:'partial',evidence:{strength:'unknown',source:offer.identity.provider},reasons:['The source proves listing price only; other applicable one-time costs are unresolved.']}}
}
