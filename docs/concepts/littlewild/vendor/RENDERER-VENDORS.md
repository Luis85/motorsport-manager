# Offline 2D renderer libraries

These browser distributions are copied byte-for-byte from the exact npm packages in package-lock.json. Installing packages uses no lifecycle scripts; the standalone player loads the vendored copies without network access.

| File | Package | SHA-256 | License |
| --- | --- | --- | --- |
| pixi-8.22.0.min.js | pixi.js 8.22.0, dist/pixi.min.js | 06d9ef9823e743518793083c296d801e752db128cb1f519fbabe37e1259567ea | MIT, PIXI-LICENSE.txt |
| pixi-csp-8.22.0.min.js | pixi.js 8.22.0, dist/packages/unsafe-eval.min.js | 80d5eabed0e1286e2f646b272687170d9211ecd1c901b3382c2d5274ba2c42a9 | MIT, PIXI-LICENSE.txt |
| excalibur-0.32.0.min.js | excalibur 0.32.0, build/dist/excalibur.min.js | fda7652d4b3f6abd00326874518186459f1889ac285568667c985f0e354319d5 | BSD-2-Clause, EXCALIBUR-LICENSE.txt |

Load Pixi core, then its CSP polyfill, then Excalibur before registering the adapters. Despite the npm subpackage name `unsafe-eval`, Pixi's official `lib/unsafe-eval/init.js` replaces dynamic shader/uniform synchronization with static polyfills and disables the corresponding eval checks. The player CSP remains unchanged and does not permit unsafe-eval. The browser regression verifies initialization/drawing under that policy without violations or requests.

The adapters follow the package's documented public APIs: Pixi `WebGLRenderer.init`, `render`, `resize`, and `destroy`; Excalibur `ExcaliburGraphicsContextWebGL`, `Polygon`, `beginDrawLifecycle`, `flush`, `endDrawLifecycle`, `updateViewport`, and `dispose`. They create no Pixi Application/Ticker or Excalibur Engine. The existing player RAF supplies each frame; simulation time stays in the existing authority.

References: https://pixijs.com/8.x/guides/components/renderers and https://excaliburjs.com/docs/graphics . Pinned package declarations and distributed source are the implementation reference, including asynchronous Pixi initialization and Excalibur's standalone graphics context.
