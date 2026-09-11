const { Bot } = require('grammy');
const { chat, clearConversation } = require('./index');

let bot = null;
let currentStoreNo = '';
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const SUPPORTED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

function stripBotMention(text, botUsername) {
  const value = String(text || '');
  if (!botUsername) return value.trim();
  return value.replace(new RegExp(`@${botUsername}`, 'gi'), '').trim();
}

function sessionIdFor(ctx) {
  return `telegram-${ctx.from.id}`;
}

function selectPhotoVariant(photos = []) {
  return [...photos]
    .filter((photo) => photo?.file_id && (!photo.file_size || photo.file_size <= MAX_IMAGE_BYTES))
    .sort((a, b) => ((a.width || 0) * (a.height || 0)) - ((b.width || 0) * (b.height || 0)))
    .pop() || null;
}

async function downloadTelegramImage(ctx, fileId, token, expectedMimeType) {
  const file = await ctx.api.getFile(fileId);
  if (!file.file_path) throw new Error('Telegram did not provide an image download path');

  const response = await fetch(`https://api.telegram.org/file/bot${token}/${file.file_path}`);
  if (!response.ok) throw new Error(`Telegram image download failed (${response.status})`);

  const contentLength = Number(response.headers.get('content-length') || 0);
  if (contentLength > MAX_IMAGE_BYTES) throw new Error('IMAGE_TOO_LARGE');

  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length > MAX_IMAGE_BYTES) throw new Error('IMAGE_TOO_LARGE');

  const responseMimeType = String(response.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
  const mimeType = SUPPORTED_IMAGE_TYPES.has(responseMimeType) ? responseMimeType : expectedMimeType;
  if (!SUPPORTED_IMAGE_TYPES.has(mimeType)) throw new Error('UNSUPPORTED_IMAGE_TYPE');

  return `data:${mimeType};base64,${bytes.toString('base64')}`;
}

function updateTelegramBotStoreNo(storeNo) {
  currentStoreNo = storeNo;
  console.log(`[Telegram Bot] Store number updated to: ${storeNo}`);
}

function startTelegramBot(db, storeNo) {
  currentStoreNo = storeNo;
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const allowedIds = (process.env.TELEGRAM_ALLOWED_IDS || '')
    .split(',')
    .map(id => id.trim())
    .filter(Boolean);

  if (!token) {
    console.log('[Telegram Bot] No TELEGRAM_BOT_TOKEN set, skipping bot start.');
    return;
  }

  if (allowedIds.length === 0) {
    console.log('[Telegram Bot] No TELEGRAM_ALLOWED_IDS set, skipping bot start.');
    return;
  }

  bot = new Bot(token);

  // Global error handler — log and continue, don't crash the bot
  bot.catch((err) => {
    console.error('[Telegram Bot] Error caught:', err.message || err);
  });

  // Middleware: check if user is allowed
  bot.use(async (ctx, next) => {
    if (ctx.from?.is_bot) return;

    const userId = String(ctx.from?.id || '');
    if (!allowedIds.includes(userId)) {
      console.log(`[Telegram Bot] Unauthorized user: ${userId}`);
      return;
    }
    await next();
  });

  // /start command
  bot.command('start', async (ctx) => {
    await ctx.reply(
      '🏪 *Adeego AI* is ready!\n\nAsk me anything about your store — sales, stock, debts, expenses, and more. You can also send a photo or image file for analysis.\n\nType /clear to start a new conversation.',
      { parse_mode: 'Markdown' }
    );
  });

  // /clear command — reset conversation
  bot.command('clear', async (ctx) => {
    const sessionId = `telegram-${ctx.from.id}`;
    clearConversation(sessionId);
    await ctx.reply('🔄 Conversation cleared. Ask me anything!');
  });

  async function respond(ctx, userMessage) {
    await ctx.replyWithChatAction('typing').catch(() => {});

    try {
      const response = String(await chat(sessionIdFor(ctx), userMessage, db, currentStoreNo, 'telegram') || '').trim();
      if (!response) {
        await ctx.reply('I did not receive a response. Please try again.');
        return;
      }

      // Telegram has a 4096 char limit per message
      const chunks = response.length > 4000 ? splitMessage(response, 4000) : [response];
      for (const chunk of chunks) {
        await ctx.reply(chunk, { parse_mode: 'Markdown' }).catch(async () => {
          // Fallback to plain text if markdown fails
          await ctx.reply(chunk).catch(() => {});
        });
      }
    } catch (error) {
      console.error('[Telegram Bot] Error:', error.message);
      const message = error.message === 'IMAGE_TOO_LARGE'
        ? '❌ That image is too large. Please send an image smaller than 5 MB.'
        : error.message === 'UNSUPPORTED_IMAGE_TYPE'
          ? '❌ Please send a JPEG, PNG, WebP, or GIF image.'
          : '❌ Sorry, something went wrong. Please try again.';
      await ctx.reply(message);
    }
  }

  // Handle all text messages
  bot.on('message:text', async (ctx) => {
    const botUsername = bot.botInfo?.username || '';
    const userMessage = stripBotMention(ctx.message.text, botUsername);
    if (userMessage) await respond(ctx, userMessage);
  });

  // Handle photos sent normally through Telegram.
  bot.on('message:photo', async (ctx) => {
    const photo = selectPhotoVariant(ctx.message.photo);
    if (!photo) {
      await ctx.reply('❌ That image is too large. Please send an image smaller than 5 MB.');
      return;
    }

    await handleImageMessage(ctx, photo.file_id, 'image/jpeg');
  });

  // Handle images sent as uncompressed files.
  bot.on('message:document', async (ctx) => {
    const document = ctx.message.document;
    const mimeType = String(document.mime_type || '').toLowerCase();
    if (!mimeType.startsWith('image/')) return;
    if (!SUPPORTED_IMAGE_TYPES.has(mimeType)) {
      await ctx.reply('❌ Please send a JPEG, PNG, WebP, or GIF image.');
      return;
    }
    if (document.file_size && document.file_size > MAX_IMAGE_BYTES) {
      await ctx.reply('❌ That image is too large. Please send an image smaller than 5 MB.');
      return;
    }

    await handleImageMessage(ctx, document.file_id, mimeType);
  });

  async function handleImageMessage(ctx, fileId, mimeType) {
    try {
      const imageUrl = await downloadTelegramImage(ctx, fileId, token, mimeType);
      const prompt = stripBotMention(ctx.message.caption, bot.botInfo?.username || '') ||
        'Describe this image and explain anything relevant to my store.';

      await respond(ctx, [
        { type: 'input_text', text: prompt },
        { type: 'input_image', image_url: imageUrl, detail: 'auto' },
      ]);
    } catch (error) {
      console.error('[Telegram Bot] Image error:', error.message);
      const message = error.message === 'IMAGE_TOO_LARGE'
        ? '❌ That image is too large. Please send an image smaller than 5 MB.'
        : error.message === 'UNSUPPORTED_IMAGE_TYPE'
          ? '❌ Please send a JPEG, PNG, WebP, or GIF image.'
          : '❌ I could not download that image. Please try again.';
      await ctx.reply(message);
    }
  }

  // Start polling
  bot.start({
    onStart: () => console.log('[Telegram Bot] Started successfully'),
  }).catch((err) => {
    console.error('[Telegram Bot] Polling error:', err.message || err);
  });

  console.log(`[Telegram Bot] Initializing with ${allowedIds.length} allowed user(s)...`);
}

function stopTelegramBot() {
  if (bot) {
    const b = bot;
    bot = null;
    b.stop().catch(() => {});
    console.log('[Telegram Bot] Stopped');
  }
}

// Send a proactive alert to all allowed Telegram users
async function sendAlert(message) {
  message = String(message || '').trim();
  if (!message) {
    console.log('[Telegram Bot] Skipping empty alert message');
    return;
  }

  if (!bot) {
    console.log('[Telegram Bot] Cannot send alert — bot not running');
    return;
  }

  const allowedIds = (process.env.TELEGRAM_ALLOWED_IDS || '')
    .split(',')
    .map(id => id.trim())
    .filter(Boolean);

  for (const userId of allowedIds) {
    try {
      if (message.length > 4000) {
        const chunks = splitMessage(message, 4000);
        for (const chunk of chunks) {
          await bot.api.sendMessage(userId, chunk, { parse_mode: 'Markdown' }).catch(() => {
            bot.api.sendMessage(userId, chunk).catch(() => {});
          });
        }
      } else {
        await bot.api.sendMessage(userId, message, { parse_mode: 'Markdown' }).catch(() => {
          bot.api.sendMessage(userId, message).catch(() => {});
        });
      }
    } catch (err) {
      console.error(`[Telegram Bot] Failed to send alert to ${userId}:`, err.message);
    }
  }
}

// Split long messages at newline boundaries
function splitMessage(text, maxLength) {
  const chunks = [];
  let remaining = text;

  while (remaining.length > maxLength) {
    let splitIndex = remaining.lastIndexOf('\n', maxLength);
    if (splitIndex === -1 || splitIndex < maxLength * 0.5) {
      splitIndex = maxLength;
    }
    chunks.push(remaining.substring(0, splitIndex));
    remaining = remaining.substring(splitIndex).trimStart();
  }

  if (remaining.length > 0) {
    chunks.push(remaining);
  }

  return chunks;
}

module.exports = { startTelegramBot, stopTelegramBot, updateTelegramBotStoreNo, sendAlert };
