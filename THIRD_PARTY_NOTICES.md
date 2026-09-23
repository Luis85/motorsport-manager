# Third-party notices and source provenance

## Geographic circuit outlines

The seven geographic circuits in `data/tracks/catalog.json` were migrated from the user's **Circuit Atelier v0.4** prototype. That prototype derived their geographic plan outlines from **Tomislav Bacinger / f1-circuits**:

- Repository: https://github.com/bacinger/f1-circuits
- License: https://github.com/bacinger/f1-circuits/blob/master/LICENSE.md
- License text checked against upstream on 2026-09-23; blob `0dea871a7a99f3a22b2d6c4e7dd0666f82956065`.

Control handles, metre coordinates, heights, road widths, banking, features, pit lanes, and props were authored or reconstructed in Circuit Atelier and converted to the native track schema. Each record retains its own provenance. The coordinate conversion is rounded to millimetres for the packaged library. Pinecrest Motor Park is an authored fictional test circuit.

### MIT license — f1-circuits

Copyright (c) 2019-2025 Tomislav Bacinger

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

## Engine and dependencies

Godot is a separate MIT-licensed editor/runtime obtained from https://godotengine.org/. It is not vendored in this source repository. The project uses Godot's built-in UI, drawing, JSON, and filesystem APIs. No Konva, Three.js, Babylon.js, npm modules, external font files, or browser runtime are shipped.

## Accuracy and affiliation

Circuit names identify unofficial reference layouts. No endorsement or affiliation with Formula 1, the FIA, circuit owners, or vehicle manufacturers is asserted. The simulations and reference lap estimates are game models, not engineering or safety advice. Reference images imported by players remain the player's responsibility to license before redistribution.
