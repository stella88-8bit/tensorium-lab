// Exercise the browser worker protocol and its offline resource loader in a fresh JS realm.
import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {MessageChannel} from 'node:worker_threads';

const read = (name, encoding) => readFile(new URL(name, import.meta.url), encoding);
async function bytes(name) {
  const data = await read('vendor/' + name);
  return data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength);
}
const files = await Promise.all(['pyodide.asm.wasm', 'pyodide-lock.json', 'python_stdlib.zip'].map(async n => [n, await bytes(n)]));
const lock = JSON.parse(await read('vendor/pyodide-lock.json', 'utf8'));
const scripts = await Promise.all(['vendor/pyodide.asm.js', 'vendor/pyodide.js', 'worker.js'].map(n => read(n, 'utf8')));
let dispatch;
const worker = {
  addEventListener(type, fn) { if (type === 'message') dispatch = fn; },
  importScripts() { throw Error('Unexpected script download'); },
  location: new URL('blob:null/runtime'), console, URL, Response, Request, Headers, WebAssembly,
  performance, crypto: webcrypto, navigator: {userAgent: 'Test worker'},
  TextDecoder, TextEncoder, setTimeout, clearTimeout, queueMicrotask, atob, btoa,
  structuredClone, ReadableStream, WritableStream, AbortController, AbortSignal, MessageChannel, Blob, URLSearchParams, DOMException,
  ArrayBuffer, Uint8Array, Int8Array, Uint16Array, Int16Array, Uint32Array, Int32Array, Float32Array, Float64Array, BigInt64Array, BigUint64Array, DataView, Error, TypeError,
};
worker.self = worker;
const link = new MessageChannel();
const clock = setTimeout(() => { console.error('Worker timed out'); process.exit(1); }, 30000);
process.on('unhandledRejection', error => console.error('async bootstrap',error?.name, error?.message));
process.on('uncaughtException', error => {
  console.error('Worker smoke test failed:', error.name, error.message, String(error.stack).split('\n').filter(x=>x.startsWith('    at')).slice(0,4).join('\n'));
  process.exit(1);
});
try {
  vm.runInContext(scripts.join('\n;\n'), vm.createContext(worker), {filename: 'tensorium-worker.js', displayErrors: false});
  const complete = new Promise((resolve, reject) => {
    link.port1.on('message', async message => {
      if (message.type === 'complete') return resolve(message.result);
      if (message.type === 'packages') {
        try {
          const additions = await Promise.all(message.names.map(async name => {
            const file = lock.packages[name].file_name;
            return [file, await bytes(file)];
          }));
          link.port1.postMessage({type: 'package-files', files: additions});
        } catch (error) { reject(error); }
      }
    });
  });
  const tests = [
    {label: 'NumPy', assert: 'assert __output == "5.0\\n"'},
    {label: 'SQL', assert: 'assert sqlite3.connect(":memory:").execute("SELECT 7").fetchone()[0] == 7'},
  ];
  const data = {files, grader: await read('grade.py', 'utf8'), tests, stdin: '',
    code: 'import numpy as np\nimport sqlite3\nprint(np.mean([4, 6]))'};
  dispatch({data, ports: [link.port2]});
  const result = await complete;
  assert.equal(result.error, undefined);
  assert.equal(result.stdout, '5.0\n');
  assert.ok(result.results.every(test => test.passed), JSON.stringify(result));
  console.log('Isolated worker completed the offline NumPy and SQLite checks.');
} catch (error) {
  console.error(error.name, error.message);
  process.exitCode = 1;
} finally {
  clearTimeout(clock);
  link.port1.close();
  link.port2.close();
}
