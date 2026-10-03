/* Status, dock and event presentation. Queries use the current story through an injected live context. */
(function(root){
 'use strict';
 function create(shell){
    const {$,BUILDINGS,RES,SKILLS,esc,html,icon,place,sound,syncTimeLabels,text,threshold,timeLabel,toast,ui,width}=shell;
    let renderedLibraryHash = '';
    function storyMarkup() { const s = shell.engine.s, q = shell.engine.quest(); if (!q) {
        const path=LW.PATHS[s.learning.path], next=path.skills.find(id=>!s.skills[id]),place=path.buildings.find(id=>!shell.engine.has(id)), count=path.skills.filter(id=>s.skills[id]).length;
        return `<section class="card story-card"><div class="eyebrow">OUR NEXT LITTLE POSSIBILITY</div><h2 class="story-title">${esc(path.name)}</h2><p class="story-desc">${esc(path.desc)}</p><div class="reward-row">${icon('book')}<strong>${count} / ${path.skills.length} lessons learned</strong></div><p class="muted micro">${next?esc(shell.engine.lessonIssue(next)?.text||'Ready to explore '+SKILLS[next].short+'.'):place?'Our learning can become a '+BUILDINGS[place].name.toLowerCase()+'.':'This path has taken root. Choose a new direction, or make these places your own.'}</p><button class="btn primary" data-act="${next?'v3-skill':place?'v3-blueprint':'v3-paths'}" ${next||place?'data-id="'+(next||place)+'"':''}>${next?'Explore '+SKILLS[next].short:place?'Imagine '+BUILDINGS[place].name:'Explore learning paths'} ${icon('arrow')}</button>${s.fieldStudies.active?'<p class="muted micro" style="margin-top:12px">'+icon('research')+' Observing: '+LW.STUDIES[s.fieldStudies.active].name+'</p>':''}<button class="text-btn" data-act="v3-paths" style="margin-top:12px">Choose another direction ↗</button></section>`;
    } const done = q.checks.every(c => c[1](s)); return `<section class="card story-card"><div class="eyebrow">${esc(q.chapter)}</div><h2 class="story-title">${esc(q.title)}</h2><p class="story-desc">${esc(q.desc)}</p><div class="checklist">${q.checks.map(([label, fn, action]) => `<button class="quest-row ${fn(s) ? 'done' : ''}" data-act="quest-go" data-id="${action}" ${fn(s) ? 'disabled' : ''}><span class="check">${fn(s) ? '✓' : ''}</span><span>${esc(label)}</span>${!fn(s) ? '<span class="arrow">↗</span>' : ''}</button>`).join('')}</div><div class="reward-row"><span class="label">A little thank you</span><strong>${icon('coin')} ${q.reward.coins}</strong><strong>${icon('research')} ${q.reward.rp}</strong></div>${done ? `<button class="btn primary claim-btn" data-act="claim">${icon('star')}Celebrate this chapter</button>` : ''}</section>`; }
    function allowanceMarkup() { const s = shell.engine.s; return `<section class="allowance"><div class="section-heading"><h2>A little independence</h2>${icon('coin')}</div><div class="allowance-readout"><span>Daily allowance</span><span><strong data-allowance-number>${s.allowance.limit}</strong> coins</span></div><label class="sr-only" for="allowance-modal">Daily allowance</label><input id="allowance-modal" class="range" type="range" min="0" max="30" step="1" value="${s.allowance.limit}" data-allowance><div class="range-labels"><span>0</span><span>Your limit. Pip’s choices.</span><span>30</span></div><p class="allowance-note">${esc(s.name)} has <strong data-pocket>${s.creature.coins}</strong> pocket coins. <span data-issued>${s.allowance.given} of ${s.allowance.limit} issued today.</span></p><button class="btn allowance-button" data-act="allowance">${icon('coin')}<span data-topup-label>Top up today’s allowance</span></button><label class="checkbox-line"><input type="checkbox" ${s.allowance.auto ? 'checked' : ''} data-auto-allowance> Automatically share each new day</label><p class="allowance-note">The limit controls coins you give, not coins Pip earns. Lowering it never takes pocket money back. Shops require a built market.</p></section>`; }
    function wishMarkup() {
        const s = shell.engine.s, w = s.wish;
        if (!w)
            return '';
        const progress = Math.min(w.amount, Math.max(0, s.stats[w.stat] - w.start));
        return `<div class="eyebrow">${icon(w.complete ? 'check' : 'heart')} ${w.complete ? 'A WISH WE SHARED' : esc(s.name.toUpperCase())+'’S SMALL WISH'}</div><h3>${esc(w.title)}</h3><p>“${esc(w.thought)}”</p><div class="wish-bottom"><span>${w.complete ? 'A memory to keep.' : progress + ' / ' + w.amount + ' · no pressure'}</span>${w.complete ? '<span class="tiny-tag">+2 bond · +1 research</span>' : '<button class="text-btn" data-act="wish">Make a little room ↗</button>'}</div>`;
    }
    function forecastMarkup(o = null) {
        const f = shell.engine.materialForecast(o);
        return `<div class="forecast"><div class="section-heading"><h3>${o ? 'How this plan comes together' : 'Materials across active plans'}</h3><span class="tiny-tag">${o ? 'Live plan' : 'Live material forecast'}</span></div>${f.rows.length ? `<div class="supply-head"><span>Supply</span><span>Available</span><span>Needed</span><span>To source</span></div>${f.rows.map(r => `<div class="supply-row"><span>${icon(RES[r.resource].icon)}${esc(RES[r.resource].name)}</span><span>${r.onHand}</span><span>${r.needed}</span><strong class="${r.missing ? 'shortfall' : ''}">${r.missing || 'Ready'}</strong></div>`).join('')}` : '<p class="muted">No materials waiting on active plans. Reserved construction supplies are already paid for.</p>'}${f.steps.length ? `<div class="chain-flow">${f.steps.map(r => `<span>${icon(RES[r.resource].icon)}${r.kind === 'craft' ? 'Make' : r.kind === 'hunt' ? 'Find' : 'Gather'} ${r.amount} ${esc(RES[r.resource].name.toLowerCase())}${r.station ? ' at ' + BUILDINGS[r.station].name.toLowerCase() : ''}</span>`).join('<b aria-hidden="true">→</b>')}</div>` : ''}${f.issues.length ? `<div class="dependency-list">${f.issues.map(i => `<button class="btn small" data-act="${i.skill ? 'training' : i.practice ? 'v3-practice-focus' : 'blueprint'}" data-id="${i.skill || i.practice || i.building}">${icon(i.skill ? 'book' : 'home')}${esc(i.text)} ↗</button>`).join('')}</div>` : ''}<p class="muted micro">A making-first forecast, including intermediate ingredients. Pantry targets are separate. Pip may shop instead when your sourcing preference and their pocket money allow it.</p></div>`;
    }
    function taskETA(t) { if (!t)
        return ''; const walking = t.phase === 'walk' ? t.path.length / 1.65 : 0; return Math.ceil(walking + Math.max(0, t.duration - t.elapsed) / shell.engine.workRate(t)) + ' sim seconds'; }
    function costString(cost) { return Object.entries(cost).map(([r, n]) => n + ' ' + RES[r].name.toLowerCase()).join(' · '); }
    function renderDock() {
        const s = shell.engine.s;
        ui.dockSignature = JSON.stringify([Object.keys(s.skills), s.buildings.map(b => b.kind), s.orders.map(o => o.kind)]);
        document.querySelectorAll('[data-act="tab"]').forEach(b => { const on = b.dataset.id === ui.tab; b.classList.toggle('active', on); b.setAttribute('aria-selected', on); });
        const hints = { care: 'Good company makes a good day.', build: 'You choose what. Pip figures out how.', train: 'Small lessons. Bigger possibilities.', trade: 'Independence starts with a little trust.' };
        text('dock-hint', hints[ui.tab]);
        if (ui.tab === 'care')
            html('dock-body', `<div class="care-grid"><button class="action-card" data-act="care" data-id="feed"><span class="action-icon">${icon('berries')}</span><strong>Share a snack</strong><small id="care-feed-caption">1 berry · a full tummy</small><span class="kbd">1</span></button><button class="action-card" data-act="care" data-id="water"><span class="action-icon">${icon('water')}</span><strong>Offer water</strong><small>1 water · a fresh start</small><span class="kbd">2</span></button><button class="action-card" data-act="care" data-id="bond"><span class="action-icon">${icon('heart')}</span><strong>Time together</strong><small>Clouds, stories & trust</small><span class="kbd">3</span></button><button class="action-card" data-act="care" data-id="praise"><span class="action-icon">${icon('star')}</span><strong>Praise effort</strong><small>Celebrate a little win</small><span class="kbd">4</span></button></div>`);
        else if (ui.tab === 'build')
            html('dock-body', `<div class="build-dock-toolbar"><span>${Object.keys(BUILDINGS).length} places · 3 stages · 3 levels</span><button class="btn small primary" data-act="v3-construction">Construction atlas ↗</button><button class="btn small" data-act="v3-recipes">Production book</button></div><div class="plan-strip">${Object.entries(BUILDINGS).map(([id, b]) => { const exists = shell.engine.has(id) || s.orders.some(o => o.kind === id), known = !!s.skills[b.skill]; return `<button class="blueprint ${shell.world.placement === id ? 'chosen' : ''}" data-act="blueprint" data-id="${id}" ${exists ? 'disabled' : ''} title="${esc(b.desc + ' ' + costString(b.cost))}"><div class="blueprint-top">${icon(b.icon)}<strong>${esc(b.name)}</strong></div><div class="cost">${esc(costString(b.cost))}</div><span class="${known ? 'ready-note' : 'locked-note'}">${exists ? 'Already in our story' : known ? 'Place a plan ↗' : 'Needs ' + SKILLS[b.skill].short}</span></button>`; }).join('')}</div>`);
        else if (ui.tab === 'train')
            html('dock-body', `<div class="dock-invite"><div class="invite-art">${icon('book')}</div><div><h3>A little more capable, every day.</h3><p>28 lessons across four tiers. Practice a craft, follow a learning path, and discover a talent of our own.</p></div><button class="btn primary" data-act="training">${icon('research')}Explore lessons</button></div>`);
        else
            html('dock-body', `<div class="dock-invite"><div class="invite-art">${icon('market')}</div><div><h3>${shell.engine.has('market') ? 'A little give. A little grow.' : 'Good things bring us together.'}</h3><p>${shell.engine.has('market') ? 'Sell deposited warehouse goods. Creatures carry, use and deliver their own supplies.' : 'Build a market stall to trade, meet neighbors, and let Pip choose what to buy.'}</p></div><button class="btn primary" data-act="market">${icon('market')}${shell.engine.has('market') ? 'Visit the market' : 'See the market'}</button></div>`);
    }
    const NEEDS = { food: ['Food', 'berries'], water: ['Water', 'water'], energy: ['Energy', 'energy'], comfort: ['Comfort', 'comfort'], joy: ['Joy', 'joy'] };
    function refreshContentLabels() {
        if(renderedLibraryHash===LWContent.registry.hash)return;
        renderedLibraryHash=LWContent.registry.hash;ui.dockSignature='';
        html('resource-list', Object.entries(RES).filter(([id])=>['wood','stone','fiber','berries','water','planks','meat','meals'].includes(id)).map(([id, r]) => `<button class="resource" data-act="pantry" title="Warehouse: ${esc(r.name)}">${icon(r.icon)}<span>${r.name === 'Hearty meals' ? 'Meals' : r.name === 'Wild meat' ? 'Provisions' : esc(r.name)}</span><strong id="res-${id}">0</strong></button>`).join(''));
    }
    function updateUI(force = false) {
        refreshContentLabels();
        const s = shell.engine.s;
        document.body.classList.toggle('no-motion', s.settings.reducedMotion);
        text('player-coins', s.player.coins);
        text('header-pocket', s.creature.coins);
        document.body.classList.toggle('high-contrast', !!s.settings.highContrast);
        text('research-points', s.rp);
        text('player-level', 'Lv. ' + s.player.level);
        width('player-xp-fill', s.player.xp / threshold(s.player.level) * 100);
        $('guide-xp').title = s.player.xp + ' / ' + threshold(s.player.level) + ' guide XP';
        text('buddy-level', 'Level ' + s.creature.level);
        text('buddy-xp', s.creature.xp + ' / ' + threshold(s.creature.level) + ' XP');
        width('buddy-xp-fill', s.creature.xp / threshold(s.creature.level) * 100);
        text('buddy-mood', shell.engine.mood());
        text('mini-mood', s.name + ' · ' + shell.engine.mood());
        html('mini-needs', icon('berries') + Math.round(s.needs.food) + '% ' + icon('water') + Math.round(s.needs.water) + '% ' + icon('energy') + Math.round(s.needs.energy) + '%');
        text('request-button-label', 'Give ' + s.name + ' an idea');
        text('world-footer-text', shell.world.placement ? 'Planning time · world paused' : s.task?.phase === 'walk' ? s.name + ' is finding their way.' : s.name + ' has a mind of their own.');
        const ds = shell.engine.decisionSummary();
        text('decision-source', ds.source);
        if (shell.world.placement && shell.world.hover) {
            const h = shell.world.hover, valid = shell.engine.canBuild(h.x, h.y,shell.world.placement) && !shell.engine.placementIssue(shell.world.placement,h.x,h.y);
            text('world-context', (valid ? 'Ready to plan' : shell.engine.placementIssue(shell.world.placement,h.x,h.y)||'Choose reachable ground') + ' · tile ' + h.x + ', ' + h.y);
            $('world-context').classList.add('show');
        }
        else {
            $('world-context').classList.remove('show');
        }
        html('wish-panel', wishMarkup());
        for (const k of Object.keys(RES)) {
            text('res-' + k, s.colony.warehouse.inventory[k]||0);
            const resource = $('res-' + k)?.closest('.resource');
            if (resource) {
                resource.classList.toggle('below-target', (s.colony.warehouse.inventory[k]||0) < s.stockTargets[k]);
                resource.title = RES[k].name + ': ' + (s.colony.warehouse.inventory[k]||0) + ' deposited. Carried items are not available to sell.';
            }
        }
        document.querySelectorAll('[data-buddy-name]').forEach(e => { if (e.textContent !== s.name)
            e.textContent = s.name; });
        document.querySelectorAll('[data-pocket]').forEach(e => e.textContent = s.creature.coins);
        text('bond-value', Math.round(s.bond));
        text('bond-title', shell.engine.friendship());
        width('bond-fill', s.bond);
        text('bond-description', s.bond >= 65 ? 'Familiar paws and growing trust. Shared moments and noticed effort deepen this friendship.' : 'Care, shared moments and noticed effort grow trust. Repeat company stays kind, with smaller daily rewards.');
        for (const k of Object.keys(NEEDS)) {
            const v = Math.round(s.needs[k]);
            text('need-' + k + '-value', v + '%');
            width('need-' + k + '-fill', s.needs[k]);
            $('need-' + k).classList.toggle('low', v < 30);
            $('need-' + k + '-meter').setAttribute('aria-valuenow', v);
        }
        const t = s.task;
        let taskText = t ? t.label : s.started ? 'Wondering what comes next…' : 'A new friend. A new beginning.';
        text('task-label', taskText);
        text('task-reason', t ? t.reason : 'I’m taking it all in. What a lovely place to begin.');
        width('task-progress', t ? t.phase === 'walk' ? 0 : t.elapsed / t.duration * 100 : 0);
        text('task-phase', t ? t.phase === 'walk' ? 'On my way · ' + t.path.length + ' steps' : t.kind === 'train' ? 'Making time to learn' : t.kind === 'build' ? 'Turning a plan into a place' : 'My own little decision' : 'Thinking for myself');
        text('task-percent', t && t.phase === 'work' ? Math.round(t.elapsed / t.duration * 100) + '%' : 'Autonomous');
        text('day-label', 'Day ' + s.day);
        text('clock-time', timeLabel(s.hour));
        text('day-phase', s.hour < 6 ? 'Night' : s.hour < 12 ? 'Morning' : s.hour < 17 ? 'Afternoon' : s.hour < 21 ? 'Evening' : 'Night');
        html('clock-icon', `<use href="#i-${s.hour < 6 || s.hour >= 20 ? 'moon' : 'sun'}"/>`);
        html('pause-button', icon(s.paused ? 'play' : 'pause'));
        $('pause-button').title = s.paused ? 'Resume (Space)' : 'Pause (Space)';
        $('pause-button').setAttribute('aria-label', s.paused ? 'Resume' : 'Pause');
        $('pause-button').classList.toggle('active', s.paused);
        document.querySelectorAll('[data-act="speed"]').forEach(b => b.classList.toggle('active', Number(b.dataset.id) === s.speed && !s.paused));
        $('pause-badge').classList.toggle('show', (s.paused || !!ui.modal || !!shell.world.placement) && s.started);
        text('pause-text', ui.modal || shell.world.placement ? 'Planning time · the world is paused' : 'A little pause');
        $('follow-button').classList.toggle('active', s.settings.follow);
        $('focus-select').value = s.focus;
        document.querySelectorAll('[data-allowance]').forEach(e => { if (e !== document.activeElement)
            e.value = s.allowance.limit; });
        document.querySelectorAll('[data-allowance-number]').forEach(e => e.textContent = s.allowance.limit);
        document.querySelectorAll('[data-issued]').forEach(e => e.textContent = s.allowance.given + ' issued today · ' + Math.max(0, s.allowance.limit - s.allowance.given) + ' left within limit.');
        document.querySelectorAll('[data-auto-allowance]').forEach(e => e.checked = s.allowance.auto);
        document.querySelectorAll('[data-topup-label]').forEach(e => { const amt = Math.max(0, Math.min(s.allowance.limit - s.allowance.given, s.player.coins)); e.textContent = amt ? 'Share ' + amt + ' more coins today' : s.allowance.given >= s.allowance.limit ? 'Today’s limit is reached' : 'Your wallet needs coins'; });
        document.querySelectorAll('[data-act="allowance"]').forEach(e => e.disabled = s.allowance.given >= s.allowance.limit || s.player.coins === 0);
        html('story-content', storyMarkup());
        text('order-count', s.orders.length);
        html('orders-list', s.orders.length ? s.orders.map(o => { const issue = shell.engine.orderIssue(o), active = s.task?.orderId === o.id; let sub = issue ? issue.text : active ? (s.task.phase === 'walk' ? 'Heading out: ' : '') + s.task.label : ['build','upgrade'].includes(o.type) && o.paid ? 'Stage '+(o.stage+1)+' · ' + Math.floor(shell.engine.projectProgress(o)*100) + '% overall' : 'Pip will work out the next step'; return `<div class="order-item"><span class="order-icon">${icon(['build','upgrade'].includes(o.type) ? BUILDINGS[o.kind].icon : o.type === 'practice' ? 'book' : o.type === 'explore' ? 'compass' : o.type === 'deliver' ? 'market' : o.type === 'hunt' ? 'paw' : RES[o.resource]?.icon || 'plan')}</span><div class="order-info"><button data-act="order" data-id="${o.id}">${o.priority ? '↑ ' : ''}${esc(shell.engine.orderName(o))}</button><small class="${issue ? 'blocked' : ''}">${esc(sub)}</small></div><button class="order-more" data-act="order" data-id="${o.id}" title="Plan details" aria-label="Details for ${esc(shell.engine.orderName(o))}">${icon('more')}</button></div>`; }).join('') : `<div class="empty-plans">${icon('plan')}<span>No rush. Just possibilities.<br>Place a plan or share a little idea.</span></div>`);
        html('skill-chips', `<span class="skill-chip">${icon('leaf')}Foraging</span><span class="skill-chip">${icon('water')}Water gathering</span>` + Object.keys(s.skills).filter(id => s.skills[id]).slice(0,5).map(id => `<button class="skill-chip" data-act="training" data-id="${id}">${icon(SKILLS[id].icon)}${esc(SKILLS[id].short)}</button>`).join('')+(Object.keys(s.skills).length>5?`<button class="skill-chip" data-act="training">+${Object.keys(s.skills).length-5} more</button>`:''));
        html('journal-preview', s.log.slice(0, 3).map(entry => journalEntry(entry)).join('') || `<p class="empty-plans">Our story is waiting to be written.</p>`);
        if (ui.tab === 'care') {
            text('care-feed-caption', s.inventory.meals > 0 ? '1 warm meal · a full tummy' : '1 berry · a full tummy');
            document.querySelectorAll('[data-act="care"]').forEach(b => { const k = b.dataset.id, wait = Math.max(0, Math.ceil((s.cooldowns[k] || 0) - s.simTime)); const issue = shell.engine.careIssue(k); b.disabled = !!issue; let state = b.querySelector('.action-feedback'); if (!state) {
                state = document.createElement('span');
                state.className = 'action-feedback';
                b.appendChild(state);
            } state.textContent = wait ? 'Ready in ' + wait + 's' : issue ? k === 'feed' && s.needs.food >= 94 ? 'Tummy is full' : k === 'water' && s.needs.water >= 94 ? 'Not thirsty' : k === 'praise' ? 'After recent effort' : k === 'bond' ? 'Care comes first' : 'Satchel needs supplies' : k === 'praise' ? 'A moment to notice' : 'Ready to offer'; b.title = issue || (wait ? 'Enjoying the moment · ' + wait + ' seconds' : k === 'praise' ? 'Notice a recent achievement. Praise works after learning, gathering, crafting or building.' : k === 'feed' ? 'Offer food already carried in this creature’s satchel.' : k === 'water' ? 'Offer water already carried in this creature’s satchel.' : 'Spend time watching the clouds together.'); });
        }
        if (ui.tab !== 'care' && (force || ui.dockSignature !== JSON.stringify([Object.keys(s.skills), s.buildings.map(b => b.kind), s.orders.map(o => o.kind)]))) {
            const scroll = $('dock-body').scrollLeft;
            renderDock();
            $('dock-body').scrollLeft = scroll;
        }
        const pc = $('portrait').getContext('2d');
        pc.clearRect(0, 0, 134, 138);
        pc.imageSmoothingEnabled = false;
        LWArt.pip(pc, 66, 118, 2.6, s.settings.reducedMotion ? 1 : ui.animationTime, shell.engine.mood(), 1, s.task?.kind === 'rest' ? 'rest' : 'idle', false, shell.engine.selected);
        if(!shell.engine.selected)pc.clearRect(0,0,134,138);
        shell.colonyUI.update();
        shell.worldUI.update();shell.buildPanel?.update();
        shell.worldExplorer.update();
        if(shell.tileMenu?.isOpen()){text('world-status-label','Choosing tile action · paused');text('pause-text','Choosing a tile action');$('pause-badge').classList.add('show');}
        shell.villageUI.update();
        syncTimeLabels();
    }
    function journalEntry(e) { return `<article class="journal-entry">${icon(RES[e.icon]?.icon || e.icon)}<div><p>${esc(e.text)}</p><time>Day ${e.day} · ${timeLabel(e.hour)}</time></div></article>`; }
    function processEvents() { const events = shell.engine.drain(); let celebration = false; for (const e of events) {
        if (e.type === 'heart') {
            shell.world.say(e.text, 'heart', e.actorId);
            sound('heart');
        }
        else if (e.type === 'celebrate') {
            shell.world.say(e.text, 'star', e.actorId);
            toast(e.text);
            celebration = true;
        }
        else if (['interaction','roll','transfer','social','return','arrival','building-transfer','production','harvest'].includes(e.type)){
            if(e.type==='interaction'&&['feed','water','bond','praise','soothe','space'].includes(e.kind))shell.worldUI.afterInteraction();
            shell.world.feedbackEvent(e);
            if(['return','arrival'].includes(e.type))toast(e.text);
        }
        else if (e.type === 'notice')
            toast(e.text, true);
    } if (celebration)
        sound('celebrate'); }
    function initializeNeeds(){$('needs-list').innerHTML = Object.entries(NEEDS).map(([id, [name, ic]]) => `<div class="need ${id}" id="need-${id}"><div class="need-label"><span>${icon(ic)}${name}</span><strong id="need-${id}-value">0%</strong></div><div class="meter" role="meter" aria-label="${name}" aria-valuemin="0" aria-valuemax="100" id="need-${id}-meter"><i id="need-${id}-fill"></i></div></div>`).join('');}
    return {storyMarkup,allowanceMarkup,wishMarkup,forecastMarkup,taskETA,costString,renderDock,refreshContentLabels,updateUI,journalEntry,processEvents,initializeNeeds};
 }
 const api={create};root.LWInterfaceStatus=api;
 if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(globalThis);
