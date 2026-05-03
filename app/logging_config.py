"""Structured logging configuration for StructAgent."""
from __future__ import annotations

import logging
import os
import sys
from typing import Any


class _StructuredFormatter(logging.Formatter):
    """JSON-style structured log formatter."""

    def format(self, record: logging.LogRecord) -> str:
        fields: dict[str, Any] = {
            "level": record.levelname,
            "logger": record.name,
            "msg": record.getMessage(),
        }
        if record.exc_info:
            fields["exc"] = self.formatException(record.exc_info)
        extras = {
            k: v
            for k, v in record.__dict__.items()
            if k not in logging.LogRecord.__dict__ and not k.startswith("_")
        }
        fields.update(extras)
        # Simple key=value format — no external deps needed
        return " ".join(f"{k}={v!r}" for k, v in fields.items())


def configure_logging(level: str | None = None) -> None:
    """Set up root logger with structured output to stderr."""
    env_level = os.getenv("LOG_LEVEL", level or "INFO").upper()
    numeric = getattr(logging, env_level, logging.INFO)

    handler = logging.StreamHandler(sys.stderr)
    handler.setFormatter(_StructuredFormatter())

    root = logging.getLogger()
    root.setLevel(numeric)
    # Remove any default handlers Flask/Python may have added
    root.handlers.clear()
    root.addHandler(handler)

    # Quiet noisy third-party loggers
    for noisy in ("werkzeug", "urllib3", "httpx", "httpcore"):
        logging.getLogger(noisy).setLevel(logging.WARNING)


def get_logger(name: str) -> logging.Logger:
    """Return a module-level logger."""
    return logging.getLogger(name)
