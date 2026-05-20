import React, { useMemo, useCallback } from 'react';
import type { ThemeContrastPreference, ThemeMode, ThemeTone, ThemeColorToken } from '../../types';
import { DEFAULT_SETTINGS } from '../../constants';
import * as HeroIcons from '../iconsets/Heroicons';
import * as LucideIcons from '../iconsets/Lucide';
import * as FeatherIcons from '../iconsets/Feather';
import * as TablerIcons from '../iconsets/Tabler';
import * as MaterialIcons from '../iconsets/Material';
import {
  SectionProps,
  detectPlatform,
  buildFontOptions,
  FontField,
  TONE_OPTIONS,
  CONTRAST_OPTIONS,
  THEME_MODE_LABELS,
  COLOR_TOKEN_METADATA,
  COLOR_TOKEN_TO_PALETTE_KEY,
  FontFamilySelector,
} from './SettingsHelpers';
import { computeThemePalette, cssColorToHex, THEME_COLOR_TOKENS, type ThemePalette } from '../../services/themeCustomization';
import ColorPicker from '../ColorPicker';
import Button from '../Button';
import SettingRow from '../SettingRow';

export const AppearanceSettingsSection: React.FC<Pick<SectionProps, 'settings' | 'setCurrentSettings'>> = ({
  settings,
  setCurrentSettings,
}) => {
  const CardButton = <T extends string>({
    name,
    value,
    children,
    onClick,
    isSelected,
  }: {
    name: string;
    value: T;
    children: React.ReactNode;
    onClick: (value: T) => void;
    isSelected: boolean;
  }) => (
    <button
      onClick={() => onClick(value)}
      className={`p-3 rounded-lg border-2 text-center transition-all w-full flex-1 ${
        isSelected ? 'border-primary bg-primary/5' : 'border-border-color bg-secondary hover:border-primary/50'
      }`}
    >
      <div className="flex items-center justify-around text-text-secondary p-2 bg-background rounded-md mb-2">{children}</div>
      <h4 className="font-semibold text-text-main text-xs">{name}</h4>
    </button>
  );

  const platform = useMemo(detectPlatform, []);

  const handleFontChange = useCallback(
    (field: FontField, fontFamily: string) => {
      setCurrentSettings((prev) => ({ ...prev, [field]: fontFamily.trim() }));
    },
    [setCurrentSettings]
  );

  const bodyFontOptions = useMemo(() => buildFontOptions('markdownBodyFontFamily', platform), [platform]);
  const headingFontOptions = useMemo(() => buildFontOptions('markdownHeadingFontFamily', platform), [platform]);
  const codeFontOptions = useMemo(() => buildFontOptions('markdownCodeFontFamily', platform), [platform]);
  const editorFontOptions = useMemo(() => buildFontOptions('editorFontFamily', platform), [platform]);

  const lightCodeBlockBackground = settings.markdownCodeBlockBackgroundLight.trim() || DEFAULT_SETTINGS.markdownCodeBlockBackgroundLight;
  const darkCodeBlockBackground = settings.markdownCodeBlockBackgroundDark.trim() || DEFAULT_SETTINGS.markdownCodeBlockBackgroundDark;

  const trimmedHighlightColorLight = settings.editorActiveLineHighlightColor.trim();
  const resolvedHighlightColorLight = trimmedHighlightColorLight || DEFAULT_SETTINGS.editorActiveLineHighlightColor;
  const isHighlightHexLight = /^#([0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(resolvedHighlightColorLight);
  const highlightColorPickerValueLight = isHighlightHexLight ? resolvedHighlightColorLight : DEFAULT_SETTINGS.editorActiveLineHighlightColor;
  const highlightColorDisplayLight = isHighlightHexLight ? resolvedHighlightColorLight.toUpperCase() : resolvedHighlightColorLight;

  const trimmedHighlightColorDark = settings.editorActiveLineHighlightColorDark.trim();
  const resolvedHighlightColorDark = trimmedHighlightColorDark || DEFAULT_SETTINGS.editorActiveLineHighlightColorDark;
  const isHighlightHexDark = /^#([0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(resolvedHighlightColorDark);
  const highlightColorPickerValueDark = isHighlightHexDark ? resolvedHighlightColorDark : DEFAULT_SETTINGS.editorActiveLineHighlightColorDark;
  const highlightColorDisplayDark = isHighlightHexDark ? resolvedHighlightColorDark.toUpperCase() : resolvedHighlightColorDark;

  const lightPalette = useMemo(() => computeThemePalette('light', settings), [settings]);
  const darkPalette = useMemo(() => computeThemePalette('dark', settings), [settings]);

  const activeTones = useMemo(
    () => ({
      light: settings.themeTone?.light ?? DEFAULT_SETTINGS.themeTone.light,
      dark: settings.themeTone?.dark ?? DEFAULT_SETTINGS.themeTone.dark,
    }),
    [settings.themeTone]
  );

  const activeContrast = settings.themeContrast ?? DEFAULT_SETTINGS.themeContrast;
  const contrastSummary = useMemo(
    () => CONTRAST_OPTIONS.find((option) => option.value === activeContrast) ?? CONTRAST_OPTIONS[0],
    [activeContrast]
  );

  const handleToneChange = useCallback(
    (mode: ThemeMode, tone: ThemeTone) => {
      setCurrentSettings((prev) => {
        const baseTone = prev.themeTone ?? DEFAULT_SETTINGS.themeTone;
        return {
          ...prev,
          themeTone: { ...baseTone, [mode]: tone },
        };
      });
    },
    [setCurrentSettings]
  );

  const handleContrastChange = useCallback(
    (contrast: ThemeContrastPreference) => {
      setCurrentSettings((prev) => ({ ...prev, themeContrast: contrast }));
    },
    [setCurrentSettings]
  );

  const handleColorOverrideChange = useCallback(
    (mode: ThemeMode, token: ThemeColorToken, rawValue: string) => {
      const value = rawValue.trim();
      setCurrentSettings((prev) => {
        const baseLight = { ...(prev.themeColorOverrides?.light ?? DEFAULT_SETTINGS.themeColorOverrides.light) };
        const baseDark = { ...(prev.themeColorOverrides?.dark ?? DEFAULT_SETTINGS.themeColorOverrides.dark) };
        const nextOverrides = {
          light: baseLight,
          dark: baseDark,
        };
        const target = mode === 'light' ? baseLight : baseDark;
        if (value) {
          target[token] = value;
        } else {
          delete target[token];
        }
        return {
          ...prev,
          themeColorOverrides: nextOverrides,
        };
      });
    },
    [setCurrentSettings]
  );

  const handleColorOverrideReset = useCallback(
    (mode: ThemeMode, token: ThemeColorToken) => {
      handleColorOverrideChange(mode, token, '');
    },
    [handleColorOverrideChange]
  );

  const renderToneControls = useCallback(
    (mode: ThemeMode) => {
      const selectedTone = activeTones[mode];
      return (
        <div className="flex w-full flex-wrap gap-2">
          {TONE_OPTIONS.map((option) => {
            const isActive = selectedTone === option.value;
            return (
              <button
                key={`${mode}-${option.value}`}
                type="button"
                onClick={() => handleToneChange(mode, option.value)}
                className={`flex-1 min-w-[140px] rounded-lg border px-3 py-2 text-left transition ${
                  isActive ? 'border-primary bg-primary/10 text-primary' : 'border-border-color bg-secondary hover:border-primary/40'
                }`}
                aria-pressed={isActive}
              >
                <span className="block text-sm font-semibold text-current">{option.label}</span>
                <span className="mt-1 block text-xs text-text-secondary">{option.description}</span>
              </button>
            );
          })}
        </div>
      );
    },
    [activeTones, handleToneChange]
  );

  const renderColorOverrideControls = useCallback(
    (mode: ThemeMode, palette: ThemePalette) => {
      const overrides = settings.themeColorOverrides?.[mode] ?? {};
      return (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {THEME_COLOR_TOKENS.map((token) => {
            const overrideValue = overrides[token] ?? '';
            const trimmedOverride = overrideValue.trim();
            const paletteKey = COLOR_TOKEN_TO_PALETTE_KEY[token];
            const paletteValue = palette[paletteKey];
            const fallbackHex = cssColorToHex(paletteValue) ?? paletteValue;
            const colorPickerValue =
              trimmedOverride && /^#([0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(trimmedOverride)
                ? trimmedOverride
                : cssColorToHex(paletteValue) ?? '#000000';
            const displayValue = trimmedOverride || fallbackHex;
            return (
              <div key={`${mode}-${token}`} className="space-y-3 rounded-lg border border-border-color bg-secondary/60 p-3">
                <div className="flex items-center gap-3">
                  <ColorPicker
                    color={colorPickerValue}
                    onChange={(next) => handleColorOverrideChange(mode, token, next)}
                    ariaLabel={`${THEME_MODE_LABELS[mode]} ${COLOR_TOKEN_METADATA[token].label} color`}
                  />
                  <div>
                    <h4 className="text-sm font-semibold text-text-main">{COLOR_TOKEN_METADATA[token].label}</h4>
                    <p className="text-xs text-text-secondary">{COLOR_TOKEN_METADATA[token].description}</p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    type="text"
                    value={trimmedOverride}
                    onChange={(event) => handleColorOverrideChange(mode, token, event.target.value)}
                    placeholder={fallbackHex.toString().toUpperCase()}
                    className="flex-1 min-w-[140px] rounded-md border border-border-color bg-background px-2 py-1 text-xs text-text-main focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/40"
                  />
                  <span className="font-mono text-[11px] text-text-secondary">Active: {displayValue.toUpperCase()}</span>
                  <Button type="button" variant="ghost" className="px-2 py-1 text-xs" onClick={() => handleColorOverrideReset(mode, token)}>
                    Reset
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      );
    },
    [handleColorOverrideChange, handleColorOverrideReset, settings.themeColorOverrides]
  );

  return (
    <section className="pt-2 pb-6">
      <h2 className="text-lg font-semibold text-text-main mb-4">Appearance</h2>
      <div className="space-y-6">
        <SettingRow label="Interface Scale" description="Adjust the size of all UI elements in the application.">
          <div className="flex items-center gap-4 w-60">
            <input
              id="uiScale"
              type="range"
              min="50"
              max="200"
              step="10"
              value={settings.uiScale}
              onChange={(e) => setCurrentSettings((prev) => ({ ...prev, uiScale: Number(e.target.value) }))}
              className="w-full h-2 bg-border-color rounded-lg appearance-none cursor-pointer range-slider"
            />
            <span className="font-semibold text-text-main tabular-nums min-w-[50px] text-right text-xs">{settings.uiScale}%</span>
          </div>
        </SettingRow>
        <SettingRow label="Document Tree Row Spacing" description="Adjust the vertical padding used for each entry in the sidebar tree.">
          <div className="flex items-center gap-4 w-60">
            <input
              id="documentTreeVerticalSpacing"
              type="range"
              min="0"
              max="16"
              step="1"
              value={settings.documentTreeVerticalSpacing}
              onChange={(e) => setCurrentSettings((prev) => ({ ...prev, documentTreeVerticalSpacing: Number(e.target.value) }))}
              className="w-full h-2 bg-border-color rounded-lg appearance-none cursor-pointer range-slider"
            />
            <span className="font-semibold text-text-main tabular-nums min-w-[50px] text-right text-xs">
              {settings.documentTreeVerticalSpacing}px
            </span>
          </div>
        </SettingRow>
        <SettingRow label="Document Tree Indent" description="Control how far nested folders and documents are indented.">
          <div className="flex items-center gap-4 w-60">
            <input
              id="documentTreeIndent"
              type="range"
              min="0"
              max="32"
              step="1"
              value={settings.documentTreeIndent}
              onChange={(e) => setCurrentSettings((prev) => ({ ...prev, documentTreeIndent: Number(e.target.value) }))}
              className="w-full h-2 bg-border-color rounded-lg appearance-none cursor-pointer range-slider"
            />
            <span className="font-semibold text-text-main tabular-nums min-w-[50px] text-right text-xs">{settings.documentTreeIndent}px</span>
          </div>
        </SettingRow>
        <SettingRow label="Icon Set" description="Customize the look of icons throughout the application.">
          <div className="grid grid-cols-3 gap-3 w-80">
            <CardButton
              name="Heroicons"
              value="heroicons"
              isSelected={settings.iconSet === 'heroicons'}
              onClick={(v) => setCurrentSettings((s) => ({ ...s, iconSet: v }))}
            >
              <HeroIcons.PlusIcon className="w-5 h-5" /> <HeroIcons.SparklesIcon className="w-5 h-5" /> <HeroIcons.FolderIcon className="w-5 h-5" />
            </CardButton>
            <CardButton
              name="Lucide"
              value="lucide"
              isSelected={settings.iconSet === 'lucide'}
              onClick={(v) => setCurrentSettings((s) => ({ ...s, iconSet: v }))}
            >
              <LucideIcons.PlusIcon className="w-5 h-5" /> <LucideIcons.SparklesIcon className="w-5 h-5" />{' '}
              <LucideIcons.FolderIcon className="w-5 h-5" />
            </CardButton>
            <CardButton
              name="Feather"
              value="feather"
              isSelected={settings.iconSet === 'feather'}
              onClick={(v) => setCurrentSettings((s) => ({ ...s, iconSet: v }))}
            >
              <FeatherIcons.PlusIcon className="w-5 h-5" /> <FeatherIcons.SparklesIcon className="w-5 h-5" />{' '}
              <FeatherIcons.FolderIcon className="w-5 h-5" />
            </CardButton>
            <CardButton
              name="Tabler"
              value="tabler"
              isSelected={settings.iconSet === 'tabler'}
              onClick={(v) => setCurrentSettings((s) => ({ ...s, iconSet: v }))}
            >
              <TablerIcons.PlusIcon className="w-5 h-5" /> <TablerIcons.SparklesIcon className="w-5 h-5" />{' '}
              <TablerIcons.FolderIcon className="w-5 h-5" />
            </CardButton>
            <CardButton
              name="Material"
              value="material"
              isSelected={settings.iconSet === 'material'}
              onClick={(v) => setCurrentSettings((s) => ({ ...s, iconSet: v }))}
            >
              <MaterialIcons.PlusIcon className="w-5 h-5" /> <MaterialIcons.SparklesIcon className="w-5 h-5" />{' '}
              <MaterialIcons.FolderIcon className="w-5 h-5" />
            </CardButton>
          </div>
        </SettingRow>
        <SettingRow label="Contrast Mode" description="Adjust the global text contrast for better readability.">
          <div className="w-full max-w-sm space-y-2">
            <select
              id="themeContrast"
              value={activeContrast}
              onChange={(event) => handleContrastChange(event.target.value as ThemeContrastPreference)}
              className="w-full rounded-md border border-border-color bg-background px-3 py-2 text-sm text-text-main focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/40"
            >
              {CONTRAST_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <p className="text-xs text-text-secondary">{contrastSummary.description}</p>
          </div>
        </SettingRow>
        <SettingRow label="Light Theme Tone" description="Choose the overall mood for surfaces while using the light theme.">
          {renderToneControls('light')}
        </SettingRow>
        <SettingRow label="Dark Theme Tone" description="Choose the overall mood for surfaces while using the dark theme.">
          {renderToneControls('dark')}
        </SettingRow>
        <SettingRow
          label="Light Theme Colors"
          description="Override specific color tokens for the light theme. Leave fields blank to inherit tone defaults."
        >
          {renderColorOverrideControls('light', lightPalette)}
        </SettingRow>
        <SettingRow
          label="Dark Theme Colors"
          description="Override specific color tokens for the dark theme. Leave fields blank to inherit tone defaults."
        >
          {renderColorOverrideControls('dark', darkPalette)}
        </SettingRow>
        <SettingRow label="Markdown Font Size" description="Adjust the base font size for the Markdown preview.">
          <div className="flex items-center gap-4 w-60">
            <input
              id="markdownFontSize"
              type="range"
              min="7"
              max="40"
              step="1"
              value={settings.markdownFontSize}
              onChange={(e) => setCurrentSettings((prev) => ({ ...prev, markdownFontSize: Number(e.target.value) }))}
              className="w-full h-2 bg-border-color rounded-lg appearance-none cursor-pointer range-slider"
            />
            <span className="font-semibold text-text-main tabular-nums min-w-[50px] text-right text-xs">{settings.markdownFontSize}px</span>
          </div>
        </SettingRow>
        <SettingRow label="Markdown Line Height" description="Control the spacing between lines of text for better readability.">
          <div className="flex items-center gap-4 w-60">
            <input
              id="markdownLineHeight"
              type="range"
              min="1.2"
              max="2.2"
              step="0.1"
              value={settings.markdownLineHeight}
              onChange={(e) => setCurrentSettings((prev) => ({ ...prev, markdownLineHeight: Number(e.target.value) }))}
              className="w-full h-2 bg-border-color rounded-lg appearance-none cursor-pointer range-slider"
            />
            <span className="font-semibold text-text-main tabular-nums min-w-[50px] text-right text-xs">
              {settings.markdownLineHeight.toFixed(1)}
            </span>
          </div>
        </SettingRow>
        <SettingRow label="Markdown Heading Spacing" description="Control the vertical space above headings to tighten or relax sections.">
          <div className="flex items-center gap-4 w-60">
            <input
              id="markdownHeadingSpacing"
              type="range"
              min="1.0"
              max="4.0"
              step="0.1"
              value={settings.markdownHeadingSpacing}
              onChange={(e) => setCurrentSettings((prev) => ({ ...prev, markdownHeadingSpacing: Number(e.target.value) }))}
              className="w-full h-2 bg-border-color rounded-lg appearance-none cursor-pointer range-slider"
            />
            <span className="font-semibold text-text-main tabular-nums min-w-[50px] text-right text-xs">
              {settings.markdownHeadingSpacing.toFixed(1)}x
            </span>
          </div>
        </SettingRow>
        <SettingRow label="Markdown Paragraph Spacing" description="Adjust the space between paragraphs and block elements.">
          <div className="flex items-center gap-4 w-60">
            <input
              id="markdownParagraphSpacing"
              type="range"
              min="0.4"
              max="2.0"
              step="0.05"
              value={settings.markdownParagraphSpacing}
              onChange={(e) => setCurrentSettings((prev) => ({ ...prev, markdownParagraphSpacing: Number(e.target.value) }))}
              className="w-full h-2 bg-border-color rounded-lg appearance-none cursor-pointer range-slider"
            />
            <span className="font-semibold text-text-main tabular-nums min-w-[50px] text-right text-xs">
              {settings.markdownParagraphSpacing.toFixed(2)}x
            </span>
          </div>
        </SettingRow>
        <SettingRow label="Markdown Max Width" description="Set the maximum width of the text content to improve line length.">
          <div className="flex items-center gap-4 w-60">
            <input
              id="markdownMaxWidth"
              type="range"
              min="500"
              max="4000"
              step="20"
              value={settings.markdownMaxWidth}
              onChange={(e) => setCurrentSettings((prev) => ({ ...prev, markdownMaxWidth: Number(e.target.value) }))}
              className="w-full h-2 bg-border-color rounded-lg appearance-none cursor-pointer range-slider"
            />
            <span className="font-semibold text-text-main tabular-nums min-w-[50px] text-right text-xs">{settings.markdownMaxWidth}px</span>
          </div>
        </SettingRow>
        <SettingRow label="Document Vertical Padding" description="Control the padding above and below the rendered document.">
          <div className="flex items-center gap-4 w-60">
            <input
              id="markdownContentPadding"
              type="range"
              min="0"
              max="240"
              step="4"
              value={settings.markdownContentPadding}
              onChange={(e) => setCurrentSettings((prev) => ({ ...prev, markdownContentPadding: Number(e.target.value) }))}
              className="w-full h-2 bg-border-color rounded-lg appearance-none cursor-pointer range-slider"
            />
            <span className="font-semibold text-text-main tabular-nums min-w-[50px] text-right text-xs">
              {settings.markdownContentPadding}px
            </span>
          </div>
        </SettingRow>
        <SettingRow label="Code Block Font Size" description="Adjust the font size used inside fenced code blocks.">
          <div className="flex items-center gap-4 w-60">
            <input
              id="markdownCodeFontSize"
              type="range"
              min="8"
              max="32"
              step="1"
              value={settings.markdownCodeFontSize}
              onChange={(e) => setCurrentSettings((prev) => ({ ...prev, markdownCodeFontSize: Number(e.target.value) }))}
              className="w-full h-2 bg-border-color rounded-lg appearance-none cursor-pointer range-slider"
            />
            <span className="font-semibold text-text-main tabular-nums min-w-[50px] text-right text-xs">{settings.markdownCodeFontSize}px</span>
          </div>
        </SettingRow>
        <FontFamilySelector
          id="markdownBodyFontFamily"
          label="Body Font Family"
          description="Typography used for paragraphs and general text."
          value={settings.markdownBodyFontFamily}
          placeholder="System UI, sans-serif"
          options={bodyFontOptions}
          defaultValue={DEFAULT_SETTINGS.markdownBodyFontFamily}
          onChange={(font) => handleFontChange('markdownBodyFontFamily', font)}
          helperText="Applies to paragraphs, lists, and regular text."
        />
        <FontFamilySelector
          id="markdownHeadingFontFamily"
          label="Heading Font Family"
          description="Choose a font family for headings or leave blank to inherit the body font."
          value={settings.markdownHeadingFontFamily}
          placeholder="Inter, sans-serif"
          options={headingFontOptions}
          defaultValue={DEFAULT_SETTINGS.markdownHeadingFontFamily}
          onChange={(font) => handleFontChange('markdownHeadingFontFamily', font)}
          helperText="Leave blank to reuse the body font."
        />
        <FontFamilySelector
          id="markdownCodeFontFamily"
          label="Code Font Family"
          description="Set the font used for inline code and code blocks."
          value={settings.markdownCodeFontFamily}
          placeholder="'JetBrains Mono', monospace"
          options={codeFontOptions}
          defaultValue={DEFAULT_SETTINGS.markdownCodeFontFamily}
          onChange={(font) => handleFontChange('markdownCodeFontFamily', font)}
          helperText="Also applies to the Markdown preview's code blocks."
        />
        <SettingRow label="Editor Font Size" description="Set the default font size for the code editor." htmlFor="editorFontSize">
          <div className="flex items-center gap-4 w-60">
            <input
              id="editorFontSize"
              type="range"
              min="10"
              max="32"
              step="1"
              value={settings.editorFontSize}
              onChange={(e) => setCurrentSettings((prev) => ({ ...prev, editorFontSize: Number(e.target.value) }))}
              className="w-full h-2 bg-border-color rounded-lg appearance-none cursor-pointer range-slider"
            />
            <span className="font-semibold text-text-main tabular-nums min-w-[50px] text-right text-xs">{settings.editorFontSize}px</span>
          </div>
        </SettingRow>
        <FontFamilySelector
          id="editorFontFamily"
          label="Editor Font Family"
          description="Choose the default font used in the Monaco-powered text editors."
          value={settings.editorFontFamily}
          placeholder="Consolas, 'Courier New', monospace"
          options={editorFontOptions}
          defaultValue={DEFAULT_SETTINGS.editorFontFamily}
          onChange={(font) => handleFontChange('editorFontFamily', font)}
          helperText="Affects both the primary editor and diff viewer."
        />
        <SettingRow
          label="Active Line Highlight (Light Theme)"
          description="Customize the background color used for the active line in Monaco editors when using the light theme."
          htmlFor="editorActiveLineHighlightColor"
        >
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-3">
              <ColorPicker
                id="editorActiveLineHighlightColor"
                color={highlightColorPickerValueLight}
                onChange={(next) => setCurrentSettings((prev) => ({ ...prev, editorActiveLineHighlightColor: next }))}
                ariaLabel="Select active line highlight color for light theme"
              />
              <span className="font-mono text-xs text-text-secondary break-all">{highlightColorDisplayLight}</span>
              <Button
                type="button"
                variant="ghost"
                className="px-2 py-1 text-xs"
                onClick={() =>
                  setCurrentSettings((prev) => ({ ...prev, editorActiveLineHighlightColor: DEFAULT_SETTINGS.editorActiveLineHighlightColor }))
                }
              >
                Reset
              </Button>
            </div>
            <input
              type="text"
              value={settings.editorActiveLineHighlightColor}
              onChange={(event) => setCurrentSettings((prev) => ({ ...prev, editorActiveLineHighlightColor: event.target.value }))}
              placeholder={DEFAULT_SETTINGS.editorActiveLineHighlightColor}
              className="w-full p-2 text-sm border border-border-color rounded-md bg-background text-text-main focus:outline-none focus:ring-1 focus:ring-primary font-mono"
            />
            <p className="text-xs text-text-secondary">Enter any valid CSS color value, such as #fff59d, #fff59d80, or rgba(255,255,0,0.3).</p>
          </div>
        </SettingRow>
        <SettingRow
          label="Active Line Highlight (Dark Theme)"
          description="Customize the active line background for Monaco editors when using the dark theme."
          htmlFor="editorActiveLineHighlightColorDark"
        >
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-3">
              <ColorPicker
                id="editorActiveLineHighlightColorDark"
                color={highlightColorPickerValueDark}
                onChange={(next) => setCurrentSettings((prev) => ({ ...prev, editorActiveLineHighlightColorDark: next }))}
                ariaLabel="Select active line highlight color for dark theme"
              />
              <span className="font-mono text-xs text-text-secondary break-all">{highlightColorDisplayDark}</span>
              <Button
                type="button"
                variant="ghost"
                className="px-2 py-1 text-xs"
                onClick={() =>
                  setCurrentSettings((prev) => ({
                    ...prev,
                    editorActiveLineHighlightColorDark: DEFAULT_SETTINGS.editorActiveLineHighlightColorDark,
                  }))
                }
              >
                Reset
              </Button>
            </div>
            <input
              type="text"
              value={settings.editorActiveLineHighlightColorDark}
              onChange={(event) => setCurrentSettings((prev) => ({ ...prev, editorActiveLineHighlightColorDark: event.target.value }))}
              placeholder={DEFAULT_SETTINGS.editorActiveLineHighlightColorDark}
              className="w-full p-2 text-sm border border-border-color rounded-md bg-background text-text-main focus:outline-none focus:ring-1 focus:ring-primary font-mono"
            />
            <p className="text-xs text-text-secondary">Enter any valid CSS color value, such as #2a2d2e, #2a2d2ecc, or rgba(42,45,46,0.5).</p>
          </div>
        </SettingRow>
        <SettingRow
          label="Code Block Background (Light Theme)"
          description="Adjust the background color for Markdown code blocks when using the light theme."
          htmlFor="markdownCodeBlockBackgroundLight"
        >
          <div className="flex items-center gap-3">
            <ColorPicker
              id="markdownCodeBlockBackgroundLight"
              color={lightCodeBlockBackground}
              onChange={(next) => setCurrentSettings((prev) => ({ ...prev, markdownCodeBlockBackgroundLight: next }))}
              ariaLabel="Select code block background color for light theme"
            />
            <span className="font-mono text-xs text-text-secondary">{lightCodeBlockBackground.toUpperCase()}</span>
            <Button
              type="button"
              variant="ghost"
              className="px-2 py-1 text-xs"
              onClick={() =>
                setCurrentSettings((prev) => ({ ...prev, markdownCodeBlockBackgroundLight: DEFAULT_SETTINGS.markdownCodeBlockBackgroundLight }))
              }
            >
              Reset
            </Button>
          </div>
        </SettingRow>
        <SettingRow
          label="Code Block Background (Dark Theme)"
          description="Adjust the background color for Markdown code blocks when using the dark theme."
          htmlFor="markdownCodeBlockBackgroundDark"
        >
          <div className="flex items-center gap-3">
            <ColorPicker
              id="markdownCodeBlockBackgroundDark"
              color={darkCodeBlockBackground}
              onChange={(next) => setCurrentSettings((prev) => ({ ...prev, markdownCodeBlockBackgroundDark: next }))}
              ariaLabel="Select code block background color for dark theme"
            />
            <span className="font-mono text-xs text-text-secondary">{darkCodeBlockBackground.toUpperCase()}</span>
            <Button
              type="button"
              variant="ghost"
              className="px-2 py-1 text-xs"
              onClick={() =>
                setCurrentSettings((prev) => ({ ...prev, markdownCodeBlockBackgroundDark: DEFAULT_SETTINGS.markdownCodeBlockBackgroundDark }))
              }
            >
              Reset
            </Button>
          </div>
        </SettingRow>
      </div>
    </section>
  );
};
