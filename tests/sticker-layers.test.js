const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync(require('node:path').join(__dirname, '..', 'js', 'planner.js'), 'utf8');
const start = source.indexOf('    function moveStickerLayer(');
const end = source.indexOf('    $("bringForward")', start);
assert.ok(start !== -1 && end > start, 'Layer movement function must exist');
const move = vm.runInNewContext(source.slice(start, end) + '\nmoveStickerLayer');
const make = () => [
  {id:'butterfly', type:'emoji', layer:1},
  {id:'note', type:'note', layer:2},
  {id:'flower', type:'emoji', layer:3}
];
test('butterfly moves forward and then backward', () => {
  const s=make();
  assert.equal(move(s,'butterfly',1),true);
  assert.equal(s[0].layer,2);
  assert.equal(s[1].layer,1);
  assert.equal(move(s,'butterfly',-1),true);
  assert.equal(s[0].layer,1);
});
test('sticky note moves both directions', () => {
  const s=make();
  assert.equal(move(s,'note',-1),true);
  assert.equal(s[1].layer,1);
  assert.equal(move(s,'note',1),true);
  assert.equal(s[1].layer,2);
});
test('moving at front or back does not create negative layers', () => {
  const s=make();
  assert.equal(move(s,'butterfly',-1),false);
  assert.equal(move(s,'flower',1),false);
  assert.ok(s.every(x=>x.layer>=1));
});
test('legacy negative and duplicate layers are normalized when moved', () => {
  const s=[{id:'butterfly',layer:-3},{id:'note',layer:0},{id:'heart',layer:0}];
  assert.equal(move(s,'butterfly',1),true);
  assert.deepEqual([...s.map(x=>x.layer)].sort((a,b)=>a-b),[1,2,3]);
});
