"""Safe handling of uploaded flow files (treated as untrusted input).

* Flow CSVs (.csv / .csv.gz / .binetflow: CICFlowMeter, Argus/CTU-13
  binetflow, UNSW-NB15) and libpcap captures (.pcap / .pcap.gz / .cap).
  No pickle, parquet, pcapng, Excel or multi-member archives are accepted.
* The client filename is never used as a path; it is sanitised for display
  only. Data is streamed to an anonymous temporary file with a hard byte
  limit, and gzip input is decompressed through a counting reader that aborts
  past `max_uncompressed_bytes` (decompression-bomb protection).
* Only whitelisted columns are parsed, row count is capped, and the content is
  never executed or evaluated.
"""

from __future__ import annotations

import gzip
import hashlib
import io
import os
import re
import tempfile
from dataclasses import dataclass
from pathlib import Path
from typing import BinaryIO

import pandas as pd

from ..forecasting.features import FlowSchemaError, _key
from .formats import ALLOWED_KEYS
from .pcap import PcapError, read_pcap_flows

ALLOWED_SUFFIXES = (".csv", ".csv.gz", ".binetflow", ".pcap", ".pcap.gz", ".cap")
PCAP_SUFFIXES = (".pcap", ".pcap.gz", ".cap")
GZIP_MAGIC = b"\x1f\x8b"
_SAFE = re.compile(r"[^A-Za-z0-9._-]+")


class UploadError(ValueError):
    def __init__(self, message: str, status_code: int = 400):
        super().__init__(message)
        self.status_code = status_code


def sanitize_filename(name: str | None) -> str:
    """Display-safe basename; never used to build a filesystem path."""
    base = os.path.basename((name or "").replace("\\", "/"))
    base = _SAFE.sub("_", base).strip("._") or "upload"
    return base[:100]


def check_suffix(name: str) -> str:
    lower = name.lower()
    for suffix in sorted(ALLOWED_SUFFIXES, key=len, reverse=True):
        if lower.endswith(suffix):
            return suffix
    raise UploadError("accepted: flow CSV (.csv, .csv.gz, .binetflow) or libpcap capture (.pcap, .pcap.gz)", 415)


@dataclass
class StoredUpload:
    path: Path
    size: int
    sha256: str
    compressed: bool

    def cleanup(self) -> None:
        try:
            self.path.unlink(missing_ok=True)
        except OSError:
            pass


def store_stream(src: BinaryIO, max_bytes: int, tmp_dir: Path | None = None, chunk: int = 1 << 20) -> StoredUpload:
    """Copy an upload stream to a private temp file, enforcing `max_bytes`."""
    fd, name = tempfile.mkstemp(prefix="aegis-upload-", suffix=".bin", dir=tmp_dir)
    path = Path(name)
    h = hashlib.sha256()
    size = 0
    try:
        with os.fdopen(fd, "wb") as out:
            while True:
                block = src.read(chunk)
                if not block:
                    break
                size += len(block)
                if size > max_bytes:
                    raise UploadError(f"file exceeds the {max_bytes // (1 << 20)} MB upload limit", 413)
                h.update(block)
                out.write(block)
        if size == 0:
            raise UploadError("empty file")
        with path.open("rb") as fh:
            head = fh.read(4096)
    except BaseException:
        path.unlink(missing_ok=True)
        raise
    return StoredUpload(path, size, h.hexdigest(), head.startswith(GZIP_MAGIC))


class _LimitedReader(io.RawIOBase):
    """Wraps a binary stream and raises once more than `limit` bytes were read."""

    def __init__(self, raw: BinaryIO, limit: int):
        self.raw, self.limit, self.count = raw, limit, 0

    def readable(self) -> bool:
        return True

    def readinto(self, b) -> int:  # noqa: ANN001
        data = self.raw.read(len(b))
        self.count += len(data)
        if self.count > self.limit:
            raise UploadError(f"decompressed data exceeds {self.limit // (1 << 20)} MB", 413)
        b[: len(data)] = data
        return len(data)


def read_flow_csv(stored: StoredUpload, suffix: str, max_uncompressed: int, max_rows: int) -> pd.DataFrame:
    if suffix == ".csv.gz" and not stored.compressed:
        raise UploadError("file has .gz extension but is not gzip data", 415)
    if suffix in (".csv", ".binetflow") and stored.compressed:
        raise UploadError("gzip data must use the .csv.gz extension", 415)
    raw: BinaryIO = gzip.open(stored.path, "rb") if stored.compressed else stored.path.open("rb")
    try:
        limited = io.BufferedReader(_LimitedReader(raw, max_uncompressed))
        head = limited.peek(65536)[:65536]
        if b"\x00" in head:
            raise UploadError("file does not look like a text CSV", 415)
        text = io.TextIOWrapper(limited, encoding="utf-8", errors="replace", newline="")
        try:
            df = pd.read_csv(
                text,
                usecols=lambda c: _key(c) in ALLOWED_KEYS,
                nrows=max_rows + 1,
                low_memory=False,
                on_bad_lines="error",
            )
        except UploadError:
            raise
        except (pd.errors.ParserError, pd.errors.EmptyDataError, UnicodeDecodeError, ValueError, EOFError, OSError) as exc:
            raise UploadError(f"malformed CSV: {str(exc)[:200]}") from exc
    finally:
        raw.close()
    if len(df) > max_rows:
        raise UploadError(f"file has more than {max_rows:,} rows", 413)
    df.columns = [str(c).strip() for c in df.columns]
    if len(df.columns) == 0:
        raise FlowSchemaError("missing required columns: no CICFlowMeter, binetflow or UNSW-NB15 flow columns found")
    if df.empty:
        raise UploadError("CSV contains no rows")
    return df


def read_pcap(stored: StoredUpload, suffix: str, max_packets: int) -> tuple[pd.DataFrame, dict]:
    if suffix == ".pcap.gz" and not stored.compressed:
        raise UploadError("file has .gz extension but is not gzip data", 415)
    try:
        return read_pcap_flows(stored.path, max_packets=max_packets)
    except PcapError as exc:
        raise UploadError(str(exc), 415) from exc
    except (OSError, EOFError) as exc:  # corrupt gzip stream
        raise UploadError(f"unreadable capture: {str(exc)[:200]}", 415) from exc


__all__ = ["read_pcap", "PCAP_SUFFIXES", "UploadError", "FlowSchemaError", "sanitize_filename", "check_suffix", "store_stream", "read_flow_csv", "StoredUpload"]
