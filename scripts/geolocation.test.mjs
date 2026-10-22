import test from 'node:test';
import assert from 'node:assert/strict';
import {parkingCoordinates,distanceKm,nearbyParkings,formatDistance,getCurrentLocation,locationError} from '../geolocation.js';
const parking=(name,xCdnt,yCdnt)=>({name,raw:{basic:{xCdnt,yCdnt}}});
test('주차장 좌표: 숫자 문자열·뒤집힌 값 보정, 빈값·범위·0,0 제외',()=>{
 assert.deepEqual(parkingCoordinates(parking('정상','35.2','129.1')),{latitude:35.2,longitude:129.1});
 assert.deepEqual(parkingCoordinates(parking('반대',129.1,35.2)),{latitude:35.2,longitude:129.1});
 for(const pair of [[null,129],['',129],[' ',129],[false,129],['abc',129],[91,200],[0,0]])assert.equal(parkingCoordinates(parking('오류',...pair)),null);
});
test('Haversine 거리·단위, 가까운 5곳을 먼저 선택하고 원본 불변',()=>{
 const origin={latitude:35.2,longitude:129.1};
 assert.equal(distanceKm(origin,origin),0);
 assert.ok(Math.abs(distanceKm(origin,{latitude:35.21,longitude:129.1})-1.112)<0.01);
 assert.equal(formatDistance(.42),'약 420m');assert.equal(formatDistance(1.84),'약 1.8km');
 const items=Array.from({length:8},(_,i)=>parking(String(i),35.2+i*.001,129.1)).reverse();items.push(parking('좌표 없음',null,null));
 const result=nearbyParkings(items,origin);
 assert.deepEqual(result.map(p=>p.name),['0','1','2','3','4']);assert.equal(items[0].distanceKm,undefined);
 assert.ok(nearbyParkings(items,{latitude:37.5,longitude:127})[0].distanceKm>50);
});
test('GPS 고정밀·12초·60초 설정 및 권한 오류·미지원',async()=>{
 const result=await getCurrentLocation({getCurrentPosition(success,error,options){
  assert.deepEqual(options,{enableHighAccuracy:true,timeout:12000,maximumAge:60000});success({coords:{latitude:35.2,longitude:129.1}});
 }});assert.deepEqual(result,{latitude:35.2,longitude:129.1});
 await assert.rejects(getCurrentLocation(null),/위치 기능/);
 for(const code of [1,2,3]){
  await assert.rejects(getCurrentLocation({getCurrentPosition(s,e){e({code});}}),e=>e.code===code);
  assert.ok(locationError({code}).length>10);
 }
});
