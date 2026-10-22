import test from 'node:test';
import assert from 'node:assert/strict';
import {createParkingService, parkingId} from '../services/parkingService.js';
import {mergeParkingData} from '../lib/mergeParkingData.js';

const now = Date.parse('2026-10-15T13:30:00+09:00');
const fresh = {name:'화명', district:'북구', totalSpaces:100, availableSpaces:5,
  occupiedSpaces:95, status:'available', realtimeSupported:true, updatedAt:'2026-10-15 13:29:00'};
const row = (code, overrides={}) => ({...fresh, parkgcd:code, ...overrides});
const service = items => createParkingService({now:()=>now, fetchImpl:async()=>Response.json({items,warnings:['기본정보 일부 누락']})});

test('빈자리 도구는 전체 검색 결과를 정렬한 뒤 limit 적용, 만차와 미확인을 구분',async()=>{
  const items=[row('1'), row('2',{name:'화명 2',availableSpaces:80}),
    row('3',{name:'화명 3',availableSpaces:0,status:'full'}),
    row('4',{name:'화명 4',availableSpaces:99,updatedAt:'2026-10-15 13:00:00'}),
    row('5',{name:'다른 구',district:'남구',availableSpaces:90})];
  const api=service(items);
  const top=await api.findAvailableParking({keyword:'화명',district:'북구',limit:1});
  assert.equal(top.items[0].parkgcd,'2');assert.equal(top.matchedCount,4);
  const all=await api.findAvailableParking({district:'북구'});
  assert.deepEqual(all.items.map(p=>p.availableSpaces),[80,5,0,null]);
  assert.deepEqual((await api.findAvailableParking({availableOnly:true,district:'북구'})).items.map(p=>p.parkgcd),['2','1']);
  assert.deepEqual(top.warnings,['기본정보 일부 누락']);
});

test('이름 상세조회는 정규화된 정확한 이름 우선, 상세 필드와 기존 id 조회 유지',async()=>{
  const exact=row('1',{name:'화명역(남측)',baseMinutes:10,baseFee:0,weekdayHours:'08:00 ~ 20:00'});
  const api=service([row('2',{name:'화명역(남측) 옆'}),exact]);
  const result=await api.getParkingDetail({name:'화명역 남측'});
  assert.equal(result.parking.id,parkingId(exact));assert.equal(result.parking.occupiedSpaces,95);
  assert.equal(result.parking.baseFee,0);assert.equal(result.parking.weekdayHours,'08:00 ~ 20:00');
  assert.equal((await api.getParkingDetail({id:parkingId(exact)})).parking.id,result.parking.id);
});

test('동명 주차장은 후보 반환, district로 좁히며 후보가 50개를 넘어도 단일 확정하지 않음',async()=>{
  const items=[row('1'),row('2',{district:'남구'})];
  const result=await service(items).getParkingDetail({name:'화명'});
  assert.equal(result.requiresSelection,true);assert.equal(result.parking,undefined);
  assert.equal(result.candidates.length,2);
  assert.equal((await service(items).getParkingDetail({name:'화명',district:'남구'})).parking.parkgcd,'2');
  const many=await service(Array.from({length:51},(_,i)=>row(String(i)))).getParkingDetail({name:'화명'});
  assert.equal(many.matchedCount,51);assert.equal(many.returnedCount,50);
});

test('빈자리·상세조회 잘못된 입력은 외부 호출 전 거절, 없는 이름은 명시적 오류',async()=>{
  let calls=0;const api=createParkingService({fetchImpl:async()=>{calls++;return Response.json({items:[]});}});
  for(const args of [{},{name:''},{name:'화명',id:'realtime:1'},{id:'a',district:'북구'},{name:'화명',district:'서울'}])
    await assert.rejects(api.getParkingDetail(args),{code:'INVALID_INPUT'});
  await assert.rejects(api.findAvailableParking({limit:0}),{code:'INVALID_INPUT'});
  assert.equal(calls,0);
  await assert.rejects(api.getParkingDetail({name:'없는 주차장'}),{code:'NOT_FOUND'});
});

test('문서에서 확인한 화명역 별칭 연결, 중복 대상은 연결 보류하고 원본 보존',()=>{
 const list=[{parkgcd:'A21',parknm:'화명역'}];
 const basic={pkNam:'화명 공영주차장',doroAddr:'부산 북구 원본 주소',pkCnt:'37'};
 const matched=mergeParkingData(list,[],[basic]);
 assert.equal(matched.length,1);assert.equal(matched[0].matchMethod,'alias');
 assert.equal(matched[0].address,basic.doroAddr);assert.deepEqual(matched[0].raw.basic,basic);
 for(const basics of [[basic,basic],[{...basic,pkNam:'화명역'},basic]]){
  const duplicate=mergeParkingData(list,[],basics);
  assert.equal(duplicate[0].basicMatched,false);assert.equal(duplicate[0].matchMethod,'ambiguous');
 }
 const collision=mergeParkingData([...list,{parkgcd:'A22',parknm:'화명'}],[],[basic]);
 assert.equal(collision.filter(p=>p.basicMatched).length,0);
});

test('V6.2 상세조회에서 주차장·공영주차장 접미사를 정규화', async () => {
  const {createParkingService} = await import('../services/parkingService.js');
  const service = createParkingService({fetchImpl:async()=>Response.json({items:[{name:'화명역',parkgcd:'1'}]})});
  for (const name of ['화명역 주차장','화명역 공영주차장']) {
    assert.equal((await service.getParkingDetail({name})).parking.name,'화명역');
  }
  await assert.rejects(service.getParkingDetail({name:'주차장'}), {code:'INVALID_INPUT'});
});
