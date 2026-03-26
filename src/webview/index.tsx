import React, { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { TDACanvas } from './components/TDACanvas';
import { CapabilityForge } from './components/CapabilityForge';
import { OracleResolver } from './components/OracleResolver';

const App = () => {
    const [route, setRoute] = useState<'MANIFOLD' | 'FORGE' | 'ORACLE'>('MANIFOLD');

    useEffect(() => {
        const handleMessage = (event: MessageEvent) => {
            const message = event.data;
            if (message && message.type === 'SET_ROUTE') {
                setRoute(message.payload);
            }
        };

        window.addEventListener('message', handleMessage);
        return () => window.removeEventListener('message', handleMessage);
    }, []);

    if (route === 'FORGE') {
        return <CapabilityForge />;
    }

    if (route === 'ORACLE') {
        return <OracleResolver />;
    }

    return <TDACanvas />;
};

const rootElement = document.getElementById('root');
if (rootElement) {
    const root = createRoot(rootElement);
    root.render(<App />);
}