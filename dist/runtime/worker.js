/* Loaded after the official Pyodide scripts inside an opaque, disposable worker. */
(() => {
  const INDEX = 'https://tensorium-runtime.invalid/';
  const PACKAGE_FOR_IMPORT = new Map([
    ['numpy', 'numpy'], ['sqlite3', 'sqlite3'], ['_sqlite3', 'sqlite3'],
    ['pandas', 'pandas'], ['scipy', 'scipy'], ['sklearn', 'scikit-learn'],
  ]);

  function contentType(name) {
    if (name.endsWith('.wasm')) return 'application/wasm';
    if (name.endsWith('.json')) return 'application/json';
    return 'application/octet-stream';
  }

  function installAssetReader(files) {
    // The opaque frame blocks all network requests. Pyodide reads previously
    // downloaded, version-locked buffers as ordinary Fetch Responses.
    self.fetch = async (input) => {
      const url = new URL(typeof input === 'string' ? input : input.url || input.href, INDEX);
      const filename = url.pathname.slice(1);
      if (url.origin !== new URL(INDEX).origin || !files.has(filename)) {
        return new Response('Ресурс отсутствует в учебной среде.', {status: 404});
      }
      return new Response(files.get(filename), {headers: {'Content-Type': contentType(filename)}});
    };
  }

  function receivePackages(channel, names) {
    return new Promise((resolve, reject) => {
      channel.onmessage = ({data}) => {
        if (data.type === 'package-error') reject(new Error(data.message));
        if (data.type === 'package-files') resolve(data.files);
      };
      channel.postMessage({type: 'packages', names});
    });
  }

  self.addEventListener('message', async ({data, ports}) => {
    const channel = ports[0];
    const files = new Map(data.files);
    installAssetReader(files);
    const testsJSON = JSON.stringify(data.tests);
    try {
      channel.postMessage({type: 'status', text: 'Открываем интерпретатор Python…'});
      const py = await self.loadPyodide({indexURL: INDEX, stdout() {}, stderr() {}});
      py.runPython(data.grader);
      const readImports = py.globals.get('tensorium_imports');
      let imports;
      try { imports = JSON.parse(readImports(data.code, testsJSON)); }
      finally { readImports.destroy(); }
      const packages = [...new Set(imports.map(name => PACKAGE_FOR_IMPORT.get(name)).filter(Boolean))];
      if (packages.length) {
        const additions = await receivePackages(channel, packages);
        for (const [name, bytes] of additions) files.set(name, bytes);
        await py.loadPackage(packages, {messageCallback() {}, errorCallback() {}});
      }
      channel.postMessage({type: 'running'});
      const grade = py.globals.get('tensorium_grade');
      let result;
      try { result = JSON.parse(grade(data.code, testsJSON, data.stdin)); }
      finally { grade.destroy(); }
      channel.postMessage({type: 'complete', result});
    } catch (reason) {
      channel.postMessage({
        type: 'complete',
        result: {stdout: '', stderr: '', results: [], error: String(reason.message || reason).slice(0, 3000)},
      });
    }
  }, {once: true});
})();
