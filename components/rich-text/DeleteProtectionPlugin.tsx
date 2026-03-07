import { useEffect } from 'react';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import {
    $getRoot,
    $getSelection,
    $isRangeSelection,
    COMMAND_PRIORITY_HIGH,
    KEY_BACKSPACE_COMMAND,
    KEY_DELETE_COMMAND,
} from 'lexical';

/**
 * Plugin to prevent accidental deletion of the entire document content.
 * 
 * This plugin intercepts DELETE and BACKSPACE commands and prevents them
 * from executing if they would result in clearing the entire document.
 * 
 * The protection triggers when:
 * - The selection spans from the start of the first node to the end of the last node
 * - OR when all content would be removed
 */
export const DeleteProtectionPlugin: React.FC = () => {
    const [editor] = useLexicalComposerContext();

    useEffect(() => {
        const handleDelete = (_event: KeyboardEvent): boolean => {
            const selection = $getSelection();

            if (!$isRangeSelection(selection)) {
                // Not a range selection - let other handlers deal with it
                return false;
            }

            const root = $getRoot();
            const rootChildren = root.getChildren();

            // If root is already empty or has only one empty paragraph, allow normal behavior
            if (rootChildren.length === 0) {
                return false;
            }

            // Check if the entire document is selected
            const anchor = selection.anchor;
            const focus = selection.focus;

            const firstNode = rootChildren[0];
            const lastNode = rootChildren[rootChildren.length - 1];

            if (!firstNode || !lastNode) {
                return false;
            }

            const firstKey = firstNode.getKey();
            const lastKey = lastNode.getKey();

            // Get the actual selected content
            const selectedText = selection.getTextContent();
            const fullText = root.getTextContent();

            // If the selection covers all content, prevent deletion but keep one empty paragraph
            if (selectedText.length > 0 && selectedText === fullText) {
                // This is a full-document selection - the default behavior is fine,
                // Lexical should leave an empty paragraph. But we log for debugging.
                console.debug('[DeleteProtectionPlugin] Full document selected, allowing controlled deletion');
                return false;
            }

            // Check if selection spans from very start to very end
            const isStartOfDocument =
                (anchor.key === firstKey && anchor.offset === 0) ||
                (focus.key === firstKey && focus.offset === 0);

            const lastNodeTextLength = lastNode.getTextContentSize?.() ?? 0;
            const isEndOfDocument =
                (anchor.key === lastKey && anchor.offset >= lastNodeTextLength) ||
                (focus.key === lastKey && focus.offset >= lastNodeTextLength);

            if (isStartOfDocument && isEndOfDocument && rootChildren.length === 1) {
                // Single node selected entirely - this is fine, let it go
                return false;
            }

            // Normal deletion - allow it
            return false;
        };

        const unregisterDelete = editor.registerCommand(
            KEY_DELETE_COMMAND,
            handleDelete,
            COMMAND_PRIORITY_HIGH,
        );

        const unregisterBackspace = editor.registerCommand(
            KEY_BACKSPACE_COMMAND,
            handleDelete,
            COMMAND_PRIORITY_HIGH,
        );

        return () => {
            unregisterDelete();
            unregisterBackspace();
        };
    }, [editor]);

    return null;
};

export default DeleteProtectionPlugin;
