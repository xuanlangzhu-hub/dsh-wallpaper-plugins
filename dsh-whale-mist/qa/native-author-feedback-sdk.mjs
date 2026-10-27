import assert from 'node:assert/strict';

// Runs against real DOM in the actual rc.3 SDK fixture. It performs no clicks,
// author requests or state mutations and is reusable after integration scenarios.
export async function assertNativeAuthorFeedbackDOM(page){
 const rows=await page.evaluate(()=>[...document.querySelectorAll('[data-whale-author-feedback]')].filter(n=>n.getClientRects().length).map(n=>({
  key:n.dataset.whaleAuthorFeedback,state:n.dataset.state,text:n.textContent,title:n.title,id:n.id,
  width:n.getBoundingClientRect().width,ids:[...document.querySelectorAll('[id]')].filter(v=>v.id===n.id).length,
  controls:[...document.querySelectorAll('[aria-describedby]')].filter(v=>v.getAttribute('aria-describedby').split(' ').includes(n.id)).map(v=>({
   type:v.type,invalid:v.getAttribute('aria-invalid'),tag:v.tagName,role:v.getAttribute('role'),
  })),
 })));
 const labels={record:'未读取壁纸实际值',busy:'正在处理修改',sent:'下发已确认，效果请观察',error:'修改未完成',unknown:'本轮修改结果未确认'};
 for(const row of rows){
  assert.ok(Object.hasOwn(labels,row.state),row.state);assert.ok(row.text.includes(labels[row.state]),JSON.stringify(row));assert.ok(row.title.includes(labels[row.state]));
  assert.ok(Math.abs(row.width-18)<0.01,`delivery slot moved: ${JSON.stringify(row)}`);assert.equal(row.ids,1);assert.ok(row.controls.length>0);
  for(const control of row.controls)if(['checkbox','range','select-one'].includes(control.type)||control.role==='combobox')assert.equal(control.invalid,null,`delivery result is not a format error: ${JSON.stringify(row)}`);
 }
 return rows;
}
