"""Structural toolbox transport contracts; gameplay validation belongs to Godot."""

from __future__ import annotations

import json
import math
import re

PROTOCOL = "motorsport-manager-toolbox"
VERSION = 1
MAX_BYTES = 8 * 1024 * 1024
IDENTITY = re.compile(r"[A-Za-z0-9][A-Za-z0-9_./-]{0,63}\Z")
RUNNER = "res://scripts/services/toolbox/cli.gd"


class ToolboxError(RuntimeError):
    """A transport failure with machine-readable evidence, never a gameplay verdict."""

    def __init__(self, code: str, message: str, details: dict | None = None):
        super().__init__(message)
        self.code, self.message, self.details = code, message, details or {}

    def as_dict(self) -> dict:
        return {"code": self.code, "message": self.message, "details": self.details}


class ToolboxDomainError(ToolboxError):
    """The native owner rejected a structurally valid request."""

    def __init__(self, response: dict):
        error = response["error"]
        super().__init__(error["code"], error["message"], error["details"])
        self.response = response


def positive_timeout(value: float) -> float:
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        raise ValueError("Timeout must be a finite positive number")
    if not math.isfinite(value) or value <= 0:
        raise ValueError("Timeout must be a finite positive number")
    return float(value)


def encode(value: object) -> bytes:
    try:
        string_keys(value)
        raw = json.dumps(value, ensure_ascii=False, allow_nan=False, separators=(",", ":")).encode(
            "utf-8"
        )
    except (TypeError, ValueError, RecursionError) as error:
        raise ToolboxError("PROTOCOL_ERROR", "Request is not finite JSON") from error
    if len(raw) > MAX_BYTES:
        raise ToolboxError("PROTOCOL_ERROR", "Request exceeds 8 MiB")
    return raw


def string_keys(value: object) -> None:
    if isinstance(value, dict):
        for key, item in value.items():
            if not isinstance(key, str):
                raise ValueError("JSON object keys must be strings")
            string_keys(item)
    elif isinstance(value, (list, tuple)):
        for item in value:
            string_keys(item)


def decode(raw: bytes) -> object:
    def nonfinite(value: str) -> None:
        raise ValueError("Non-finite JSON number: " + value)

    def unique(items: list[tuple]) -> dict:
        result = {}
        for key, value in items:
            if key in result:
                raise ValueError("Repeated JSON key: " + key)
            result[key] = value
        return result

    if len(raw) > MAX_BYTES:
        raise ToolboxError("PROTOCOL_ERROR", "JSON frame exceeds 8 MiB")
    try:
        value = json.loads(raw.decode("utf-8"), parse_constant=nonfinite, object_pairs_hook=unique)
        encode(value)
        return value
    except (ValueError, UnicodeError, RecursionError) as error:
        raise ToolboxError("PROTOCOL_ERROR", "Malformed JSON frame") from error


def request(operation: str, session: str, arguments: dict, request_id: str) -> dict:
    value = dict(
        protocol=PROTOCOL,
        version=VERSION,
        request_id=request_id,
        operation=operation,
        session=session,
        arguments=arguments,
    )
    validate_request(value)
    return value


def validate_request(value: dict) -> None:
    if not isinstance(value, dict) or value.get("protocol") != PROTOCOL:
        raise ToolboxError("PROTOCOL_ERROR", "Request must use the toolbox protocol")
    if type(value.get("version")) is not int or value["version"] != VERSION:
        raise ToolboxError("PROTOCOL_ERROR", "Unsupported request protocol version")
    for field in ("request_id", "session"):
        text = value.get(field, "" if field == "session" else None)
        if (
            not isinstance(text, str)
            or (text or field == "request_id")
            and not IDENTITY.fullmatch(text)
        ):
            raise ToolboxError("PROTOCOL_ERROR", "Invalid request " + field)
    if not isinstance(value.get("operation"), str) or not value["operation"]:
        raise ToolboxError("PROTOCOL_ERROR", "Request operation must be a nonempty string")
    if not isinstance(value.get("arguments"), dict):
        raise ToolboxError("PROTOCOL_ERROR", "Request arguments must be an object")
    encode(value)


def metadata(value: object, expected: dict) -> dict:
    if not isinstance(value, dict) or value.get("engine_executed") is not True:
        raise ToolboxError("PROTOCOL_ERROR", "Missing actual native execution metadata")
    if not isinstance(value.get("engine"), str) or not value["engine"]:
        raise ToolboxError("PROTOCOL_ERROR", "Missing actual engine identity")
    if any(value.get(key) != text for key, text in expected.items()):
        raise ToolboxError("PROTOCOL_ERROR", "Native metadata belongs to another startup source")
    return value


def ready(value: object, expected: dict) -> dict:
    if not isinstance(value, dict) or value.get("protocol") != PROTOCOL:
        raise ToolboxError("PROTOCOL_ERROR", "Malformed native READY frame")
    if type(value.get("version")) is not int or value["version"] != VERSION:
        raise ToolboxError("PROTOCOL_ERROR", "Unsupported native READY version")
    return metadata(value.get("metadata"), expected)


def response(value: object, sent: dict, expected: dict) -> dict:
    if not isinstance(value, dict):
        raise ToolboxError("PROTOCOL_ERROR", "Native response must be an object")
    for key in ("protocol", "version", "request_id", "operation", "session"):
        wanted = sent.get(key, "" if key == "session" else None)
        if value.get(key) != wanted or (key == "version" and type(value.get(key)) is not int):
            raise ToolboxError("PROTOCOL_ERROR", "Native response correlation differs: " + key)
    metadata(value.get("metadata"), expected)
    if type(value.get("ok")) is not bool:
        raise ToolboxError("PROTOCOL_ERROR", "Native response requires a Boolean verdict")
    if value["ok"]:
        if "result" not in value or "error" in value:
            raise ToolboxError("PROTOCOL_ERROR", "Successful response requires only a result")
    else:
        error = value.get("error")
        if not isinstance(error, dict) or "result" in value:
            raise ToolboxError("PROTOCOL_ERROR", "Rejected response requires only an error")
        if any(
            not isinstance(error.get(key), str) or not error[key] for key in ("code", "message")
        ):
            raise ToolboxError("PROTOCOL_ERROR", "Native error requires a code and message")
        if not isinstance(error.get("details"), dict):
            raise ToolboxError("PROTOCOL_ERROR", "Native error details must be an object")
    return value
