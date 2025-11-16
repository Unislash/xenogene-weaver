import { Gene } from '../types';

export function genesConflict(a?: Gene, b?: Gene): boolean {
  if (!a || !b) return false;
  const categoriesA = a.conflicts;
  const categoriesB = b.conflicts;
  if (!categoriesA?.length || !categoriesB?.length) return false;
  const setA = new Set(categoriesA);
  for (const cat of categoriesB) {
    if (setA.has(cat)) return true;
  }
  return false;
}
