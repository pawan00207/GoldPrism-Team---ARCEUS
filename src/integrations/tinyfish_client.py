"""Resilient, server-side client for the documented TinyFish REST APIs."""

from __future__ import annotations

import hashlib
import json
import logging
import os
import threading
import time
from collections.abc import Mapping, Sequence
from typing import Any, Literal

import requests

logger = logging.getLogger(__name__)

SEARCH_URL = "https://api.search.tinyfish.ai"
FETCH_URL = "https://api.fetch.tinyfish.ai"
AGENT_URL = "https://agent.tinyfish.ai/v1/automation/run"
MONITORS_URL = "https://agent.tinyfish.ai/v1/monitors"
WALLET_URL = "https://agent.tinyfish.ai/v1/wallet"


class TinyFishError(RuntimeError):
    """Raised when a TinyFish API request cannot produce a usable response."""

    def __init__(self, message: str, *, status_code: int | None = None) -> None:
        super().__init__(message)
        self.status_code = status_code


class TinyFishClient:
    """Call TinyFish with bounded retries, redacted logs, and a process-local TTL cache."""

    def __init__(
        self,
        *,
        timeout_seconds: float = 30.0,
        agent_timeout_seconds: float = 120.0,
        retries: int = 3,
        backoff_seconds: float = 0.5,
        cache_ttl_seconds: float = 60.0,
        session: requests.Session | None = None,
    ) -> None:
        if timeout_seconds <= 0 or agent_timeout_seconds <= 0:
            raise ValueError("timeouts must be greater than zero")
        if retries < 0 or backoff_seconds < 0 or cache_ttl_seconds < 0:
            raise ValueError("retries, backoff, and cache TTL cannot be negative")

        self._api_key = os.environ.get("TINYFISH_API_KEY", "").strip()
        self._timeout_seconds = timeout_seconds
        self._agent_timeout_seconds = agent_timeout_seconds
        self._retries = retries
        self._backoff_seconds = backoff_seconds
        self._cache_ttl_seconds = cache_ttl_seconds
        self._session = session or requests.Session()
        self._cache: dict[str, tuple[float, dict[str, Any]]] = {}
        self._cache_lock = threading.Lock()

    @property
    def configured(self) -> bool:
        """Whether the required API key is available in the process environment."""
        return bool(self._api_key)

    def search(self, query: str, **params: str | int) -> dict[str, Any]:
        """Search public web or news results using TinySearch."""
        if not query.strip():
            raise ValueError("query cannot be empty")
        return self._get_json(
            "search",
            SEARCH_URL,
            params={"query": query, **params},
        )

    def fetch(self, urls: Sequence[str], *, purpose: str | None = None) -> dict[str, Any]:
        """Fetch public URLs using TinyFetch; per-URL errors remain in the response."""
        if not urls or len(urls) > 10:
            raise ValueError("urls must contain between 1 and 10 entries")
        if any(not url.startswith(("http://", "https://")) for url in urls):
            raise ValueError("each URL must use http or https")
        payload: dict[str, Any] = {
            "urls": list(urls),
            "format": "markdown",
            "ttl": 0,
            "per_url_timeout_ms": 60000,
        }
        if purpose:
            payload["purpose"] = purpose
        return self._post_json("fetch", FETCH_URL, payload)

    def run_agent(
        self,
        url: str,
        goal: str,
        output_schema: Mapping[str, Any],
    ) -> dict[str, Any]:
        """Run a synchronous TinyAgent task and require its documented result object."""
        if not url.startswith(("http://", "https://")):
            raise ValueError("url must use http or https")
        if not goal.strip():
            raise ValueError("goal cannot be empty")
        if output_schema.get("type") != "object":
            raise ValueError("output_schema must describe a top-level object")
        result = self._post_json(
            "agent",
            AGENT_URL,
            {"url": url, "goal": goal, "output_schema": dict(output_schema)},
            timeout_seconds=self._agent_timeout_seconds,
        )
        if result.get("status") != "COMPLETED" or not isinstance(result.get("result"), dict):
            raise TinyFishError("TinyAgent did not return a completed structured result")
        return result["result"]

    def create_monitor(
        self,
        monitor_type: Literal["fetch", "search"],
        config: Mapping[str, Any],
        schedule_cron: str,
        *,
        name: str,
        purpose: str,
        webhook_url: str,
    ) -> dict[str, Any]:
        """Create a documented TinyMonitor Page or Topic monitor."""
        if monitor_type not in ("fetch", "search"):
            raise ValueError("monitor_type must be 'fetch' or 'search'")
        if not webhook_url.startswith("https://"):
            raise ValueError("webhook_url must use https")
        return self._request(
            "monitor_create",
            "POST",
            MONITORS_URL,
            json_body={
                "type": monitor_type,
                "config": dict(config),
                "schedule_cron": schedule_cron,
                "name": name,
                "purpose": purpose,
                "webhook_url": webhook_url,
            },
        )

    def health_check(self) -> dict[str, Any]:
        """Check API-key health and wallet support without exposing credentials."""
        if not self.configured:
            return {
                "status": "UNAVAILABLE",
                "configured": False,
                "healthy": False,
                "wallet_available": False,
                "message": "TINYFISH_API_KEY is not configured.",
            }

        try:
            response = self._request(
                "health",
                "GET",
                WALLET_URL,
                timeout_seconds=self._timeout_seconds,
            )
        except TinyFishError as exc:
            if exc.status_code == 404:
                return {
                    "status": "HEALTHY",
                    "configured": True,
                    "healthy": True,
                    "wallet_available": False,
                    "message": "TinyFish is reachable; wallet details are not available for this account.",
                }
            return {
                "status": "UNAVAILABLE",
                "configured": True,
                "healthy": False,
                "wallet_available": False,
                "message": "TinyFish health check failed.",
            }

        return {
            "status": "HEALTHY",
            "configured": True,
            "healthy": True,
            "wallet_available": True,
            "wallet": {
                "available_balance": response.get("available_balance"),
                "currency": response.get("currency"),
            },
            "message": "TinyFish API and wallet endpoint are reachable.",
        }

    def _get_json(
        self,
        operation: str,
        url: str,
        *,
        params: Mapping[str, str | int],
    ) -> dict[str, Any]:
        cache_key = self._cache_key(operation, params)
        cached = self._get_cached(cache_key)
        if cached is not None:
            return cached
        response = self._request(operation, "GET", url, params=params)
        self._cache_value(cache_key, response)
        return response

    def _post_json(
        self,
        operation: str,
        url: str,
        payload: Mapping[str, Any],
        *,
        timeout_seconds: float | None = None,
    ) -> dict[str, Any]:
        cache_key = self._cache_key(operation, payload)
        cached = self._get_cached(cache_key)
        if cached is not None:
            return cached
        response = self._request(
            operation,
            "POST",
            url,
            json_body=payload,
            timeout_seconds=timeout_seconds or self._timeout_seconds,
        )
        self._cache_value(cache_key, response)
        return response

    def _request(
        self,
        operation: str,
        method: Literal["GET", "POST"],
        url: str,
        *,
        params: Mapping[str, str | int] | None = None,
        json_body: Mapping[str, Any] | None = None,
        timeout_seconds: float | None = None,
    ) -> dict[str, Any]:
        if not self._api_key:
            raise TinyFishError("TINYFISH_API_KEY is not configured.")

        headers = {"X-API-Key": self._api_key}
        if json_body is not None:
            headers["Content-Type"] = "application/json"

        last_status: int | None = None
        for attempt in range(self._retries + 1):
            try:
                response = self._session.request(
                    method,
                    url,
                    params=params,
                    json=json_body,
                    headers=headers,
                    timeout=timeout_seconds or self._timeout_seconds,
                )
            except requests.RequestException as exc:
                if attempt < self._retries:
                    self._wait_before_retry(operation, attempt, None)
                    continue
                logger.warning(
                    "TinyFish request failed",
                    extra={"operation": operation, "failure": type(exc).__name__},
                )
                raise TinyFishError(f"TinyFish {operation} request failed.") from exc

            last_status = response.status_code
            if response.status_code == 404 and operation == "health":
                raise TinyFishError("TinyFish wallet endpoint is unavailable.", status_code=404)
            if response.status_code >= 400:
                retryable = response.status_code == 429 or response.status_code >= 500
                if retryable and attempt < self._retries:
                    self._wait_before_retry(operation, attempt, response.status_code)
                    continue
                logger.warning(
                    "TinyFish request returned an error",
                    extra={"operation": operation, "status_code": response.status_code},
                )
                raise TinyFishError(
                    f"TinyFish {operation} request returned HTTP {response.status_code}.",
                    status_code=response.status_code,
                )

            try:
                payload = response.json()
            except ValueError as exc:
                logger.warning(
                    "TinyFish response was not valid JSON",
                    extra={"operation": operation, "status_code": response.status_code},
                )
                raise TinyFishError("TinyFish returned invalid JSON.", status_code=response.status_code) from exc
            if not isinstance(payload, dict):
                raise TinyFishError("TinyFish response was not a JSON object.", status_code=response.status_code)
            logger.info("TinyFish request succeeded", extra={"operation": operation})
            return payload

        raise TinyFishError(
            f"TinyFish {operation} request failed after retries.",
            status_code=last_status,
        )

    def _wait_before_retry(self, operation: str, attempt: int, status_code: int | None) -> None:
        logger.warning(
            "Retrying TinyFish request",
            extra={"operation": operation, "attempt": attempt + 1, "status_code": status_code},
        )
        time.sleep(self._backoff_seconds * (2**attempt))

    def _cache_key(self, operation: str, value: Mapping[str, Any]) -> str:
        serialized = json.dumps(value, sort_keys=True, separators=(",", ":"), default=str)
        return hashlib.sha256(f"{operation}:{serialized}".encode()).hexdigest()

    def _get_cached(self, key: str) -> dict[str, Any] | None:
        if self._cache_ttl_seconds == 0:
            return None
        now = time.monotonic()
        with self._cache_lock:
            item = self._cache.get(key)
            if item is None:
                return None
            expires_at, value = item
            if expires_at <= now:
                del self._cache[key]
                return None
            return json.loads(json.dumps(value))

    def _cache_value(self, key: str, value: dict[str, Any]) -> None:
        if self._cache_ttl_seconds == 0:
            return
        with self._cache_lock:
            self._cache[key] = (time.monotonic() + self._cache_ttl_seconds, value)
