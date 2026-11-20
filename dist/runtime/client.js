const VENDOR = new URL('./vendor/', import.meta.url);
const DISTRIBUTION = 'https://cdn.jsdelivr.net/pyodide/v0.27.7/full/';
const LOCAL_PACKAGES = new Set(['numpy', 'sqlite3']);
const ALLOWED_PACKAGES = new Set([...LOCAL_PACKAGES, 'pandas', 'scipy', 'scikit-learn']);
const EMPTY_RESULT = {stdout: '', stderr: '', results: []};
const packageCache = new Map();
let corePromise;

async function fetchAsset(url, as, integrity) {
  const res = await fetch(url, {
    credentials: url instanceof URL && url.origin === location.origin ? 'same-origin' : 'omit',
    ...(integrity ? {integrity} : {}),
  });
  if (!res.ok) throw new Error('Файл ' + String(url).split('/').pop() + ' недоступен (HTTP ' + res.status + ').');
  return as === 'text' ? res.text() : res.arrayBuffer();
}

function getCore() {
  if (corePromise) return corePromise;
  corePromise = (async () => {
    const [asm, loader, worker, grader, wasm, stdlib, lockfile] = await Promise.all([
      fetchAsset(new URL('pyodide.asm.js', VENDOR), 'text'),
      fetchAsset(new URL('pyodide.js', VENDOR), 'text'),
      fetchAsset(new URL('./worker.js', import.meta.url), 'text'),
      fetchAsset(new URL('./grade.py', import.meta.url), 'text'),
      fetchAsset(new URL('pyodide.asm.wasm', VENDOR), 'buffer'),
      fetchAsset(new URL('python_stdlib.zip', VENDOR), 'buffer'),
      fetchAsset(new URL('pyodide-lock.json', VENDOR), 'buffer'),
    ]);
    return {
      worker: [asm, loader, worker].join('\n;\n'),
      grader,
      packages: JSON.parse(new TextDecoder().decode(lockfile)).packages,
      files: [['pyodide.asm.wasm', wasm], ['python_stdlib.zip', stdlib], ['pyodide-lock.json', lockfile]],
    };
  })().catch(error => { corePromise = null; throw error; });
  return corePromise;
}

function requestedFiles(roots, packages) {
  const names = new Set();
  function visit(name) {
    if (names.has(name)) return;
    const pkg = packages[name];
    if (!pkg) throw new Error('Пакет недоступен в этом окружении.');
    for (const dependency of pkg.depends) visit(dependency);
    names.add(name);
  }
  for (const root of roots) {
    if (!ALLOWED_PACKAGES.has(root)) throw new Error('Пакет недоступен в этом окружении.');
    visit(root);
  }
  return [...names];
}

async function getPackage(name, packages) {
  const {file_name: file, sha256} = packages[name];
  if (!packageCache.has(file)) {
    const url = new URL(file, LOCAL_PACKAGES.has(name) ? VENDOR : DISTRIBUTION);
    const digest = btoa(String.fromCharCode(...sha256.match(/../g).map(pair => parseInt(pair, 16))));
    const fetchPackage = fetchAsset(url, 'buffer', 'sha256-' + digest).catch(() => {
      packageCache.delete(file);
      throw new Error('Не удалось загрузить пакет ' + name + '. Проверьте соединение и запустите код ещё раз.');
    });
    packageCache.set(file, fetchPackage);
  }
  return [file, (await packageCache.get(file)).slice(0)];
}

// Serialized into the sandboxed iframe. It has no origin in common with the
// app, holds no account or progress data, and never evaluates student code.
function startFrameBridge() {
  window.addEventListener('message', event => {
    if (event.source !== parent || event.data?.type !== 'tensorium-init') return;
    const app = event.ports[0];
    let worker;
    let objectURL;
    function release() {
      worker?.terminate();
      if (objectURL) URL.revokeObjectURL(objectURL);
    }
    try {
      objectURL = URL.createObjectURL(new Blob([event.data.script], {type: 'text/javascript'}));
      worker = new Worker(objectURL);
      const bridge = new MessageChannel();
      worker.onerror = () => app.postMessage({type: 'worker-error'});
      app.onmessage = ({data}) => {
        if (data.type === 'dispose') { release(); return; }
        const transfer = data.type === 'package-files' ? data.files.map(entry => entry[1]) : [];
        bridge.port1.postMessage(data, transfer);
      };
      bridge.port1.onmessage = ({data}) => {
        app.postMessage(data);
        if (data.type === 'complete') release();
      };
      const job = event.data.job;
      worker.postMessage(job, [bridge.port2, ...job.files.map(entry => entry[1])]);
      window.addEventListener('pagehide', release, {once: true});
    } catch {
      release();
      app.postMessage({type: 'worker-error'});
    }
  }, {once: true});
}

const FRAME_DOCUMENT = `<!doctype html><html><head><meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline' 'unsafe-eval' 'wasm-unsafe-eval' blob:; worker-src blob:; child-src blob:; frame-src 'none'; connect-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'">
</head><body><script>(${startFrameBridge.toString()})()</script></body></html>`;

/** Start a new, disposable CPython interpreter for one run or local check. */
export function executePython({code, tests = [], stdin = '', onStatus, signal, timeoutMs = 20000} = {}) {
  if (typeof code !== 'string' || code.length > 131072 || !Array.isArray(tests)) {
    return Promise.resolve({...EMPTY_RESULT, error: 'Проверьте исходный код и размер программы (до 128 КБ).'});
  }
  if (signal?.aborted) return Promise.resolve({...EMPTY_RESULT, error: 'Запуск остановлен.'});
  const checks = tests.map(item => ({label: String(item.label), assert: String(item.assert)}));
  return new Promise(resolve => {
    let frame, port, deadline;
    let closed = false;
    const status = text => {
      try { onStatus?.(text); } catch { /* A UI notification cannot interrupt the interpreter. */ }
    };
    const finish = result => {
      if (closed) return;
      closed = true;
      clearTimeout(deadline);
      signal?.removeEventListener('abort', abort);
      if (port) {
        port.postMessage({type: 'dispose'});
        port.close();
      }
      frame?.remove();
      resolve(result);
    };
    const fail = error => finish({...EMPTY_RESULT, results: [], error});
    const abort = () => fail('Запуск остановлен.');
    signal?.addEventListener('abort', abort, {once: true});
    deadline = setTimeout(() => fail('Не удалось запустить Python вовремя. Проверьте соединение и повторите.'), 150000);
    status('Загружаем файлы Python…');
    getCore().then(core => {
      if (closed) return;
      const link = new MessageChannel();
      port = link.port1;
      port.onmessage = async ({data}) => {
        if (closed) return;
        if (data.type === 'status') { status(data.text); return; }
        if (data.type === 'worker-error') { fail('Браузер не смог запустить изолированную среду Python.'); return; }
        if (data.type === 'packages') {
          try {
            const names = requestedFiles(data.names, core.packages);
            status('Подключаем ' + data.names.join(', ') + '…');
            const files = await Promise.all(names.map(name => getPackage(name, core.packages)));
            if (!closed) port.postMessage({type: 'package-files', files}, files.map(entry => entry[1]));
          } catch (error) {
            if (!closed) port.postMessage({type: 'package-error', message: error.message});
          }
          return;
        }
        if (data.type === 'running') {
          clearTimeout(deadline);
          const limit = Math.min(120000, Math.max(100, Number(timeoutMs) || 20000));
          deadline = setTimeout(() => fail('Время выполнения истекло. Проверьте условие цикла или уменьшите объём вычислений.'), limit);
          status(checks.length ? 'Выполняем код и проверки…' : 'Выполняем код…');
          return;
        }
        if (data.type === 'complete') finish(data.result);
      };
      frame = document.createElement('iframe');
      frame.hidden = true;
      frame.setAttribute('sandbox', 'allow-scripts');
      frame.setAttribute('title', 'Изолированная среда Python');
      frame.referrerPolicy = 'no-referrer';
      frame.onload = () => {
        if (closed) return;
        const files = core.files.map(([name, buffer]) => [name, buffer.slice(0)]);
        const job = {files, grader: core.grader, code, tests: checks, stdin: String(stdin)};
        frame.contentWindow.postMessage({type: 'tensorium-init', script: core.worker, job}, '*', [
          link.port2, ...files.map(entry => entry[1]),
        ]);
      };
      frame.srcdoc = FRAME_DOCUMENT;
      document.body.append(frame);
    }).catch(error => fail(error.message || 'Не удалось загрузить интерпретатор Python.'));
  });
}
