import { useEffect, useMemo, useState } from 'react';
import { useBuildStore } from '../store';
import './SavedXenogerms.css';

export function SavedXenogerms() {
  const savedMap = useBuildStore(s => s.savedXenogerms);
  const currentSavedId = useBuildStore(s => s.currentSavedXenogermId);
  const setSavedName = useBuildStore(s => s.setSavedXenogermName);
  const deleteSaved = useBuildStore(s => s.deleteSavedXenogerm);
  const loadSaved = useBuildStore(s => s.loadSavedXenogerm);
  const startNew = useBuildStore(s => s.startNewSavedXenogerm);
  const selectedCount = useBuildStore(s => s.selectedXeno.size);

  const [nameInput, setNameInput] = useState('');

  const savedList = useMemo(
    () =>
      Object.values(savedMap).sort((a, b) =>
        a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
      ),
    [savedMap]
  );

  useEffect(() => {
    if (currentSavedId) {
      setNameInput(savedMap[currentSavedId]?.name ?? '');
    } else {
      setNameInput('');
    }
  }, [currentSavedId, savedMap]);

  const handleNameChange = (value: string) => {
    setNameInput(value);
    setSavedName(value);
  };

  const handleSelectSaved = (id: string) => {
    loadSaved(id);
  };

  const handleDeleteSaved = (id: string) => {
    deleteSaved(id);
  };

  return (
    <section className="saved-xenogerms">
      <div className="saved-header">
        <h2>Saved Xenogerms</h2>
        <div className="header-actions">
          {currentSavedId && (
            <button
              className="ghost danger"
              onClick={() => handleDeleteSaved(currentSavedId)}
            >
              Delete current
            </button>
          )}
          <button className="ghost" onClick={startNew}>
            Start from scratch
          </button>
        </div>
      </div>
      <div className="name-row">
        <input
          type="text"
          value={nameInput}
          placeholder={
            selectedCount === 0
              ? 'Select genes to save a xenogerm'
              : 'Name this xenogerm to save it'
          }
          onChange={e => handleNameChange(e.target.value)}
        />
        {currentSavedId && (
          <span className="name-hint">
            Auto-saving {selectedCount} selected genes
          </span>
        )}
      </div>
      <div className="saved-list">
        {savedList.map(saved => (
          <div
            key={saved.id}
            className={`saved-chip ${currentSavedId === saved.id ? 'active' : ''}`}
          >
            <button className="load" onClick={() => handleSelectSaved(saved.id)}>
              <div className="meta">
                <span className="name">{saved.name}</span>
                <span className="count">{saved.genes.length} genes</span>
              </div>
            </button>
            <button
              className="delete"
              onClick={() => handleDeleteSaved(saved.id)}
              aria-label={`Delete ${saved.name}`}
            >
              ×
            </button>
          </div>
        ))}
        {savedList.length === 0 && (
          <div className="emptystate">
            No saved xenogerms yet. Enter a name above to save your current
            genes.
          </div>
        )}
      </div>
    </section>
  );
}
