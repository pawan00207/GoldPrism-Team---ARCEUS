"""
GoldPrism — MCX Gold Spread Research Terminal
==============================================

An explainable spread research platform for MCX gold futures contracts.

Core pipeline:
  Raw MCX data → Validation & Trust Flags → Contract-Aware Normalization
  → X-Ray Spread Decomposition → Transaction Costs → Signal/Verdict
  → Best-Vehicle Ranking → Walk-Forward Backtest → Reproducible Reports

Author: Original tsdataprep by Seyyid Sahin (MIT License)
GoldPrism extension layer: Added for MCX gold research terminal.
"""

from __future__ import annotations

__version__ = "0.1.0"
__project__ = "GoldPrism"
