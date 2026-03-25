import React from 'react';
import { createRoot } from 'react-dom/client';

const App = () => {
    return (
        <div style={{ padding: '20px', color: 'var(--vscode-editor-foreground)' }}>
            <h1>CoReason Projection Manifold</h1>
            <p>Awaiting telemetry synchronization...</p>
        </div>
    );
};

const rootElement = document.getElementById('root');
if (rootElement) {
    const root = createRoot(rootElement);
    root.render(<App />);
}
