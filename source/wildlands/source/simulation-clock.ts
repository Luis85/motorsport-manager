/* Presentation clock: all animation frame sizes produce fixed simulation steps.
 * Pausing/losing visibility discards sub-step display time, never catches up offline.
 * This class is independent of DOM, content, simulation RNG and wall-clock APIs. */
(function (inputRoot: unknown) {
    'use strict';
    class FixedStepClock {
        readonly step:number;
        pending=0;
        constructor(step = .1) {
            if (!Number.isFinite(step) || step <= 0 || step > 1)
                throw Error('Use a step greater than zero and at most one second.');
            this.step = step;
            this.pending = 0;
        }
        reset() { this.pending = 0; }
        advance(seconds:number, speed:number, tick:(step:number)=>void):number {
            if (!Number.isFinite(seconds) || seconds < 0 || !Number.isFinite(speed) || speed < 0 || typeof tick !== 'function')
                throw Error('Invalid clock input.');
            // Backpressure is explicit: long suspension never advances an unattended world.
            this.pending = Math.min(32 * this.step, this.pending + Math.min(seconds, .1) * Math.min(speed, 16));
            const count = Math.min(32, Math.floor(this.pending / this.step + 1e-9));
            for (let i = 0; i < count; i++) {
                // Consume display debt before invoking a possibly failing external callback.
                this.pending = Math.max(0, this.pending - this.step);
                try { tick(this.step); } catch(error) { this.reset(); throw error; }
            }
            return count;
        }
    }
    (inputRoot as {LWFixedStepClock?:typeof FixedStepClock}).LWFixedStepClock = FixedStepClock;
    if (typeof module !== 'undefined' && module.exports)
        module.exports = FixedStepClock;
})(globalThis);
