import type { Settings, DocumentTemplate } from './types';

export const LOCAL_STORAGE_KEYS = {
  // UI state persistence:
  SIDEBAR_WIDTH: 'docforge_sidebar_width',
  LOGGER_PANEL_HEIGHT: 'docforge_logger_panel_height',
  EXPANDED_FOLDERS: 'docforge_expanded_folders',
  SIDEBAR_TEMPLATES_COLLAPSED: 'docforge_sidebar_templates_collapsed',
  SIDEBAR_TEMPLATES_PANEL_HEIGHT: 'docforge_sidebar_templates_panel_height',

  // Legacy keys used for migration check:
  LEGACY_PROMPTS: 'promptforge_prompts',
  LEGACY_TEMPLATES: 'promptforge_templates',
  LEGACY_SETTINGS: 'promptforge_settings',
  LEGACY_PROMPT_VERSIONS: 'promptforge_prompt_versions',
  LEGACY_TEMPLATES_INITIALIZED: 'promptforge_templates_initialized',
};

export const DEFAULT_SETTINGS: Settings = {
  llmProviderUrl: '',
  llmModelName: '',
  llmProviderName: '',
  apiType: 'unknown',
  iconSet: 'heroicons',
  autoSaveLogs: false,
  allowPrerelease: false,
  uiScale: 100,
  customShortcuts: {},
  markdownFontSize: 16,
  markdownLineHeight: 1.7,
  markdownMaxWidth: 800,
  markdownHeadingSpacing: 1.8,
  markdownCodeFontSize: 14,
  markdownBodyFontFamily: 'Inter, sans-serif',
  markdownHeadingFontFamily: 'Inter, sans-serif',
  markdownCodeFontFamily: '\'JetBrains Mono\', monospace',
  markdownContentPadding: 48,
  markdownParagraphSpacing: 0.75,
  pythonDefaults: {
    targetPythonVersion: '3.11',
    basePackages: [
      { name: 'pip', version: 'latest' },
      { name: 'setuptools', version: 'latest' },
      { name: 'wheel', version: 'latest' },
      { name: 'numpy' },
      { name: 'pandas' },
      { name: 'requests' },
    ],
    environmentVariables: {},
    workingDirectory: null,
  },
  pythonWorkingDirectory: null,
  pythonConsoleTheme: 'dark',
};

export const EXAMPLE_TEMPLATES: Omit<DocumentTemplate, 'template_id' | 'created_at' | 'updated_at'>[] = [
    {
        title: 'Creative Story Starter',
        content: 'Write the opening paragraph of a story about a {{character_type}} who discovers a mysterious {{object}} in a {{setting}}.',
    },
    {
        title: 'Technical Explainer',
        content: 'Explain the concept of {{technical_concept}} to a {{target_audience}} in simple terms. Use an analogy to help clarify the main idea.',
    },
    {
        title: 'Email Copywriter',
        content: 'Write a marketing email to promote a new product: {{product_name}}. The target audience is {{audience_description}}. The email should have a compelling subject line, highlight the key feature: {{key_feature}}, and include a clear call to action: {{call_to_action}}.',
    },
    {
        title: 'Code Generation',
        content: 'Write a function in {{programming_language}} that takes {{input_parameters}} as input and {{function_purpose}}. Include comments explaining the code.',
    },
    {
        title: 'Social Media Post',
        content: 'Draft a social media post for {{platform}} announcing {{announcement}}. The tone should be {{tone}}, and it should include the hashtag #{{hashtag}}.',
    },
    {
        title: 'Five Whys Root Cause Analysis',
        content: 'Perform a "Five Whys" root cause analysis for the following problem:\n\nProblem Statement: {{problem_statement}}\n\n1. Why did this happen?\n   - Because...\n2. Why did that happen?\n   - Because...\n3. Why did that happen?\n   - Because...\n4. Why did that happen?\n   - Because...\n5. Why did that happen?\n   - Because...\n\nRoot Cause:',
    },
];