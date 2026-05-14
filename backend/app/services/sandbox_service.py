from __future__ import annotations

import asyncio
import time
from pathlib import Path
from tempfile import TemporaryDirectory
from typing import TypedDict

import docker
from docker.errors import DockerException, ImageNotFound

from app.config import get_settings


class SandboxTestCase(TypedDict):
    id: str
    name: str
    input_data: str
    expected_output: str
    is_hidden: bool
    points: int


class SandboxService:
    @staticmethod
    async def run_code_against_tests(
        code: str,
        language: str,
        test_cases: list[SandboxTestCase],
        time_limit_ms: int,
        memory_limit_mb: int,
    ) -> dict[str, object]:
        loop = asyncio.get_running_loop()
        return await loop.run_in_executor(
            None,
            SandboxService._run_code_sync,
            code,
            language,
            test_cases,
            time_limit_ms,
            memory_limit_mb,
        )

    @staticmethod
    def _run_code_sync(
        code: str,
        language: str,
        test_cases: list[SandboxTestCase],
        time_limit_ms: int,
        memory_limit_mb: int,
    ) -> dict[str, object]:
        started = time.perf_counter()
        results: list[dict[str, object]] = []
        score = 0
        max_score = sum(item["points"] for item in test_cases)
        status = "success"
        logs: str | None = None

        try:
            client = docker.from_env()
            client.ping()
        except DockerException as exc:
            return SandboxService._error_result(test_cases, max_score, started, f"Docker unavailable: {exc}")

        source_name, image, command = SandboxService._language_runtime(language)

        # Check image exists locally, do not attempt to pull
        try:
            client.images.get(image)
        except ImageNotFound:
            return SandboxService._error_result(
                test_cases,
                max_score,
                started,
                f"Sandbox image '{image}' not found locally. Please run: docker pull {image}",
            )
        except DockerException as exc:
            return SandboxService._error_result(
                test_cases,
                max_score,
                started,
                f"Failed to check sandbox image '{image}': {exc}",
            )

        with TemporaryDirectory() as temp_dir:
            workspace = Path(temp_dir)
            (workspace / source_name).write_text(code, encoding="utf-8")

            for test_case in test_cases:
                case_started = time.perf_counter()
                (workspace / "input.txt").write_text(test_case["input_data"], encoding="utf-8")
                container = None
                try:
                    container = client.containers.run(
                        image=image,
                        command=command,
                        detach=True,
                        working_dir="/workspace",
                        volumes={str(workspace): {"bind": "/workspace", "mode": "rw"}},
                        network_mode="none",
                        mem_limit=f"{memory_limit_mb}m",
                        cpu_quota=50000,
                    )
                    timeout_seconds = max(1, time_limit_ms / 1000)
                    wait_result = container.wait(timeout=timeout_seconds)
                    output = container.logs(stdout=True, stderr=True).decode("utf-8", errors="replace")
                    exit_code = int(wait_result.get("StatusCode", 1))
                except Exception as exc:
                    if container is not None:
                        try:
                            container.kill()
                        except Exception:
                            pass
                    elapsed = int((time.perf_counter() - case_started) * 1000)
                    message = str(exc)
                    if "Read timed out" in message or "timed out" in message.lower():
                        case_status = "timeout"
                        status = "timeout"
                        error = "Execution timed out"
                    else:
                        case_status = "error"
                        status = "error"
                        error = message
                    logs = error
                    results.append(
                        SandboxService._case_result(
                            test_case=test_case,
                            passed=False,
                            actual_output=None,
                            error=error,
                            execution_time_ms=elapsed,
                        )
                    )
                    if case_status in {"timeout", "error"}:
                        break
                    continue
                finally:
                    if container is not None:
                        try:
                            container.remove(force=True)
                        except Exception:
                            pass

                elapsed = int((time.perf_counter() - case_started) * 1000)
                normalized_actual = output.rstrip()
                normalized_expected = test_case["expected_output"].rstrip()
                if exit_code != 0:
                    status = "error"
                    logs = output or f"Process exited with code {exit_code}"
                    results.append(
                        SandboxService._case_result(
                            test_case=test_case,
                            passed=False,
                            actual_output=output,
                            error=logs,
                            execution_time_ms=elapsed,
                        )
                    )
                    break

                passed = normalized_actual == normalized_expected
                if passed:
                    score += test_case["points"]
                elif status == "success":
                    status = "failed"

                results.append(
                    SandboxService._case_result(
                        test_case=test_case,
                        passed=passed,
                        actual_output=output,
                        error=None,
                        execution_time_ms=elapsed,
                    )
                )

        tests_passed = sum(1 for item in results if item["passed"])
        total_elapsed = int((time.perf_counter() - started) * 1000)
        return {
            "status": status,
            "score": score,
            "max_score": max_score,
            "tests_passed": tests_passed,
            "tests_total": len(test_cases),
            "results": results,
            "logs": logs,
            "execution_time_ms": total_elapsed,
        }

    @staticmethod
    def _language_runtime(language: str) -> tuple[str, str, list[str]]:
        settings = get_settings()
        if language == "python":
            return "main.py", settings.sandbox_python_image, ["sh", "-lc", "python main.py < input.txt"]
        if language == "javascript":
            return "main.js", settings.sandbox_javascript_image, ["sh", "-lc", "node main.js < input.txt"]
        if language == "cpp":
            return (
                "main.cpp",
                settings.sandbox_cpp_image,
                ["sh", "-lc", "g++ main.cpp -O2 -std=c++17 -o /tmp/main && /tmp/main < input.txt"],
            )
        raise ValueError(f"Unsupported language: {language}")

    @staticmethod
    def _case_result(
        test_case: SandboxTestCase,
        passed: bool,
        actual_output: str | None,
        error: str | None,
        execution_time_ms: int,
    ) -> dict[str, object]:
        return {
            "test_case_id": test_case["id"],
            "name": test_case["name"],
            "is_hidden": test_case["is_hidden"],
            "passed": passed,
            "points": test_case["points"],
            "actual_output": actual_output,
            "expected_output": test_case["expected_output"],
            "input_data": test_case["input_data"],
            "error": error,
            "execution_time_ms": execution_time_ms,
        }

    @staticmethod
    def _error_result(
        test_cases: list[SandboxTestCase],
        max_score: int,
        started: float,
        message: str,
    ) -> dict[str, object]:
        return {
            "status": "error",
            "score": 0,
            "max_score": max_score,
            "tests_passed": 0,
            "tests_total": len(test_cases),
            "results": [
                SandboxService._case_result(
                    test_case=item,
                    passed=False,
                    actual_output=None,
                    error=message,
                    execution_time_ms=0,
                )
                for item in test_cases
            ],
            "logs": message,
            "execution_time_ms": int((time.perf_counter() - started) * 1000),
        }