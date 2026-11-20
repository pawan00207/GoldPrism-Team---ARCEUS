"""Create scheduled TinyFish Page Monitors for user-supplied official rules pages."""

from __future__ import annotations

import argparse
import json
import os
import sys

PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from src.integrations.tinyfish_client import TinyFishClient, TinyFishError


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--url",
        action="append",
        required=True,
        help="Public official MCX, CTT, or GST rules page; repeat once per page.",
    )
    args = parser.parse_args()

    app_url = os.environ.get("GOLDPRISM_APP_URL", "").rstrip("/")
    webhook_token = os.environ.get("TINYFISH_MONITOR_WEBHOOK_TOKEN", "")
    client = TinyFishClient()
    if not client.configured:
        parser.error("Set TINYFISH_API_KEY in the environment.")
    if not app_url.startswith("https://") or not webhook_token:
        parser.error("Set HTTPS GOLDPRISM_APP_URL and TINYFISH_MONITOR_WEBHOOK_TOKEN.")

    webhook_url = f"{app_url}/webhooks/rules-change?token={webhook_token}"
    monitor_ids: list[str] = []
    try:
        for index, url in enumerate(args.url, start=1):
            if not url.startswith(("https://", "http://")):
                parser.error(f"Monitor URL must use http or https: {url}")
            response = client.create_monitor(
                "fetch",
                {"url": url, "format": "markdown"},
                "CRON_TZ=Asia/Kolkata 0 9 * * 1-5",
                name=f"GoldPrism official cost/rules source {index}",
                purpose=(
                    "Detect changes to MCX gold contract fees, CTT, GST, stamp duty, "
                    "or other statutory transaction-cost rules."
                ),
                webhook_url=webhook_url,
            )
            monitor = response.get("monitor")
            monitor_id = monitor.get("id") if isinstance(monitor, dict) else None
            if not isinstance(monitor_id, str):
                raise TinyFishError("TinyMonitor response did not contain a monitor ID.")
            monitor_ids.append(monitor_id)
    except TinyFishError as exc:
        print(f"Monitor creation failed: {exc}", file=sys.stderr)
        return 1

    print(json.dumps({"monitor_ids": monitor_ids}, indent=2))
    print(
        "Set TINYFISH_COST_MONITOR_IDS to the comma-separated IDs above in the web app environment.",
        file=sys.stderr,
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
