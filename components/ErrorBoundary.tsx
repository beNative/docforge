import React, { Component, ErrorInfo, ReactNode } from 'react';
import Button from './Button';
import { WarningIcon, CopyIcon, CheckIcon } from './Icons';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallbackTitle?: string;
  fallbackMessage?: string;
  contextInfo?: string;
  resetKeys?: any[];
  onReset?: () => void;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  copied: boolean;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  private copyTimeoutRef: ReturnType<typeof setTimeout> | null = null;

  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      copied: false,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    const contextPrefix = this.props.contextInfo ? ` [${this.props.contextInfo}]` : '';
    const formattedLog = `[ErrorBoundary]${contextPrefix} Caught render error: ${error.name}: ${error.message}\n` +
      `Stack: ${error.stack ?? 'N/A'}\n` +
      `Component Stack: ${errorInfo.componentStack ?? 'N/A'}`;

    console.error(formattedLog, { error, errorInfo });

    // Sync to main log file on disk if electronAPI is available
    if (typeof window !== 'undefined' && window.electronAPI?.log) {
      try {
        window.electronAPI.log({
          level: 'ERROR',
          message: formattedLog,
        });
      } catch (err) {
        console.warn('[ErrorBoundary] Failed to sync error log to main process:', err);
      }
    }

    this.setState({ errorInfo });
    this.props.onError?.(error, errorInfo);
  }

  componentDidUpdate(prevProps: ErrorBoundaryProps): void {
    if (this.state.hasError && this.props.resetKeys && prevProps.resetKeys) {
      const hasChanged = this.props.resetKeys.some(
        (key, index) => key !== prevProps.resetKeys?.[index]
      );
      if (hasChanged) {
        this.handleReset();
      }
    }
  }

  componentWillUnmount(): void {
    if (this.copyTimeoutRef) {
      clearTimeout(this.copyTimeoutRef);
    }
  }

  handleReset = (): void => {
    this.setState({ hasError: false, error: null, errorInfo: null, copied: false });
    this.props.onReset?.();
  };

  handleCopyDetails = (): void => {
    const { error, errorInfo } = this.state;
    const details = [
      `Context: ${this.props.contextInfo ?? 'General UI'}`,
      `Time: ${new Date().toISOString()}`,
      `Error: ${error?.name ?? 'Error'}: ${error?.message ?? 'Unknown error'}`,
      `Stack:\n${error?.stack ?? 'N/A'}`,
      `Component Stack:\n${errorInfo?.componentStack ?? 'N/A'}`,
    ].join('\n\n');

    navigator.clipboard?.writeText(details).then(() => {
      this.setState({ copied: true });
      if (this.copyTimeoutRef) clearTimeout(this.copyTimeoutRef);
      this.copyTimeoutRef = setTimeout(() => {
        this.setState({ copied: false });
      }, 2000);
    }).catch((err) => {
      console.warn('Failed to copy error details to clipboard:', err);
    });
  };

  render(): ReactNode {
    if (this.state.hasError) {
      const { fallbackTitle, fallbackMessage, contextInfo } = this.props;
      const { error, errorInfo, copied } = this.state;

      return (
        <div className="w-full h-full flex flex-col items-center justify-center p-6 bg-secondary text-text-main overflow-y-auto">
          <div className="max-w-xl w-full bg-background border border-border-color rounded-xl p-6 shadow-xl flex flex-col items-center text-center">
            <div className="w-12 h-12 rounded-full bg-destructive-bg/30 text-destructive-text flex items-center justify-center mb-3">
              <WarningIcon className="w-6 h-6" />
            </div>

            <h3 className="text-base font-semibold mb-1 text-text-main">
              {fallbackTitle ?? 'Something went wrong displaying this content'}
            </h3>

            {contextInfo && (
              <div className="text-xs font-mono bg-secondary/80 px-2.5 py-1 rounded text-text-secondary mb-3 border border-border-color/50 max-w-full truncate">
                {contextInfo}
              </div>
            )}

            <p className="text-xs text-destructive-text mb-4 font-medium">
              {fallbackMessage ?? error?.message ?? 'An unexpected error occurred during rendering.'}
            </p>

            {error?.stack && (
              <details className="w-full text-left mb-4 group">
                <summary className="text-xs text-text-secondary hover:text-text-main cursor-pointer select-none font-medium mb-2">
                  Show technical details
                </summary>
                <div className="bg-secondary/60 rounded-lg p-3 border border-border-color/60 max-h-48 overflow-auto">
                  <pre className="text-[11px] font-mono text-text-secondary whitespace-pre-wrap break-all leading-relaxed">
                    {error.stack}
                    {errorInfo?.componentStack && `\n\nComponent Stack:${errorInfo.componentStack}`}
                  </pre>
                </div>
              </details>
            )}

            <div className="flex items-center gap-3 mt-1">
              <Button onClick={this.handleReset} variant="primary" size="sm">
                Try Again
              </Button>
              <Button onClick={this.handleCopyDetails} variant="secondary" size="sm" className="flex items-center gap-1.5">
                {copied ? <CheckIcon className="w-4 h-4 text-success" /> : <CopyIcon className="w-4 h-4" />}
                {copied ? 'Copied Details' : 'Copy Error Details'}
              </Button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
