import { useState, useMemo } from 'react';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDate(iso) {
  try {
    const d = new Date(iso);
    return d.toLocaleString('fr-FR', {
      day: '2-digit', month: '2-digit', year: '2-digit',
      hour: '2-digit', minute: '2-digit',
    });
  } catch { return '—'; }
}

function StatusBadge({ status }) {
  const labels = { running: 'En cours', done: 'Terminé', error: 'Erreur' };
  return <span className={`hc-status ${status}`}>{labels[status] || status}</span>;
}

function ProgressBar({ progress, status }) {
  return (
    <div className="progress-bar hc-progress-bar">
      <div
        className={`progress-fill ${status}`}
        style={{ width: `${Math.min(100, progress || 0)}%` }}
      />
    </div>
  );
}

// ─── History Card ─────────────────────────────────────────────────────────────

function HistoryCard({ entry, onDelete, onOpenDir }) {
  return (
    <div className={`history-card ${entry.status}`}>
      <div className="hc-main">
        {/* Header */}
        <div className="hc-header">
          <span className="hc-filename">{entry.sourceFile}</span>
          <StatusBadge status={entry.status} />
        </div>

        {/* Meta grid */}
        <div className="hc-meta">
          <div className="hc-meta-item">
            <span className="hc-meta-label">Pattern</span>
            <span className="hc-meta-value accent" title={entry.pattern}>
              {entry.pattern.length > 28 ? entry.pattern.slice(0, 28) + '…' : entry.pattern}
            </span>
          </div>
          <div className="hc-meta-item">
            <span className="hc-meta-label">Destination</span>
            <span className="hc-meta-value" title={entry.outputDir}>
              {entry.outputDir.length > 30 ? '…' + entry.outputDir.slice(-28) : entry.outputDir}
            </span>
          </div>
          <div className="hc-meta-item">
            <span className="hc-meta-label">Fichiers créés</span>
            <span className={`hc-meta-value ${entry.status === 'done' ? 'success' : entry.status === 'error' ? 'error' : 'accent'}`}>
              {entry.status === 'error'
                ? entry.error || 'Erreur'
                : `${entry.filesCreated || 0} fichier${(entry.filesCreated || 0) !== 1 ? 's' : ''}`}
            </span>
          </div>
          {entry.sourceEncoding && (
            <div className="hc-meta-item">
              <span className="hc-meta-label">Encodage</span>
              <span className="hc-meta-value accent" title="Source → Sortie">
                {entry.sourceEncoding} → UTF-8
              </span>
            </div>
          )}
        </div>

        {/* Progress bar */}
        <div className="hc-progress-row">
          <ProgressBar progress={entry.progress} status={entry.status} />
          <span className="hc-progress-pct">
            {entry.status === 'done' ? '100%' : entry.status === 'error' ? '—' : `${entry.progress || 0}%`}
          </span>
        </div>
      </div>

      {/* Actions */}
      <div className="hc-actions">
        <span className="hc-date">{formatDate(entry.createdAt)}</span>
        <div className="hc-action-btns">
          {entry.status === 'done' && (
            <button
              className="btn btn-ghost btn-icon"
              title="Ouvrir le dossier de destination"
              onClick={() => onOpenDir(entry.outputDir)}
              style={{ padding: '6px 10px' }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                <polyline points="15 3 21 3 21 9" />
                <line x1="10" y1="14" x2="21" y2="3" />
              </svg>
            </button>
          )}
          <button
            className="btn btn-ghost btn-icon"
            title="Supprimer de l'historique"
            onClick={() => onDelete(entry.id)}
            style={{ padding: '6px 10px', color: 'var(--error)' }}
            disabled={entry.status === 'running'}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6l-1 14H6L5 6" />
              <path d="M10 11v6M14 11v6" />
              <path d="M9 6V4h6v2" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function History({ history, setHistory }) {
  const [search, setSearch] = useState('');
  const [confirmClear, setConfirmClear] = useState(false);

  const filtered = useMemo(() => {
    if (!search.trim()) return history;
    const q = search.toLowerCase();
    return history.filter(
      (h) =>
        h.sourceFile.toLowerCase().includes(q) ||
        h.pattern.toLowerCase().includes(q) ||
        h.outputDir.toLowerCase().includes(q)
    );
  }, [history, search]);

  const stats = useMemo(() => ({
    total:   history.length,
    done:    history.filter(h => h.status === 'done').length,
    running: history.filter(h => h.status === 'running').length,
    files:   history.reduce((acc, h) => acc + (h.filesCreated || 0), 0),
  }), [history]);

  const handleDelete = async (id) => {
    await window.electronAPI?.deleteHistoryEntry(id);
    setHistory(prev => prev.filter(h => h.id !== id));
  };

  const handleClearAll = async () => {
    if (!confirmClear) { setConfirmClear(true); return; }
    await window.electronAPI?.clearHistory();
    setHistory([]);
    setConfirmClear(false);
  };

  const handleOpenDir = (dir) => {
    window.electronAPI?.openPath(dir);
  };

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Historique</h1>
        <p className="page-subtitle">
          Toutes les découpes effectuées, avec leur progression et résultats.
        </p>
      </div>

      {/* Stats */}
      {history.length > 0 && (
        <div className="stats-row" style={{ marginBottom: 28 }}>
          <div className="stat-card">
            <div className="stat-label">Découpes totales</div>
            <div className="stat-value">{stats.total}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Terminées</div>
            <div className="stat-value" style={{ color: 'var(--success)' }}>{stats.done}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">En cours</div>
            <div className="stat-value accent">{stats.running}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Fichiers créés</div>
            <div className="stat-value accent">{stats.files.toLocaleString()}</div>
          </div>
        </div>
      )}

      {/* Toolbar */}
      <div className="history-toolbar">
        <input
          className="history-search"
          type="text"
          placeholder="Filtrer par nom, pattern, destination…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        {search && (
          <span className="history-count">
            {filtered.length} / {history.length}
          </span>
        )}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          {history.length > 0 && (
            <button
              className={`btn ${confirmClear ? 'btn-danger' : 'btn-ghost'}`}
              onClick={handleClearAll}
              onBlur={() => setConfirmClear(false)}
              style={{ fontSize: 12.5 }}
            >
              {confirmClear ? '⚠ Confirmer la suppression' : 'Vider l\'historique'}
            </button>
          )}
        </div>
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <div className="history-empty">
          <div className="history-empty-icon">
            {history.length === 0 ? '📂' : '🔍'}
          </div>
          <div className="history-empty-text">
            {history.length === 0
              ? 'Aucune découpe effectuée pour l\'instant.'
              : 'Aucun résultat pour ce filtre.'}
          </div>
        </div>
      ) : (
        <div className="history-list">
          {filtered.map(entry => (
            <HistoryCard
              key={entry.id}
              entry={entry}
              onDelete={handleDelete}
              onOpenDir={handleOpenDir}
            />
          ))}
        </div>
      )}
    </div>
  );
}
