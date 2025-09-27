import type { Settings, LogLevel } from '../types';

interface OllamaResponse {
  model: string;
  created_at: string;
  response: string;
  done: boolean;
}

interface OpenAIResponse {
  choices: {
    message: {
      content: string;
    };
  }[];
}

const createBody = (apiType: 'ollama' | 'openai' | 'unknown', model: string, content: string) => {
    if (apiType === 'ollama') {
        return JSON.stringify({
            model: model,
            prompt: content,
            stream: false,
        });
    }
    // openai compatible
    return JSON.stringify({
        model: model,
        messages: [{ role: 'user', content }],
        stream: false,
    });
};

const makeLLMRequest = async (
  metaPrompt: string,
  settings: Settings,
  addLog: (level: LogLevel, message: string) => void
): Promise<string> => {
  const { llmProviderUrl, llmModelName, apiType } = settings;

  if (!llmProviderUrl || !llmModelName || apiType === 'unknown') {
    const errorMsg = 'LLM provider is not configured. Please check your settings.';
    addLog('ERROR', errorMsg);
    throw new Error(errorMsg);
  }

  try {
    const body = createBody(apiType, llmModelName, metaPrompt);
    addLog('INFO', `Sending request to ${llmProviderUrl} with model ${llmModelName} (API: ${apiType}).`);

    const response = await fetch(llmProviderUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body,
    });

    if (!response.ok) {
      const errorText = await response.text();
      const errorMsg = `LLM provider responded with status ${response.status}: ${errorText}`;
      addLog('ERROR', errorMsg);
      throw new Error(errorMsg);
    }

    const data = await response.json();

    if (apiType === 'ollama') {
      return (data as OllamaResponse).response.trim();
    } else { // openai compatible
      return (data as OpenAIResponse).choices[0].message.content.trim();
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
    const connectionError = `Failed to connect to LLM provider at ${llmProviderUrl}. Please check your settings and ensure the provider is running. Details: ${errorMessage}`;

    console.error('Failed to connect to LLM provider:', error);
    addLog('ERROR', connectionError);

    if (error instanceof Error) {
      throw new Error(connectionError);
    }
    throw new Error('An unknown error occurred while contacting the LLM provider.');
  }
};

export const llmService = {
  refineDocument: async (documentContent: string, settings: Settings, addLog: (level: LogLevel, message: string) => void): Promise<string> => {
    const metaPrompt = `You are a world-class prompt engineering assistant. Your task is to refine the following user-provided document to make it more effective, clear, and comprehensive for a large language model. Do not answer the document's request, but improve it. Return only the improved document text.

Original Document:
---
${documentContent}
---
Refined Document:`;

    const result = await makeLLMRequest(metaPrompt, settings, addLog);
    addLog('INFO', 'Successfully received refined document from LLM provider.');
    return result;
  },

  generateTitle: async (documentContent: string, settings: Settings, addLog: (level: LogLevel, message: string) => void): Promise<string> => {
    const metaPrompt = `Generate a concise, descriptive title for the following document. The title should be 5 words or less. Return ONLY the title text, without any quotation marks or labels like "Title:".

Document:
---
${documentContent}
---
Title:`;

    const result = await makeLLMRequest(metaPrompt, settings, addLog);
    // Clean up the title - remove quotes and any leading/trailing weirdness.
    const cleanedTitle = result.replace(/["'“”]/g, '').trim();
    addLog('INFO', `Successfully generated and cleaned title: "${cleanedTitle}"`);
    return cleanedTitle;
  },
};