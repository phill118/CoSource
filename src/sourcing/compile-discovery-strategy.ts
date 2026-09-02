import type {PurchaseGoal,GoalCondition,GoalConditionKind} from '../goals/domain/purchase-goal'
import type {DiscoveryStrategy,EvidenceGap,ProductCondition,TaxonomyAttributeName,TaxonomyConstraint} from './domain/discovery-strategy'
const attributeAliases:Record<string,TaxonomyAttributeName>={color:'Color',colour:'Color',size:'Size','target gender':'Target gender'}
const normalise=(value:string)=>value.trim().toLocaleLowerCase('en-US')
function describe(condition:GoalCondition){return condition.operator==='free_text'?(condition.value??'Unspecified condition'):`${condition.field??'Field'} ${condition.operator.replaceAll('_',' ')} ${condition.value??''}`.trim()}
function gap(condition:GoalCondition,kind:GoalConditionKind):EvidenceGap{const description=describe(condition),delivery=/\b(delivery|deliver|shipping|arrive|arrival)\b/i.test(description);return{goalConditionId:condition.id,description,reason:delivery?'Current catalog evidence does not prove delivery date or cost.':'The condition cannot be safely projected to a supported catalog filter.',resolution:delivery?'requires_merchant_verification':'inspect_product',relevance:kind==='preference'?'preference':'mandatory'}}
export function compileDiscoveryStrategy(goal:PurchaseGoal,market={country:'GB',currency:'GBP'}):DiscoveryStrategy{
  const query=goal.searchFocus?.trim();if(!query)throw new TypeError('A product being sourced is required.')
  const attributes:TaxonomyConstraint[]=[],evidenceGaps:EvidenceGap[]=[],unprojectable:string[]=[],warnings:string[]=[];let condition:ProductCondition|undefined
  const project=(item:GoalCondition,kind:GoalConditionKind)=>{const field=normalise(item.field??''),value=normalise(item.value??'')
    if(item.operator==='equals'&&field==='condition'&&(value==='new'||value==='secondhand')){if(kind==='requirement')condition=value;else evidenceGaps.push(gap(item,kind));return}
    const attribute=attributeAliases[field];if(item.operator==='equals'&&attribute&&item.value?.trim()){attributes.push({name:attribute,values:[item.value.trim()]});return}
    evidenceGaps.push(gap(item,kind));unprojectable.push(describe(item))
  }
  goal.requirements.forEach(item=>project(item,'requirement'));goal.preferences.forEach(item=>project(item,'preference'));goal.exclusions.forEach(item=>{evidenceGaps.push(gap(item,'exclusion'));unprojectable.push(describe(item))})
  if(goal.quantity&&goal.quantity>1)evidenceGaps.push({description:`Quantity ${goal.quantity}`,reason:`Authoritative inventory quantity for ${goal.quantity} units is unavailable; catalog availability is only a sale-ready signal.`,resolution:'requires_merchant_verification',relevance:'mandatory'})
  let maximumPrice=goal.maximumItemPrice;if(maximumPrice&&maximumPrice.currency!==market.currency){unprojectable.push(`Maximum item price ${maximumPrice.currency}`);evidenceGaps.push({description:'Maximum item price',reason:`The ${maximumPrice.currency} item-price ceiling cannot be projected into a ${market.currency} search without FX data.`,resolution:'unsupported_by_provider',relevance:'mandatory'});warnings.push('Maximum item price was not applied because currencies differ.');maximumPrice=undefined}
  return{goalId:goal.id,goalRevision:goal.revision,query,humanIntent:goal.summary,market,constraints:{available:true,shipsToCountry:market.country,maximumPrice,condition,attributes},unprojectable,evidenceGaps,warnings}
}
