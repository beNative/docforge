import React, { useEffect, useMemo, useState } from 'react';
import plantumlEncoder from 'plantuml-encoder';
import type { Settings } from '../../types';

export const PLANTUML_LANGS = ['plantuml', 'puml', 'uml'] as const;
const PLANTUML_SERVER = 'https://www.plantuml.com/plantuml/svg';

interface PlantUMLDiagramProps {
  code: string;
  mode: Settings['plantumlRendererMode'];
}

interface PlantUMLErrorProps {
  message: string;
  details?: string | null;
}

const PlantUMLError: React.FC<PlantUMLErrorProps> = ({ message, details }) => (
  <div className="df-plantuml" role="alert">
    <div className="df-plantuml-error">
      <div className="df-plantuml-error__message">{message}</div>
      {details && details.trim() && (
        <details className="df-plantuml-error__details">
          <summary>Technical details</summary>
          <code>{details}</code>
        </details>
      )}
    </div>
  </div>
);

const PlantUMLRemoteDiagram: React.FC<{ code: string }> = ({ code }) => {
  const { encoded, reason, error } = useMemo(() => {
    const trimmed = code.trim();
    if (!trimmed) {
      return { encoded: null, reason: 'empty' as const, error: 'The PlantUML code block is empty.' };
    }
    try {
      return { encoded: plantumlEncoder.encode(trimmed), reason: 'ok' as const, error: null };
    } catch (err) {
      return {
        encoded: null,
        reason: 'encode-error' as const,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }, [code]);

  const [hasError, setHasError] = useState(false);
  const [errorDetails, setErrorDetails] = useState<string | null>(error);

  useEffect(() => {
    setHasError(false);
    setErrorDetails(error);
  }, [error, encoded, code]);

  if (!encoded) {
    const message =
      reason === 'empty'
        ? 'PlantUML diagram is empty.'
        : 'Unable to encode PlantUML diagram.';
    return <PlantUMLError message={message} details={errorDetails} />;
  }

  if (hasError) {
    return (
      <PlantUMLError
        message="Failed to load PlantUML diagram from remote server."
        details={errorDetails ?? `Request URL: ${PLANTUML_SERVER}/${encoded}`}
      />
    );
  }

  return (
    <div className="df-plantuml">
      <img
        src={`${PLANTUML_SERVER}/${encoded}`}
        alt="PlantUML diagram"
        loading="lazy"
        onError={() => {
          setHasError(true);
          setErrorDetails(`Request URL: ${PLANTUML_SERVER}/${encoded}`);
        }}
      />
    </div>
  );
};

interface OfflineRenderState {
  status: 'idle' | 'loading' | 'success' | 'error';
  svg?: string;
  error?: string;
  details?: string | null;
}

const PlantUMLOfflineDiagram: React.FC<{ code: string }> = ({ code }) => {
  const [state, setState] = useState<OfflineRenderState>({ status: 'idle' });

  useEffect(() => {
    let cancelled = false;
    const trimmed = code.trim();

    if (!trimmed) {
      setState({ status: 'error', error: 'PlantUML diagram is empty.', details: null });
      return () => {
        cancelled = true;
      };
    }

    if (typeof window === 'undefined' || !window.electronAPI?.renderPlantUML) {
      setState({
        status: 'error',
        error: 'Local PlantUML renderer is not available in this environment.',
        details: 'Switch to remote rendering or run the desktop app with a Java runtime installed.',
      });
      return () => {
        cancelled = true;
      };
    }

    setState({ status: 'loading' });

    window.electronAPI
      .renderPlantUML(trimmed, 'svg')
      .then((result) => {
        if (cancelled) {
          return;
        }
        if (result?.success && result.svg) {
          setState({ status: 'success', svg: result.svg });
        } else {
          setState({
            status: 'error',
            error: result?.error || 'The local PlantUML renderer returned no output.',
            details: result?.details ?? null,
          });
        }
      })
      .catch((err) => {
        if (cancelled) {
          return;
        }
        const details = err instanceof Error ? err.message : String(err);
        setState({
          status: 'error',
          error: 'Unable to render PlantUML diagram locally.',
          details,
        });
      });

    return () => {
      cancelled = true;
    };
  }, [code]);

  if (state.status === 'loading' || state.status === 'idle') {
    return (
      <div className="df-plantuml">
        <div className="df-plantuml-loading">Rendering diagram locally...</div>
      </div>
    );
  }

  if (state.status === 'error') {
    return <PlantUMLError message={state.error ?? 'Unable to render PlantUML diagram locally.'} details={state.details} />;
  }

  if (state.status === 'success' && state.svg) {
    return (
      <div
        className="df-plantuml"
        role="img"
        aria-label="PlantUML diagram"
        dangerouslySetInnerHTML={{ __html: state.svg }}
      />
    );
  }

  return (
    <PlantUMLError
      message="Local PlantUML renderer did not return any SVG output."
      details={state.details}
    />
  );
};

export const PlantUMLDiagram: React.FC<PlantUMLDiagramProps> = ({ code, mode }) => {
  if (mode === 'offline') {
    return <PlantUMLOfflineDiagram code={code} />;
  }
  return <PlantUMLRemoteDiagram code={code} />;
};

