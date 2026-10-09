// AI의 원문 HTML은 실행하지 않고 지원하는 Markdown만 표시합니다.
const escapeHtml = text => text.replace(/[&<>"']/g, character => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[character]));
function inline(text) {
  // 코드 안의 Markdown은 그대로 보존합니다.
  return text.split(/(`[^`]+`)/g).map(part => part.startsWith('`') && part.endsWith('`')
    ? `<code>${escapeHtml(part.slice(1,-1))}</code>`
    : escapeHtml(part).replace(/\*\*([^*]+)\*\*/g,'<strong>$1</strong>')).join('');
}
const cells = line => line.trim().replace(/^\|/,'').replace(/\|$/,'').split('|').map(cell => cell.trim());
const divider = line => line.includes('|') && cells(line).every(cell => /^:?-{3,}:?$/.test(cell));
const listItem = line => /^\s*(?:[-*+] |\d+[.)] )/.test(line);
const heading = line => /^(#{1,6})\s+/.test(line);
export function renderAnswerHtml(value) {
  const lines=String(value??'').replace(/\r\n?/g,'\n').split('\n');
  const output=[];let i=0;
  while(i<lines.length) {
    const line=lines[i].trim();
    if(!line){i++;continue;}
    if(line.startsWith('```')) {
      const code=[];i++;
      while(i<lines.length&&!lines[i].trim().startsWith('```'))code.push(lines[i++]);
      output.push(`<pre><code>${escapeHtml(code.join('\n'))}</code></pre>`);i++;continue;
    }
    if(line.includes('|')&&i+1<lines.length&&divider(lines[i+1])) {
      const headers=cells(line),rows=[];i+=2;
      while(i<lines.length&&lines[i].trim()&&lines[i].includes('|'))rows.push(cells(lines[i++]));
      output.push('<div class="answer-table-scroll" role="region" aria-label="주차장 검색 결과 표" tabindex="0"><table><thead><tr>'
        +headers.map(cell=>`<th scope="col">${inline(cell)}</th>`).join('')+'</tr></thead><tbody>'
        +rows.map(row=>'<tr>'+headers.map((_,index)=>`<td>${inline(row[index]??'')}</td>`).join('')+'</tr>').join('')
        +'</tbody></table></div>');continue;
    }
    if(heading(line)) {
      const match=line.match(/^(#{1,6})\s+(.+)$/),level=Math.min(match[1].length+2,6);
      output.push(`<h${level}>${inline(match[2])}</h${level}>`);i++;continue;
    }
    if(/^([-*_])\1{2,}$/.test(line)) {output.push('<hr>');i++;continue;}
    if(listItem(line)) {
      const ordered=/^\s*\d+[.)] /.test(line),tag=ordered?'ol':'ul',items=[];
      while(i<lines.length&&listItem(lines[i])&&/^\s*\d+[.)] /.test(lines[i])===ordered)items.push(lines[i++].replace(/^\s*(?:[-*+] |\d+[.)] )/,''));
      output.push(`<${tag}>`+items.map(item=>`<li>${inline(item)}</li>`).join('')+`</${tag}>`);continue;
    }
    const paragraph=[line];i++;
    while(i<lines.length&&lines[i].trim()&&!heading(lines[i].trim())&&!listItem(lines[i])&&!lines[i].trim().startsWith('```')
      &&!/^([-*_])\1{2,}$/.test(lines[i].trim())&&!(lines[i].includes('|')&&i+1<lines.length&&divider(lines[i+1])))paragraph.push(lines[i++].trim());
    output.push('<p>'+paragraph.map(inline).join('<br>')+'</p>');
  }
  return output.join('');
}
