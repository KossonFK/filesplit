// SVG icons as inline components
function IconScissors() {
  return (
    <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="6" cy="6" r="3" />
      <circle cx="6" cy="18" r="3" />
      <line x1="20" y1="4" x2="8.12" y2="15.88" />
      <line x1="14.47" y1="14.48" x2="20" y2="20" />
      <line x1="8.12" y1="8.12" x2="12" y2="12" />
    </svg>
  );
}

function IconHistory() {
  return (
    <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="12 8 12 12 14 14" />
      <path d="M3.05 11a9 9 0 1 0 .5-4.29" />
      <polyline points="1 4 3 6 5 4" />
    </svg>
  );
}

export default function Sidebar({ page, setPage }) {
  return (
    <div className="sidebar">
      <nav className="sidebar-nav">
        <div className="nav-label">Navigation</div>

        <button
          className={`nav-item ${page === 'new-split' ? 'active' : ''}`}
          onClick={() => setPage('new-split')}
        >
          <IconScissors />
          Nouvelle découpe
        </button>

        <button
          className={`nav-item ${page === 'history' ? 'active' : ''}`}
          onClick={() => setPage('history')}
        >
          <IconHistory />
          Historique
        </button>
      </nav>

      <div className="sidebar-footer">
        <div className="sidebar-version">v1.0.0 · FileSplitter</div>
      </div>
    </div>
  );
}
