# VEXORA asset credits and integration notes

VEXORA uses original procedural meshes and procedural canvas textures for its town and humanoid prototypes. It also loads one optional animated companion model at runtime:

- **Corgi** from Gobkit Free Animal Pack: https://gobkit.com/freebies/animal/Corgi.glb
- **License:** CC0 1.0, as stated in the Gobkit public asset manifest: https://gobkit.com/api/free
- **Animation timeline:** 24 fps; idle frames 0–29, walk frames 90–119. The game slices these clips with Three.js AnimationUtils.

The companion is an optional external prototype dependency. If the remote asset fails to load, the rest of the world remains playable. For production, vendor the permitted model into the repository and pin a copy/version rather than hotlinking it.

## Human character asset pipeline candidates

- Quaternius Universal Base Characters: https://quaternius.com/packs/universalbasecharacters.html
- Quaternius Universal Animation Library: https://quaternius.com/packs/universalanimationlibrary.html
- Quaternius Universal Animation Library 2: https://quaternius.com/packs/universalanimationlibrary2.html
- Current Quaternius asset terms: https://quaternius.com/license.html

These packs describe rigged humanoids and retargetable animations. Their pages state CC0 for the packs; check the exact pack/version terms at acquisition. The current QAL license is not permission to redistribute the raw assets as a standalone asset pack. Integrate assets into the playable game, retain provenance and do not claim authorship.

## Roblox assets

VEXORA should not scrape or redistribute Roblox marketplace/catalog assets or Roblox-owned character models unless the specific item has an explicit license granting that use. "Available on Roblox" does not mean open source. VEXORA uses original code and properly licensed third-party assets instead.

## Next production asset step

Download the free glTF/GLB human base characters and animation clips, import them into `public/assets/characters` and `public/assets/animations`, validate the skeleton and clip retargeting in a local build, then bundle them with the game so gameplay does not depend on third-party runtime hosting.

## Models now used by the live world scene

The current Three.js scene loads these real GLB environment models from the CC0 pack listed above:

- Kenney City Kit Suburban: building types A–K (modelled building exteriors).
- Quaternius / Poly Pizza Stylized Nature GLTF: Tree, Pine, Twisted Tree and Dead Tree.
- Model loader normalizes model height, enables shadows, caches loaded source scenes and clones them for repeated placements.
- Source repository: https://github.com/petroulacl/fps-buildings-env-kit
- Runtime asset origin: https://raw.githubusercontent.com/petroulacl/fps-buildings-env-kit/main/

These models replace the previous large coloured box building placeholders and primitive tree trunks/crowns. They are streamed from the asset source, not copied into this repository yet. For production reliability, download only the selected GLBs and required textures, verify their pack-level attribution/CC0 notices, vendor them under `public/assets`, and pin a source commit.
