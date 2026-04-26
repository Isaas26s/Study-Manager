export function TitleBar() {
  const api = window.electronAPI;

  return (
    <div className="titlebar">
      <div className="titlebar-title">Study Manager</div>
      <div className="titlebar-controls">
        <button
          className="titlebar-btn minimize"
          onClick={() => api?.windowMinimize()}
          title="Minimizar"
        />
        <button
          className="titlebar-btn maximize"
          onClick={() => api?.windowMaximize()}
          title="Maximizar"
        />
        <button
          className="titlebar-btn close"
          onClick={() => api?.windowClose()}
          title="Fechar"
        />
      </div>
    </div>
  );
}
