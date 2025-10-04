import type { DocumentTemplate } from '../types';

export const SUPPORTED_LANGUAGES = [
    { id: 'plaintext', label: 'Plain Text' },
    { id: 'javascript', label: 'JavaScript' },
    { id: 'typescript', label: 'TypeScript' },
    { id: 'python', label: 'Python' },
    { id: 'html', label: 'HTML' },
    { id: 'css', label: 'CSS' },
    { id: 'json', label: 'JSON' },
    { id: 'markdown', label: 'Markdown' },
    { id: 'java', label: 'Java' },
    { id: 'csharp', label: 'C#' },
    { id: 'cpp', label: 'C++' },
    { id: 'go', label: 'Go' },
    { id: 'rust', label: 'Rust' },
    { id: 'ruby', label: 'Ruby' },
    { id: 'php', label: 'PHP' },
    { id: 'sql', label: 'SQL' },
    { id: 'xml', label: 'XML' },
    { id: 'yaml', label: 'YAML' },
    { id: 'pascal', label: 'Pascal' },
    { id: 'ini', label: 'INI' },
    { id: 'pdf', label: 'PDF' },
];

export const mapExtensionToLanguageId = (extension: string | null): string => {
    if (!extension) return 'plaintext';
    switch (extension.toLowerCase()) {
        case 'js':
        case 'jsx':
            return 'javascript';
        case 'ts':
        case 'tsx':
            return 'typescript';
        case 'py':
            return 'python';
        case 'html':
        case 'htm':
            return 'html';
        case 'css':
            return 'css';
        case 'json':
            return 'json';
        case 'md':
        case 'markdown':
            return 'markdown';
        case 'java':
            return 'java';
        case 'cs':
            return 'csharp';
        case 'cpp':
        case 'cxx':
        case 'h':
        case 'hpp':
            return 'cpp';
        case 'go':
            return 'go';
        case 'rs':
            return 'rust';
        case 'rb':
            return 'ruby';
        case 'php':
            return 'php';
        case 'sql':
            return 'sql';
        case 'xml':
            return 'xml';
        case 'yml':
        case 'yaml':
            return 'yaml';
        case 'pas':
            return 'pascal';
        case 'dfm':
        case 'lfm':
        case 'fmx':
        case 'ini':
             return 'ini';
        case 'application/pdf':
            return 'pdf';
        case 'pdf':
            return 'pdf';
        default:
            // Try to find a direct match in supported languages by id
            const match = SUPPORTED_LANGUAGES.find(l => l.id === extension.toLowerCase());
            return match ? match.id : 'plaintext';
    }
}