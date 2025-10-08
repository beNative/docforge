import React, { useState } from 'react';
import { ChevronDownIcon, ChevronRightIcon } from './Icons';
import ToggleSwitch from './ToggleSwitch';

type ValueType = 'string' | 'number' | 'boolean' | 'object' | 'array' | 'null';

const getValueType = (value: any): ValueType => {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  if (typeof value === 'object') return 'object';
  if (typeof value === 'boolean') return 'boolean';
  if (typeof value === 'number') return 'number';
  return 'string';
};

const ValueEditor: React.FC<{
  path: (string | number)[];
  value: any;
  onSettingChange: (path: (string | number)[], value: any) => void;
}> = ({ path, value, onSettingChange }) => {
  const type = getValueType(value);
  const inputClass = "w-full p-1 text-sm rounded-md bg-background text-text-main border border-border-color focus:ring-1 focus:ring-primary focus:outline-none";

  switch (type) {
    case 'string':
      return <input type="text" value={value} onChange={e => onSettingChange(path, e.target.value)} className={inputClass} />;
    case 'number':
      return <input type="number" value={value} onChange={e => onSettingChange(path, Number(e.target.value))} className={inputClass} />;
    case 'boolean':
      return <ToggleSwitch id={path.join('-')} checked={value} onChange={checked => onSettingChange(path, checked)} />;
    case 'null':
        return <span className="text-text-secondary italic px-1 text-sm">null</span>;
    default:
      return null;
  }
};

const TreeNode: React.FC<{
  nodeKey: string | number;
  nodeValue: any;
  path: (string | number)[];
  level: number;
  onSettingChange: (path: (string | number)[], value: any) => void;
}> = ({ nodeKey, nodeValue, path, level, onSettingChange }) => {
  const type = getValueType(nodeValue);
  const isObject = type === 'object' || type === 'array';
  const [isExpanded, setIsExpanded] = useState(true);

  return (
    <div style={{ paddingLeft: `${level * 20}px` }}>
      <div className="flex items-center gap-2 py-1.5">
        <div className="w-5 flex-shrink-0">
            {isObject && (
                <button onClick={() => setIsExpanded(!isExpanded)} className="p-0.5 rounded hover:bg-border-color/50">
                    {isExpanded ? <ChevronDownIcon className="w-4 h-4 text-text-secondary" /> : <ChevronRightIcon className="w-4 h-4 text-text-secondary" />}
                </button>
            )}
        </div>
        <span className="font-mono text-sm text-text-secondary select-none">{nodeKey}:</span>
        {!isObject && <div className="flex-1"><ValueEditor path={path} value={nodeValue} onSettingChange={onSettingChange} /></div>}
        {isObject && <span className="text-xs text-text-secondary/70 font-mono">{type === 'array' ? `Array[${Object.keys(nodeValue).length}]` : 'Object'}</span>}
      </div>
      {isObject && isExpanded && (
        <div className="border-l border-border-color/50 ml-2.5">
          {Object.entries(nodeValue).map(([key, value]) => (
            <TreeNode key={key} nodeKey={key} nodeValue={value} path={[...path, key]} level={level + 1} onSettingChange={onSettingChange} />
          ))}
        </div>
      )}
    </div>
  );
};


interface SettingsTreeEditorProps {
  settings: object;
  onSettingChange: (path: (string | number)[], value: any) => void;
  className?: string;
}

const SettingsTreeEditor: React.FC<SettingsTreeEditorProps> = ({ settings, onSettingChange, className }) => {
  return (
    <div
      className={`p-2 rounded-lg bg-background border border-border-color overflow-y-auto ${
        className ?? 'h-96'
      }`}
    >
      {Object.entries(settings).map(([key, value]) => (
        <TreeNode key={key} nodeKey={key} nodeValue={value} path={[key]} level={0} onSettingChange={onSettingChange} />
      ))}
    </div>
  );
};

export default SettingsTreeEditor;