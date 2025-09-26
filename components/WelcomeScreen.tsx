
import React from 'react';
import { PlusIcon, FileIcon } from './Icons';
import Button from './Button';

interface WelcomeScreenProps {
  onNewPrompt: () => void;
}

export const WelcomeScreen: React.FC<WelcomeScreenProps> = ({ onNewPrompt }) => {
    return (
        <div className="flex flex-col items-center justify-center h-full text-center text-text-secondary p-8 bg-background">
            <div className="p-10 bg-secondary rounded-lg border border-border-color max-w-lg">
                <FileIcon className="w-16 h-16 text-primary mx-auto mb-6" />
                <h2 className="text-2xl font-semibold text-text-main mb-2">Welcome to DocForge</h2>
                <p className="max-w-md mb-8 text-base">
                    Your creative space for crafting, refining, and managing LLM prompts. Let's get started.
                </p>
                <Button
                    onClick={onNewPrompt}
                    variant="primary"
                    className="px-6 py-3 text-base"
                >
                    <PlusIcon className="w-5 h-5 mr-2" />
                    Create New Prompt
                </Button>
            </div>
        </div>
    );
};