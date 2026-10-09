import test from 'node:test';
import assert from 'node:assert/strict';
import {renderAnswerHtml} from '../answer-renderer.js';
test('AI 표·강조·목록을 읽을 수 있는 HTML로 표시',()=>{
 const result=renderAnswerHtml('**화명 검색 결과**\n\n| 이름 | 빈자리 |\n| --- | ---: |\n| **화명역** | 11대 |\n\n### 이용 안내\n- 갱신 시각 확인\n- 도착 시 달라질 수 있음');
 assert.ok(result.includes('<th scope="col">이름</th>'));assert.ok(result.includes('<td><strong>화명역</strong></td>'));
 assert.ok(result.includes('<td>11대</td>'));assert.ok(result.includes('<h5>이용 안내</h5>'));assert.ok(result.includes('<li>갱신 시각 확인</li>'));
 assert.ok(!result.includes('| ---'));
});
test('모델의 HTML·이벤트·링크를 실행 가능한 요소로 만들지 않음',()=>{
 const result=renderAnswerHtml('**<img src=x onerror=alert(1)>**\n\n| 이름 |\n| --- |\n| <script>alert(1)</script> |\n\n[클릭](javascript:alert(1))');
 assert.ok(!result.includes('<img'));assert.ok(!result.includes('<script'));assert.ok(!result.includes('<a'));
 assert.ok(result.includes('&lt;img'));assert.ok(result.includes('&lt;script&gt;'));
});
test('일반 문장·코드·빈 답변도 안전하게 표시',()=>{
 assert.equal(renderAnswerHtml(null),'');assert.equal(renderAnswerHtml('한 줄\n다음 줄'),'<p>한 줄<br>다음 줄</p>');
 assert.equal(renderAnswerHtml('`**코드**`'),'<p><code>**코드**</code></p>');
 assert.ok(renderAnswerHtml('```\n<script>\n```').includes('<pre><code>&lt;script&gt;</code></pre>'));
});
