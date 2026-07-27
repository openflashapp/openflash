import { AI_PROVIDERS } from '../config/ai'
import type { AIProviderId, ProviderConfig } from '../types'

export interface AICard {
  question: string
  answer: string
  transcription?: string
}

export interface AIResult {
  deck: string
  cards: AICard[]
}

export interface GenerateOptions {
  nativeLang: string
  targetLang: string
  template: string
  topic: string
  withTranscription: boolean
  transcriptionPlacement: 'question' | 'answer'
  transcriptionLang: 'target' | 'latin'
  count?: number
}

const TEMPLATES: Record<string, string> = {
  vocabulary: `Generate flashcards for vocabulary learning.
question = the word/phrase in {targetLang}
answer = its translation in {nativeLang} with an example sentence
Focus on the most useful and common words related to this topic.`,
  phrases: `Generate flashcards for useful phrases and expressions.
question = the phrase in {targetLang}
answer = its translation in {nativeLang} with usage context
Make the phrases practical for real conversations.`,
  grammar: `Generate flashcards for grammar rules and patterns.
question = a grammar rule example in {targetLang}
answer = the rule explanation in {nativeLang} and what it means
Include an example sentence that illustrates the rule.`,
  conversation: `Generate flashcards for conversation practice.
question = a question or prompt in {targetLang}
answer = its translation in {nativeLang} plus a model response
Focus on dialogue-based learning.`,
  custom: `{topic}`,
}

export function getPromptTemplate(key: string): string {
  return TEMPLATES[key] || TEMPLATES.custom
}

export function buildPrompt(opts: GenerateOptions): string {
  const template = getPromptTemplate(opts.template)
  let prompt = template
    .replace(/\{targetLang\}/g, opts.targetLang || 'the target language')
    .replace(/\{nativeLang\}/g, opts.nativeLang || 'the native language')
    .replace(/\{topic\}/g, opts.topic)

  return prompt
}

async function providerRequest(
  providerId: AIProviderId,
  config: ProviderConfig,
  body: Record<string, unknown>,
  signal?: AbortSignal,
): Promise<Response> {
  const meta = AI_PROVIDERS[providerId]
  if (!meta) throw new Error(`Unknown provider: ${providerId}`)
  if (meta.requiresApiKey !== false && !config.apiKey) throw new Error(`API key not found for ${meta.name}. Add it in Settings.`)

  const url = config.baseUrl || meta.baseUrl

  const requestBody: Record<string, unknown> = {
    ...body,
    model: config.model || meta.defaultModel,
  }
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }

  if (meta.protocol === 'anthropic') {
    const messages = Array.isArray(body.messages) ? body.messages : []
    const systemMessage = messages.find(isSystemMessage)
    requestBody.system = systemMessage?.content
    requestBody.messages = messages.filter(message => !isSystemMessage(message))
    requestBody.max_tokens = body.max_tokens ?? 8192
    delete requestBody.response_format
    headers['x-api-key'] = config.apiKey
    headers['anthropic-version'] = '2023-06-01'
  } else if (config.apiKey) {
    headers.Authorization = `Bearer ${config.apiKey}`
  }

  return fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(requestBody),
    signal,
  })
}

function isSystemMessage(value: unknown): value is { role: 'system'; content: string } {
  if (typeof value !== 'object' || value === null) return false
  const message = value as Record<string, unknown>
  return message.role === 'system' && typeof message.content === 'string'
}

export async function testApiKey(providerId: AIProviderId, config: ProviderConfig): Promise<boolean> {
  const meta = AI_PROVIDERS[providerId]
  if (!meta) throw new Error(`Unknown provider: ${providerId}`)
  if (meta.requiresApiKey !== false && !config.apiKey) throw new Error(`API key not found for ${meta.name}. Add it in Settings.`)

  const res = await providerRequest(providerId, config, {
    messages: [{ role: 'user', content: 'test' }],
    max_tokens: 1,
  })

  if (res.status === 401 || res.status === 403) throw new Error('Invalid API key')
  if (!res.ok) throw new Error(`${meta.name} API error (${res.status})`)
  return true
}

export async function discoverModels(providerId: AIProviderId, config: ProviderConfig): Promise<string[]> {
  const meta = AI_PROVIDERS[providerId]
  if (!meta) throw new Error(`Unknown provider: ${providerId}`)
  if (meta.requiresApiKey !== false && !config.apiKey) throw new Error(`API key not found for ${meta.name}. Add it in Settings.`)

  const { url, headers } = modelListRequest(providerId, config)
  const res = await fetch(url, { headers })
  if (!res.ok) throw new Error(`${meta.name} model list error (${res.status})`)
  return parseModelList(providerId, await res.json())
}

function modelListRequest(providerId: AIProviderId, config: ProviderConfig): { url: string; headers: Record<string, string> } {
  const meta = AI_PROVIDERS[providerId]
  const baseUrl = config.baseUrl || meta.baseUrl
  if (providerId === 'ollama') {
    return { url: new URL('/api/tags', baseUrl).toString(), headers: {} }
  }
  if (providerId === 'gemini') {
    const url = new URL('https://generativelanguage.googleapis.com/v1beta/models')
    url.searchParams.set('key', config.apiKey)
    return { url: url.toString(), headers: {} }
  }
  if (meta.protocol === 'anthropic') {
    return {
      url: new URL('/v1/models', baseUrl).toString(),
      headers: { 'x-api-key': config.apiKey, 'anthropic-version': '2023-06-01' },
    }
  }

  const url = new URL(baseUrl)
  url.pathname = url.pathname.replace(/\/(?:chat\/completions|messages)\/?$/, '/models')
  if (!url.pathname.endsWith('/models')) url.pathname = `${url.pathname.replace(/\/$/, '')}/models`
  return { url: url.toString(), headers: config.apiKey ? { Authorization: `Bearer ${config.apiKey}` } : {} }
}

function parseModelList(providerId: AIProviderId, data: unknown): string[] {
  if (typeof data !== 'object' || data === null) return []
  const payload = data as Record<string, unknown>
  const values = providerId === 'ollama'
    ? Array.isArray(payload.models) ? payload.models : []
    : Array.isArray(payload.data) ? payload.data : Array.isArray(payload.models) ? payload.models : []
  const models = values.flatMap(value => {
    if (typeof value === 'string') return [value]
    if (typeof value !== 'object' || value === null) return []
    const record = value as Record<string, unknown>
    const id = record.id ?? record.name ?? record.model
    return typeof id === 'string' ? [providerId === 'gemini' ? id.replace(/^models\//, '') : id] : []
  })
  return [...new Set(models.filter(model => model.trim()))]
}

export async function generateCards(
  providerId: AIProviderId,
  config: ProviderConfig,
  opts: GenerateOptions,
  signal?: AbortSignal,
): Promise<AIResult> {
  const meta = AI_PROVIDERS[providerId]
  if (!meta) throw new Error(`Unknown provider: ${providerId}`)
  if (meta.requiresApiKey !== false && !config.apiKey) throw new Error(`API key not found for ${meta.name}. Add it in Settings.`)

  const countMatch = opts.topic.match(/\b(\d{2,})\s*(card|word|flashcard|слов|карточек|карточки|слов[ао]?)\b/i) || opts.topic.match(/^(\d{2,})\b/)
  const count = opts.count || (countMatch ? parseInt(countMatch[1]) : 0)

  const countInstr = count
    ? `CRITICAL: Generate EXACTLY ${count} cards. Not ${count - 1}, not ${count + 1}. Exactly ${count}. Count your cards before responding and verify the count matches. If you cannot generate exactly ${count}, generate filler cards like "word = already covered".`
    : ''

  const transInstr = opts.withTranscription
    ? opts.transcriptionLang === 'latin'
      ? `The "transcription" field is REQUIRED and must be non-empty for EVERY card. Write pronunciation in LATIN script (for example "privet" or "annyeong").`
      : `The "transcription" field is REQUIRED and must be non-empty for EVERY card. Write a readable pronunciation guide in the target language's writing system.`
    : ''

  const schema = opts.withTranscription
    ? `{
  "deck": "suggested deck name",
  "cards": [
    { "question": "text", "answer": "text", "transcription": "required non-empty pronunciation" }
  ]
}`
    : `{
  "deck": "suggested deck name",
  "cards": [
    { "question": "text", "answer": "text" }
  ]
}`

  const systemPrompt = `You are a flashcard generator. Generate flashcards based on the user's request.

Return a JSON object with this exact structure:
${schema}

Rules:
- question MUST be just the word/phrase in the target language, NOT a full sentence like "What does X mean?"
- answer is the translation or explanation in the native language
- Never wrap the question in quotes or ask "What does ... mean?"
- Never put pronunciation inside the question or answer text
${countInstr}
${transInstr ? `- ${transInstr}` : ''}
- The deck name should be short and descriptive
- Only return valid JSON, no markdown or other text`

  const userPrompt = buildPrompt(opts)

  const res = await providerRequest(providerId, config, {
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    response_format: { type: 'json_object' },
    temperature: 0.7,
    max_tokens: 8192,
  }, signal)

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`${meta.name} API error (${res.status}): ${text}`)
  }

  const data: unknown = await res.json()
  const content = extractResponseText(data, meta.protocol)
  if (!content) throw new Error(`Empty response from ${meta.name}`)

  try {
    const parsed: unknown = JSON.parse(content)
    if (typeof parsed !== 'object' || parsed === null) throw new Error('Response is not an object')
    const payload = parsed as Record<string, unknown>
    const rawCards = Array.isArray(payload.cards) ? payload.cards : []
    const cards: AICard[] = rawCards.flatMap(card => {
      if (typeof card !== 'object' || card === null) return []
      const item = card as Record<string, unknown>
      if (typeof item.question !== 'string' || typeof item.answer !== 'string') return []
      const transcription = ['transcription', 'pronunciation', 'phonetic', 'ipa']
        .map(key => item[key])
        .find(value => typeof value === 'string' && value.trim().length > 0)
      return [{
        question: item.question.trim(),
        answer: item.answer.trim(),
        transcription: typeof transcription === 'string' ? transcription.trim() : undefined,
      }]
    }).filter(card => card.question && card.answer)
    if (cards.length === 0) throw new Error('No valid cards in response')
    if (opts.withTranscription && cards.some(card => !card.transcription)) {
      throw new Error('AI response omitted pronunciation for one or more cards. Please generate again.')
    }
    return { deck: typeof payload.deck === 'string' ? payload.deck.trim() : '', cards }
  } catch (e) {
    throw new Error(`Failed to parse ${meta.name} response: ${e instanceof Error ? e.message : 'unknown error'}`)
  }
}

function extractResponseText(data: unknown, protocol: 'openai' | 'anthropic'): string | undefined {
  if (typeof data !== 'object' || data === null) return undefined
  const payload = data as Record<string, unknown>

  if (protocol === 'anthropic') {
    if (!Array.isArray(payload.content)) return undefined
    const textBlock = payload.content.find(block => {
      if (typeof block !== 'object' || block === null) return false
      return (block as Record<string, unknown>).type === 'text'
    })
    if (typeof textBlock !== 'object' || textBlock === null) return undefined
    const text = (textBlock as Record<string, unknown>).text
    return typeof text === 'string' ? text : undefined
  }

  if (!Array.isArray(payload.choices)) return undefined
  const first = payload.choices[0]
  if (typeof first !== 'object' || first === null) return undefined
  const message = (first as Record<string, unknown>).message
  if (typeof message !== 'object' || message === null) return undefined
  const content = (message as Record<string, unknown>).content
  return typeof content === 'string' ? content : undefined
}
