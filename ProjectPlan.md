## Overview
- Xenogerm planner for RimWorld Biology: pick a germline, add xenogenes, and see the combined gene set with conflicts resolved.
- Gene and germline data load on startup from `src/data/genes.json` and `src/data/germlines.json`.

## Core Workflow
- Germline selection is optional
- Available Genes list shows every gene with name, complexity, efficiency, image (if present), archite styling when `capsules` is set, and status tags.
- Clicking a gene from the available genes list toggles it in the resulting xenogerm display
- Search box filters genes by case-insensitive substring.
- Resulting Xenogerm view merges germline genes (first) and selected xenogenes (order preserved by selection/reorder), showing suppressed/override badges.
- Xenogenes can be reordered via right-click drag; drop target highlights where the gene will land.
- Empty state prompts when no germline/genes are selected.

## Conflict & Override Logic
- Gene conflicts are determined by any two genes sharing an entry in their `conflicts` array.
- Germline suppression: any selected xenogene that conflicts with a germline gene suppresses that germline gene.
- Xenogene conflicts: selected xenogenes sharing conflict categories form groups; each group picks a winner by higher efficiency, breaking ties by later selection order.
- Overrides: group winners are overrides; xenogenes that suppress germline genes are also overrides unless they lost a xeno conflict (in which case they themselves are overridden).
- Suppressed/conflicted genes stay visible but are marked inactive and don't contribute to the resulting totals.

## Totals & Compatibility
- Active genes = unsuppressed germline genes + selected xenogenes that aren’t losing conflicts.
- Xenogerm efficiency is summed over active xenogenes only.
- Final efficiency, as well as complexity, are summed over active genes (both germline and xenogenes)
- Compatibility rule: final efficiency must be ≥ -5 to be implantable; xenogerm efficiency warning when < -5.
- Stats panel shows xenogerm efficiency, final efficiency, complexity, and an implantation status banner.

## Saving & Persistence
- LocalStorage key `savedXenogerms` stores saved builds; reads/writes are guarded to fail silently if unavailable.
- Entering a name creates/renames the current build and auto-saves selected genes; IDs are slug + timestamp.
- Saved list of xenogerms is alphabetized, shows gene counts, supports load, delete, and “Start from scratch” (clears selection/current ID).
- Current saved build badge shows “Delete current”; hint displays auto-save status with current gene count.

## Undo/Redo & Shortcuts
- Selection history (max 50) records toggles, reorders, and loads so undo/redo returns to prior selections.
- Buttons in Resulting Xenogerm plus hotkeys: Cmd/Ctrl+Z (undo), Cmd/Ctrl+Shift+Z or Cmd/Ctrl+Y (redo); shortcuts ignored while typing.
