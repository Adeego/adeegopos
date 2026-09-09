const crypto = require('crypto');
const fs = require('fs');
const http = require('http');
const os = require('os');
const path = require('path');
const { URL } = require('url');
const { app, shell } = require('electron');

const OPENAI_CODEX_BASE_URL = 'https://chatgpt.com/backend-api/codex';
const OPENAI_ISSUER = 'https://auth.openai.com';
const OPENAI_OAUTH_CLIENT_ID = 'app_EMoamEEZ73f0CkXaXp7hrann';
const OPENAI_OAUTH_PORT = Number(process.env.OPENAI_OAUTH_PORT || 1455);
const OPENAI_OAUTH_SCOPE = 'openid profile email offline_access api.connectors.read api.connectors.invoke';
const OPENAI_OAUTH_ORIGINATOR = process.env.OPENAI_OAUTH_ORIGINATOR || 'codex_cli_rs';
const DEFAULT_OPENAI_MODEL = 'gpt-5.4-mini';

let cachedClient = null;
let cachedClientKey = null;
let refreshPromise = null;
const installationId = crypto.randomUUID();

function base64Url(buffer) {
  return buffer
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function createPkce() {
  const verifier = base64Url(crypto.randomBytes(32));
  const challenge = base64Url(crypto.createHash('sha256').update(verifier).digest());
  return { verifier, challenge };
}

function getAuthFilePath() {
  const basePath = app && app.getPath ? app.getPath('userData') : path.join(os.homedir(), '.adeegopos');
  return path.join(basePath, 'openai-oauth.json');
}

function readStoredAuth() {
  try {
    const filePath = getAuthFilePath();
    if (!fs.existsSync(filePath)) return null;
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    console.error('[OpenAI OAuth] Failed to read stored auth:', error.message);
    return null;
  }
}

function writeStoredAuth(auth) {
  const filePath = getAuthFilePath();
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(auth, null, 2), { mode: 0o600 });
}

function deleteStoredAuth() {
  const filePath = getAuthFilePath();
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
  cachedClient = null;
  cachedClientKey = null;
}

function decodeJwtClaims(jwt) {
  if (!jwt || typeof jwt !== 'string') return {};
  const parts = jwt.split('.');
  if (parts.length < 2) return {};

  try {
    const payload = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = payload.padEnd(payload.length + ((4 - (payload.length % 4)) % 4), '=');
    return JSON.parse(Buffer.from(padded, 'base64').toString('utf8'));
  } catch (error) {
    return {};
  }
}

function extractAccountId(idToken, accessToken) {
  const idClaims = decodeJwtClaims(idToken);
  const accessClaims = decodeJwtClaims(accessToken);
  const authClaims = idClaims['https://api.openai.com/auth'] || accessClaims['https://api.openai.com/auth'] || {};

  return (
    authClaims.chatgpt_account_id ||
    idClaims.chatgpt_account_id ||
    accessClaims.chatgpt_account_id ||
    authClaims.account_id ||
    null
  );
}

async function postForm(url, data) {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(data),
  });
  const text = await response.text();

  if (!response.ok) {
    throw new Error(`OpenAI OAuth request failed (${response.status}): ${text}`);
  }

  return JSON.parse(text);
}

async function postJson(url, data) {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  const text = await response.text();

  if (!response.ok) {
    throw new Error(`OpenAI OAuth refresh failed (${response.status}): ${text}`);
  }

  return JSON.parse(text);
}

function buildCodexHeaders(auth) {
  const headers = {
    'Content-Type': 'application/json',
    Accept: 'text/event-stream',
    Authorization: `Bearer ${auth.accessToken}`,
    originator: OPENAI_OAUTH_ORIGINATOR,
    'x-codex-installation-id': installationId,
    'x-codex-window-id': `adeegopos:${auth.accountId}`,
  };

  if (auth.accountId) {
    headers['chatgpt-account-id'] = auth.accountId;
  }

  return headers;
}

async function postCodexStream(url, data, auth) {
  const response = await fetch(url, {
    method: 'POST',
    headers: buildCodexHeaders(auth),
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`OpenAI Codex request failed (${response.status}): ${text}`);
  }

  return readSseResponse(response);
}

async function readSseResponse(response) {
  if (!response.body) {
    return [];
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  const events = [];

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const blocks = buffer.split(/\r?\n\r?\n/);
    buffer = blocks.pop() || '';

    for (const block of blocks) {
      const event = parseSseBlock(block);
      if (event) events.push(event);
    }
  }

  buffer += decoder.decode();
  const finalEvent = parseSseBlock(buffer);
  if (finalEvent) events.push(finalEvent);

  return events;
}

function parseSseBlock(block) {
  if (!block.trim()) return null;

  const data = block
    .split(/\r?\n/)
    .filter((line) => line.startsWith('data:'))
    .map((line) => line.slice(5).trimStart())
    .join('\n');

  if (!data || data === '[DONE]') return null;

  try {
    return JSON.parse(data);
  } catch (error) {
    console.warn('[OpenAI OAuth] Failed to parse Codex stream event:', data);
    return null;
  }
}

async function exchangeCodeForTokens(code, redirectUri, verifier) {
  return postForm(`${OPENAI_ISSUER}/oauth/token`, {
    grant_type: 'authorization_code',
    code,
    redirect_uri: redirectUri,
    client_id: OPENAI_OAUTH_CLIENT_ID,
    code_verifier: verifier,
  });
}

async function refreshOAuthTokens(auth) {
  if (refreshPromise) {
    return refreshPromise;
  }

  refreshPromise = refreshOAuthTokensUnsafe(auth);

  try {
    return await refreshPromise;
  } finally {
    refreshPromise = null;
  }
}

async function refreshOAuthTokensUnsafe(auth) {
  if (!auth?.refreshToken) {
    throw new Error('OpenAI OAuth refresh token is missing');
  }

  const refreshed = await postJson(`${OPENAI_ISSUER}/oauth/token`, {
    client_id: OPENAI_OAUTH_CLIENT_ID,
    grant_type: 'refresh_token',
    refresh_token: auth.refreshToken,
  });

  const nextAuth = {
    ...auth,
    idToken: refreshed.id_token || auth.idToken,
    accessToken: refreshed.access_token || auth.accessToken,
    refreshToken: refreshed.refresh_token || auth.refreshToken,
    refreshedAt: new Date().toISOString(),
  };

  nextAuth.accountId = extractAccountId(nextAuth.idToken, nextAuth.accessToken);

  writeStoredAuth(nextAuth);
  cachedClient = null;
  cachedClientKey = null;
  return nextAuth;
}

function buildAuthorizeUrl(redirectUri, challenge, state) {
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: OPENAI_OAUTH_CLIENT_ID,
    redirect_uri: redirectUri,
    scope: OPENAI_OAUTH_SCOPE,
    code_challenge: challenge,
    code_challenge_method: 'S256',
    id_token_add_organizations: 'true',
    codex_cli_simplified_flow: 'true',
    state,
    originator: OPENAI_OAUTH_ORIGINATOR,
  });

  return `${OPENAI_ISSUER}/oauth/authorize?${params.toString()}`;
}

function waitForOAuthCallback(port, state) {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      try {
        const callbackUrl = new URL(req.url, `http://localhost:${port}`);

        if (callbackUrl.pathname !== '/auth/callback') {
          res.writeHead(404, { 'Content-Type': 'text/plain' });
          res.end('Not found');
          return;
        }

        const error = callbackUrl.searchParams.get('error');
        if (error) {
          throw new Error(callbackUrl.searchParams.get('error_description') || error);
        }

        if (callbackUrl.searchParams.get('state') !== state) {
          throw new Error('OpenAI OAuth state mismatch');
        }

        const code = callbackUrl.searchParams.get('code');
        if (!code) {
          throw new Error('OpenAI OAuth callback did not include a code');
        }

        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end('<h1>OpenAI sign-in complete</h1><p>You can return to AdeegoPOS.</p>');
        server.close();
        resolve(code);
      } catch (error) {
        res.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end('<h1>OpenAI sign-in failed</h1><p>You can close this tab and try again.</p>');
        server.close();
        reject(error);
      }
    });

    server.on('error', reject);
    server.listen(port, '127.0.0.1');
  });
}

async function loginWithOpenAIOAuth() {
  const { verifier, challenge } = createPkce();
  const state = base64Url(crypto.randomBytes(32));
  const redirectUri = `http://localhost:${OPENAI_OAUTH_PORT}/auth/callback`;
  const codePromise = waitForOAuthCallback(OPENAI_OAUTH_PORT, state);
  const authorizeUrl = buildAuthorizeUrl(redirectUri, challenge, state);

  await shell.openExternal(authorizeUrl);

  const code = await codePromise;
  const tokens = await exchangeCodeForTokens(code, redirectUri, verifier);
  const accountId = extractAccountId(tokens.id_token, tokens.access_token);

  const auth = {
    authMode: 'openai-oauth',
    idToken: tokens.id_token,
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token,
    accountId,
    refreshedAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
  };

  writeStoredAuth(auth);
  cachedClient = null;
  cachedClientKey = null;

  return getOpenAIAuthStatus();
}

async function getOpenAICredential() {
  let auth = readStoredAuth();
  if (!auth) {
    throw new Error('OpenAI OAuth is not configured. Sign in with OpenAI first.');
  }

  const refreshedAt = auth.refreshedAt ? new Date(auth.refreshedAt).getTime() : 0;
  const refreshAgeMs = Date.now() - refreshedAt;
  const refreshIntervalMs = 8 * 24 * 60 * 60 * 1000;

  if (refreshAgeMs > refreshIntervalMs) {
    auth = await refreshOAuthTokens(auth);
  }

  if (!auth.accessToken) {
    throw new Error('Stored OpenAI OAuth credentials are incomplete. Sign in again.');
  }

  const accountId = auth.accountId || extractAccountId(auth.idToken, auth.accessToken);
  if (!accountId) {
    throw new Error('Stored OpenAI OAuth credentials are missing the ChatGPT account id. Sign in again.');
  }

  return {
    accessToken: auth.accessToken,
    accountId,
    source: 'oauth-access-token',
  };
}

async function getOpenAIClient() {
  const { accessToken, accountId } = await getOpenAICredential();
  const clientKey = `${accessToken}:${accountId || ''}`;

  if (!cachedClient || cachedClientKey !== clientKey) {
    cachedClient = createCodexCompatClient({ accessToken, accountId });
    cachedClientKey = clientKey;
  }

  return cachedClient;
}

function createCodexCompatClient(auth) {
  return {
    chat: {
      completions: {
        create: (params) => createCodexChatCompletion(params, auth),
      },
    },
  };
}

function getResponsesInstructions(messages) {
  const instructions = (messages || [])
    .filter((message) => message.role === 'system' || message.role === 'developer')
    .map((message) => {
      if (Array.isArray(message.content)) {
        return message.content
          .map((part) => part.text || '')
          .filter(Boolean)
          .join('\n');
      }

      return message.content || '';
    })
    .filter(Boolean)
    .join('\n\n');

  return instructions || 'You are a helpful assistant.';
}

function convertChatMessagesToResponsesInput(messages) {
  const input = [];

  for (const message of messages || []) {
    if (message.role === 'system' || message.role === 'developer') {
      continue;
    }

    if (message.role === 'tool') {
      input.push({
        type: 'function_call_output',
        call_id: message.tool_call_id,
        output: message.content || '',
      });
      continue;
    }

    if (message.role === 'assistant' && Array.isArray(message.tool_calls) && message.tool_calls.length > 0) {
      for (const toolCall of message.tool_calls) {
        if (!toolCall.function?.name) {
          continue;
        }

        input.push({
          type: 'function_call',
          call_id: toolCall.id,
          name: toolCall.function?.name,
          arguments: toolCall.function?.arguments || '{}',
        });
      }
      continue;
    }

    input.push({
      role: message.role,
      content: message.content || '',
    });
  }

  return input;
}

function convertChatToolsToResponsesTools(tools) {
  return (tools || []).map((tool) => {
    if (tool.type !== 'function') return tool;

    return {
      type: 'function',
      name: tool.function.name,
      description: tool.function.description,
      parameters: tool.function.parameters,
      ...(tool.function.strict !== undefined ? { strict: Boolean(tool.function.strict) } : {}),
    };
  });
}

function extractResponseText(response) {
  if (response.output_text) return response.output_text;

  const parts = [];
  for (const item of response.output || []) {
    if (item.type !== 'message') continue;

    for (const content of item.content || []) {
      if (content.type === 'output_text' || content.type === 'text' || content.type === 'summary_text') {
        if (typeof content.text === 'string') {
          parts.push(content.text);
        } else if (content.text?.value) {
          parts.push(content.text.value);
        }
      }
    }
  }

  return parts.join('');
}

function extractResponseToolCalls(response) {
  return (response.output || [])
    .filter((item) => item.type === 'function_call' && item.name)
    .map((item) => ({
      id: item.call_id || item.id,
      type: 'function',
      function: {
        name: item.name,
        arguments: item.arguments || '{}',
      },
    }));
}

function buildResponseFromStreamEvents(events) {
  let completedResponse = null;
  let outputText = '';
  const functionCalls = new Map();
  const functionCallAliases = new Map();

  function appendOutputText(text) {
    if (!text) return;

    if (!outputText) {
      outputText = text;
      return;
    }

    // Some Codex stream events send the full accumulated text again rather than
    // only the next delta. Prefer the longest cumulative version and skip exact
    // repeats so Telegram does not receive the same answer multiple times.
    if (text === outputText || outputText.endsWith(text)) {
      return;
    }

    if (text.startsWith(outputText)) {
      outputText = text;
      return;
    }

    outputText += text;
  }

  function getFunctionCallKey(event, item) {
    const candidates = [
      item?.id,
      event.item_id,
      item?.call_id,
      event.call_id,
      event.output_index !== undefined ? `output:${event.output_index}` : null,
    ].filter(Boolean);

    for (const candidate of candidates) {
      if (functionCallAliases.has(candidate)) {
        return functionCallAliases.get(candidate);
      }
      if (functionCalls.has(candidate)) {
        return candidate;
      }
    }

    return candidates[0] || `call:${functionCalls.size}`;
  }

  function rememberFunctionCallAliases(key, event, item) {
    [
      item?.id,
      event.item_id,
      item?.call_id,
      event.call_id,
      event.output_index !== undefined ? `output:${event.output_index}` : null,
    ].filter(Boolean).forEach((alias) => functionCallAliases.set(alias, key));
  }

  for (const event of events) {
    const eventType = event.type || event.event;

    if (event.response && (eventType === 'response.completed' || eventType === 'response.done')) {
      completedResponse = event.response;
      continue;
    }

    if (event.response?.output) {
      completedResponse = event.response;
    }

    if (eventType === 'response.output_text.delta' || eventType === 'response.text.delta') {
      appendOutputText(event.delta || '');
      continue;
    }

    if (eventType === 'response.output_text.done' || eventType === 'response.text.done') {
      appendOutputText(event.text || '');
      continue;
    }

    const item = event.item;
    if (item?.type === 'message') {
      appendOutputText(extractResponseText({ output: [item] }));
      continue;
    }

    if (item?.type === 'function_call') {
      const key = getFunctionCallKey(event, item);
      rememberFunctionCallAliases(key, event, item);

      const existing = functionCalls.get(key) || {
        id: item.call_id || item.id || key,
        type: 'function',
        function: { name: item.name, arguments: '' },
      };
      existing.id = item.call_id || existing.id || item.id || key;
      existing.function.name = item.name || existing.function.name;
      existing.function.arguments = item.arguments || existing.function.arguments || '';
      functionCalls.set(key, existing);
      continue;
    }

    if (eventType === 'response.function_call_arguments.delta') {
      const key = getFunctionCallKey(event);
      rememberFunctionCallAliases(key, event);

      const existing = functionCalls.get(key) || {
        id: key,
        type: 'function',
        function: { name: event.name, arguments: '' },
      };
      existing.function.arguments += event.delta || '';
      functionCalls.set(key, existing);
      continue;
    }

    if (eventType === 'response.function_call_arguments.done') {
      const key = getFunctionCallKey(event);
      rememberFunctionCallAliases(key, event);

      const existing = functionCalls.get(key) || {
        id: key,
        type: 'function',
        function: { name: event.name, arguments: '' },
      };
      existing.function.arguments = event.arguments || existing.function.arguments || '{}';
      functionCalls.set(key, existing);
    }
  }

  if (completedResponse) {
    const completedText = extractResponseText(completedResponse);
    const completedToolCalls = extractResponseToolCalls(completedResponse);
    if (completedText || completedToolCalls.length > 0 || (!outputText && functionCalls.size === 0)) {
      return completedResponse;
    }
  }

  if (completedResponse?.id) {
    return {
      ...completedResponse,
      output: [
        ...(outputText ? [{
          type: 'message',
          content: [{ type: 'output_text', text: outputText }],
        }] : []),
        ...Array.from(functionCalls.values())
          .filter((toolCall) => toolCall.function.name)
          .map((toolCall) => ({
            type: 'function_call',
            call_id: toolCall.id,
            name: toolCall.function.name,
            arguments: toolCall.function.arguments || '{}',
          })),
      ],
    };
  }

  if (completedResponse) {
    return completedResponse;
  }

  const output = [];
  if (outputText) {
    output.push({
      type: 'message',
      content: [{ type: 'output_text', text: outputText }],
    });
  }

  for (const toolCall of functionCalls.values()) {
    if (!toolCall.function.name) {
      continue;
    }

    output.push({
      type: 'function_call',
      call_id: toolCall.id,
      name: toolCall.function.name,
      arguments: toolCall.function.arguments || '{}',
    });
  }

  return {
    id: `resp_${crypto.randomUUID()}`,
    created_at: Math.floor(Date.now() / 1000),
    output,
  };
}

async function createCodexChatCompletion(params, auth) {
  const body = {
    model: normalizeOpenAIModel(params.model || getOpenAIModel()),
    instructions: getResponsesInstructions(params.messages),
    input: convertChatMessagesToResponsesInput(params.messages),
    store: false,
    stream: true,
    tool_choice: params.tool_choice || 'auto',
    parallel_tool_calls: params.parallel_tool_calls !== false,
    include: [],
    prompt_cache_key: `adeegopos:${auth.accountId}`,
    text: { format: { type: 'text' } },
    client_metadata: {
      'x-codex-installation-id': installationId,
    },
  };

  const tools = convertChatToolsToResponsesTools(params.tools);
  if (tools.length > 0) body.tools = tools;
  if (params.max_tokens) body.max_output_tokens = params.max_tokens;
  if (params.max_completion_tokens) body.max_output_tokens = params.max_completion_tokens;
  if (params.temperature !== undefined) body.temperature = params.temperature;
  if (params.top_p !== undefined) body.top_p = params.top_p;

  const events = await postCodexStream(`${OPENAI_CODEX_BASE_URL}/responses`, body, auth);
  const failedEvent = events.find((event) => event.error || event.type === 'response.failed');
  if (failedEvent) {
    throw new Error(`OpenAI Codex stream failed: ${JSON.stringify(failedEvent.error || failedEvent)}`);
  }

  const response = buildResponseFromStreamEvents(events);
  const content = extractResponseText(response);
  const toolCalls = extractResponseToolCalls(response);
  const message = {
    role: 'assistant',
    content: content || null,
  };

  if (toolCalls.length > 0) {
    message.tool_calls = toolCalls;
  }

  const completion = {
    id: response.id,
    object: 'chat.completion',
    created: response.created_at || Math.floor(Date.now() / 1000),
    model: response.model || body.model,
    choices: [{
      index: 0,
      message,
      finish_reason: toolCalls.length > 0 ? 'tool_calls' : 'stop',
    }],
    usage: response.usage,
  };

  if (!params.stream) {
    return completion;
  }

  return (async function* streamSingleChunk() {
    yield {
      id: completion.id,
      object: 'chat.completion.chunk',
      created: completion.created,
      model: completion.model,
      choices: [{
        index: 0,
        delta: { content },
        finish_reason: completion.choices[0].finish_reason,
      }],
    };
  })();
}

function normalizeOpenAIModel(model) {
  return (model || DEFAULT_OPENAI_MODEL).replace(/^openai-codex\//, '');
}

function getOpenAIModel() {
  return normalizeOpenAIModel(process.env.OPENAI_MODEL || DEFAULT_OPENAI_MODEL);
}

function hasOpenAIAuth() {
  return Boolean(readStoredAuth());
}

function getOpenAIAuthStatus() {
  const stored = readStoredAuth();
  return {
    configured: Boolean(stored),
    source: stored ? 'openai-oauth' : null,
    accountId: stored?.accountId || null,
    model: getOpenAIModel(),
    authFile: getAuthFilePath(),
  };
}

module.exports = {
  getOpenAIAuthStatus,
  getOpenAIClient,
  getOpenAIModel,
  hasOpenAIAuth,
  loginWithOpenAIOAuth,
  logoutOpenAI: deleteStoredAuth,
};
