/* Persistent companion HUD. Updates keyed controls in place; reads never issue commands. */
(function(inputRoot: unknown) {
    'use strict';

    interface Quest { status: string; name: string; returnRemaining: number; duration: number; elapsed: number; }
    interface Roll { time: number; label: string; dice: number[]; total: number; target: number; outcome: string; }
    interface Companion {
        id: string;
        name: string;
        personality: string;
        archetype: string;
        creature: { level: number };
        rpg: { cp: number };
        feelings: { anger: number };
        activeQuest?: Quest | null;
        lastRoll?: Roll | null;
    }
    interface EngineView {
        selected: Companion | null;
        creatures: Companion[];
        s: { simTime: number };
        load(companion: Companion): { grams: number; label: string };
    }
    interface Ports {
        engine(): EngineView;
        attention(engine: EngineView, companion: Companion): { label: string; kind: string };
        profile(personality: string): { name: string; color: string };
        archetypeName(archetype: string): string | undefined;
        returnSeconds(): number;
        status(companion: Companion): string;
        esc(value: string): string;
        icon(id: string): string;
        button(label: string, action: string, id?: string, css?: string): string;
        notice(message: string, css?: string): string;
        kg(grams: number): string;
        pct(value: number): string;
        time(seconds: number): string;
    }
    interface Hud { update(): void; }
    interface Root { LWColonyHUD?: { create(ports: Ports): Hud }; }
    const root = inputRoot as Root;

    function create(h: Ports): Hud {
        const E = () => h.engine(), actor = () => E().selected;
        const { esc: e, icon: ic, button: btn, notice, kg, pct, time, status } = h;
        function update(): void {
            const en = E(), c = actor(), s = en.s, roster = document.getElementById('creature-roster')!;
            // Stable keyed controls: changes to a mood or load cannot remove a focused button.
            for (const o of en.creatures) {
                let button = roster.querySelector<HTMLButtonElement>(`[data-id="${o.id}"]`);
                if (!button) {
                    button = document.createElement('button');
                    button.dataset.act = 'cx-select';
                    button.dataset.id = o.id;
                    button.innerHTML = '<span class="cx-dot"></span><span><strong></strong><small></small></span>';
                    roster.appendChild(button);
                }
                const attention = h.attention(en, o);
                button.className = 'cx-roster-button' + (c?.id === o.id ? ' selected' : '') + (o.activeQuest ? ' away' : '');
                button.setAttribute('aria-pressed', String(c?.id === o.id));
                button.title = o.name + ' · ' + status(o);
                button.querySelector<HTMLElement>('.cx-dot')!.style.background = h.profile(o.personality).color;
                button.querySelector('strong')!.textContent = o.name;
                button.querySelector('small')!.textContent = attention.label + ' · Lv. ' + o.creature.level;
                button.dataset.attention = attention.kind;
            }
            for (const b of [...roster.children] as HTMLElement[])
                if (!en.creatures.some(c => c.id === b.dataset.id))
                    b.remove();
            const htmlIfChanged = (id: string, markup: string) => { const el = document.getElementById(id); if (el && el.innerHTML !== markup)
                el.innerHTML = markup; };
            document.body.classList.toggle('cx-unselected', !c);
            document.body.classList.toggle('cx-away', !!c?.activeQuest);
            document.getElementById('selection-label')!.textContent = c ? c.name + ' · ' + status(c) : 'Select a friend before interacting.';
            const mini = document.getElementById('cx-character-summary')!;
            if (c) {
                if (!mini.querySelector('#v6-load-summary'))
                    mini.innerHTML = `<div class="cx-mini-row"><span id="v6-load-summary" class="cx-tag"></span><span id="v6-cp-summary" class="cx-tag"></span><span id="v6-temper-summary" class="cx-tag"></span></div><div class="cx-mini-actions">${btn('Outfit', 'cx-open', 'outfit', 'small')}${btn('Satchel', 'cx-open', 'satchel', 'small')}${btn('Personality', 'cx-open', 'feelings', 'small')}</div>`;
                const l = en.load(c);
                document.getElementById('v6-load-summary')!.textContent = kg(l.grams) + ' · ' + l.label;
                document.getElementById('v6-cp-summary')!.textContent = c.rpg.cp + ' CP';
                document.getElementById('v6-temper-summary')!.textContent = Math.round(c.feelings.anger) + ' anger';
            }
            else
                htmlIfChanged('cx-character-summary', notice('Choose a friend in the roster. Their needs, plans and belongings will appear here.'));
            const pocketLabel = document.querySelector('.stat-pod.pocket small');
            if (pocketLabel)
                pocketLabel.textContent = c ? c.name + '’s coins' : 'Choose a creature';
            if (!c)
                document.getElementById('header-pocket')!.textContent = '—';
            document.getElementById('wish-panel')?.setAttribute('aria-label', c ? c.name + '’s small wish' : 'Select a creature to see their wish');
            document.getElementById('portrait')?.setAttribute('aria-label', c ? c.name + ' and their worn equipment' : 'No creature selected');
            const sub = document.querySelector('.buddy-sub');
            if (sub)
                sub.textContent = c ? h.profile(c.personality).name + ' · ' + (h.archetypeName(c.archetype) || 'Companion') : 'Each companion has a life of their own';
            if (c?.activeQuest) {
                const q = c.activeQuest;
                document.getElementById('task-label')!.textContent = q.status === 'returning' ? 'On the way home' : 'Beyond the glade';
                document.getElementById('task-reason')!.textContent = q.name + ' · ' + time(q.status === 'returning' ? q.returnRemaining : q.duration - q.elapsed + h.returnSeconds()) + ' until return. Only recall is available while away.';
                document.getElementById('task-phase')!.textContent = q.status === 'returning' ? 'Return journey' : 'Quest in progress';
                document.getElementById('task-percent')!.textContent = pct(q.elapsed / q.duration);
                document.getElementById('task-progress')!.style.width = pct(q.elapsed / q.duration);
            }
            if (!c) {
                document.querySelectorAll('[data-buddy-name]').forEach(el => el.textContent = 'Choose a friend');
                document.getElementById('task-label')!.textContent = 'Several lives, one shared home';
                document.getElementById('task-reason')!.textContent = 'Select a companion to understand their next step.';
                document.getElementById('mini-mood')!.textContent = en.creatures.length + ' independent creatures';
            }
            const forbidden = !c || !!c.activeQuest;
            document.querySelectorAll<HTMLInputElement | HTMLButtonElement | HTMLSelectElement>('#focus-select,[data-allowance],[data-auto-allowance],[data-act="allowance"],[data-act="rename"],[data-act="blueprint"],[data-act="request"]').forEach(el => { if (forbidden)
                el.disabled = true;
            else if (el.matches('#focus-select,[data-allowance],[data-auto-allowance],[data-act="rename"],[data-act="request"]'))
                el.disabled = false; });
            const gate = document.getElementById('cx-interaction-gate')!;
            gate.hidden = !forbidden;
            htmlIfChanged('cx-interaction-gate', !c ? `Choose a companion in the roster to interact. ${btn('Our creatures', 'cx-open', 'community', 'small')}` : `${e(c.name)} is away. ${btn('View quest / recall', 'cx-open', 'adventures', 'small')}`);
            const feedback = document.getElementById('cx-roll-feedback')!;
            // Keep the detailed record, but do not pin an old roll above the care actions forever.
            if (c?.lastRoll && s.simTime - c.lastRoll.time < 12) {
                const r = c.lastRoll;
                htmlIfChanged('cx-roll-feedback', `${ic('star')}<span><strong>${e(r.label)}</strong><small>${r.dice.join(' + ')} = ${r.total} / target ${r.target} · ${e(r.outcome)}</small></span>${btn('Explain', 'cx-open', 'character', 'small')}`);
                feedback.hidden = false;
            }
            else
                feedback.hidden = true;
        }
        return { update };
    }
    root.LWColonyHUD = { create };
})(globalThis);
