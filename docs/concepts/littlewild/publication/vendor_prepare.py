"""Reproduce the existing bundled Three.js bytes from two pinned MIT sources.

Used only by the one-time publication runner. The game stays self-contained;
normal gameplay and the checked-in Python build make no network requests.
"""
from __future__ import annotations

import hashlib
from pathlib import Path
import re
import urllib.request

EXPECTED_VENDOR = "a998daec49b9df4d7fbb55eb23cf7c908479d3983ff92d165ea403361b7c2bd2"
UPSTREAM = {
    "three.core.js": "368dc78835287709a48939e8eb9a7a61d0732098bdf916e56840d458aae9ccf3",
    "three.module.js": "61134198639a10885daf893fb29669ca26386e2a4cde76e8399f51e329f741f2",
}
PREAMBLE = '/*\nThe MIT License\n\nCopyright © 2010-2026 three.js authors\n\nPermission is hereby granted, free of charge, to any person obtaining a copy\nof this software and associated documentation files (the "Software"), to deal\nin the Software without restriction, including without limitation the rights\nto use, copy, modify, merge, publish, distribute, sublicense, and/or sell\ncopies of the Software, and to permit persons to whom the Software is\nfurnished to do so, subject to the following conditions:\n\nThe above copyright notice and this permission notice shall be included in\nall copies or substantial portions of the Software.\n\nTHE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR\nIMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,\nFITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE\nAUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER\nLIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,\nOUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN\nTHE SOFTWARE.\n\n*/\n'


def sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def names(spec: str, importing: bool = False) -> str:
    result = []
    for entry in spec.split(","):
        parts = entry.strip().split(" as ")
        if len(parts) not in (1, 2) or any(not re.fullmatch(r"[$\w]+", p) for p in parts):
            raise ValueError("Unexpected upstream export/import name.")
        local = parts[0]
        public = parts[-1]
        result.append((local + ":" + public) if importing else (public + ":" + local))
    return ",".join(result)


def bundle(core: bytes, module: bytes) -> bytes:
    for name, data in (("three.core.js", core), ("three.module.js", module)):
        if sha256(data) != UPSTREAM[name]:
            raise ValueError("Pinned upstream SHA-256 mismatch: " + name)
    core_text = core.decode("utf-8")
    module_text = module.decode("utf-8")
    core_text, count = re.subn(
        r"^export \{([^\n]+)\};$",
        lambda match: "return {" + names(match[1]) + "};",
        core_text, flags=re.MULTILINE,
    )
    if count != 1:
        raise ValueError("Expected exactly one core export.")
    module_text, count = re.subn(
        r"^import \{([^\n]+)\} from './three.core.js';$",
        lambda match: "const {" + names(match[1], True) + "}=THREE;",
        module_text, flags=re.MULTILINE,
    )
    if count != 1:
        raise ValueError("Expected exactly one module import.")
    module_text, count = re.subn(
        r"^export \{[^\n]+\} from './three.core.js';$", "", module_text,
        flags=re.MULTILINE,
    )
    if count != 1:
        raise ValueError("Expected exactly one core re-export.")
    module_text, count = re.subn(
        r"^export \{([^\n]+)\};$",
        lambda match: "Object.assign(THREE,{" + names(match[1]) + "});",
        module_text, flags=re.MULTILINE,
    )
    if count != 1:
        raise ValueError("Expected exactly one renderer export.")
    data = (PREAMBLE + "window.THREE=(()=>{\n" + core_text
            + "\n})();\n(()=>{\n" + module_text + "\n})();\n").encode("utf-8")
    if sha256(data) != EXPECTED_VENDOR:
        raise ValueError("Reproduced vendor differs from the delivered game.")
    return data


def obtain_vendor() -> bytes:
    sources = []
    for name, expected in UPSTREAM.items():
        url = "https://raw.githubusercontent.com/mrdoob/three.js/r184/build/" + name
        request = urllib.request.Request(url, headers={"User-Agent": "Littlewild-pinned-publication"})
        with urllib.request.urlopen(request, timeout=30) as response:
            data = response.read(3 * 1024 * 1024 + 1)
        if len(data) > 3 * 1024 * 1024 or sha256(data) != expected:
            raise ValueError("Unexpected upstream file: " + name)
        sources.append(data)
    return bundle(*sources)


if __name__ == "__main__":
    destination = Path(__file__).resolve().parent.parent / "vendor" / "three.js"
    data = obtain_vendor()
    if destination.exists() and destination.read_bytes() != data:
        raise SystemExit("Refusing to replace modified vendor.")
    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_bytes(data)
    print("Reproduced exact delivered Three.js bundle:", sha256(data), flush=True)
