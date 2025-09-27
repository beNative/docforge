import { useState, useEffect, useCallback } from 'react';
import type { DocVersion } from '../types';
import { repository } from '../services/repository';
import { useLogger } from './useLogger';

export const usePromptHistory = (nodeId: string | null) => {
    const [versions, setVersions] = useState<DocVersion[]>([]);
    const { addLog } = useLogger();

    const fetchVersions = useCallback(async () => {
        if (nodeId) {
            try {
                const fetchedVersions = await repository.getVersionsForNode(nodeId);
                setVersions(fetchedVersions);
            } catch (error) {
                const message = error instanceof Error ? error.message : String(error);
                addLog('ERROR', `Failed to fetch version history for node ${nodeId}: ${message}`);
                setVersions([]);
            }
        } else {
            setVersions([]);
        }
    }, [nodeId, addLog]);

    useEffect(() => {
        fetchVersions();
    }, [fetchVersions]);

    const deleteVersions = useCallback(async (versionIds: number[]) => {
        try {
            await repository.deleteDocVersions(versionIds);
            addLog('INFO', `Deleted ${versionIds.length} version(s).`);
            await fetchVersions(); // Refresh the list
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            addLog('ERROR', `Failed to delete versions: ${message}`);
            // Potentially show an error to the user here
        }
    }, [addLog, fetchVersions]);

    // The component that uses this seems to call this function.
    // While the state is already available, we provide this for API compatibility
    // with the existing component structure to minimize refactoring.
    const getVersionsForPrompt = (id: string) => {
        if (id === nodeId) {
            return versions;
        }
        // This case should ideally not happen if the hook is used correctly.
        // It indicates the component might have a stale document ID.
        console.warn(`getVersionsForPrompt called with a different ID (${id}) than the hook was initialized with (${nodeId}). Refetching is recommended.`);
        return [];
    };

    return { versions, getVersionsForPrompt, refresh: fetchVersions, deleteVersions };
};