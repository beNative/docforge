import React, { useState } from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import ErrorBoundary from '../components/ErrorBoundary';

const BuggyComponent: React.FC<{ shouldThrow?: boolean; message?: string }> = ({
  shouldThrow = true,
  message = 'Simulated render crash',
}) => {
  if (shouldThrow) {
    throw new Error(message);
  }
  return <div>Component rendered successfully</div>;
};

describe('ErrorBoundary', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders children when there is no error', () => {
    render(
      <ErrorBoundary fallbackTitle="Error Title">
        <div>Safe Content</div>
      </ErrorBoundary>
    );

    expect(screen.getByText('Safe Content')).toBeInTheDocument();
  });

  it('catches render error, displays fallback UI and context info, and invokes onError', () => {
    const onError = vi.fn();
    const mockLog = vi.fn();
    (window as any).electronAPI = { log: mockLog };

    // Suppress console.error in test output for intentional error
    const spyConsole = vi.spyOn(console, 'error').mockImplementation(() => {});

    render(
      <ErrorBoundary
        fallbackTitle="Custom Fallback Title"
        contextInfo="Document: test.png (id: 123)"
        onError={onError}
      >
        <BuggyComponent message="Custom error test" />
      </ErrorBoundary>
    );

    expect(screen.getByText('Custom Fallback Title')).toBeInTheDocument();
    expect(screen.getByText('Document: test.png (id: 123)')).toBeInTheDocument();
    expect(screen.getByText('Custom error test')).toBeInTheDocument();
    expect(onError).toHaveBeenCalledTimes(1);
    expect(mockLog).toHaveBeenCalledWith(
      expect.objectContaining({
        level: 'ERROR',
        message: expect.stringContaining('[ErrorBoundary] [Document: test.png (id: 123)] Caught render error'),
      })
    );

    spyConsole.mockRestore();
  });

  it('automatically recovers when resetKeys change', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});

    const TestParent: React.FC = () => {
      const [activeId, setActiveId] = useState('doc-1');
      return (
        <div>
          <button onClick={() => setActiveId('doc-2')}>Switch to doc-2</button>
          <ErrorBoundary resetKeys={[activeId]} fallbackTitle="Error in document">
            {activeId === 'doc-1' ? (
              <BuggyComponent message="Doc 1 failed" />
            ) : (
              <div>Doc 2 Loaded Fine</div>
            )}
          </ErrorBoundary>
        </div>
      );
    };

    render(<TestParent />);

    expect(screen.getByText('Error in document')).toBeInTheDocument();
    expect(screen.getByText('Doc 1 failed')).toBeInTheDocument();

    // Click switch button to change resetKeys
    fireEvent.click(screen.getByText('Switch to doc-2'));

    // Should auto-reset and render doc-2
    expect(screen.getByText('Doc 2 Loaded Fine')).toBeInTheDocument();
    expect(screen.queryByText('Error in document')).not.toBeInTheDocument();
  });

  it('resets error state when "Try Again" button is clicked', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});

    let shouldFail = true;
    const DynamicComponent: React.FC = () => {
      if (shouldFail) {
        throw new Error('Initial failure');
      }
      return <div>Recovered Content</div>;
    };

    const onReset = vi.fn();

    render(
      <ErrorBoundary onReset={onReset} fallbackTitle="Error Title">
        <DynamicComponent />
      </ErrorBoundary>
    );

    expect(screen.getByText('Initial failure')).toBeInTheDocument();

    shouldFail = false;
    fireEvent.click(screen.getByRole('button', { name: 'Try Again' }));

    expect(onReset).toHaveBeenCalledTimes(1);
    expect(screen.getByText('Recovered Content')).toBeInTheDocument();
  });
});
