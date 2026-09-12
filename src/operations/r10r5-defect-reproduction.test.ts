import {describe,expect,it} from 'vitest'
import {operationalObservationSnapshotFingerprint} from './domain/operational-case'

const base={product:{provider:'fixture',id:'product'},id:'observation',sequence:1,observedAt:'2026-09-12T10:00:00.000Z',lineId:'line',offers:[{offer:{provider:'fixture',id:'offer-b'},merchant:null},{offer:{provider:'fixture',id:'offer-a'},merchant:{provider:'fixture',id:'merchant'}}]}

describe('R10R5 frozen observation snapshot',()=>{
 it('is deterministic across non-authoritative offer input ordering',()=>{expect(operationalObservationSnapshotFingerprint(base)).toBe(operationalObservationSnapshotFingerprint({...base,offers:[...base.offers].reverse()}))})
 it('changes for offer membership, merchant presence, line, observation, sequence and time corruption',()=>{const fingerprint=operationalObservationSnapshotFingerprint(base),changed=[{...base,lineId:'other-line'},{...base,id:'other-observation'},{...base,sequence:2},{...base,observedAt:'2026-09-12T10:00:00.001Z'},{...base,offers:base.offers.slice(1)},{...base,offers:base.offers.map((item,index)=>index?item:{...item,merchant:{provider:'fixture',id:'forged'}})}];for(const value of changed)expect(operationalObservationSnapshotFingerprint(value)).not.toBe(fingerprint)})
})
