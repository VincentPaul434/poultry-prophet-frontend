/* eslint-disable @typescript-eslint/no-require-imports -- The test loads TypeScript modules in an isolated VM. */
const test = require('node:test');
const assert = require('node:assert/strict');
const ts = require('typescript');
const vm = require('node:vm');
const fs = require('node:fs');
function load(file, extra = {}) { const context = {exports:{}, require: (id) => extra[id] || require(id)}; vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), {compilerOptions:{module: ts.ModuleKind.CommonJS}}).outputText, context); return context.exports; }
test('Tagalog labels are understandable and English is preserved', () => { const m = load('lib/i18n.ts'); assert.equal(m.LANGUAGE_LABELS.taglish, 'Tagalog'); assert.equal(m.getMessage('taglish','nav.home'), 'Simula'); assert.equal(m.getMessage('en','nav.home'), 'Home'); assert.equal(m.getMessage('taglish','record.populationChange'), 'Pagbabago sa bilang'); });
test('static translated labels leave unknown text intact', () => { const m=load('lib/tagalog-text.ts'); assert.equal(m.translateDisplayText('taglish','Complete review'), 'Tapusin ang pagsusuri'); assert.equal(m.translateDisplayText('en','Complete review'), 'Complete review'); assert.equal(m.translateDisplayText('taglish','A farm name entered by a user'), 'A farm name entered by a user'); });
