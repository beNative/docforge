import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MainApp } from '../App';
import { DEFAULT_SETTINGS } from '../constants';

const mockUseDocuments = vi.fn();

vi.mock('../hooks/usePrompts', () => ({
    useDocuments: () => mockUseDocuments(),
}));

vi.mock('../hooks/useSettings', () => ({
    useSettings: () => ({
        settings: DEFAULT_SETTINGS,
        saveSettings: vi.fn(),
        loaded: true,
    }),
}));

vi.mock('../hooks/useTemplates', () => ({
    useTemplates: () => ({
        templates: [],
        addTemplate: vi.fn(),
        updateTemplate: vi.fn(),
        deleteTemplate: vi.fn(),
        deleteTemplates: vi.fn(),
    }),
}));

vi.mock('../hooks/useTheme', () => ({
    useTheme: () => ({
        theme: 'light',
        toggleTheme: vi.fn(),
    }),
}));

vi.mock('../hooks/useApplyThemeCustomizations', () => ({
    useApplyThemeCustomizations: vi.fn(),
}));

vi.mock('../hooks/useLLMStatus', () => ({
    useLLMStatus: () => 'connected',
}));

const mockLogger = {
    logs: [],
    addLog: vi.fn(),
    clearLogs: vi.fn(),
};

vi.mock('../hooks/useLogger', () => ({
    useLogger: () => mockLogger,
}));

vi.mock('../services/repository', () => ({
    repository: {
        getDbPath: vi.fn().mockResolvedValue(null),
        searchDocumentsByBody: vi.fn().mockResolvedValue([]),
        selectDatabaseFile: vi.fn().mockResolvedValue({ success: false }),
        createNewDatabase: vi.fn().mockResolvedValue({ success: false }),
        backupDatabase: vi.fn().mockResolvedValue({ success: false }),
        runIntegrityCheck: vi.fn().mockResolvedValue({ success: false }),
        runVacuum: vi.fn().mockResolvedValue({ success: false }),
        init: vi.fn(),
    },
}));

vi.mock('../services/llmDiscoveryService', () => ({
    llmDiscoveryService: {
        discoverServices: vi.fn().mockResolvedValue([]),
        fetchModels: vi.fn().mockResolvedValue([]),
    },
}));

describe('MainApp', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockUseDocuments.mockReturnValue({
            items: [],
            addDocument: vi.fn(),
            addFolder: vi.fn(),
            updateItem: vi.fn(),
            commitVersion: vi.fn(),
            deleteItems: vi.fn(),
            moveItems: vi.fn(),
            getDescendantIds: vi.fn().mockReturnValue(new Set<string>()),
            duplicateItems: vi.fn(),
            addDocumentsFromFiles: vi.fn(),
            importNodesFromTransfer: vi.fn(),
            createDocumentFromClipboard: vi.fn(),
            isLoading: true,
        });
    });

    it('renders a loading indicator while documents are loading', async () => {
        render(<MainApp />);

        expect(await screen.findByRole('status')).toBeInTheDocument();
        expect(screen.getByText(/loading documents/i)).toBeInTheDocument();
        expect(screen.queryByText(/welcome to docforge/i)).not.toBeInTheDocument();
    });
});
