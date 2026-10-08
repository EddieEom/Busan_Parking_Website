import test from 'node:test';
import assert from 'node:assert/strict';
import {createParkingService, filterParkings} from '../services/parkingService.js';

const now = Date.parse('2026-10-08T13:30:00+09:00');
const row = (overrides = {}) => ({
  id: 'realtime:1', name: '화명', district: '북구', address: '부산 북구 화명동',
  totalSpaces: 100, availableSpaces: 5, status: 'available', realtimeSupported: true,
  updatedAt: '2026-10-08 13:29:00', ...overrides
});
const payload = {fetchedAt: '2026-10-08T04:30:00.000Z', warnings: ['기본정보 일부 누락'], items: [row()]};
const fakeService = (fetchImpl) => createParkingService({fetchImpl, now: () => now});

test('공백과 괄호를 생략한 검색 및 이름 일치 우선 정렬', () => {
  const items = [row({name: '화명 2'}), row({name: '화명', address: null}),
    row({name: '기타', address: '화명동'}), row({name: '부산대역(남측)', address: '부산 금정구'})];
  assert.deepEqual(filterParkings(items, {keyword: '화명'}, now).items.map(p => p.name), ['화명', '화명 2', '기타']);
  assert.equal(filterParkings(items, {keyword: '부산대역 남측'}, now).matchedCount, 1);
});
test('구 필터, 결과 제한 및 검색 결과 없음', () => {
  const items = [row(), row({name: '화명2'}), row({name: '다른 곳', district: '남구'})];
  const result = filterParkings(items, {district: '북구', limit: 1}, now);
  assert.equal(result.matchedCount, 2);
  assert.equal(result.returnedCount, 1);
  assert.equal(filterParkings(items, {keyword: '존재하지않음'}, now).matchedCount, 0);
});
test('만차 0과 미확인 null을 구분하고 오래된 잔여 면수를 제거', () => {
  const items = [row(), row({name: '만차', availableSpaces: 0}),
    row({name: '지연', updatedAt: '2026-10-08 13:19:59'}),
    row({name: '미제공', realtimeSupported: false, status: 'unknown', updatedAt: null})];
  const result = filterParkings(items, {}, now).items;
  assert.equal(result.find(p => p.name === '만차').availableSpaces, 0);
  assert.equal(result.find(p => p.name === '만차').status, 'full');
  assert.equal(result.find(p => p.name === '지연').availableSpaces, null);
  assert.equal(result.find(p => p.name === '미제공').status, 'unknown');
  assert.equal(filterParkings(items, {availableOnly: true}, now).matchedCount, 1);
});
test('10분 경계, 미래 시각, 누락 시각 및 잘못된 잔여 면수', () => {
  assert.equal(filterParkings([row({updatedAt: '2026-10-08 13:20:00'})], {}, now).items[0].status, 'available');
  for (const overrides of [{updatedAt: '2026-10-08 13:31:01'}, {updatedAt: null},
    {availableSpaces: -1}, {availableSpaces: 101}, {availableSpaces: null}]) {
    assert.equal(filterParkings([row(overrides)], {availableOnly: true}, now).matchedCount, 0);
  }
});
test('원본을 변경하지 않고 raw 데이터는 AI 응답에서 제외', () => {
  const items = [row({raw: {secret: 'fixture'}})];
  const before = structuredClone(items);
  const result = filterParkings(items, {}, now);
  assert.deepEqual(items, before);
  assert.equal('raw' in result.items[0], false);
});
test('유효하지 않은 입력은 네트워크 호출 전에 거절', async () => {
  let calls = 0;
  const service = fakeService(async () => { calls++; return Response.json(payload); });
  for (const options of [{limit: 0}, {limit: 51}, {limit: 1.5}, {availableOnly: 'true'}, {keyword: 1}, null]) {
    await assert.rejects(service.searchParking(options), {code: 'INVALID_INPUT'});
  }
  assert.equal(calls, 0);
});
test('API 응답에서 경고와 조회 시각을 유지하고 캐시를 사용하지 않음', async () => {
  const service = fakeService(async (url, options) => {
    assert.equal(url, 'http://localhost:8788/api/parking');
    assert.equal(options.cache, 'no-store');
    return Response.json(payload);
  });
  const result = await service.searchParking({keyword: '화명'});
  assert.equal(result.totalCount, 1);
  assert.deepEqual(result.warnings, payload.warnings);
  assert.equal(result.fetchedAt, payload.fetchedAt);
  assert.equal(result.checkedAt, '2026-10-08T04:30:00.000Z');
});
test('HTTP 오류, 비 JSON, 잘못된 응답 및 연결 실패를 구분', async () => {
  for (const [response, code] of [[new Response('', {status: 502}), 'UPSTREAM_ERROR'],
    [new Response('<html>error</html>'), 'INVALID_RESPONSE'],
    [Response.json({}), 'INVALID_RESPONSE'], [Response.json({items: [null]}), 'INVALID_RESPONSE']]) {
    await assert.rejects(fakeService(async () => response).searchParking(), {code});
  }
  await assert.rejects(fakeService(async () => { throw new Error('private failure'); }).searchParking(), {code: 'NETWORK_ERROR'});
});
test('응답 지연은 취소하고 TIMEOUT으로 반환', async () => {
  const service = createParkingService({timeoutMs: 5, fetchImpl: async (_url, {signal}) =>
    new Promise((_resolve, reject) => signal.addEventListener('abort', () => reject(new Error('aborted')), {once: true}))});
  await assert.rejects(service.searchParking(), {code: 'TIMEOUT'});
});
test('잘못된 서버 설정을 거절', () => {
  for (const apiUrl of ['not-a-url', 'file:///tmp/data', 'https://user:password@example.com']) {
    assert.throws(() => createParkingService({apiUrl}), {code: 'INVALID_CONFIG'});
  }
});
