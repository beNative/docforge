
import React from 'react';
import { PlusIcon, FileIcon } from './Icons';
import Button from './Button';

interface WelcomeScreenProps {
    onNewDocument: () => void;
}

export const WelcomeScreen: React.FC<WelcomeScreenProps> = ({ onNewDocument }) => {
    return (
        <div className="flex flex-col items-center justify-center h-full text-center text-text-secondary p-8 bg-background">
            <div className="p-8 bg-secondary rounded-sm border border-border-color max-w-lg">
                <FileIcon className="w-16 h-16 text-primary mx-auto mb-6" />
                <h2 className="text-xl font-semibold text-text-main mb-2">Welcome to DocForge</h2>
                <p className="max-w-md mb-8 text-sm">
                    Your creative space for crafting, refining, and managing documents. Let's get started.
                </p>
                <Button
                    onClick={onNewDocument}
                    variant="primary"
                    className="px-5 py-2 text-sm"
                >
                    <PlusIcon className="w-5 h-5 mr-2" />
                    Create New Document
                </Button>
            </div>
        </div>
    );
};