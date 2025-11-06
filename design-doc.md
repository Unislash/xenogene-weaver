
# RimWorld Xenogerm Planner – Design Document

## 1. Overview

The Xenogerm Planner is a frontend-only web application for Rimworld players that enables them to experiment with combining genes into custom xenogerms. It visualizes gene interactions, calculates efficiency and xenogerm complexity in real-time, and displays suppression effects between xenogenes and germline genes.

----------

## 2. Goals

-   **Primary:** Allow users to combine genes and instantly see the resulting efficiency, complexity, and suppressed genes.
    
-   **Secondary:** Provide an intuitive, visually engaging dark-themed UI with clear feedback and smooth interactions.
    

----------

## 3. Technical Stack

Layer

Technology

Purpose

UI

React (TypeScript)

Component-driven view layer

State

Zustand

Predictable, fast, and minimal global state management

Build

Rspack

Fast, Rust-based bundler optimized for incremental rebuilds

Tests

Vitest

Unit testing

----------

## 4. Core Features

### 4.1 Gene Management

-   Load gene data (JSON) with efficiency and complexity deltas (json is shipped with the tool; users will not provide it).
    
-   Select xenogenes and germline genes.
    
-   Visualize suppressed germline genes in real-time.
    

### 4.2 Calculations

-   **Efficiency:** Sum of `efficiency` across all _active_ genes.
    
-   **Complexity:** Sum of `complexity` across all _active_ genes.
    
-   **Suppression:** Germline genes suppressed by selected genes are inactive.
    
-   Conflicting genes: Selected genes can be incompatible with other genes that have not been selected (yet); ie: "Awful with Animals" conflicts with "Poor with Animals" and "Great with Animals"
    

### 4.3 Compatibility Logic

-   A xenogerm is **compatible** if resulting combined xenogerm genes and germline genes have a total `efficiency > -5`.
    
-   UI shows real-time status: _Compatible_, or _Incompatible_.
    

----------

## 5. State Design

```
interface Gene {
  id: string;
  name: string;
  efficiency: number;
  complexity: number;
  conflicts?: string[]; // gene IDs
}

interface BuildState {
  genesById: Record<string, Gene>;
  selectedXeno: Set<string>;
  selectedGermline: Set<string>;
  suppressedGermline: Set<string>;
  totals: { efficiency: number; complexity: number };
  compatibleXenogerm: boolean;
}
```

**Key concept:** Derived data (like suppression and totals) recomputed synchronously inside the toggle action for instantaneous feedback.

----------

## 6. UI & UX

### 6.1 Palette

Token

Hex

Description

`--bg-app`

#0B0E12

Primary background (very dark, bluish gray)

`--bg-grid`

#121417

Slightly lighter dark gray

`--tile-default`

#1E2227

Default gene tile

`--germline-selected`

#2F2A66

Selected germline gene

`--suppressed-overlay`

rgba(70,61,122,0.6)

Overlay for suppressed germlines

`--accent-outline`

#6C63FF

Xenogene accent border

`--text`

#E6E8EB

Main text color

`--warning`

#FFB02E

Near-limit efficiency

`--error`

#FF5D5D

Incompatible state

`--good`

#42D392

Compatible state

### 6.2 Layout

-   Top row: Germline selector on the left; efficiency and complexity on the right
    
-   **Available Genes Grid:** Grid of all available genes in the game.
    
-   Selected Xenogerm Grid: Grid of the selected genes
    
-   Compatibility rating: Is the xenogerm compatible with the metabolic efficiency rules?
    

### 6.3 Interactions

-   Select germline -> available genes grid indicates which genes are in the germline
    
-   Click gene → selects the gene for the xenogerm; gene shows up int he xenogerm grid and gets highlighted in the available genes grid.
    
-   Suppressed genes → when a gene is selected that suppresses other genes, those genes get an opacity applied and show "suppressed" as a tooltip on hover
    

----------

## 7. Testing Strategy

-   **Unit Tests:**
    
    -   Efficiency/complexity calculations
        
    -   Suppression resolution (single/multiple suppressors)
        
    -   Boundary condition: efficiency == -5 (incompatible)
        

----------

## 8. Future Enhancements

-   Shareable URLs (encoded state).
    
-   Responsive mobile layout.