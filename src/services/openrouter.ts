const MODEL_ID = 'x-ai/grok-4.1-fast:free'

interface OpenRouterMessageContentPart {
  type: 'text' | 'image_url'
  text?: string
  image_url?: {
    url: string
  }
}

interface OpenRouterChoice {
  message?: {
    content?: string | OpenRouterMessageContentPart[]
  }
}

interface OpenRouterResponse {
  choices?: OpenRouterChoice[]
}

const getReferer = () => {
  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin
  }

  return 'http://localhost'
}

export async function describeImage(imageDataUrl: string): Promise<string> {
  const apiKey = import.meta.env.VITE_OPENROUTER_API_KEY

  if (!apiKey) {
    throw new Error('Missing VITE_OPENROUTER_API_KEY for OpenRouter')
  }

  const payload = {
    model: MODEL_ID,
    max_tokens: 180,
    temperature: 0.4,
    messages: [
      {
        role: 'system',
        content:
          'You are an assistive vision guide for a blind user. Describe what the camera sees in clear, calm English, prioritizing safety cues and any visible text.',
      },
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: 'Describe the live scene in under three concise sentences. Read any visible signage or text aloud.',
          },
          {
            type: 'image_url',
            image_url: {
              url: imageDataUrl,
            },
          },
        ],
      },
    ],
  }

  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
      'HTTP-Referer': getReferer(),
      'X-Title': 'Live Vision Narrator',
    },
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    const errorBody = await response.text()
    throw new Error(`OpenRouter error ${response.status}: ${errorBody}`)
  }

  const data = (await response.json()) as OpenRouterResponse
  const rawContent = data.choices?.[0]?.message?.content

  if (!rawContent) {
    throw new Error('No description was returned by the model')
  }

  if (typeof rawContent === 'string') {
    return rawContent.trim()
  }

  return rawContent
    .map((part) => part.text ?? '')
    .join(' ')
    .trim()
}
