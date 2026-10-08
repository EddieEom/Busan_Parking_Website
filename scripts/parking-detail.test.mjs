import test from 'node:test';
import assert from 'node:assert/strict';
import {createParkingService, parkingId} from '../services/parkingService.js';
const a={id:'basic:0',name:'공영 A',address:'부산 북구 1',district:'북구',phone:'051-1'};
const b={id:'basic:1',name:'공영 B',address:'부산 북구 2',district:'북구'};
const service=items=>createParkingService({fetchImpl:async()=>Response.json({items})});
test('순서와 basic 순번이 바뀌어도 동일한 상세 조회',async()=>{
 const first=await service([a,b]).searchParking();
 const id=first.items.find(p=>p.name===a.name).id;
 const detail=await service([{...b,id:'basic:0'},{...a,id:'basic:1'}]).getParkingDetail({id});
 assert.equal(detail.parking.phone,'051-1');
 assert.equal(detail.parking.id,parkingId(a));
 assert.ok(detail.parking.mapUrl.startsWith('https://map.kakao.com/link/search/'));
});
test('중복 식별자와 없는 식별자는 명시적 오류',async()=>{
 await assert.rejects(service([a,a]).getParkingDetail({id:parkingId(a)}),e=>e.code==='AMBIGUOUS_ID');
 await assert.rejects(service([a]).getParkingDetail({id:'missing'}),e=>e.code==='NOT_FOUND');
});
