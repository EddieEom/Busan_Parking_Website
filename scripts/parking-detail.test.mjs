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

test('구·빈자리 조건에서 지연·미확인·만차·다른 구를 제외',async()=>{
 const timestamp=Date.parse('2026-10-09T07:30:00+09:00');
 const fresh={id:'realtime:1',name:'빈자리',district:'북구',availableSpaces:5,totalSpaces:10,status:'available',realtimeSupported:true,updatedAt:'2026-10-09 07:29:00'};
 const items=[fresh,{...fresh,id:'realtime:2',name:'지연',updatedAt:'2026-10-09 07:00:00'},
 {...fresh,id:'realtime:3',name:'만차',availableSpaces:0,status:'full'},
 {...fresh,id:'realtime:4',name:'다른구',district:'남구'},a];
 const api=createParkingService({now:()=>timestamp,fetchImpl:async()=>Response.json({items})});
 const result=await api.searchParking({district:'북구',availableOnly:true});
 assert.deepEqual(result.items.map(p=>p.name),['빈자리']);
});

test('비교는 한 번 조회하고 무료 0원·미확인 null을 구분',async()=>{
 let calls=0;
 const items=[{...a,baseMinutes:10,baseFee:0},{...b,baseMinutes:null,baseFee:null}];
 const api=createParkingService({fetchImpl:async()=>{calls++;return Response.json({items});}});
 const result=await api.compareParkings({ids:items.map(parkingId),sortBy:'fee'});
 assert.equal(calls,1);assert.equal(result.items[0].estimatedHourlyFee,0);
 assert.equal(result.items[1].estimatedHourlyFee,null);
 await assert.rejects(api.compareParkings({ids:[parkingId(a),parkingId(a)]}),e=>e.code==='INVALID_INPUT');
});
