import { useState, useCallback, useEffect } from 'react';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getFolderKey(str) {
  const c = (str || '').trim().charAt(0).toUpperCase();
  if (/[A-Z]/.test(c)) return c;
  if (/[0-9]/.test(c)) return '0-9';
  return '_misc';
}

function sanitize(str) {
  return str.replace(/[<>:"/\\|?*\x00-\x1F]/g, '_').trim().slice(0, 40) || 'untitled';
}

function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

// ─── Regex Preview ────────────────────────────────────────────────────────────

function RegexPreview({ pattern, sampleText }) {
  const [matches, setMatches] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!pattern || !sampleText) { setMatches([]); setError(''); return; }
    try {
      const re = new RegExp(pattern, 'gm');
      const found = [];
      let m;
      while ((m = re.exec(sampleText)) !== null) {
        found.push({ fullMatch: m[0], firstGroup: m[1] !== undefined ? m[1] : m[0] });
        if (m.index === re.lastIndex) re.lastIndex++;
        if (found.length >= 8) break;
      }
      setMatches(found);
      setError('');
    } catch (e) {
      setMatches([]);
      setError(e.message);
    }
  }, [pattern, sampleText]);

  if (!pattern) return null;

  if (error) {
    return (
      <div className="regex-preview">
        <div className="regex-preview-title">⚠ Regex invalide</div>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--error)' }}>{error}</div>
      </div>
    );
  }

  if (!sampleText) {
    return (
      <div className="regex-preview">
        <div className="regex-preview-title">Aperçu — chargez un fichier source pour voir les correspondances</div>
      </div>
    );
  }

  return (
    <div className="regex-preview">
      <div className="regex-preview-title">
        Aperçu — {matches.length} correspondance{matches.length !== 1 ? 's' : ''} détectée{matches.length !== 1 ? 's' : ''}
        {matches.length >= 8 ? ' (limité à 8)' : ''}
      </div>
      {matches.length === 0 ? (
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-muted)' }}>
          Aucune correspondance dans l'aperçu
        </div>
      ) : (
        <div className="regex-preview-list">
          {matches.map((m, i) => (
            <div key={i} className="regex-match-item">
              <span className="regex-match-folder">{getFolderKey(m.firstGroup)}/</span>
              <span className="regex-match-text">{sanitize(m.firstGroup || m.fullMatch)}.txt</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function NewSplit({ setPage, history }) {
  const [sourcePath, setSourcePath]     = useState('');
  const [sourceSize, setSourceSize]     = useState(0);
  const [sampleText, setSampleText]     = useState('');
  const [pattern, setPattern]           = useState('');
  const [outputDir, setOutputDir]       = useState('');
  const [patternError, setPatternError] = useState('');
  const [activeId, setActiveId]         = useState(null); // id de la découpe en cours
  const [awaitingEntry, setAwaitingEntry] = useState(false); // en attente que l'entrée apparaisse dans history

  // Dès qu'une nouvelle entrée 'running' apparaît dans history, on la capture comme activeId
  useEffect(() => {
    if (!awaitingEntry) return;
    const found = (history || []).find(h => h.status === 'running');
    if (found) {
      setActiveId(found.id);
      setAwaitingEntry(false);
    }
  }, [history, awaitingEntry]);

  // Dériver l'état depuis history partagé — aucun listener IPC ici
  const activeEntry = activeId ? (history || []).find(h => h.id === activeId) : null;
  const running  = awaitingEntry || (!!activeEntry && activeEntry.status === 'running');
  const progress = activeEntry?.progress ?? 0;
  const result   = !activeEntry ? null
    : activeEntry.status === 'done'  ? { type: 'success', filesCreated: activeEntry.filesCreated }
    : activeEntry.status === 'error' ? { type: 'error', message: activeEntry.error }
    : null;

  // Validate pattern on change
  useEffect(() => {
    if (!pattern) { setPatternError(''); return; }
    try { new RegExp(pattern); setPatternError(''); }
    catch (e) { setPatternError(e.message); }
  }, [pattern]);

  const pickSource = async () => {
    const p = await window.electronAPI?.openFile();
    if (!p) return;
    setSourcePath(p);
    setActiveId(null);
    setSampleText('');
  };

  const pickOutput = async () => {
    const d = await window.electronAPI?.openDirectory();
    if (d) setOutputDir(d);
  };

  const canSubmit = sourcePath && pattern && !patternError && outputDir && !running;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setActiveId(null);
    // On signale qu'on attend l'apparition de la nouvelle entrée dans history.
    // App.jsx va recevoir 'history:updated' et mettre à jour history → le useEffect
    // ci-dessus capturera l'ID dès que l'entrée 'running' sera visible.
    setAwaitingEntry(true);
    await window.electronAPI?.startSplit({ sourcePath, pattern, outputDir });
    // startSplit résout après la fin : activeEntry est déjà à jour via history.
  };

  const openOutput = () => {
    if (outputDir) window.electronAPI?.openPath(outputDir);
  };

  const reset = () => {
    setSourcePath('');
    setSampleText('');
    setPattern('');
    setOutputDir('');
    setActiveId(null);
    setAwaitingEntry(false);
  };

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Nouvelle découpe</h1>
        <p className="page-subtitle">
          Découpez un fichier texte en plusieurs fichiers selon un motif regex.
          Chaque correspondance marque le début d'un nouveau fichier.
        </p>
      </div>

      {/* ── Fichier source ── */}
      <div className="form-card">
        <div className="form-card-title">01 · Fichier source</div>

        <div className="form-group">
          <label className="form-label">Fichier à découper <span>*</span></label>
          <div className="input-row">
            <input
              className="form-input"
              type="text"
              placeholder="/chemin/vers/fichier.txt"
              value={sourcePath}
              readOnly
              style={{ cursor: 'default' }}
            />
            <button className="btn btn-ghost btn-icon" onClick={pickSource}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
              </svg>
              Parcourir
            </button>
          </div>
          {sourcePath && (
            <div className="form-hint">
              {sourcePath}
              {sourceSize > 0 && <> · <strong>{formatBytes(sourceSize)}</strong></>}
            </div>
          )}
        </div>
      </div>

      {/* ── Pattern ── */}
      <div className="form-card">
        <div className="form-card-title">02 · Motif de découpe (Regex)</div>

        <div className="form-group">
          <label className="form-label">Expression régulière <span>*</span></label>
          <input
            className={`form-input ${patternError ? 'error' : ''}`}
            type="text"
            placeholder="ex: ^Chapter (\w+) ou ^={3,}"
            value={pattern}
            onChange={(e) => setPattern(e.target.value)}
            style={{ WebkitUserSelect: 'text', userSelect: 'text' }}
          />
          {patternError && (
            <div className="form-error">⚠ {patternError}</div>
          )}
          <div className="form-hint">
            Chaque correspondance marque le début d'un nouveau fichier.
            Le <strong>1er groupe capturant</strong> (parenthèses) détermine le nom du fichier et le dossier alphabétique.
            Si aucun groupe n'est défini, la correspondance complète est utilisée.
          </div>
        </div>

        <RegexPreview pattern={pattern} sampleText={sampleText} />

        <div style={{ marginTop: 16 }}>
          <div className="form-card-title" style={{ marginBottom: 8 }}>Exemples de patterns</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {[
              { label: 'Chapitres', val: '^Chapter\\s+(\\w+)' },
              { label: 'Sections', val: '^={3,}\\s*(.+)\\s*={3,}' },
              { label: 'Date ISO', val: '^(\\d{4}-\\d{2}-\\d{2})' },
              { label: '--- séparateur', val: '^---$' },
              { label: 'ID numérique', val: '^\\[(\\d+)\\]' },
            ].map(ex => (
              <button
                key={ex.val}
                className="btn btn-ghost"
                style={{ fontSize: 11.5, padding: '5px 10px' }}
                onClick={() => setPattern(ex.val)}
              >
                {ex.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Destination ── */}
      <div className="form-card">
        <div className="form-card-title">03 · Répertoire de sortie</div>

        <div className="form-group">
          <label className="form-label">Dossier de destination <span>*</span></label>
          <div className="input-row">
            <input
              className="form-input"
              type="text"
              placeholder="/chemin/vers/dossier/"
              value={outputDir}
              readOnly
              style={{ cursor: 'default' }}
            />
            <button className="btn btn-ghost btn-icon" onClick={pickOutput}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
              </svg>
              Choisir
            </button>
          </div>
          <div className="form-hint">
            Les fichiers seront organisés en sous-dossiers selon la première lettre du groupe capturant
            (ex: <code style={{ color: 'var(--accent)', fontSize: 11 }}>A/</code>,{' '}
            <code style={{ color: 'var(--accent)', fontSize: 11 }}>B/</code>,{' '}
            <code style={{ color: 'var(--accent)', fontSize: 11 }}>0-9/</code>).
          </div>
        </div>
      </div>

      {/* ── Progress & Actions ── */}
      {running && (
        <div className="form-card" style={{ maxWidth: 720, marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
            <div className="spinner" />
            <span style={{ fontSize: 13, color: 'var(--text-dim)' }}>
              Découpe en cours…
            </span>
            <span style={{ marginLeft: 'auto', fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--accent)' }}>
              {progress}%
            </span>
          </div>
          <div className="progress-bar">
            <div className="progress-fill" style={{ width: `${progress}%` }} />
          </div>
        </div>
      )}

      {result && (
        <div className={`result-banner ${result.type}`}>
          <div className="result-icon">
            {result.type === 'success' ? '✓' : '✕'}
          </div>
          <div className="result-text">
            <div className="result-title">
              {result.type === 'success'
                ? `${result.filesCreated} fichier${result.filesCreated !== 1 ? 's' : ''} créé${result.filesCreated !== 1 ? 's' : ''} avec succès`
                : 'Erreur lors de la découpe'}
            </div>
            <div className="result-msg">
              {result.type === 'success' ? outputDir : result.message}
            </div>
          </div>
          {result.type === 'success' && (
            <button className="btn btn-ghost" style={{ fontSize: 12 }} onClick={openOutput}>
              Ouvrir le dossier
            </button>
          )}
        </div>
      )}

      <div style={{ display: 'flex', gap: 10, marginTop: 24, maxWidth: 720 }}>
        <button
          className="btn btn-primary"
          onClick={handleSubmit}
          disabled={!canSubmit}
          style={{ minWidth: 160 }}
        >
          {running ? (
            <>
              <div className="spinner" style={{ borderTopColor: '#0F0F0F', borderColor: 'rgba(0,0,0,0.2)' }} />
              Découpe en cours…
            </>
          ) : (
            <>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="6" cy="6" r="3" /><circle cx="6" cy="18" r="3" />
                <line x1="20" y1="4" x2="8.12" y2="15.88" />
                <line x1="14.47" y1="14.48" x2="20" y2="20" />
                <line x1="8.12" y1="8.12" x2="12" y2="12" />
              </svg>
              Lancer la découpe
            </>
          )}
        </button>

        <button className="btn btn-ghost" onClick={reset} disabled={running}>
          Réinitialiser
        </button>
      </div>
    </div>
  );
}
