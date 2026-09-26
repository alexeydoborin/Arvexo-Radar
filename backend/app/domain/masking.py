"""Deterministic sensitive-data masking (docs/08-dataset.md section 7,
docs/10-ai-pipeline.md section 4).

Regex detectors are a best-effort signal, not a leakage guarantee
(docs/16-security.md section 5) — a finding is "potential", never "proven".
Placeholders are stable per-record (`[EMAIL_1]`, `[EMAIL_2]`, ...); the
raw-to-placeholder mapping is never persisted or returned.
"""

from __future__ import annotations

import re
import string
from collections.abc import Callable
from dataclasses import dataclass

# Emails are located from each "@" outwards instead of with a single
# `local+@domain` regex: the regex engine retries the unbounded local part
# from every start position, which is quadratic on long runs of word
# characters (a 2M-char row took ~40 min of CPU and blocked the API).
_EMAIL_LOCAL_CHARS = frozenset(string.ascii_letters + string.digits + "._%+-")
_EMAIL_DOMAIN_RE = re.compile(r"@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}")
_PHONE_RE = re.compile(r"(?<!\w)(\+?\d[\d\-\s()]{8,}\d)(?!\w)")
# Common API key / token shapes: long high-entropy alnum runs, or provider-style
# prefixes (sk-, ghp_, AKIA...). Intentionally broad; false positives are safer
# than missed secrets for this MVP detector.
_SECRET_RE = re.compile(
    r"\b(?:sk-[A-Za-z0-9]{10,}|ghp_[A-Za-z0-9]{20,}|AKIA[0-9A-Z]{12,}|[A-Za-z0-9_\-]{32,})\b"
)

Replacer = Callable[[str], str]


def _sub_emails(replace: Replacer, text: str) -> str:
    """Same matches as `[a-zA-Z0-9._%+\\-]+@[a-zA-Z0-9.\\-]+\\.[a-zA-Z]{2,}`, in linear time."""
    parts: list[str] = []
    last_end = 0
    for match in _EMAIL_DOMAIN_RE.finditer(text):
        start = match.start()
        while start > last_end and text[start - 1] in _EMAIL_LOCAL_CHARS:
            start -= 1
        if start == match.start():
            continue
        parts.append(text[last_end:start])
        parts.append(replace(text[start : match.end()]))
        last_end = match.end()
    parts.append(text[last_end:])
    return "".join(parts)


def _regex_detector(pattern: re.Pattern[str]) -> Callable[[Replacer, str], str]:
    return lambda replace, text: pattern.sub(lambda match: replace(match.group(0)), text)


_DETECTORS: tuple[tuple[str, Callable[[Replacer, str], str]], ...] = (
    ("EMAIL", _sub_emails),
    ("SECRET", _regex_detector(_SECRET_RE)),
    ("PHONE", _regex_detector(_PHONE_RE)),
)


@dataclass(frozen=True)
class MaskingFinding:
    kind: str  # EMAIL | PHONE | SECRET
    placeholder: str


@dataclass(frozen=True)
class MaskingResult:
    masked_text: str
    findings: tuple[MaskingFinding, ...]


def mask_text(text: str) -> MaskingResult:
    findings: list[MaskingFinding] = []
    counters: dict[str, int] = {}
    result = text

    for kind, substitute in _DETECTORS:
        def _replace(_matched: str, kind: str = kind) -> str:
            counters[kind] = counters.get(kind, 0) + 1
            placeholder = f"[{kind}_{counters[kind]}]"
            findings.append(MaskingFinding(kind=kind, placeholder=placeholder))
            return placeholder

        result = substitute(_replace, result)

    return MaskingResult(masked_text=result, findings=tuple(findings))
