import { useState, useEffect } from 'react';
import TitleBar from './components/TitleBar';
import Sidebar from './components/Sidebar';
import NewSplit from './pages/NewSplit';
import History from './pages/History';

export default function App() {
  const [page, setPage]       = useState('new-split');
  const [history, setHistory] = useState([]);

  useEffect(() => {
    // Initial history load
    window.electronAPI?.getHistory().then(h => setHistory(h || []));

    // Real-time: new entry added
    window.electronAPI?.onHistoryUpdated((entry) => {
      setHistory(prev => {
        const exists = prev.find(h => h.id === entry.id);
        if (exists) return prev.map(h => h.id === entry.id ? { ...h, ...entry } : h);
        return [entry, ...prev];
      });
    });

    // Real-time: progress updates
    window.electronAPI?.onSplitProgress((data) => {
      setHistory(prev =>
        prev.map(h => h.id === data.id ? { ...h, ...data } : h)
      );
    });

    return () => {
      window.electronAPI?.removeListener('history:updated');
      window.electronAPI?.removeListener('split:progress');
    };
  }, []);

  return (
    <div className="app">
      <TitleBar />
      <div className="app-body">
        <Sidebar page={page} setPage={setPage} />
        <main className="main-content">
          {page === 'new-split' && (
            <NewSplit setPage={setPage} />
          )}
          {page === 'history' && (
            <History history={history} setHistory={setHistory} />
          )}
        </main>
      </div>
    </div>
  );
}
