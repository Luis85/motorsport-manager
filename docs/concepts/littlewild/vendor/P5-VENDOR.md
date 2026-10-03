# p5.js 2.3.4

The unmodified browser bundle is copied from `p5@2.3.4/lib/p5.min.js` from the npm registry. Copyright belongs to the p5.js contributors; the complete GNU Lesser General Public License 2.1 is in `P5-LICENSE.txt`. Editable corresponding source and license headers are included in `p5-source-2.3.4.tar.gz`, taken from upstream git commit `61cf6e4e11017b39a0ad84a1d7948f4e94860e67` (the package gitHead). The archive contains all `src`, `utils`, and `translations` files, upstream package/lock files, README, license, and `rollup.config.mjs`; unrelated tests/media are omitted.

| File | SHA-256 |
| --- | --- |
| p5-2.3.4.min.js | bb8b82b97fcbcd5bb2d5475d1b6a3904f3ab4ed01b821134fd8f1e7710fce559 |
| p5-source-2.3.4.tar.gz | a95beddead62cb3888387e1c14635f684c04e857fe139df78233ef91c6509d42 |

To edit or replace the library, extract the source archive in a separate directory, use Node 22 or newer, run `npm ci --ignore-scripts` and `npm run build`, then copy its `lib/p5.min.js` over this vendor bundle. The upstream banner includes the build date, so a rebuild need not be byte-identical. The application source remains editable and the vendor boundary remains separate: rerun the Littlewild TypeScript/build commands documented in the main README to embed the replacement bundle. Preserve the license/source distribution when redistributing. Code-generation source exports include the bundle, license, provenance, and binary source archive so recipients can replace/rebuild it.

The actual p5 instance-mode P2D API creates a scoped canvas. The adapter calls `noLoop()` before setup and drives `redraw()` from the existing application render cadence. Presets consume explicit sampled time, phase and seed; they never use `frameCount`, `deltaTime`, p5 random state, or gameplay RNG. `remove()` disposes the sketch and its event listeners, including after cancelled asynchronous setup.

The shipped CSP remains unchanged: offline scripts, no external requests, and no unsafe-eval. The distribution contains optional shader-generation features using dynamic functions; this integration uses only P2D drawing and never invokes those features. Actual browser verification checks raw errors, warnings and network requests under the shipping CSP rather than allowing or filtering violations.
