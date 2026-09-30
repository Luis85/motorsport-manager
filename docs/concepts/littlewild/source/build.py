"""Build one offline HTML file with Python's standard library only."""
from pathlib import Path
import json
import argparse
import subprocess

ROOT = Path(__file__).resolve().parent
INSERTS = (
    ('STYLE', 'style.css', 'style'),
    ('POLISH', 'polish.css', 'style'),
    ('COLONY_CSS', 'colony.css', 'style'),
    ('REFINEMENT', 'refinement.css', 'style'),
    ('WORLD_UI_CSS', 'world-ui.css', 'style'),
    ('CONTENT_RUNTIME', 'content-runtime.js', 'script'),
    ('WORLD_PROFILE', 'world-profile.js', 'script'),
    ('GEOGRAPHY', 'island-geometry.js', 'script'),
    ('NAVIGATION', 'navigation.js', 'script'),
    ('ENGINE', 'engine.js', 'script'),
    ('SYSTEMS', 'systems.js', 'script'),
    ('RPG', 'rpg.js', 'script'),
    ('BEHAVIOR', 'behavior-tree.js', 'script'),
    ('ADVENTURE', 'adventure-content.js', 'script'),
    ('POLICIES', 'colony-policies.js', 'script'),
    ('ECS', 'ecs.js', 'script'),
    ('ACTOR_SYSTEMS', 'actor-systems.js', 'script'),
    ('COLONY', 'colony.js', 'script'),
    ('WORLD_CONTENT', 'world-content.js', 'script'),
    ('WORLD_INTEGRITY', 'world-integrity.js', 'script'),
    ('WORLD_SIMULATION', 'world-simulation.js', 'script'),
    ('GROWTH_CONTENT', 'growth-content.js', 'script'),
    ('VILLAGE_SYSTEMS', 'village-systems.js', 'script'),
    ('VILLAGE_VALIDATION', 'validation-village.js', 'script'),
    ('PLANNER', 'planner.js', 'script'),
    ('CARTOGRAPHY', 'cartography.js', 'script'),
    ('WORLD_EXPLORER', 'world-explorer.js', 'script'),
    ('WORLD_EXPLORER_CSS', 'world-explorer.css', 'style'),
    ('STORY', 'story-codec.js', 'script'),
    ('SCENARIO_SHAPE', 'scenario-shape.js', 'script'),
    ('SCENARIOS', 'scenario-runtime.js', 'script'),
    ('SCENARIO_STORY', 'scenario-story.js', 'script'),
    ('STORAGE', 'story-storage.js', 'script'),
    ('FILES', 'file-io.js', 'script'),
    ('WORLD', 'world.js', 'script'),
    ('PROGRESSION_UI', 'progression-ui.js', 'script'),
    ('CONTENT_UI', 'content-ui.js', 'script'),
    ('COLONY_UI', 'colony-ui.js', 'script'),
    ('CLOCK', 'simulation-clock.js', 'script'),
    ('INTERFACE_PAUSE', 'interface-pause.js', 'script'),
    ('V13_CSS', 'v13.css', 'style'),
    ('WORLD_LAYOUT', 'world-layout.js', 'script'),
    ('WORLD_UI', 'world-ui.js', 'script'),
    ('QUALITY_CSS', 'quality.css', 'style'),
    ('THREE', '../vendor/three.js', 'script'),
    ('SOFTWARE_3D', 'software-3d.js', 'script'),
    ('WORLD_INPUT', 'world-input.js', 'script'),
    ('FIDELITY', 'world-fidelity.js', 'script'),
    ('PRESENTATION', 'world-presentation.js', 'script'),
    ('WORLD_3D', 'world-3d.js', 'script'),
    ('TILE_CONTEXT', 'tile-context.js', 'script'),
    ('V12_CSS', 'v12.css', 'style'),
    ('VILLAGE_CSS', 'village.css', 'style'),
    ('CARTOGRAPHY_CSS', 'cartography.css', 'style'),
    ('VILLAGE_UI', 'village-ui.js', 'script'),
    ('V14_CSS', 'v14.css', 'style'),
    ('BUILD_PANEL', 'build-panel.js', 'script'),
    ('GUIDE_PANEL', 'guide-panel.js', 'script'),
    ('SCENARIO_UI', 'scenario-ui.js', 'script'),
    ('V15_CSS', 'v15.css', 'style'),
    ('UI', 'ui.js', 'script'),
)

def build(pack_path: Path | None = None, output_path: Path | None = None) -> Path:
    """Validate source insertion points and produce the standalone artifact."""
    if pack_path is not None:
        subprocess.run(['node', str(ROOT/'tools/scenario-cli.cjs'), 'validate', str(pack_path.resolve())], check=True, timeout=60)
    html = (ROOT / 'index.html').read_text(encoding='utf-8')
    data = 'window.LWDefaultLibrary = ' + json.dumps(json.loads((ROOT/'content/default-library.json').read_text()), ensure_ascii=False) + ';\nwindow.LWContentSchema = ' + json.dumps(json.loads((ROOT/'content/library.schema.json').read_text()), ensure_ascii=False) + ';'
    data += '\nwindow.LWDefaultAdventure = ' + json.dumps(json.loads((ROOT/'content/adventure-library.json').read_text()), ensure_ascii=False) + ';'
    data += '\nwindow.LWAdventureSchema = ' + json.dumps(json.loads((ROOT/'content/adventure.schema.json').read_text()), ensure_ascii=False) + ';'
    data += '\nwindow.LWDefaultWorld = ' + json.dumps(json.loads((ROOT/'content/world-library.json').read_text()), ensure_ascii=False) + ';'
    data += '\nwindow.LWWorldSchema = ' + json.dumps(json.loads((ROOT/'content/world.schema.json').read_text()), ensure_ascii=False) + ';'
    data += '\nwindow.LWDefaultGrowth = ' + json.dumps(json.loads((ROOT/'content/growth-library.json').read_text()), ensure_ascii=False) + ';'
    data += '\nwindow.LWGrowthSchema = ' + json.dumps(json.loads((ROOT/'content/growth.schema.json').read_text()), ensure_ascii=False) + ';'
    data += '\nwindow.LWActorModel = ' + json.dumps(json.loads((ROOT/'content/actor-model.json').read_text()), ensure_ascii=False) + ';'
    for variable, filename in [('LWDefaultProfile','default-profile.json'),('LWScenarioSchema','scenario.schema.json')]:
        data += '\nwindow.' + variable + ' = ' + json.dumps(json.loads((ROOT/'content'/filename).read_text()), ensure_ascii=False) + ';'
    packs = [json.loads(pack_path.read_text())] if pack_path else [json.loads((ROOT/'content'/f).read_text()) for f in ['littlewild.pack.json','emberworks.pack.json']]
    data += '\nwindow.LWScenarioPacks = ' + json.dumps(packs, ensure_ascii=False) + ';'
    data = data.replace('<', '\\u003c').replace('>', '\\u003e').replace('&', '\\u0026')
    marker = '<!-- INLINE_CONTENT_DATA -->'
    if html.count(marker) != 1:
        raise ValueError('Missing unique content-data insertion point')
    html = html.replace(marker, '<script>\n' + data + '\n</script>')
    for name, filename, tag in INSERTS:
        marker = '<!-- INLINE_' + name + ' -->'
        if html.count(marker) != 1:
            raise ValueError(f'Expected exactly one {marker} insertion point.')
        content = (ROOT / filename).read_text(encoding='utf-8')
        if f'</{tag}' in content.lower():
            raise ValueError(f'{filename} contains an unsafe inline closing tag.')
        html = html.replace(marker, f'<{tag}>\n{content}\n</{tag}>')
    output = output_path or ROOT.parent / 'littlewild.html'
    output.write_text(html, encoding='utf-8', newline='\n')
    return output

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--pack', type=Path, help='Use one validated external scenario pack')
    parser.add_argument('--output', type=Path, help='Output standalone HTML path')
    args = parser.parse_args()
    artifact = build(args.pack, args.output)
    print(f'Built {artifact} ({artifact.stat().st_size:,} bytes)')
