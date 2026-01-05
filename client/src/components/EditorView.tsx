import React from 'react';
import Editor from '@monaco-editor/react';

interface EditorViewProps {
    content: string;
    onChange: (value: string | undefined) => void;
}

export const EditorView: React.FC<EditorViewProps> = ({ content, onChange }) => {
    return (
        <div className="editor-wrapper">
            <Editor
                height="100%"
                defaultLanguage="typescript"
                theme="vs-dark"
                value={content}
                onChange={onChange}
                options={{
                    readOnly: false,
                    minimap: { enabled: false },
                    fontSize: 14,
                    padding: { top: 20 },
                }}
            />
        </div>
    );
};
