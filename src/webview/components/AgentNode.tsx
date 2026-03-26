import React from 'react';

export interface AgentNodeData {
    label: string;
    status: string;
    tokens: string;
}

export interface AgentNodeProps {
    data: AgentNodeData;
}

export const AgentNode: React.FC<AgentNodeProps> = ({ data }) => {
    return (
        <div className="agent-node">
            <div className="agent-label">{data.label}</div>
            {data.status === 'running' && (
                <div className="agent-tokens">{data.tokens}</div>
            )}
        </div>
    );
};
