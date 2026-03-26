import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AgentNode, AgentNodeData } from '../webview/components/AgentNode';
import React from 'react';

describe('AgentNode', () => {
    it('renders the label ResearchAgent', () => {
        const mockData: AgentNodeData = {
            label: 'ResearchAgent',
            status: 'idle',
            tokens: 'Thinking...',
        };

        render(<AgentNode data={mockData} />);

        expect(screen.getByText('ResearchAgent')).toBeInTheDocument();
        expect(screen.queryByText('Thinking...')).toBeNull();
    });

    it('renders the tokens when status is running', () => {
        const mockData: AgentNodeData = {
            label: 'ResearchAgent2',
            status: 'running',
            tokens: 'Thinking...',
        };

        render(<AgentNode data={mockData} />);

        expect(screen.getByText('ResearchAgent2')).toBeInTheDocument();
        expect(screen.getByText('Thinking...')).toBeInTheDocument();
    });
});
