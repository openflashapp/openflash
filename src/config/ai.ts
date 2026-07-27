import type { AIProviderId, ProviderConfig, Settings } from '../types'

export interface AIProviderMeta {
  name: string
  baseUrl: string
  models: readonly string[]
  defaultModel: string
  icon: string
  color: string
  protocol: 'openai' | 'anthropic'
  requiresApiKey?: boolean
}

export const AI_PROVIDER_IDS = [
  'mistral',
  'openrouter',
  'openai',
  'anthropic',
  'gemini',
  'deepseek',
  'meta',
  'xai',
  'ollama',
  'lmstudio',
] as const satisfies readonly AIProviderId[]

export const AI_PROVIDERS: Record<AIProviderId, AIProviderMeta> = {
  mistral: {
    name: 'Mistral',
    baseUrl: 'https://api.mistral.ai/v1/chat/completions',
    models: ['mistral-small-latest', 'mistral-medium-latest', 'mistral-large-latest', 'open-mistral-nemo'],
    defaultModel: 'mistral-small-latest',
    icon: 'mistral',
    color: '#FF6B00',
    protocol: 'openai',
  },
  openrouter: {
    name: 'OpenRouter',
    baseUrl: 'https://openrouter.ai/api/v1/chat/completions',
    models: [
      'openrouter/free',
      'openai/gpt-oss-20b:free',
      'google/gemma-4-31b-it:free',
      'openai/gpt-4o-mini',
      'mistralai/mistral-small-3.1-24b-instruct',
      'deepseek/deepseek-chat-v3-0324',
      'google/gemini-2.5-flash-exp-03-25',
      'openai/o3-mini-high',
      'anthropic/claude-sonnet-4-20250514',
    ],
    defaultModel: 'mistralai/mistral-small-3.1-24b-instruct',
    icon: 'openrouter',
    color: '#B6FF00',
    protocol: 'openai',
  },
  openai: {
    name: 'OpenAI',
    baseUrl: 'https://api.openai.com/v1/chat/completions',
    models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-3.5-turbo'],
    defaultModel: 'gpt-4o-mini',
    icon: 'openai',
    color: 'var(--text)',
    protocol: 'openai',
  },
  anthropic: {
    name: 'Anthropic',
    baseUrl: 'https://api.anthropic.com/v1/messages',
    models: ['claude-sonnet-4-20250514', 'claude-3-5-haiku-latest', 'claude-3-opus-latest'],
    defaultModel: 'claude-sonnet-4-20250514',
    icon: 'anthropic',
    color: '#D97757',
    protocol: 'anthropic',
  },
  gemini: {
    name: 'Gemini',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions',
    models: ['gemini-2.5-flash', 'gemini-2.5-pro', 'gemini-2.0-flash'],
    defaultModel: 'gemini-2.5-flash',
    icon: 'gemini',
    color: '#4285F4',
    protocol: 'openai',
  },
  deepseek: {
    name: 'DeepSeek',
    baseUrl: 'https://api.deepseek.com/chat/completions',
    models: ['deepseek-chat', 'deepseek-reasoner'],
    defaultModel: 'deepseek-chat',
    icon: 'deepseek',
    color: '#4F6FFF',
    protocol: 'openai',
  },
  meta: {
    name: 'Meta',
    baseUrl: 'https://api.meta.ai/v1/chat/completions',
    models: ['llama-4-maverick', 'llama-4-scout'],
    defaultModel: 'llama-4-maverick',
    icon: 'meta',
    color: '#0066FF',
    protocol: 'openai',
  },
  xai: {
    name: 'xAI',
    baseUrl: 'https://api.x.ai/v1/chat/completions',
    models: ['grok-2', 'grok-2-mini'],
    defaultModel: 'grok-2',
    icon: 'xai',
    color: 'var(--text)',
    protocol: 'openai',
  },
  ollama: {
    name: 'Ollama',
    baseUrl: 'http://localhost:11434/v1/chat/completions',
    models: ['llama3.2', 'qwen2.5', 'gemma3', 'mistral'],
    defaultModel: 'llama3.2',
    icon: 'ollama',
    color: '#FFFFFF',
    protocol: 'openai',
    requiresApiKey: false,
  },
  lmstudio: {
    name: 'LM Studio',
    baseUrl: 'http://localhost:1234/v1/chat/completions',
    models: ['local-model'],
    defaultModel: 'local-model',
    icon: 'lmstudio',
    color: '#7C5CFC',
    protocol: 'openai',
    requiresApiKey: false,
  },
}

export function createDefaultProviderConfigs(): Record<AIProviderId, ProviderConfig> {
  return Object.fromEntries(
    AI_PROVIDER_IDS.map(id => [id, { apiKey: '', model: AI_PROVIDERS[id].defaultModel }]),
  ) as Record<AIProviderId, ProviderConfig>
}

export function createDefaultSettings(): Settings {
  return {
    cursorEffect: false,
    adsEnabled: false,
    vimMode: false,
    glowEffect: false,
    developerMode: false,
    activeProvider: 'mistral',
    providers: createDefaultProviderConfigs(),
    aiForm: {
      mode: 'custom',
      nativeLang: '',
      targetLang: '',
      template: 'vocabulary',
      withTranscription: false,
      transcriptionPlacement: 'question',
      transcriptionLang: 'target',
    },
  }
}

export function isAIProviderId(value: unknown): value is AIProviderId {
  return typeof value === 'string' && AI_PROVIDER_IDS.includes(value as AIProviderId)
}
