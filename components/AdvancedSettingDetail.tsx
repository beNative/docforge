import React, { useEffect, useMemo, useState } from 'react';
import Button from './Button';
import ToggleSwitch from './ToggleSwitch';

type ValueType = 'string' | 'number' | 'boolean' | 'object' | 'array' | 'null' | 'unknown';

const getValueType = (value: any): ValueType => {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  if (typeof value === 'object') return 'object';
  if (typeof value === 'boolean') return 'boolean';
  if (typeof value === 'number') return 'number';
  if (typeof value === 'string') return 'string';
  return 'unknown';
};

const cloneValue = (value: any) => {
  if (value === undefined || value === null) {
    return value;
  }
  if (typeof value === 'object') {
    try {
      return JSON.parse(JSON.stringify(value));
    } catch (error) {
      return value;
    }
  }
  return value;
};

const areValuesEqual = (a: any, b: any) => {
  if (a === b) {
    return true;
  }
  if (typeof a !== typeof b) {
    return false;
  }
  if (typeof a === 'object') {
    if (a === null || b === null) {
      return a === b;
    }
    try {
      return JSON.stringify(a) === JSON.stringify(b);
    } catch (error) {
      return false;
    }
  }
  return false;
};

const formatValuePreview = (value: any) => {
  const type = getValueType(value);
  switch (type) {
    case 'string':
      return value === '' ? '"" (empty string)' : `"${value}"`;
    case 'number':
    case 'boolean':
      return String(value);
    case 'array':
      return `Array (${Array.isArray(value) ? value.length : 0} items)`;
    case 'object':
      return `Object (${value ? Object.keys(value).length : 0} keys)`;
    case 'null':
      return 'null';
    default:
      return 'Not set';
  }
};

interface AdvancedSettingDetailProps {
  path: (string | number)[] | null;
  value: any;
  defaultValue: any;
  onSettingChange: (path: (string | number)[], value: any) => void;
  onJsonErrorChange: (message: string | null) => void;
  jsonError: string | null;
  pythonValidationError?: string | null;
}

const AdvancedSettingDetail: React.FC<AdvancedSettingDetailProps> = ({
  path,
  value,
  defaultValue,
  onSettingChange,
  onJsonErrorChange,
  jsonError,
  pythonValidationError,
}) => {
  const [jsonDraft, setJsonDraft] = useState('');

  const pathLabel = useMemo(() => {
    if (!path) {
      return '';
    }
    return path.map((segment) => (typeof segment === 'number' ? segment : String(segment))).join(' › ');
  }, [path]);

  const pathId = useMemo(() => {
    if (!path) {
      return 'advanced-setting';
    }
    return path.map((segment) => String(segment)).join('-');
  }, [path]);

  const valueType = useMemo<ValueType>(() => {
    if (path === null) {
      return 'unknown';
    }
    return getValueType(value);
  }, [path, value]);

  useEffect(() => {
    if (path === null) {
      setJsonDraft('');
      onJsonErrorChange(null);
      return;
    }

    if (valueType === 'object' || valueType === 'array' || valueType === 'null') {
      if (value === null) {
        setJsonDraft('null');
      } else {
        try {
          setJsonDraft(JSON.stringify(value, null, 2));
        } catch (error) {
          setJsonDraft('');
        }
      }
    } else {
      setJsonDraft('');
    }
    onJsonErrorChange(null);
  }, [path, value, valueType, onJsonErrorChange]);

  if (!path) {
    return (
      <div className="border border-border-color rounded-lg p-6 h-full flex items-center justify-center text-sm text-text-secondary">
        Select a setting from the tree to edit its details.
      </div>
    );
  }

  if (typeof value === 'undefined') {
    return (
      <div className="border border-border-color rounded-lg p-6 h-full flex items-center justify-center text-sm text-text-secondary">
        This setting is not available in the current configuration.
      </div>
    );
  }

  const handleStringChange = (nextValue: string) => {
    onSettingChange(path, nextValue);
    onJsonErrorChange(null);
  };

  const handleNumberChange = (nextValue: string) => {
    const parsed = Number(nextValue);
    onSettingChange(path, Number.isNaN(parsed) ? value : parsed);
    onJsonErrorChange(null);
  };

  const handleBooleanChange = (nextValue: boolean) => {
    onSettingChange(path, nextValue);
    onJsonErrorChange(null);
  };

  const handleJsonChange = (nextValue: string) => {
    setJsonDraft(nextValue);
    try {
      const parsed = JSON.parse(nextValue);
      onSettingChange(path, parsed);
      onJsonErrorChange(null);
    } catch (error) {
      onJsonErrorChange(error instanceof Error ? error.message : 'Invalid JSON');
    }
  };

  const handleResetToDefault = () => {
    if (typeof defaultValue === 'undefined') {
      return;
    }
    onSettingChange(path, cloneValue(defaultValue));
    onJsonErrorChange(null);
  };

  const canReset = typeof defaultValue !== 'undefined' && !areValuesEqual(value, defaultValue);

  const renderEditor = () => {
    switch (valueType) {
      case 'string':
        return (
          <input
            type="text"
            value={value ?? ''}
            onChange={(event) => handleStringChange(event.target.value)}
            className="w-full bg-background border border-border-color rounded-md px-3 py-2 text-sm text-text-main focus:outline-none focus:ring-1 focus:ring-primary"
          />
        );
      case 'number':
        return (
          <input
            type="number"
            value={value ?? 0}
            onChange={(event) => handleNumberChange(event.target.value)}
            className="w-full bg-background border border-border-color rounded-md px-3 py-2 text-sm text-text-main focus:outline-none focus:ring-1 focus:ring-primary"
          />
        );
      case 'boolean':
        return (
          <div className="flex items-center gap-3">
            <ToggleSwitch id={`advanced-${pathId}`} checked={Boolean(value)} onChange={handleBooleanChange} />
            <span className="text-xs text-text-secondary">{value ? 'Enabled' : 'Disabled'}</span>
          </div>
        );
      case 'object':
      case 'array':
      case 'null':
        return (
          <textarea
            value={jsonDraft}
            onChange={(event) => handleJsonChange(event.target.value)}
            className="w-full h-60 bg-background border border-border-color rounded-md px-3 py-2 text-sm text-text-main focus:outline-none focus:ring-1 focus:ring-primary font-mono"
            spellCheck={false}
          />
        );
      default:
        return (
          <textarea
            value={jsonDraft}
            onChange={(event) => handleJsonChange(event.target.value)}
            className="w-full h-48 bg-background border border-border-color rounded-md px-3 py-2 text-sm text-text-main focus:outline-none focus:ring-1 focus:ring-primary font-mono"
            placeholder="Enter JSON to set this value"
            spellCheck={false}
          />
        );
    }
  };

  return (
    <div className="border border-border-color rounded-lg p-4 bg-background h-full flex flex-col gap-4">
      <div className="space-y-3">
        <div>
          <p className="text-xs font-semibold text-text-secondary uppercase tracking-wide">Selected Path</p>
          <p className="font-mono text-sm text-text-main break-all">{pathLabel}</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <p className="text-xs font-semibold text-text-secondary uppercase tracking-wide">Value Type</p>
            <p className="text-sm font-medium text-text-main capitalize">{valueType}</p>
          </div>
          <div>
            <p className="text-xs font-semibold text-text-secondary uppercase tracking-wide">Default</p>
            <p className="text-sm text-text-secondary">{formatValuePreview(defaultValue)}</p>
          </div>
        </div>
        {typeof defaultValue !== 'undefined' && (
          <div>
            <div className="flex items-center justify-between gap-2 mb-2">
              <p className="text-xs font-semibold text-text-secondary uppercase tracking-wide">Default Value</p>
              <Button variant="secondary" className="px-2 py-1 text-xs" onClick={handleResetToDefault} disabled={!canReset}>
                Reset to default
              </Button>
            </div>
            <pre className="bg-secondary/40 border border-border-color rounded-md p-3 text-xs font-mono text-text-main whitespace-pre-wrap break-all max-h-40 overflow-auto">
              {(() => {
                try {
                  return JSON.stringify(defaultValue, null, 2);
                } catch (error) {
                  return String(defaultValue);
                }
              })()}
            </pre>
          </div>
        )}
      </div>

      <div className="flex-1 flex flex-col gap-2">
        <p className="text-xs font-semibold text-text-secondary uppercase tracking-wide">Current Value</p>
        {renderEditor()}
      </div>

      {(jsonError || pythonValidationError) && (
        <div className="space-y-2">
          {jsonError && (
            <div className="border border-destructive-text/20 bg-destructive-text/5 text-destructive-text text-xs rounded-md px-3 py-2">
              JSON error: {jsonError}
            </div>
          )}
          {pythonValidationError && (
            <div className="border border-destructive-text/20 bg-destructive-text/5 text-destructive-text text-xs rounded-md px-3 py-2">
              Python settings error: {pythonValidationError}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default AdvancedSettingDetail;
