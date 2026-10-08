import test from 'node:test';
import assert from 'node:assert/strict';
import {askGemini, buildGeminiRequest} from '../geminiClient.js';

const parkingResult = {matchedCount: 1, returnedCount: 1, items: [{name: '국철 화명역 공영주차장'}]};
const options = {question: '화명 주차장 찾아줘', mcpUrl: 'https://parking.example/api/mcp'};
test('Gemini Remote MCP 요청 형식과 도구 제한', () => {
  const request = buildGeminiRequest({...options, mcpToken: 'fixture-token'});
  assert.equal(request.tools[0].type, 'mcp_server');
  assert.equal(request.tools[0].name, 'busan_parking');
  assert.deepEqual(request.tools[0].allowed_tools, [{mode: 'any', tools: ['search_parking']}]);
  assert.equal(request.tools[0].headers.Authorization, 'Bearer fixture-token');
});
test('Gemini 키와 원격 주소 누락을 실제 호출 전에 거절', async () => {
  let calls = 0;
  const fetchImpl = async () => {calls++;};
  await assert.rejects(askGemini(options, fetchImpl), /GEMINI_API_KEY/);
  for (const mcpUrl of [undefined, 'http://localhost:8788/api/mcp', 'https://127.0.0.1/api/mcp']) {
    await assert.rejects(askGemini({...options, mcpUrl, apiKey: 'fixture-key'}, fetchImpl));
  }
  assert.equal(calls, 0);
});
test('키는 요청 헤더에만 전달하고 Gemini 최종 답변을 반환', async () => {
  const result = await askGemini({...options, apiKey: 'fixture-key'}, async (url, init) => {
    assert.equal(url, 'https://generativelanguage.googleapis.com/v1beta/interactions');
    assert.equal(init.headers['x-goog-api-key'], 'fixture-key');
    assert.equal(init.body.includes('fixture-key'), false);
    assert.deepEqual(JSON.parse(init.body).tools[0].allowed_tools,
      [{mode: 'any', tools: ['search_parking']}]);
    return Response.json({id: 'fixture-id', steps: [
      {type: 'mcp_server_tool_call', id: 'call-1', name: 'search_parking', server_name: 'busan_parking'},
      {type: 'mcp_server_tool_result', call_id: 'call-1', result: parkingResult},
      {type: 'model_output', content: [{type: 'text', text: '검색 결과입니다.'}]}
    ]});
  });
  assert.equal(result.text, '검색 결과입니다.');
  assert.equal(result.interactionId, 'fixture-id');
  assert.deepEqual(result.toolCalls, ['search_parking']);
});
test('MCP 호출 없이 생성된 답변은 검색 성공으로 취급하지 않음', async () => {
  await assert.rejects(askGemini({...options, apiKey: 'fixture-key'}, async () =>
    Response.json({steps: [{type: 'model_output', content: [{type: 'text', text: '추측 답변'}]}]})), /도구 호출이 확인되지/);
});
test('Gemini 제공 오류에 포함된 키를 제거', async () => {
  await assert.rejects(askGemini({...options, apiKey: 'fixture-key'}, async () =>
    Response.json({error: {message: 'invalid fixture-key'}}, {status: 400})), error =>
      error.message.includes('[redacted]') && !error.message.includes('fixture-key'));
});

test('도구 호출 누락 시 응답 상태·유형·미검증 답변을 진단하고 비밀값을 제거', async () => {
  await assert.rejects(askGemini({...options, apiKey: 'fixture-key', mcpToken: 'fixture-token'}, async () =>
    Response.json({id: 'debug-id', status: 'completed', steps: [
      {type: 'model_output', content: [{type: 'text', text: 'fixture-key fixture-token 추측 답변'}]}
    ]})), error => {
      assert.equal(error.diagnostics.interactionId, 'debug-id');
      assert.equal(error.diagnostics.status, 'completed');
      assert.deepEqual(error.diagnostics.stepTypes, ['model_output']);
      assert.deepEqual(error.diagnostics.toolEvents, []);
      assert.equal(error.diagnostics.unverifiedModelText, '[redacted] [redacted] 추측 답변');
      return true;
    });
});
test('다른 서버의 동일 이름 도구 호출을 성공으로 인정하지 않음', async () => {
  await assert.rejects(askGemini({...options, apiKey: 'fixture-key'}, async () =>
    Response.json({steps: [
      {type: 'mcp_server_tool_call', name: 'search_parking', server_name: 'another_server', arguments: {secret: 'not-printed'}},
      {type: 'model_output', content: [{type: 'text', text: '답변'}]}
    ]})), error => {
      assert.equal(error.diagnostics.toolEvents[0].server, 'another_server');
      assert.equal(JSON.stringify(error.diagnostics).includes('not-printed'), false);
      return true;
    });
});
test('도구를 호출했지만 최종 답변이 없을 때도 진단 정보를 제공', async () => {
  await assert.rejects(askGemini({...options, apiKey: 'fixture-key'}, async () =>
    Response.json({status: 'incomplete', steps: [
      {type: 'mcp_server_tool_call', id: 'call-1', name: 'search_parking', server_name: 'busan_parking'},
      {type: 'mcp_server_tool_result', call_id: 'call-1', result: parkingResult}
    ]})), error => {
      assert.match(error.message, /최종 답변/);
      assert.equal(error.diagnostics.status, 'incomplete');
      return true;
    });
});

test('관측된 requires_action·function_call/result 형식에서 연결된 검색 결과 확인', async () => {
  const result = await askGemini({...options, apiKey: 'fixture-key'}, async () => Response.json({
    status: 'requires_action', steps: [
      {type: 'function_call', id: 'fc-1', name: 'search_parking'},
      {type: 'function_result', call_id: 'fc-1', result: [{type: 'text', text: JSON.stringify(parkingResult)}]},
      {type: 'thought'},
      {type: 'model_output', content: [{type: 'text', text: '화명역 검색 결과입니다.'}]}
    ]
  }));
  assert.deepEqual(result.toolCalls, ['search_parking']);
  assert.equal(result.status, 'requires_action');
});
test('호출 ID 불일치·검색 오류·관련 없는 결과·미실행 호출을 성공으로 처리하지 않음', async () => {
  for (const [callId, payload] of [
    ['wrong-id', parkingResult], ['fc-1', {isError: true, content: []}],
    ['fc-1', {message: '임의 결과'}]
  ]) {
    await assert.rejects(askGemini({...options, apiKey: 'fixture-key'}, async () => Response.json({steps: [
      {type: 'function_call', id: 'fc-1', name: 'search_parking'},
      {type: 'function_result', call_id: callId, result: payload},
      {type: 'model_output', content: [{type: 'text', text: '추측 답변'}]}
    ]})), /도구 호출이 확인되지/);
  }
});
