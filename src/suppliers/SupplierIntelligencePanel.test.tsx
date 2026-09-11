// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import {cleanup,fireEvent,render,screen,within} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {afterEach,describe,expect,it} from 'vitest'
import {createCoSourceApplication} from '../application/cosource-application'
import type {ProductCluster} from '../commerce/domain/commerce'
import {SupplierIntelligencePanel} from './SupplierIntelligencePanel'

const provider='shopify_global_catalog' as const
const provenance={kind:'provider_explicit' as const,provider}
const makeProduct=(id:string):ProductCluster=>({identity:{provider,id},title:{value:`Pack ${id}`,provenance},media:[],offers:[{identity:{provider,id:`offer-${id}`},title:{value:`Pack ${id}`,provenance},merchant:{identity:{provider,id:`merchant-${id}`},name:`Merchant ${id}`,policyLinks:[],provenance},price:{minorAmount:1000,currency:'GBP'},availability:{state:'available',basis:'catalog_signal',provenance},selectedOptions:[],media:[],correlations:[],provenance}],featuredOfferId:`offer-${id}`,offerCompleteness:'featured_only',provenance})
const products=[makeProduct('a'),makeProduct('b')]
afterEach(cleanup)
async function setup(retainSupplier=true){let id=0;const application=createCoSourceApplication({market:{country:'GB',currency:'GBP'},makeId:()=>`id-${++id}`,now:()=>`2026-01-02T00:00:00.000Z`,catalog:{search:async()=>({products,messages:[],pagination:{hasMore:false}}),product:async({identity})=>({product:products.find(item=>item.identity.id===identity.id)!,selectedOptions:[],messages:[]})}});application.editGoal({summary:'Buy packs',searchFocus:'pack'});application.commitGoalDraft();await application.searchCandidates({query:'pack'});products.forEach(product=>application.retainCandidate(product.identity));if(retainSupplier)application.retainSupplier(products[0]!.identity,products[0]!.offers[0]!.identity);return application}
async function setupWithoutGoal(){let id=0;const application=createCoSourceApplication({market:{country:'GB',currency:'GBP'},makeId:()=>`no-goal-${++id}`,now:()=>`2026-01-02T00:00:00.000Z`,catalog:{search:async()=>({products:[products[0]!],messages:[],pagination:{hasMore:false}}),product:async()=>({product:products[0]!,selectedOptions:[],messages:[]})}});await application.searchCandidates({query:'pack'});application.retainCandidate(products[0]!.identity);const retained=application.retainSupplier(products[0]!.identity,products[0]!.offers[0]!.identity);expect(retained.ok).toBe(true);return application}

describe('SupplierIntelligencePanel',()=>{
 it('provides labelled controls, human-readable money, histories, and preserves rejected input',async()=>{
  const application=await setup(),view=render(<SupplierIntelligencePanel application={application} state={application.getSnapshot()}/>)
  await userEvent.click(screen.getByText('Merchant a',{selector:'strong'}))
  expect(screen.getByLabelText('Supplier name')).toBeInTheDocument()
  expect(screen.getByLabelText('Received quote amount')).toBeInTheDocument()
  expect(screen.getByLabelText('Contact subject')).toBeInTheDocument()
  expect(screen.getByLabelText('Reliability category')).toBeInTheDocument()
  expect(screen.getByLabelText('Risk category')).toBeInTheDocument()
  const amount=screen.getByLabelText('Received quote amount')
  await userEvent.type(amount,'10.999');await userEvent.click(screen.getByRole('button',{name:'Record received quotation'}))
  expect(amount).toHaveValue('10.999');expect(screen.getByRole('status')).toHaveTextContent(/valid amount/i)
  await userEvent.clear(amount);await userEvent.type(amount,'12.34');await userEvent.click(screen.getByRole('button',{name:'Record received quotation'}))
  view.rerender(<SupplierIntelligencePanel application={application} state={application.getSnapshot()}/>)
  expect(screen.getByText(/GBP 12.34/)).toBeInTheDocument();expect(screen.getByText(/never automatically replace/i)).toBeInTheDocument()
 })

 it('links a second exact merchant immediately after the first supplier becomes available',async()=>{
  const application=await setup(false),view=render(<SupplierIntelligencePanel application={application} state={application.getSnapshot()}/>)
  await userEvent.click(screen.getAllByRole('button',{name:'Retain as new supplier'})[0]!)
  view.rerender(<SupplierIntelligencePanel application={application} state={application.getSnapshot()}/>)
  const selection=screen.getByLabelText('Link merchant-b to supplier')
  expect(selection).toHaveValue(application.getSnapshot().suppliers[0]!.id)
  await userEvent.click(screen.getAllByRole('button',{name:'Link merchant'})[0]!)
  expect(application.getSnapshot().suppliers[0]!.merchantLinks).toHaveLength(2)
 })

 it('resets every supplier and merchant presentation draft across workspace identity',async()=>{
  const application=await setup(),base=application.getSnapshot(),supplier=base.suppliers[0]!,secondSupplier={...supplier,id:'second-supplier',name:'Second supplier',merchantLinks:[],quotations:[],contacts:[],reliability:[],risks:[]},firstState={...base,suppliers:[supplier,secondSupplier]},view=render(<SupplierIntelligencePanel application={application} state={firstState}/>)
  await userEvent.click(screen.getByText('Merchant a',{selector:'strong'}))
  fireEvent.change(screen.getAllByLabelText('Supplier name')[0]!,{target:{value:'Draft rename'}})
  fireEvent.change(screen.getAllByLabelText('Received quote amount')[0]!,{target:{value:'12.34'}})
  fireEvent.change(screen.getAllByLabelText('Currency')[0]!,{target:{value:'USD'}})
  fireEvent.change(screen.getAllByLabelText('Contact subject')[0]!,{target:{value:'Draft contact'}})
  fireEvent.change(screen.getAllByLabelText('Short summary')[0]!,{target:{value:'Draft summary'}})
  fireEvent.change(screen.getAllByLabelText('Outcome')[0]!,{target:{value:'negative'}})
  fireEvent.change(screen.getAllByLabelText('Valid until')[1]!,{target:{value:'2026-02-01T10:00'}})
  fireEvent.change(screen.getAllByLabelText('Reason')[0]!,{target:{value:'Draft risk'}})
  fireEvent.change(screen.getAllByLabelText('Review due')[0]!,{target:{value:'2026-02-02T10:00'}})
  fireEvent.change(screen.getByLabelText('Link merchant-b to supplier'),{target:{value:'second-supplier'}})
  const switched={...firstState,id:'other-workspace',suppliers:[{...supplier,name:'Other project supplier'},secondSupplier]}
  view.rerender(<SupplierIntelligencePanel application={application} state={switched}/>)
  await userEvent.click(screen.getByText('Other project supplier',{selector:'strong'}))
  expect(screen.getAllByLabelText('Supplier name')[0]).toHaveValue('Other project supplier')
  expect(screen.getAllByLabelText('Received quote amount')[0]).toHaveValue('')
  expect(screen.getAllByLabelText('Currency')[0]).toHaveValue('GBP')
  expect(screen.getAllByLabelText('Contact subject')[0]).toHaveValue('')
  expect(screen.getAllByLabelText('Short summary')[0]).toHaveValue('')
  expect(screen.getAllByLabelText('Outcome')[0]).toHaveValue('unknown')
  expect(screen.getAllByLabelText('Valid until')[1]).toHaveValue('')
  expect(screen.getAllByLabelText('Reason')[0]).toHaveValue('')
  expect(screen.getAllByLabelText('Review due')[0]).toHaveValue('')
  expect(screen.getByLabelText('Link merchant-b to supplier')).toHaveValue(supplier.id)
 })

 it('labels retained future active-status risks only as future-dated',async()=>{
  const application=await setup(),state=application.getSnapshot(),supplier=state.suppliers[0]!,future={id:'future-risk',supplierId:supplier.id,category:'fulfilment' as const,severity:'critical' as const,status:'active' as const,observedAt:'2027-01-01T00:00:00.000Z',reviewAt:'2027-01-02T00:00:00.000Z',reason:'Future observation',evidence:{strength:'source_explicit' as const,source:'restored_record'}},restored={...state,suppliers:[{...supplier,risks:[future]}]}
  application.restoreWorkspace(restored)
  expect(application.resolveSupplierRisk(supplier.id,future.id)).toMatchObject({ok:false,code:'invalid_input'})
  render(<SupplierIntelligencePanel application={application} state={application.getSnapshot()}/>)
  await userEvent.click(screen.getByText('Merchant a',{selector:'strong'}))
  const row=screen.getByText(/Future-dated.*Future observation/)
  expect(row).not.toHaveTextContent(/Active|overdue/)
  expect(within(row).queryByRole('button',{name:'Resolve risk'})).not.toBeInTheDocument()
 })

 it('keeps current and overdue risk resolution available while resolved history stays non-actionable',async()=>{
  const application=await setup(),state=application.getSnapshot(),supplier=state.suppliers[0]!,current={id:'current-risk',supplierId:supplier.id,category:'quality' as const,severity:'low' as const,status:'active' as const,observedAt:'2026-01-01T00:00:00.000Z',reason:'Current observation',evidence:{strength:'source_explicit' as const,source:'restored_record'}},overdue={...current,id:'overdue-risk',severity:'high' as const,reviewAt:'2026-01-01T12:00:00.000Z',reason:'Overdue observation'},resolved={...current,id:'resolved-risk',status:'resolved' as const,resolvedAt:'2026-01-01T18:00:00.000Z',reason:'Resolved observation'}
  application.restoreWorkspace({...state,suppliers:[{...supplier,risks:[current,overdue,resolved]}]})
  render(<SupplierIntelligencePanel application={application} state={application.getSnapshot()}/>)
  await userEvent.click(screen.getByText('Merchant a',{selector:'strong'}))
  const currentRow=screen.getByText(/Active.*Current observation/),overdueRow=screen.getByText(/Active.*review overdue.*Overdue observation/),resolvedRow=screen.getByText(/Resolved.*Resolved observation/)
  expect(within(currentRow).getByRole('button',{name:'Resolve risk'})).toBeInTheDocument()
  expect(within(overdueRow).getByRole('button',{name:'Resolve risk'})).toBeInTheDocument()
  expect(within(resolvedRow).queryByRole('button',{name:'Resolve risk'})).not.toBeInTheDocument()
  await userEvent.click(within(currentRow).getByRole('button',{name:'Resolve risk'}))
  expect(application.getSnapshot().suppliers[0]!.risks.find(item=>item.id===current.id)?.status).toBe('resolved')
 })

 it('keeps canonical risk presentation and resolution available without an active goal',async()=>{
  const application=await setupWithoutGoal(),supplier=application.getSnapshot().suppliers[0]!
  expect(application.recordSupplierRisk(supplier.id,{category:'fulfilment',severity:'high',reason:'No-goal current risk',evidence:{strength:'source_explicit',source:'human_record'}})).toMatchObject({ok:true})
  const recordedState=application.getSnapshot(),recordedSupplier=recordedState.suppliers[0]!,current=recordedSupplier.risks[0]!
  expect(application.assessSupplier(supplier.id)).toMatchObject({ok:false,code:'invalid_state'})
  const firstView=render(<SupplierIntelligencePanel application={application} state={application.getSnapshot()}/>)
  await userEvent.click(screen.getByText('Merchant a',{selector:'strong'}))
  const initialCurrentRow=screen.getByText(/Active.*No-goal current risk/)
  await userEvent.click(within(initialCurrentRow).getByRole('button',{name:'Resolve risk'}))
  expect(application.getSnapshot().suppliers[0]!.risks[0]!.status).toBe('resolved')
  firstView.unmount()
  const overdue={...current,id:'no-goal-overdue',reviewAt:'2026-01-01T12:00:00.000Z',reason:'No-goal overdue risk'}
  const future={...current,id:'no-goal-future',observedAt:'2026-01-03T00:00:00.000Z',reviewAt:'2026-01-04T00:00:00.000Z',reason:'No-goal future risk'}
  const resolved={...current,id:'no-goal-resolved',status:'resolved' as const,observedAt:'2026-01-01T00:00:00.000Z',resolvedAt:'2026-01-01T18:00:00.000Z',reason:'No-goal resolved risk'}
  application.restoreWorkspace({...recordedState,suppliers:[{...recordedSupplier,risks:[current,overdue,future,resolved]}]})
  render(<SupplierIntelligencePanel application={application} state={application.getSnapshot()}/>)
  await userEvent.click(screen.getByText('Merchant a',{selector:'strong'}))
  const currentRow=screen.getByText(/Active.*No-goal current risk/),overdueRow=screen.getByText(/Active.*review overdue.*No-goal overdue risk/),futureRow=screen.getByText(/Future-dated.*No-goal future risk/),resolvedRow=screen.getByText(/Resolved.*No-goal resolved risk/)
  expect(within(currentRow).getByRole('button',{name:'Resolve risk'})).toBeInTheDocument()
  expect(within(overdueRow).getByRole('button',{name:'Resolve risk'})).toBeInTheDocument()
  expect(within(futureRow).queryByRole('button',{name:'Resolve risk'})).not.toBeInTheDocument()
  expect(within(resolvedRow).queryByRole('button',{name:'Resolve risk'})).not.toBeInTheDocument()
 })
})
