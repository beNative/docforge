import React from 'react';
import ReactDOM from 'react-dom';
import Button from './Button';
import { WarningIcon } from './Icons';

interface FatalErrorProps {
  title: string;
  header: string;
  details: string;
}

const FatalError: React.FC<FatalErrorProps> = ({ title, header, details }) => {
    const handleOk = () => {
        window.electronAPI?.closeWindow();
    }

    const modalContent = (
        <div className="fixed inset-0 bg-modal-backdrop flex items-center justify-center z-50">
            <div className="bg-secondary rounded-lg shadow-xl w-full max-w-md mx-4 border border-border-color">
                <div className="flex justify-between items-center px-6 py-4 border-b border-border-color">
                    <h2 className="text-lg font-semibold text-text-main">{title}</h2>
                </div>
                <div className="p-6">
                    <div className="flex items-start gap-4">
                        <div className="flex-shrink-0 w-10 h-10 bg-error/10 text-error rounded-full flex items-center justify-center">
                            <WarningIcon className="w-6 h-6" />
                        </div>
                        <div className="text-sm pt-1">
                            <h3 className="font-semibold text-text-main">{header}</h3>
                            <p className="text-text-secondary mt-1">{details}</p>
                        </div>
                    </div>
                    <div className="flex justify-end gap-3 mt-6">
                        <Button onClick={handleOk} variant="primary">
                            OK
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );

    const overlayRoot = document.getElementById('overlay-root');
    if (!overlayRoot) return null;

    return ReactDOM.createPortal(modalContent, overlayRoot);
};

export default FatalError;
