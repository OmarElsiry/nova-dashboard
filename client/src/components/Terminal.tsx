import React, { useEffect, useRef } from 'react';
import { Terminal as XTerm } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import 'xterm/css/xterm.css';

interface TerminalProps {
    onData: (data: string) => void;
    output: string;
}

export const Terminal: React.FC<TerminalProps> = ({ onData, output }) => {
    const terminalRef = useRef<HTMLDivElement>(null);
    const xtermRef = useRef<XTerm | null>(null);

    useEffect(() => {
        if (!terminalRef.current) return;

        const term = new XTerm({
            cursorBlink: true,
            theme: {
                background: '#0a0a0a',
                foreground: '#d4d4d4',
                cursor: '#3b82f6',
            },
            fontSize: 14,
            fontFamily: '"Cascadia Code", Menlo, monospace',
        });

        const fitAddon = new FitAddon();
        term.loadAddon(fitAddon);
        term.open(terminalRef.current);
        fitAddon.fit();

        term.onData((data) => {
            onData(data);
        });

        xtermRef.current = term;

        return () => {
            term.dispose();
        };
    }, []);

    useEffect(() => {
        if (xtermRef.current && output) {
            // Clear terminal and write full output for simplicity in this demo
            // or just write the delta. Usually write delta.
            xtermRef.current.write(output);
        }
    }, [output]);

    return <div ref={terminalRef} style={{ width: '100%', height: '100%' }} />;
};
