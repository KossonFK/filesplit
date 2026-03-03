const isMac = window.electronAPI?.platform === 'darwin';

export default function TitleBar() {
  return (
    <div className="titlebar">
      {/* On macOS, traffic lights are on the left — reserve space */}
      {isMac ? (
        <div className="titlebar-controls mac-space" />
      ) : (
        <div className="titlebar-brand">
          <div className="titlebar-logo" />
          <span className="titlebar-name">FileSplitter</span>
        </div>
      )}

      {isMac && (
        <div className="titlebar-brand" style={{ position: 'absolute', left: '50%', transform: 'translateX(-50%)' }}>
          <div className="titlebar-logo" />
          <span className="titlebar-name">FileSplitter</span>
        </div>
      )}

      {!isMac ? (
        <div className="titlebar-controls" style={{ WebkitAppRegion: 'no-drag' }}>
          <button className="wc-btn wc-min" onClick={() => window.electronAPI?.minimize()} title="Minimize" />
          <button className="wc-btn wc-max" onClick={() => window.electronAPI?.maximize()} title="Maximize" />
          <button className="wc-btn wc-close" onClick={() => window.electronAPI?.close()} title="Close" />
        </div>
      ) : (
        <div style={{ width: 72 }} />
      )}
    </div>
  );
}
