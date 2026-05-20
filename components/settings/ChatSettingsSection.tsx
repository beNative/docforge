import React from 'react';
import type { SectionProps } from './SettingsHelpers';
import * as Icons from '../Icons';
import Button from '../Button';
import ToggleSwitch from '../ToggleSwitch';
import SettingRow from '../SettingRow';
import { AGENT_TOOLS } from '../../services/agentService';

export const ChatSettingsSection: React.FC<SectionProps> = ({ settings, setCurrentSettings }) => {
  const toggleTool = (toolName: string) => {
    const currentEnabled = settings.chatEnabledTools || [];
    const nextEnabled = currentEnabled.includes(toolName)
      ? currentEnabled.filter((name) => name !== toolName)
      : [...currentEnabled, toolName];

    setCurrentSettings((prev) => ({
      ...prev,
      chatEnabledTools: nextEnabled,
    }));
  };

  const isToolEnabled = (toolName: string) => {
    return (settings.chatEnabledTools || []).includes(toolName);
  };

  const iconMap: Record<string, React.FC<Icons.IconProps>> = {
    FolderIcon: Icons.FolderIcon,
    FileIcon: Icons.FileIcon,
    EditIcon: Icons.PencilIcon,
    PlusIcon: Icons.PlusIcon,
    MoveIcon: Icons.ChevronRightIcon,
    TrashIcon: Icons.TrashIcon,
    TerminalIcon: Icons.TerminalIcon,
    SearchIcon: Icons.SearchIcon,
  };

  return (
    <section className="pt-2 pb-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2.5 bg-primary/10 rounded-xl text-primary shadow-sm">
          <Icons.SparklesIcon className="w-6 h-6" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-text-main">AI Chat Capabilities</h2>
          <p className="text-sm text-text-tertiary">Configure how the AI interacts with your workspace</p>
        </div>
      </div>

      <div className="space-y-6">
        {/* Core Agent Settings */}
        <div className="bg-secondary/30 border border-border-color/60 rounded-2xl overflow-hidden shadow-sm">
          <div className="p-6 space-y-6">
            <SettingRow
              label="Enable Agent Mode (Tool Calling)"
              description="Allows the AI to perform actions like reading/editing documents, creating files, and running scripts. Requires a model that supports tool-calling."
            >
              <ToggleSwitch
                id="chatEnableAgentMode"
                checked={settings.chatEnableAgentMode}
                onChange={(enabled) => setCurrentSettings((prev) => ({ ...prev, chatEnableAgentMode: enabled }))}
              />
            </SettingRow>

            <div className="h-px bg-border-color/40 mx-[-24px]" />

            <SettingRow
              label="Require Approval for Actions"
              description="When enabled, the AI will ask for your permission before performing any destructive actions or running scripts."
            >
              <ToggleSwitch
                id="chatAgentRequiresApproval"
                checked={settings.chatAgentRequiresApproval}
                onChange={(enabled) => setCurrentSettings((prev) => ({ ...prev, chatAgentRequiresApproval: enabled }))}
              />
            </SettingRow>
          </div>

          <div className="px-6 py-4 bg-primary/5 border-t border-border-color/40 flex gap-3 items-start">
            <Icons.InfoIcon className="w-4 h-4 text-primary mt-0.5" />
            <p className="text-[11px] text-text-tertiary leading-relaxed">
              Agent mode gives the AI significant power over your files. We recommend keeping <strong>Require Approval</strong> enabled for maximum security.
            </p>
          </div>
        </div>

        {/* Individual Tool Management */}
        <div className={`transition-all duration-300 ${settings.chatEnableAgentMode ? 'opacity-100' : 'opacity-40 pointer-events-none'}`}>
          <div className="flex items-center justify-between mb-4 px-2">
            <div>
              <h3 className="text-sm font-semibold text-text-main">Available Tools</h3>
              <p className="text-[11px] text-text-tertiary">Enable or disable specific capabilities for the AI Agent</p>
            </div>
            <div className="flex gap-2">
              <Button
                variant="ghost"
                className="text-[10px] h-6 px-2"
                onClick={() => setCurrentSettings((prev) => ({ ...prev, chatEnabledTools: AGENT_TOOLS.map((t) => t.name) }))}
              >
                Enable All
              </Button>
              <Button
                variant="ghost"
                className="text-[10px] h-6 px-2"
                onClick={() => setCurrentSettings((prev) => ({ ...prev, chatEnabledTools: [] }))}
              >
                Disable All
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {AGENT_TOOLS.map((tool) => {
              const Icon = iconMap[tool.icon] || Icons.FileIcon;
              const isEnabled = isToolEnabled(tool.name);

              return (
                <div
                  key={tool.name}
                  onClick={() => toggleTool(tool.name)}
                  className={`group relative flex items-start gap-4 p-4 rounded-xl border transition-all cursor-pointer select-none
                    ${isEnabled
                      ? 'bg-background border-primary/20 hover:border-primary/40 shadow-sm'
                      : 'bg-secondary/40 border-border-color/60 grayscale opacity-70 hover:opacity-100 hover:grayscale-0'
                    }`}
                >
                  <div className={`p-2 rounded-lg transition-colors ${isEnabled ? 'bg-primary/10 text-primary' : 'bg-secondary text-text-tertiary group-hover:bg-primary/10 group-hover:text-primary'}`}>
                    <Icon className="w-5 h-5" />
                  </div>

                  <div className="flex-1 pr-8">
                    <h4 className={`text-sm font-semibold transition-colors ${isEnabled ? 'text-text-main' : 'text-text-tertiary group-hover:text-text-main'}`}>
                      {tool.label}
                    </h4>
                    <p className="text-[11px] text-text-tertiary leading-tight mt-1">{tool.description}</p>
                  </div>

                  <div className="absolute top-4 right-4">
                    <div
                      className={`w-4 h-4 rounded-full border-2 transition-all flex items-center justify-center
                      ${isEnabled ? 'bg-primary border-primary' : 'border-border-color group-hover:border-primary/40'}`}
                    >
                      {isEnabled && <Icons.CheckIcon className="w-3 h-3 text-white" />}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
};
