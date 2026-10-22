import test from 'node:test';
import assert from 'node:assert/strict';
import {mapSearch} from '../map-link.js';
import {filterParkings} from '../services/parkingService.js';
test('18구역 같은 이름 대신 도로명주소로 검색, 부산 시·도 보강 및 보충 괄호 제외',()=>{
 const p={name:'(18구역)소규모공동주차장',roadAddress:'북구 시랑로21번길 73 (구포동 1205-62)',lotAddress:'부산 북구 구포동 1205-62'};
 const target=mapSearch(p);assert.equal(target.query,'부산광역시 북구 시랑로21번길 73');assert.equal(target.usesAddress,true);
 assert.ok(!decodeURIComponent(target.url).includes('18구역'));
 assert.equal(filterParkings([p]).items[0].mapUrl,target.url);
});
test('지번주소·기존 통합 주소·원본 기본정보 지원, 도로명주소 우선',()=>{
 assert.equal(mapSearch({roadAddress:'-',lotAddress:'부산광역시 북구 구포동 1205-62'}).query,'부산광역시 북구 구포동 1205-62');
 assert.equal(mapSearch({address:'부산 북구 시랑로 1'}).query,'부산 북구 시랑로 1');
 assert.equal(mapSearch({lotAddress:'북구 구포동 1',raw:{basic:{doroAddr:'북구 시랑로 1'}}}).query,'부산광역시 북구 시랑로 1');
 assert.equal(mapSearch({roadAddress:'경상남도 김해시 가락로 1'}).query,'경상남도 김해시 가락로 1');
});
test('주소 없으면 명시적인 이름 검색, 검색어는 URL 경로로 안전하게 인코딩',()=>{
 const target=mapSearch({name:'주차장/?#<script>',roadAddress:'-',address:''});assert.equal(target.usesAddress,false);
 assert.equal(target.url,'https://map.kakao.com/link/search/'+encodeURIComponent('부산 주차장/?#<script>'));
});
