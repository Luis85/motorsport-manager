/* Colony presentation: inspection is read-only. Every command carries the current explicit actor. */
(function (root) {
    'use strict';
    const A = root.LWAdventure, R = root.LWRPG, L = root.LW;
    function create(h) {
        const e = h.esc, ic = h.icon, E = () => h.engine(), actor = () => E().selected, view = { panel: null, quest: null, questDetail: false, gearSlot: 'all', stockFilter: 'all', stockSearch: '', pending: null, search: '', preview: null, baseHash: null, newStory: false, filename: '', qty: 1 };
        const btn = (label, act, id = '', cls = '', disabled = false) => `<button class="btn ${cls}" data-act="${act}" data-id="${e(id)}" ${disabled ? 'disabled' : ''}>${label}</button>`;
        const tag = (v, cls = '') => `<span class="cx-tag ${cls}">${e(v)}</span>`;
        const name = id => L.colony.item(id)?.name || id, kg = n => (n / 1000).toFixed(n % 1000 ? 2 : 0) + ' kg', pct = n => Math.round(n * 100) + '%', time = n => Math.ceil(n) + 's';
        const coins = n => n + (n === 1 ? ' coin' : ' coins');
        const cost = obj => Object.entries(obj).filter(([, n]) => n > 0).map(([id, n]) => `${n} ${e(name(id))}`).join(' · ') || 'Nothing needed';
        const bar = (n, cls = '') => `<div class="cx-meter ${cls}"><i style="width:${Math.max(0, Math.min(100, n))}%"></i></div>`;
        const portrait = c => `<canvas class="cx-portrait" width="120" height="130" data-creature-portrait="${c.id}" aria-label="${e(c.name)}’s outfit"></canvas>`;
        const closed = () => !!E().interactionIssue();
        const notice = (msg, cls = '') => `<div class="cx-notice ${cls}">${msg}</div>`;
        function selection() { return `<div class="cx-empty">${ic('paw')}<h3>Who would you like to spend time with?</h3><p>Each creature has their own needs, skills, belongings and intentions. Select one first.</p><div class="cx-choice-row">${E().creatures.map(c => btn(e(c.name), 'cx-select', c.id, 'primary')).join('')}</div></div>`; }
        function title(title, subtitle, kicker = 'LIFE IN LITTLEWILD') { return h.head(title, subtitle, kicker); }
        function wrap(titleText, sub, body) { return title(titleText, sub) + `<div class="modal-body cx-body">${body}</div>` + h.footer(); }
        function status(c) { return c.activeQuest ? c.activeQuest.status === 'returning' ? 'Returning from a quest' : 'Beyond the glade' : c.questPlan ? 'Preparing an adventure' : c.task?.label || 'Taking in the glade'; }
        function loadView(c) {
            const l = E().load(c), next = [1, 2, 3, 6, 10][l.level] * l.liftKg, spare = Math.max(0, next - l.kg);
            return `<div class="cx-load"><div><strong>${kg(l.grams)} <small>carried, including outfit</small></strong>${tag(l.label, l.level >= 2 ? 'warm' : '')}</div><div class="v6-load-bands" role="img" aria-label="${e(l.label)}; ${Math.round(l.move * 100)} percent walking speed">${['Free', 'Light', 'Medium', 'Heavy', 'Extra-heavy'].map((n, i) => `<span class="${i === l.level ? 'current' : ''}">${n}</span>`).join('')}</div><small>${Math.round(l.move * 100)}% walking speed · ${spare.toFixed(1)} kg before ${l.level < 4 ? 'the next load band' : 'the carrying limit'}. Capacity ${l.maximumKg.toFixed(1)} kg. Worn items count once.</small></div>`;
        }
        function hero(c) {
            const p = L.colony.profile(c.personality), a = LWPolicies.attention(E(), c);
            return `<div class="cx-hero v6-hero">${portrait(c)}<div><div class="eyebrow">${e(p.name)}</div><h3>${e(c.name)} <span class="v6-level">Level ${c.creature.level}</span></h3><div class="cx-tags">${tag(a.label, ['need', 'mood', 'blocked'].includes(a.kind) ? 'warm' : '')}${tag(Object.values(c.skills).filter(Boolean).length + ' learned skills')}</div></div><div class="v6-profile-links">${btn('Satchel', 'cx-open', 'satchel', 'small')}${btn('Personality', 'cx-open', 'feelings', 'small')}${btn('Character & rolls', 'cx-open', 'character', 'small')}${btn('Why this?', 'cx-open', 'behavior', 'small')}</div></div>`;
        }
        function community() { const en = E(), s = en.s; return wrap('A home for different little lives.', 'Select a creature to care, teach, equip or suggest a quest.', `<div class="cx-roster-grid">${en.creatures.map(c => `<article class="cx-creature-card ${actor()?.id === c.id ? 'chosen' : ''}">${portrait(c)}<div><div class="cx-tags">${tag(L.colony.profile(c.personality).name)}${tag(c.activeQuest ? 'Away' : 'In the glade')}</div><h3>${e(c.name)}</h3><p>${e(status(c))}</p><small>Food ${Math.round(c.needs.food)} · Water ${Math.round(c.needs.water)} · Energy ${Math.round(c.needs.energy)}</small>${btn(actor()?.id === c.id ? 'Selected' : 'Select ' + e(c.name), 'cx-select', c.id, actor()?.id === c.id ? '' : 'primary')}</div></article>`).join('')}</div><section class="cx-section"><div class="cx-section-head"><div><div class="eyebrow">MAKE ROOM FOR ANOTHER FRIEND</div><h3>A new creature, a new personality.</h3></div>${tag('Next arrival: ' + en.purchasePrice() + ' coins', 'gold')}</div><p>New creatures begin with their own skills, empty satchel and fresh relationships. The next welcome costs progressively more. Your guide wallet has <strong>${s.player.coins} coins</strong>.</p><div class="cx-personality-grid">${A.content.personalities.map(p => `<article class="cx-option"><span class="cx-person-dot" style="background:${p.color}"></span><h4>${e(p.name)}</h4><p>${e(p.description)}</p><small>${p.traits.map(id => e(A.content.traits.find(t => t.id === id)?.name)).join(' · ')}</small>${btn('Welcome · ' + en.purchasePrice() + ' coins', 'cx-purchase', p.id, '', s.player.coins < en.purchasePrice() || en.creatures.length >= A.content.rules.maxCreatures)}</article>`).join('')}</div><p class="cx-fine">This prototype supports ${A.content.rules.maxCreatures} creatures. Welcoming a friend uses in-game coins only.</p></section>`); }
        function dice(r) { return `<div class="cx-roll ${r.success ? 'pass' : 'miss'}"><span class="cx-dice" aria-label="Dice ${r.dice.join(', ')}">${r.dice.map(n => `<b>${['', '⚀', '⚁', '⚂', '⚃', '⚄', '⚅'][n]}</b>`).join('')}</span><div><strong>${e(r.label || r.skill)}</strong><small>${r.total} against ${r.target} · ${e(r.outcome)} · margin ${r.margin >= 0 ? '+' : ''}${r.margin}</small></div></div>`; }
        function questActive(c) { const q = c.activeQuest, percent = q.elapsed / q.duration * 100; return `<section class="cx-quest-active"><div class="eyebrow">${q.status === 'returning' ? 'ON THE WAY HOME' : 'OUT BEYOND THE TREES'}</div><h3>${e(q.name)}</h3><p class="chart-origin">${e(q.islandName||'Mossmeadow')} · Guide Lv. ${q.playerLevel||1} · Creature Lv. ${q.creatureLevel||1}</p><p>${e(c.name)} is absent from the glade. Care, lessons, equipment changes and new orders are unavailable until their return.</p>${bar(percent)}<div class="cx-facts"><span><b>${q.successes} / ${q.required}</b>checks needed</span><span><b>${q.checkIndex} / ${q.checks.length}</b>checkpoints resolved</span><span><b>${time(q.status === 'returning' ? q.returnRemaining : q.duration - q.elapsed + A.content.rules.returnSeconds)}</b>estimated return</span><span><b>${Math.round(q.energySpent)} / ${q.energy}</b>energy spent</span></div><h4>In the expedition satchel</h4><p>${cost(q.found)}. These items are not yet available to sell.</p>${q.rolls.map(dice).join('')}${btn(q.status === 'returning' ? 'Already returning' : 'Recall ' + e(c.name) + ' · ' + A.content.rules.abortEnergy + ' energy', 'cx-recall', '', 'danger', q.status === 'returning')}<small class="cx-block">Recalling keeps finds, spends packed provisions, costs ${A.content.rules.abortEnergy} energy and takes ${A.content.rules.abortReturnSeconds}s to return. No completion reward.</small></section>`; }
        function adventures() {
            const en = E(), c = actor();
            if (!c)
                return wrap('Beyond the glade.', 'Select a companion, prepare, then let them find their way.', selection());
            if(root.LWQuestDestination){view.questIsland=root.LWQuestDestination;Reflect.deleteProperty(root,'LWQuestDestination');view.quest=null;view.questDetail=false;}let body = hero(c);
            if (c.activeQuest)
                body += questActive(c);
            else if (c.questPlan) {
                const q = A.content.quests.find(q => q.id === c.questPlan.questId), r = LWPolicies.questReadiness(en, c, q);
                body += `<section class="cx-quest-active"><div class="eyebrow">PREPARING · STILL IN THE GLADE</div><h3>${e(q.name)}</h3><p class="chart-origin">${e(c.questPlan.islandName||"Mossmeadow")} · Guide Lv. ${c.questPlan.playerLevel||1} · Creature Lv. ${c.questPlan.creatureLevel||1}</p>${en.questPlanIssue(c.questPlan,c)?notice(e(en.questPlanIssue(c.questPlan,c)),"warm"):""}<p>${e(c.name)} keeps essential care first. Requested equipment must be ready before departure.</p><div class="v6-checklist"><div>${r.suppliesReady ? '✓' : '○'} <strong>Pack provisions</strong><span>${r.suppliesReady ? 'All supplies are carried' : r.forecast.missing.map(m => `${e(name(m.id))}: ${m.carried}/${m.need} carried, ${m.stored} stored`).join(' · ')}</span></div><div>${r.outfitReady ? '✓' : '○'} <strong>Finish outfit</strong><span>${r.outfitReady ? 'No outstanding outfit requests' : r.equipment.map(g => `${e(name(g.id))} — ${e(g.text)}`).join(' · ')}</span></div><div>${r.energyReady ? '✓' : '○'} <strong>Rest for the journey</strong><span>${Math.floor(c.needs.energy)} / ${r.energyNeeded} energy needed</span></div><div>${r.loadReady ? '✓' : '○'} <strong>Check carried weight</strong><span>${kg(r.forecast.load.grams)} · ${e(r.forecast.load.label)}</span></div></div><p class="cx-fine">${r.ready ? 'Ready. Close this panel and resume time to watch departure.' : 'Preparation advances in the world, not while this panel is open.'} No provisions are spent until departure.</p><div class="cx-choice-row">${btn('Review equipment', 'cx-open', 'outfit')}${btn('Cancel preparation', 'cx-cancel-quest', '', 'danger')}${btn('Watch in the glade', 'close-modal', '', 'primary')}</div></section>`;
            }
            else {
                const offers = en.s.colony.board.offers.filter(o=>!view.questIsland||o.islandId===view.questIsland);
                if (!offers.some(o => o.id === view.quest))
                    view.quest = offers[0]?.id || null;
                const offer = offers.find(o => o.id === view.quest), q = offer && A.content.quests.find(q => q.id === offer.questId), r = q && LWPolicies.questReadiness(en, c, q), f = r?.forecast;
                body += `<label class="chart-quest-filter">Expedition origin<select id="v11-quest-island"><option value="">Every owned island</option>${en.s.estate.islands.map(i=>{const id=root.LWGeography.key(i.ix,i.iy);return `<option value="${id}" ${view.questIsland===id?'selected':''}>${e(i.name)}</option>`;}).join('')}</select></label><div class="v6-board-meta"><span>${offers.length} opportunities · choose one to review</span><span>Next event check: ${time(Math.max(0, en.s.colony.board.nextAt - en.s.simTime))} of game time</span></div><div class="v6-quest-workspace ${view.questDetail ? 'show-detail' : ''}"><div class="v6-quest-list" aria-label="Quest opportunities">${offers.map(o => { const q = A.content.quests.find(q => q.id === o.questId), f = en.questForecast(q, c); return `<button data-act="cx-review-quest" data-id="${o.id}" class="v6-quest-choice ${view.quest === o.id ? 'selected' : ''}" aria-pressed="${view.quest === o.id}"><span class="eyebrow">${e(o.islandName||q.biome)} · Guide Lv. ${o.playerLevel||q.tier}</span><strong>${e(q.name)}</strong><span>${time(f.duration + A.content.rules.returnSeconds)} away · ${pct(f.chance)} current estimate</span><small>${q.energy} energy · ${q.coins} total coins</small><b>Review preparation →</b></button>`; }).join('') || notice('The trails are quiet. Resume time for new invitations. Cooldowns use game time, never real-world waiting.')}</div>${q ? `<section class="v6-quest-detail"><button class="text-btn v6-back-list" data-act="cx-quest-list">← All opportunities</button><div class="cx-tags">${tag(offer.islandName||q.biome)}${tag("Guide Lv. "+(offer.playerLevel||q.tier))}${tag("Creature Lv. "+(offer.creatureLevel||q.tier))}${tag(f.required + ' of ' + f.checks.length + ' checks')}${tag(pct(f.chance) + ' current estimate', f.chance >= .7 ? 'good' : 'warm')}</div><h3>${e(q.name)}</h3><p>${e(q.description)}</p><div class="v6-quest-stats"><div><small>Time away, including return</small><b>${time(f.duration + A.content.rules.returnSeconds)}</b></div><div><small>Energy cost / departure minimum</small><b>${q.energy} / ${q.energy + 15}</b></div><div><small>Coins on completion</small><b>${q.coins - Math.floor(q.coins * .3)} you · ${Math.floor(q.coins * .3)} ${e(c.name)}</b></div><div><small>Shared research reward</small><b>${q.research} points</b></div></div><div class="v6-provisions"><strong>Provisions spent at departure</strong>${Object.entries(q.cost).map(([id, n]) => `<div><span>${e(name(id))} × ${n}</span><span>${Math.min(n, c.inventory[id] || 0)}/${n} carried · ${en.s.colony.warehouse.inventory[id] || 0} stored</span></div>`).join('')}</div><div class="v6-primary-action">${btn('Prepare ' + e(c.name), 'cx-quest', offer.id, 'primary', !!en.questOfferIssue(offer.id,c))}<small>${en.questOfferIssue(offer.id,c)?e(en.questOfferIssue(offer.id,c)) : r.ready ? 'Ready to depart when time resumes.' : 'Accepts a plan; ' + e(c.name) + ' gathers, fetches, crafts and rests independently.'}</small></div><details><summary>What affects these odds?</summary><p class="cx-fine">Exact 3d6 probabilities at the current targets; not a guarantee. Training, mood, outfit and weight may change before departure. Targets freeze when the journey starts.</p>${f.checks.map(st => `<div class="cx-row"><span>${e(st.name)}<small>${st.base} base ${st.modifiers.map(m => (m.value >= 0 ? '+' : '') + m.value + ' ' + e(m.name)).join(' ')}</small></span><b>${st.target} target · ${pct(st.chance)}</b></div>`).join('')}</details><small class="cx-block">${e(offer.source)} · invitation expires in ${time(Math.max(0, offer.expires - en.s.simTime))} of game time.</small></section>` : ''}</div>`;
            }
            body += `<details class="cx-section v6-history"><summary>Past journeys · ${c.questHistory.length}</summary>${c.questHistory.slice(0, 5).map(q => `<details class="cx-report"><summary><strong>${e(q.name)}</strong>${tag(q.islandName||"Mossmeadow")}${tag(q.outcome)}${tag(q.delivered ? 'Deposited at warehouse' : 'Finds still carried')}</summary><p>${cost(q.found)} · ${q.reward} total coins · ${q.researchReward} research</p>${q.rolls.map(dice).join('')}</details>`).join('') || '<p>No completed journeys yet.</p>'}</details>`;
            return wrap('Beyond the glade.', 'Prepare a companion. Trust their skills. Welcome them home.', body);
        }
        function outfit() {
            const en = E(), c = actor();
            if (!c)
                return wrap('Ready for the world.', 'Equipment is personal. Select its future wearer first.', selection());
            const gear = A.content.equipment.filter(g => view.gearSlot === 'all' || g.slot === view.gearSlot);
            return wrap('Ready for the world.', 'Choose an intention. Your companion fetches or crafts, then puts the item on.', hero(c) + loadView(c) + (c.activeQuest ? notice('Away on a quest. This outfit cannot change until return.', 'warm') : '') + `<div class="cx-slot-grid">${A.slots.map(slot => { const g = L.colony.definition(c.equipment[slot]); return `<section class="cx-slot"><small>${e(slot)}</small><strong>${g ? e(g.name) : 'Nothing worn'}</strong>${g ? btn('Remove', 'cx-unequip', slot, 'small', closed()) : ''}</section>`; }).join('')}</div>${c.equipQueue.length ? `<section class="v6-outfit-queue"><h4>Being prepared · ${c.equipQueue.length} / 4</h4>${c.equipQueue.map(id => { const g = LWPolicies.equipmentStatus(en, c, id); return `<div class="cx-row"><span><strong>${e(name(id))}</strong><small>${e(g.text)}${g.state === 'blocked' ? ' · the quest will wait' : ''}</small></span>${btn('Cancel', 'cx-unqueue', id, 'small', closed())}</div>`; }).join('')}</section>` : ''}<div class="v6-catalog-tools"><label>Equipment slot<select id="cx-gear-slot">${['all', ...A.slots].map(s => `<option value="${s}" ${view.gearSlot === s ? 'selected' : ''}>${s === 'all' ? 'All slots' : s[0].toUpperCase() + s.slice(1)}</option>`).join('')}</select></label><span>${gear.length} pieces · worn equipment stays in its satchel</span></div><div class="cx-equipment-grid cx-gear-grid">${gear.map(g => { const info = LWPolicies.equipmentStatus(en, c, g.id), worn = info.state === 'worn', queued = c.equipQueue.includes(g.id), current = L.colony.definition(c.equipment[g.slot]); return `<article class="cx-option cx-gear-card ${worn ? 'v6-worn' : ''}"><div class="cx-tags">${tag(g.slot)}${tag(kg(g.weight))}${worn ? tag('Worn', 'good') : ''}</div><h4>${e(g.name)}</h4><p>${e(g.description)}</p><div class="cx-bonuses">${Object.entries(g.bonuses).map(([k, n]) => tag((n >= 0 ? '+' : '') + n + ' ' + (L.SKILLS[k]?.short || k), n >= 0 ? 'good' : 'warm')).join('')}${g.travel ? tag('−' + pct(g.travel) + ' quest travel', 'good') : ''}</div><small>${e(info.text)}</small>${current && !worn ? `<small>Replaces ${e(current.name)} · ${g.weight - current.weight >= 0 ? '+' : ''}${((g.weight - current.weight) / 1000).toFixed(2)} kg worn difference; the old piece stays carried until deposited.</small>` : ''}<details><summary>Crafting requirements</summary><small>${cost(g.recipe.cost)}<br>${e(L.BUILDINGS[g.recipe.station].name)} · ${e(L.SKILLS[g.recipe.skill].short)}</small></details>${btn(worn ? 'Worn' : queued ? 'Queued' : info.state === 'carried' ? 'Put on' : info.state === 'workplace' ? 'Collect & put on' : info.state === 'stored' ? 'Fetch & put on' : info.state === 'blocked' ? 'Plan for later' : 'Make & put on', 'cx-equip', g.id, '', closed() || worn || queued || c.equipQueue.length >= 4)}</article>`; }).join('')}</div>`);
        }
        function satchel() {
            const c = actor();
            if (!c)
                return wrap('Only what I carry.', 'Resources stay with their owner until a warehouse visit.', selection());
            return wrap('Only what I carry.', 'Food, materials and equipment must be carried before they can be used.', hero(c) + loadView(c) + notice('The guide cannot move items between inventories. Your creature fetches supplies for needs and plans, and brings surplus or quest finds back to the warehouse.') + `<div class="cx-inventory">${Object.entries(c.inventory).filter(([, n]) => n > 0).map(([id, n]) => `<div class="cx-row"><span><strong>${e(name(id))}</strong><small>${Object.values(c.equipment).includes(id) ? 'Worn · ' : ''}${kg(L.colony.item(id).weight)} each</small></span><b>${n} · ${kg(n * L.colony.item(id).weight)}</b></div>`).join('') || '<p>The satchel is empty. Your creature will gather or visit the warehouse when something is needed.</p>'}</div>${btn('Inspect warehouse', 'cx-open', 'warehouse')}${(c.inventory.wooden_chest || 0) > 0 ? btn('Suggest unpacking chest', 'cx-unpack', '', 'primary', closed()) : ''}`);
        }
        function warehouse() {
            const en = E(), w = en.s.colony.warehouse;
            const rows = [...Object.keys(L.RES), ...A.content.equipment.map(g => g.id), 'wooden_chest'].map(id => LWPolicies.inventoryRow(en, id)).filter(r => r.stored || r.carried || r.atWorkplaces);
            const filtered = rows.filter(r => (!view.stockSearch || r.name.toLowerCase().includes(view.stockSearch.toLowerCase())) && (view.stockFilter === 'carried' ? r.carried > 0 : view.stockFilter === 'stored' ? r.stored > 0 : view.stockFilter === 'workplaces'?r.atWorkplaces>0:true));
            return wrap('Our shared warehouse.', 'List deposited stock for delivery. Creatures carry it to a built market stall before coins are earned.', `<div class="button-row">${en.unlocked('features','trade')?'<button class="btn" data-act="v10-open" data-id="market">Market deliveries & receipts</button>':''}${en.unlocked('features','prestige-shop')?'<button class="btn" data-act="v10-open" data-id="shop">Prestige shop</button>':''}</div><div class="v6-storage-summary"><div><b>${rows.filter(r => r.stored > 0).length}</b><span>stored item types</span></div><div><b>${rows.filter(r => r.carried > 0).length}</b><span>item types in satchels</span></div>${btn('Production book', 'v3-recipes', '', 'primary')}</div>${!en.has('market') ? notice('Build a market before selling. Creatures can still visit the warehouse for supplies.', 'warm') : ''}<div class="v6-catalog-tools"><label>Find an item<input id="cx-stock-search" type="search" value="${e(view.stockSearch || '')}" placeholder="Search stock in all locations"></label><label>Show<select id="cx-stock-filter">${[['all', 'All belongings'], ['stored', 'In warehouse'], ['carried', 'In satchels'], ['workplaces','At workplaces']].map(([id, label]) => `<option value="${id}" ${view.stockFilter === id ? 'selected' : ''}>${label}</option>`).join('')}</select></label><label>Sale quantity<select id="cx-sale-qty">${[1, 5, 10].map(n => `<option ${view.qty === n ? 'selected' : ''}>${n}</option>`).join('')}</select></label></div><div class="cx-table-head"><span>Item & location</span><span>Warehouse</span><span>Sale preview</span></div>${filtered.map(r => `<div class="cx-stock-row"><span><strong>${e(r.name)}</strong><small>${kg(r.weight)} each${r.carried ? ' · ' + r.carriers.map(c => `${e(c.name)} carries ${c.quantity}${c.away ? ' (away)' : ''}`).join('; ') : ' · no carried copies'}</small>${r.atWorkplaces?`<small>${r.workplaces.map(b=>e(b.name)+': '+(b.input?b.input+' input ':'')+(b.output?b.output+' finished ':'')+(b.reserved?b.reserved+' committed':'')).join(' · ')}</small><button class="text-btn" data-act="land-show-building" data-id="${r.workplaces[0].id}">Inspect workplace ↗</button>`:''}</span><span><b>${r.stored}</b><small>available here</small></span>${btn(r.stored < view.qty ? (r.stored ? 'Need ' + view.qty + ' stored' : 'Not deposited') : 'List ' + view.qty + ' · ' + coins(r.price * view.qty), 'cx-sell', r.id, 'small', !en.has('market') || r.stored < view.qty)}</div>`).join('') || notice('No items match this view. Try another filter or clear the search.')}<p class="cx-fine">${filtered.length} item types shown. Listing never credits coins or transfers goods. A creature must collect, deliver and sell at the market stall.</p><details class="cx-section"><summary>At the warehouse door · ${w.transfers.length} recent handovers</summary>${w.transfers.slice(0, 10).map(t => `<div class="cx-row"><span><strong>${e(t.name)} ${t.direction === 'in' ? 'deposited' : 'picked up'}</strong><small>${cost(t.items)}</small></span>${tag(time(en.s.simTime - t.time) + ' ago')}</div>`).join('') || '<p>A handover appears only after a creature arrives.</p>'}</details>${(w.inventory.wooden_chest || 0) > 0 ? btn('Ask selected creature to fetch & unpack chest', 'cx-unpack', '', '', closed()) : ''}`);
        }
        function feelings() {
            const en = E(), c = actor();
            if (!c)
                return wrap('A personality, not a task list.', 'Moods change. Friendships take time.', selection());
            return wrap('A personality, not a task list.', 'Notice the cause. Make room for their response.', hero(c) + `<div class="cx-feeling-grid"><section class="cx-option"><h4>Temper</h4><strong class="cx-big">${Math.round(c.feelings.anger)} / 100</strong>${bar(c.feelings.anger, 'anger')}<p>${c.feelings.anger >= 60 ? 'Angry; slower work and harder checks. Space and essential care help.' : c.feelings.anger >= 30 ? 'Frustrated; give this feeling time and attention.' : 'Settled enough to find their own rhythm.'}</p></section><section class="cx-option"><h4>Company</h4><strong class="cx-big">${Math.round(c.feelings.social)} / 100</strong>${bar(c.feelings.social)}<p>Low company encourages meeting an available friend. Personal needs always come first.</p></section></div><div class="cx-choice-row">${btn('Offer reassurance', 'cx-care', 'soothe', 'primary', closed())}${btn('Give some space', 'cx-care', 'space', '', closed())}${btn('Spend time together', 'cx-care', 'bond', '', closed())}</div><div class="cx-traits">${c.traits.map(id => { const t = A.content.traits.find(t => t.id === id); return `<article class="cx-option"><h4>${e(t.name)}</h4><p>${e(t.description)}</p><small>${Object.entries(t.bonuses).map(([k, v]) => (v > 0 ? '+' : '') + v + ' ' + e(k)).join(' · ')} · anger response ×${t.angerRate} · recovery ×${t.soothing}</small></article>`; }).join('')}</div><section class="cx-section"><h3>What has been on my mind</h3>${c.feelings.causes.map(f => `<div class="cx-row"><span>${e(f.reason)}<small>${Math.max(0, Math.floor(en.s.simTime - f.time))}s ago</small></span>${tag(f.anger === 0 ? 'A small moment' : (f.anger > 0 ? '+' : '') + f.anger + ' temper', f.anger > 0 ? 'warm' : 'good')}</div>`).join('') || '<p>A quiet beginning. Future moments will explain changing feelings here.</p>'}</section><section class="cx-section"><h3>The friends I’m getting to know</h3>${en.creatures.filter(o => o !== c).map(o => { const r = en.relationship(c.id, o.id); return `<article class="cx-relationship"><div><h4>${e(o.name)}</h4><p>${r.meetings ? 'Shared ' + r.meetings + ' moments' : 'We haven’t spent time together yet.'}</p><small>Affinity ${Math.round(r.affinity)} · Trust ${Math.round(r.trust)} · ${o.activeQuest ? 'Away' : e(en.mood(o))}</small>${bar((r.affinity + 100) / 2)}</div>${btn('Suggest time together', 'cx-social', o.id, '', closed() || !!o.activeQuest)}${r.memories.length ? `<p>${e(r.memories[0].text)}</p>` : ''}</article>`; }).join('') || '<p>A second creature opens the possibility of new friendships.</p>'}</section>`);
        }
        function character() {
            const en = E(), c = actor();
            if (!c)
                return wrap('A little character sheet.', 'Learn possibilities, practice skills, and make the rolls your own.', selection());
            return wrap('A little character sheet.', 'A GURPS-inspired 3d6 core, with Littlewild’s own progression and quest rules.', hero(c) + `<div class="cx-attributes">${Object.entries(c.rpg.attributes).map(([id, n]) => `<section><small>${id} · ${{ ST: 'Strength', DX: 'Dexterity', IQ: 'Intelligence', HT: 'Health' }[id]}</small><b>${n}</b>${btn('+1 · ' + (['IQ', 'DX'].includes(id) ? 20 : 10) + ' CP', 'cx-cp', id, 'small', closed() || c.rpg.cp < (['IQ', 'DX'].includes(id) ? 20 : 10))}</section>`).join('')}</div>${notice(`<strong>${c.rpg.cp} unspent character points.</strong> Each new creature level grants ${A.content.rules.cpPerLevel}. Learned skills gain points from practice; researching a lesson is not the same as learning it.`)}<div class="cx-section-head"><h3>Learned skills</h3>${btn('Open learning studio', 'training', '', 'primary')}</div>${Object.keys(c.skills).filter(id => c.skills[id]).map(id => { const r = en.skillRating(id, c), points = c.rpg.points[id] || 1, cost = R.nextCost(points); return `<div class="cx-skill-row"><span><strong>${e(L.SKILLS[id].short)}</strong><small>${r.attribute}/${r.difficulty} · ${points} invested · base ${r.base}${r.modifiers.length ? ' · ' + r.modifiers.map(x => (x.value >= 0 ? '+' : '') + x.value + ' ' + e(x.name)).join(', ') : ''}</small></span><b>${r.target}<small>${pct(r.chance)} at +0</small></b>${btn('Improve · ' + cost + ' CP', 'cx-cp', id, 'small', closed() || c.rpg.cp < cost || points >= 40)}</div>`; }).join('') || '<p>Start with a lesson in the Learning Studio. Basic foraging and finding water are available without tuition.</p>'}<section class="cx-section"><h3>The last rolls, explained</h3><p class="cx-fine">Three dice against an effective target. Low rolls succeed. Gear, traits, fatigue, mood and task difficulty appear in the modifiers. Essential routine acts such as eating, drinking and walking need no uncertainty roll.</p>${c.rpg.rolls.slice(0, 15).map(dice).join('') || '<p>Learning, making and adventures will leave their rolls here.</p>'}</section>`);
        }
        function behavior() {
            const c = actor();
            if (!c)
                return wrap('A mind of my own.', 'A data-driven decision tree, not a list of forced movements.', selection());
            return wrap('A mind of my own.', 'The first available branch becomes an intention; movement and work remain autonomous.', hero(c) + notice(`<strong>${e(c.activeQuest ? 'Away on a quest' : c.behavior.lastAction)}</strong><br>${e(c.activeQuest ? 'World decisions are suspended until return.' : c.task?.reason || 'The tree will be evaluated when this creature is idle.')}`) + `<ol class="cx-tree">${(c.behavior.trace.length ? c.behavior.trace : []).map(n => `<li class="${e(n.status)}"><code>${e(n.id)}</code><span>${e(n.status)}</span></li>`).join('') || '<li>No decision has been evaluated yet. Return to the glade to advance time.</li>'}</ol><details><summary>Extending this behavior tree</summary><p>Export the Adventure Library to edit selector, sequence and cooldown nodes. Action names refer to registered engine handlers, never executable JSON. Essential care must stay the first root branch. New handlers belong in <code>colony.js → handlers()</code>.</p><pre class="cx-json">${e(JSON.stringify(A.content.behaviorTree, null, 2))}</pre></details>${btn('Adventure definitions', 'cx-open', 'adventure-library')}`);
        }
        function library() { return wrap('The living-game library.', 'A separate, versioned JSON pack for your external component tool.', `<div class="cx-library-counts">${[['Equipment', A.content.equipment.length], ['Quest templates', A.content.quests.length], ['Personalities', A.content.personalities.length], ['Traits', A.content.traits.length]].map(([label, n]) => `<section><b>${n}</b><span>${label}</span></section>`).join('')}</div><p>This pack contains equipment and crafting requirements, item weights, quest checkpoints and loot, chest contents, personalities, traits, skill rules, balance settings and the behavior tree. Existing items, buildings and lessons remain in the original Content Library.</p><div class="cx-choice-row">${btn('Export adventure JSON', 'cx-export-pack', '', 'primary')}${btn('Import adventure JSON', 'cx-import-pack')}${btn('Export JSON Schema', 'cx-export-schema')}${btn('Original content library', 'content')}</div>${notice('Imports are validated before review. No current story changes during preview. Applying to a current colony requires no committed work; applying to a new story is an explicit separate choice. Existing carried equipment and active references must remain valid.')}<div class="cx-row"><span>Schema / revision</span><code>${A.content.schemaVersion} / ${e(A.content.revision)}</code></div><div class="cx-row"><span>Definition fingerprint</span><code>${e(A.hash)}</code></div><details><summary>Inspect all definitions</summary><pre class="cx-json">${e(JSON.stringify(A.content, null, 2))}</pre></details><p class="cx-fine">The v11 application uses portable story format 8, embedding base, adventure, world and growth libraries with all creature state. This is an independent prototype, not an official GURPS product or a complete implementation of that ruleset.</p>`); }
        function preview() { const p = view.preview, valid = p?.ok, diff = valid ? A.diff(A.content, p.content) : null; return title('Review the adventure library.', 'Your current colony is still untouched.', 'IMPORT · ' + e(view.filename)) + `<div class="modal-body cx-body">${valid ? `${notice('Validation passed. ' + p.summary.equipment + ' equipment definitions, ' + p.summary.quests + ' quests and ' + p.summary.personalities + ' personalities.', 'good')}<div class="cx-row"><span>Current fingerprint</span><code>${e(A.hash)}</code></div><div class="cx-row"><span>Incoming fingerprint</span><code>${e(A.hashOf(p.content))}</code></div><h3>Changed top-level collections</h3><div class="cx-tags">${Object.keys(p.content).filter(k => JSON.stringify(p.content[k]) !== JSON.stringify(A.content[k])).map(k => tag(k)).join('') || tag('No changes')}</div>${diff?.total ? `<details class="v6-content-diff"><summary>${diff.total} changed fields · inspect before applying</summary>${diff.changes.slice(0, 50).map(d => `<div class="v6-diff-row"><code>${e(d.path)}</code><span><s>${e(String(JSON.stringify(d.before)??'Not present').slice(0, 240))}</s> → <b>${e(String(JSON.stringify(d.after)??'Not present').slice(0, 240))}</b></span></div>`).join('')}${diff.total > 50 ? '<p>Showing the first 50 changes. Use the CLI diff for a structured report.</p>' : ''}</details>` : ''}<label class="cx-check"><input type="checkbox" id="cx-new-story" ${view.newStory ? 'checked' : ''}> Apply to a new story, replacing the current colony</label><p class="cx-fine">Export the current story first. Applying records a local recovery copy when browser storage allows it. No current creature gets free inventory from a definition change.</p>${!view.newStory && LWStory.committed(E()) ? notice('Current-story application is blocked: a creature has committed work. Finish or cancel it, or explicitly choose a new story.', 'warm') : ''}` : notice(e(p?.errors?.join('\n') || 'No valid file.').replace(/\n/g, '<br>'), 'warm')}<div class="cx-choice-row">${btn('Cancel import', 'cx-open', 'adventure-library')}${btn('Export current story', 'export')}${valid ? btn(view.newStory ? 'Replace with a new story' : 'Apply to this colony', 'cx-apply-pack', '', 'primary', (!view.newStory && LWStory.committed(E())) || !diff.total) : ''}</div></div>` + h.footer(); }
        function confirmation() {
            const p = view.pending;
            if (!p)
                return wrap('No action waiting.', 'Return to the glade.', notice('This review has expired.'));
            const en = E(), c = en.creatures.find(c => c.id === p.actorId);
            let titleText = '', body = '', action = 'Confirm';
            if (p.kind === 'sell') {
                const r = LWPolicies.inventoryRow(en, p.id);
                titleText = 'List these goods for the market?';
                action = 'Queue market delivery · ' + p.qty;
                body = `<h3>${e(r.name)} × ${p.qty}</h3><div class="cx-row"><span>Coins after delivery and sale</span><b>+${coins(p.total)}</b></div><div class="cx-row"><span>Unlisted warehouse stock after this order</span><b>${r.stored - p.qty}</b></div><p>${r.carried} carried copies stay with their owners. This listing cannot remove them. No coins are earned now: a creature must collect, carry and sell these goods at the built market stall.</p>${r.food ? notice('This is a care supply. Creatures may need to gather or make more after the sale.', 'warm') : ''}`;
            }
            if (p.kind === 'purchase') {
                titleText = 'Welcome another companion?';
                action = 'Welcome · ' + p.total + ' coins';
                const def = L.colony.profile(p.id);
                body = `<h3>${e(def.name)}</h3><p>${e(def.description)}</p><div class="cx-row"><span>Cost from your wallet</span><b>${p.total} coins</b></div><div class="cx-row"><span>Your remaining coins</span><b>${en.s.player.coins - p.total}</b></div><p>A new companion starts with an empty satchel, independent needs and their own progression. No equipment or supplies are created by recruitment.</p>`;
            }
            if (p.kind === 'recall') {
                titleText = 'Recall ' + e(c?.name || 'this companion') + '?';
                action = 'Recall · ' + A.content.rules.abortEnergy + ' energy';
                body = `<h3>${e(c?.activeQuest?.name || 'This journey')}</h3><p>The companion returns in ${A.content.rules.abortReturnSeconds}s of game time. The recall costs ${A.content.rules.abortEnergy} additional energy.</p>${notice('Finds already gathered are kept. Packed provisions remain spent, and completion rewards are forfeited.', 'warm')}`;
            }
            return title(titleText, 'Nothing changes until you confirm.', 'REVIEW YOUR CHOICE') + `<div class="modal-body cx-body v6-confirm-body">${body}</div>` + h.footer(`<div class="cx-choice-row">${btn('Keep things as they are', 'cx-dismiss-confirm')}${btn(action, 'cx-confirm', '', 'primary')}</div>`);
        }
        function render(panel) {
            if (!actor() && ['training', 'construction', 'plans', 'blueprint-detail', 'recipe', 'building', 'order'].includes(panel))
                return wrap('Choose a creature first.', 'Learning, plans and carried supplies belong to individual creatures.', selection());
            const aliases = { pantry: 'warehouse', market: 'warehouse', decision: 'behavior' };
            panel = aliases[panel] || panel;
            const renders = { community, adventures, outfit, satchel, feelings, character, behavior, warehouse, 'adventure-library': library, 'adventure-review': preview, 'colony-confirm': confirmation };
            if (!renders[panel])
                return null;
            view.panel = panel;
            document.getElementById('modal').classList.add('cx-modal');
            return renders[panel]();
        }
        function paint() {
            document.querySelectorAll('[data-creature-portrait]').forEach(canvas => {
                const c = E().creatures.find(c => c.id === canvas.dataset.creaturePortrait);
                if (!c)
                    return;
                const ctx = canvas.getContext('2d');
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                ctx.imageSmoothingEnabled = false;
                LWArt.pip(ctx, canvas.width / 2, canvas.height - 10, 2.4, 1, E().mood(c), 1, 'idle', false, c);
            });
        }
        const file = document.createElement('input');
        file.type = 'file';
        file.accept = '.json,application/json';
        file.hidden = true;
        file.id = 'cx-content-file';
        document.body.appendChild(file);
        let readToken = 0;
        file.addEventListener('change', async () => {
            const f = file.files[0];
            if (!f)
                return;
            const token = ++readToken;
            try {
                if (f.size > 1500000)
                    throw Error('Adventure files must be smaller than 1.5 MB.');
                const text = await f.text();
                if (token !== readToken)
                    return;
                view.preview = A.validate(A.parse(text));
            }
            catch (error) {
                if(token!==readToken)return;
                view.preview = { ok: false, errors: [error.message] };
            }
            view.filename = f.name;
            view.baseHash = A.hash;
            view.newStory = false;
            file.value = '';
            h.open('adventure-review');
        });
        document.addEventListener('change', ev => {
            if(ev.target.id==='v11-quest-island'){view.questIsland=ev.target.value;view.quest=null;view.questDetail=false;h.redraw();paint();return;}
            if (ev.target.id === 'cx-sale-qty') {
                view.qty = Number(ev.target.value);
                h.redraw();
                paint();
            }
            if (ev.target.id === 'cx-new-story') {
                view.newStory = ev.target.checked;
                h.redraw();
                paint();
            }
        });
        document.addEventListener('input', ev => { if (ev.target.id === 'cx-stock-search') {
            view.stockSearch = ev.target.value;
            h.redraw();
            paint();
        } });
        document.addEventListener('change', ev => {
            if(ev.target.id==='v11-quest-island'){view.questIsland=ev.target.value;view.quest=null;view.questDetail=false;h.redraw();paint();return;}
            if (ev.target.id === 'cx-stock-filter') {
                view.stockFilter = ev.target.value;
                h.redraw();
                paint();
            }
            if (ev.target.id === 'cx-gear-slot') {
                view.gearSlot = ev.target.value;
                h.redraw();
                paint();
            }
            if (ev.target.id === 'cx-active-creature' && ev.target.value) {
                h.result(E().selectCreature(ev.target.value));
                h.redraw();
                paint();
            }
        });
        function action(a, id, b) {
            if (!a.startsWith('cx-') && a !== 'demo-colony')
                return false;
            const en = E();
            try {
                if (a === 'cx-review-quest') {
                    view.quest = id;
                    view.questDetail = true;
                    h.redraw();
                    paint();
                    document.querySelector('.v6-quest-detail h3')?.scrollIntoView({ block: 'nearest' });
                    return true;
                }
                if (a === 'cx-quest-list') {
                    view.questDetail = false;
                    h.redraw();
                    paint();
                    return true;
                }
                if (a === 'cx-dismiss-confirm') {
                    const target = view.pending?.returnPanel || 'community';
                    view.pending = null;
                    h.open(target, null, true);
                    return true;
                }
                if (a === 'cx-confirm') {
                    const p = view.pending;
                    if (!p)
                        throw Error('This review has expired.');
                    if (p.actorId && en.selected?.id !== p.actorId)
                        throw Error('The selected creature changed. Cancel and review again.');
                    let r;
                    if (p.kind === 'sell') {
                        const row = LWPolicies.inventoryRow(en, p.id);
                        if (row.price * p.qty !== p.total)
                            throw Error('The price changed. Review this sale again.');
                        r = en.sellItem(p.id, p.qty);
                    }
                    else if (p.kind === 'purchase') {
                        if (en.purchasePrice() !== p.total)
                            throw Error('The arrival cost changed. Review again.');
                        r = en.purchaseCreature(p.id);
                    }
                    else if (p.kind === 'recall')
                        r = en.abortQuest();
                    if (r) {
                        h.result(r);
                        if (r.ok) {
                            view.pending = null;
                            h.open(p.returnPanel, null, true);
                            h.toast(p.kind === 'sell' ? 'Sale complete · ' + coins(p.total) + ' to your wallet.' : p.kind === 'purchase' ? 'A new companion has arrived. Select a friend before interacting.' : 'Recall confirmed. Resume time for the journey home.');
                        }
                    }
                    return true;
                }
                if (['cx-sell', 'cx-purchase', 'cx-recall'].includes(a)) {
                    const kind = { 'cx-sell': 'sell', 'cx-purchase': 'purchase', 'cx-recall': 'recall' }[a];
                    view.pending = { kind, id, qty: view.qty, total: kind === 'sell' ? LWPolicies.inventoryRow(en, id).price * view.qty : kind === 'purchase' ? en.purchasePrice() : 0, actorId: kind === 'recall' ? en.selected?.id : null, returnPanel: kind === 'sell' ? 'warehouse' : kind === 'purchase' ? 'community' : 'adventures' };
                    h.open('colony-confirm');
                    return true;
                }
                if (a === 'cx-open') {
                    h.open(id);
                    paint();
                    return true;
                }
                if (a === 'cx-select') {
                    h.result(en.selectCreature(id));
                    h.redraw();
                    paint();
                    return true;
                }
                if (a === 'demo-colony') {
                    h.backup();
                    const example = L.createColonyDemo();
                    example.drain();
                    h.setEngine(example);
                    h.close();
                    h.save();
                    h.toast('Three independent lives. Select a creature to begin.');
                    return true;
                }
                if (a === 'cx-export-pack') {
                    LWFiles.downloadJSON(A.content, 'littlewild-adventure-library.json');
                    h.toast('Adventure definitions exported, without creature progress.');
                    return true;
                }
                if (a === 'cx-export-schema') {
                    LWFiles.downloadJSON(LWAdventureSchema, 'littlewild-adventure.schema.json');
                    return true;
                }
                if (a === 'cx-import-pack') {
                    file.click();
                    return true;
                }
                if (a === 'cx-apply-pack') {
                    if (view.baseHash !== A.hash)
                        throw Error('The active library changed. Import again.');
                    h.backup();
                    if (!view.preview?.ok || !A.diff(A.content, view.preview.content).total)
                        throw Error('There are no definition changes to apply.');
                    const next = LWStory.applyAdventure(view.preview.content, en, view.newStory);
                    h.setEngine(next);
                    h.save();
                    h.open('adventure-library');
                    h.toast('Adventure definitions applied.');
                    paint();
                    return true;
                }
                let r;
                if (a === 'cx-equip')
                    r = en.requestEquipment(id);
                else if (a === 'cx-unequip')
                    r = en.unequip(id);
                else if (a === 'cx-unqueue')
                    r = en.cancelEquipment(id);
                else if (a === 'cx-quest')
                    r = en.acceptQuest(id);
                else if (a === 'cx-cancel-quest')
                    r = en.cancelQuestPlan();
                else if (a === 'cx-care')
                    r = en.care(id);
                else if (a === 'cx-social')
                    r = en.suggestSocial(id);
                else if (a === 'cx-cp')
                    r = en.spendPoint(id);
                else if (a === 'cx-unpack')
                    r = en.requestUnpack();
                if (r) {
                    h.result(r);
                    if (r.ok && a === 'cx-care')
                        h.close();
                    else {
                        h.redraw();
                        paint();
                    }
                }
            }
            catch (error) {
                h.toast(error.message, true);
            }
            return true;
        }
        function update() {
            const en = E(), c = actor(), s = en.s, roster = document.getElementById('creature-roster');
            // Stable keyed controls: changes to a mood or load cannot remove a focused button.
            for (const o of en.creatures) {
                let button = roster.querySelector(`[data-id="${o.id}"]`);
                if (!button) {
                    button = document.createElement('button');
                    button.dataset.act = 'cx-select';
                    button.dataset.id = o.id;
                    button.innerHTML = '<span class="cx-dot"></span><span><strong></strong><small></small></span>';
                    roster.appendChild(button);
                }
                const attention = LWPolicies.attention(en, o);
                button.className = 'cx-roster-button' + (c?.id === o.id ? ' selected' : '') + (o.activeQuest ? ' away' : '');
                button.setAttribute('aria-pressed', String(c?.id === o.id));
                button.title = o.name + ' · ' + status(o);
                button.querySelector('.cx-dot').style.background = L.colony.profile(o.personality).color;
                button.querySelector('strong').textContent = o.name;
                button.querySelector('small').textContent = attention.label + ' · Lv. ' + o.creature.level;
                button.dataset.attention = attention.kind;
            }
            for (const b of [...roster.children])
                if (!en.creatures.some(c => c.id === b.dataset.id))
                    b.remove();
            const htmlIfChanged = (id, markup) => { const el = document.getElementById(id); if (el && el.innerHTML !== markup)
                el.innerHTML = markup; };
            document.body.classList.toggle('cx-unselected', !c);
            document.body.classList.toggle('cx-away', !!c?.activeQuest);
            document.getElementById('selection-label').textContent = c ? c.name + ' · ' + status(c) : 'Select a friend before interacting.';
            const mini = document.getElementById('cx-character-summary');
            if (c) {
                if (!mini.querySelector('#v6-load-summary'))
                    mini.innerHTML = `<div class="cx-mini-row"><span id="v6-load-summary" class="cx-tag"></span><span id="v6-cp-summary" class="cx-tag"></span><span id="v6-temper-summary" class="cx-tag"></span></div><div class="cx-mini-actions">${btn('Outfit', 'cx-open', 'outfit', 'small')}${btn('Satchel', 'cx-open', 'satchel', 'small')}${btn('Personality', 'cx-open', 'feelings', 'small')}</div>`;
                const l = en.load(c);
                document.getElementById('v6-load-summary').textContent = kg(l.grams) + ' · ' + l.label;
                document.getElementById('v6-cp-summary').textContent = c.rpg.cp + ' CP';
                document.getElementById('v6-temper-summary').textContent = Math.round(c.feelings.anger) + ' anger';
            }
            else
                htmlIfChanged('cx-character-summary', notice('Choose a friend in the roster. Their needs, plans and belongings will appear here.'));
            const pocketLabel = document.querySelector('.stat-pod.pocket small');
            if (pocketLabel)
                pocketLabel.textContent = c ? c.name + '’s coins' : 'Choose a creature';
            if (!c)
                document.getElementById('header-pocket').textContent = '—';
            document.getElementById('wish-panel')?.setAttribute('aria-label', c ? c.name + '’s small wish' : 'Select a creature to see their wish');
            document.getElementById('portrait')?.setAttribute('aria-label', c ? c.name + ' and their worn equipment' : 'No creature selected');
            const sub = document.querySelector('.buddy-sub');
            if (sub)
                sub.textContent = c ? L.colony.profile(c.personality).name : 'Each companion has a life of their own';
            if (c?.activeQuest) {
                const q = c.activeQuest;
                document.getElementById('task-label').textContent = q.status === 'returning' ? 'On the way home' : 'Beyond the glade';
                document.getElementById('task-reason').textContent = q.name + ' · ' + time(q.status === 'returning' ? q.returnRemaining : q.duration - q.elapsed + A.content.rules.returnSeconds) + ' until return. Only recall is available while away.';
                document.getElementById('task-phase').textContent = q.status === 'returning' ? 'Return journey' : 'Quest in progress';
                document.getElementById('task-percent').textContent = pct(q.elapsed / q.duration);
                document.getElementById('task-progress').style.width = pct(q.elapsed / q.duration);
            }
            if (!c) {
                document.querySelectorAll('[data-buddy-name]').forEach(el => el.textContent = 'Choose a friend');
                document.getElementById('task-label').textContent = 'Several lives, one shared home';
                document.getElementById('task-reason').textContent = 'Select a companion to understand their next step.';
                document.getElementById('mini-mood').textContent = en.creatures.length + ' independent creatures';
            }
            const forbidden = !c || !!c.activeQuest;
            document.querySelectorAll('#focus-select,[data-allowance],[data-auto-allowance],[data-act="allowance"],[data-act="rename"],[data-act="blueprint"],[data-act="request"]').forEach(el => { if (forbidden)
                el.disabled = true;
            else if (el.matches('#focus-select,[data-allowance],[data-auto-allowance],[data-act="rename"],[data-act="request"]'))
                el.disabled = false; });
            const gate = document.getElementById('cx-interaction-gate');
            gate.hidden = !forbidden;
            htmlIfChanged('cx-interaction-gate', !c ? `Choose a companion in the roster to interact. ${btn('Our creatures', 'cx-open', 'community', 'small')}` : `${e(c.name)} is away. ${btn('View quest / recall', 'cx-open', 'adventures', 'small')}`);
            const feedback = document.getElementById('cx-roll-feedback');
            // Keep the detailed record, but do not pin an old roll above the care actions forever.
            if (c?.lastRoll && s.simTime - c.lastRoll.time < 12) {
                const r = c.lastRoll;
                htmlIfChanged('cx-roll-feedback', `${ic('star')}<span><strong>${e(r.label)}</strong><small>${r.dice.join(' + ')} = ${r.total} / target ${r.target} · ${e(r.outcome)}</small></span>${btn('Explain', 'cx-open', 'character', 'small')}`);
                feedback.hidden = false;
            }
            else
                feedback.hidden = true;
        }
        return { render, action, update, paint, cancelRead(){readToken++;file.value='';} };
    }
    root.LWColonyUI = { create };
})(window);
