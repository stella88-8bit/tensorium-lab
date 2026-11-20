"""Evaluate a single voluntary practice submission in the disposable interpreter."""
import ast
import builtins
import contextlib
import io
import json
import sys
import traceback


_OUTPUT_LIMIT = 24000
_TRUNCATED = "\n… Вывод сокращён.\n"


class _Output(io.TextIOBase):
    def __init__(self):
        self._stream = io.StringIO()
        self._truncated = False

    def writable(self):
        return True

    def write(self, text):
        count = len(text)
        free = _OUTPUT_LIMIT - self._stream.tell()
        if free > 0:
            self._stream.write(text[:free])
        if count > free:
            self._truncated = True
        return count

    def value(self):
        return self._stream.getvalue() + (_TRUNCATED if self._truncated else "")


def tensorium_imports(code, test_json):
    modules = set()
    for source in [code, *(test["assert"] for test in json.loads(test_json))]:
        try:
            syntax = ast.parse(source)
        except (ValueError, SyntaxError):
            continue
        for node in ast.walk(syntax):
            if isinstance(node, ast.Import):
                modules.update(alias.name.split(".")[0] for alias in node.names)
            elif isinstance(node, ast.ImportFrom) and node.module:
                modules.add(node.module.split(".")[0])
    return json.dumps(sorted(modules))


def _message(exc):
    return "".join(traceback.format_exception_only(type(exc), exc)).strip()[:3000]


def tensorium_grade(code, test_json, stdin=""):
    checks = json.loads(test_json)
    output, errors = _Output(), _Output()
    namespace = {"__name__": "__main__", "__file__": "solution.py",
                 "__builtins__": builtins.__dict__.copy()}
    result = {"stdout": "", "stderr": "", "results": []}
    old_stdin = sys.stdin
    try:
        sys.stdin = io.StringIO(stdin)
        with contextlib.redirect_stdout(output), contextlib.redirect_stderr(errors):
            try:
                exec(compile(code, "solution.py", "exec"), namespace)
            except BaseException as exc:
                result["error"] = _message(exc)
                if exc.__traceback__.tb_next:
                    errors.write("".join(traceback.format_tb(exc.__traceback__.tb_next)))
            else:
                namespace["__output"] = output.value()
                for check in checks:
                    verdict = {"label": check["label"], "passed": True}
                    with contextlib.redirect_stdout(_Output()), contextlib.redirect_stderr(_Output()):
                        try:
                            exec(compile(check["assert"], "check.py", "exec"), namespace)
                        except BaseException as exc:
                            verdict["passed"] = False
                            detail = _message(exc)
                            if detail == "AssertionError":
                                detail = "Результат отличается от ожидаемого."
                            verdict["detail"] = detail
                    result["results"].append(verdict)
    finally:
        sys.stdin = old_stdin
    result["stdout"], result["stderr"] = output.value(), errors.value()
    return json.dumps(result, ensure_ascii=False)
