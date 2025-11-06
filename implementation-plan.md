
# RimWorld Xenogerm Planner – Detailed Implementation Plan

This document expands upon the design doc and identifies all required **business logic**, interaction rules, and data-processing responsibilities needed to implement the Xenogerm Planner.

----------

## 1. Core Logical Domains

The system logic can be divided into five primary domains:

1.  **Gene Catalog Management** – loading, parsing, and maintaining canonical gene data.
    
2.  **Selection State Management** – user selection of xenogenes and germline genes.
    
3.  **Suppression and Conflict Resolution** – calculating which genes are inactive due to suppression or conflicts.
    
4.  **Calculation Engine** – deriving efficiency, complexity, and compatibility from the active gene set.
    
5.  **Feedback and Validation Layer** – updating the UI with user-facing messages and enforcing business rules.
    

----------

## 2. Gene Catalog Management

### 2.1 Data Structure

-   Each gene includes the following fields:
    
    -   `id`: unique string identifier
        
    -   `name`: display name
        
    -   `efficiency`: numeric delta applied to total efficiency
        
    -   `complexity`: numeric delta applied to total complexity
        
    -   `conflicts`: array of gene IDs incompatible with this gene
        

### 2.2 Responsibilities

-   Load once at app start from embedded JSON.
    
-   Provide lookup utilities:
    
    -   `getGene(id)` – returns full gene object.
        
    -   `getConflicts(id)` – returns all conflicts for a given gene.
        

----------

## 3. Selection State Management

### 3.1 Core Data

-   `selectedGenes`: set of selected gene IDs.
    
-   `selectedGermline`: set of germline IDs.
    

### 3.2 Business Logic

-   When a gene tile is clicked:
    
    -   If it is already selected → deselect it.
        
    -   If not selected → add to its appropriate set.
        
-   After any change:
    
    -   Trigger recomputation of suppression, conflicts, efficiency, and complexity totals.
        

### 3.3 Derived Sets

-   `suppressedGermline`: subset of genes in the selected germline that conflicts with the selected genes.
    
-   `conflictedGenes`: any genes (selected or available) that cannot coexist with the active set.
    
-   `activeGermline`: selected germline minus conflicted genes.
    
-   `activeGenes`: union of active germline and selected xenogenes.
    

----------

## 4. Suppression and Conflict Resolution

### 4.1 Conflict Rules

-   A conflict occurs when one gene lists the other in its `conflicts` array.
    
-   Although both suppression and conflicts both use the "conflicts" list, conflicts only apply to the available genes and selected genes. That is to say, conflicts applying to genes in the selected germline are referred to as "Suppression", not "Conflicting".
    
-   If a newly selected gene conflicts with any active gene, the new active gene is unselected and is highlighted in the warning color for a few moments.
    
-   Multiple xenogenes conflicting with the same gene should stack logically (once conflicted, always conflicted until all conflicts are removed).
    
-   Conflicts are recalculated every time the selected xenogene set changes.
    

### 4.2 Suppression Rules

-   Suppression rules are basically the same thing as conflict rules, except it only applies to genes in the selected germline
    
-   A germline gene becomes **inactive** if any selected xenogene lists it in its `conflicts` array.
    

### 4.3 Resolution Algorithm

1.  Compute all suppression relationships for current xenogene selections.
    
2.  Mark suppressed germlines as inactive by having less opacity.
    
3.  Compute conflicts among all currently selected genes.
    
4.  Mark conflicting genes as unavailable by having less opacity.
    
5.  Produce derived lists for rendering: `active`, `conflicted`.
    

----------

## 5. Calculation Engine

### 5.1 Efficiency Calculation

-   Efficiency is the **sum of all active gene efficiency stats**.
    
-   Suppressed and conflicted genes are excluded from calculation.
    

### 5.2 Complexity Calculation

-   Complexity is the **sum of all active gene complexity stats**.
    

### 5.3 Compatibility Rule

-   The resulting xenogerm build is **compatible** if `efficiency >= -5`.
    
-   When efficiency equals or drops below -5, mark build as **incompatible**.
    

### 5.4 Derived Totals Object

```
{
  efficiency: number,
  complexity: number,
  compatible: boolean,
}
```

----------

## 6. Feedback and Validation Layer

### 6.1 Real-Time Updates

-   UI must calculate efficiency and complexity immediately after every toggle.
    
-   Compatibility text update based on total efficiency.
    

### 6.2 Visual Feedback Rules

State

Visual cue

Active gene

Default tile background

Selected germline

Indigo background

Suppressed

Opacity applied

Conflicted

Opacity applied

----------

## 8. Testing Requirements

### 8.1 Unit Tests

-   Verify suppression logic: multiple suppressors, removal restores activity.
    
-   Verify conflict detection: symmetric/asymmetric listings.
    
-   Efficiency and complexity totals recomputed accurately after state mutations.
    
-   Boundary test: efficiency == -5 → incompatible.
    

### 8.2 Property Tests

-   No suppressed gene remains counted in totals.