// Offline smoke test. Run with: node dist/runtime/verify.mjs
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {loadPyodide} from './vendor/pyodide.mjs';

const root = new URL('./', import.meta.url);
const vendor = fileURLToPath(new URL('vendor/', root));
const py = await loadPyodide({indexURL: vendor + path.sep, packageCacheDir: vendor});
py.runPython(await readFile(new URL('grade.py', root), 'utf8'));
await py.loadPackage(['numpy', 'sqlite3']);
const grade = py.globals.get('tensorium_grade');

function run(code, tests = [], stdin = '') {
  return JSON.parse(grade(code, JSON.stringify(tests), stdin));
}
try {
  const greet = run('print("Привет, Tensorium!")', [
    {label: 'Сообщение', assert: 'assert __output.strip() == "Привет, Tensorium!"'},
  ]);
  assert.equal(greet.stdout, 'Привет, Tensorium!\n');
  assert.equal(greet.results[0].passed, true);
  assert.equal(run('print(input().upper())', [], 'учусь\n').stdout, 'УЧУСЬ\n');
  assert.match(run('print(unknown_name)').error, /NameError/);
  assert.match(run('if True print(1)').error, /SyntaxError/);
  const mismatch = run('x = 5', [{label: 'Значение', assert: 'assert x == 6'}]);
  assert.equal(mismatch.results[0].passed, false);
  assert.match(run('print("x"*50000)').stdout, /Вывод сокращён/);
  const science = run('import numpy as np\nimport sqlite3\na = np.mean([1, 3])\nb = sqlite3.connect(":memory:").execute("SELECT 2 + 3").fetchone()[0]', [
    {label: 'NumPy', assert: 'assert a == 2'},
    {label: 'SQL', assert: 'assert b == 5'},
  ]);
  assert.equal(science.error, undefined);
  assert.ok(science.results.every(test => test.passed));
  console.log('CPython, NumPy, SQLite, stdin, stdout, syntax and assessment smoke tests passed.');
} finally {
  grade.destroy();
}
