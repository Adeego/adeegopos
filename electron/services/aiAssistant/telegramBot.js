const { Bot } = require('grammy');
const { chat, clearConversation } = require('./index');

let bot = null;
let currentStoreNo = '';

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
      '🏪 *Adeego AI* is ready!\n\nAsk me anything about your store — sales, stock, debts, expenses, and more.\n\nType /clear to start a new conversation.',
      { parse_mode: 'Markdown' }
    );
  });

  // /clear command — reset conversation
  bot.command('clear', async (ctx) => {
    const sessionId = `telegram-${ctx.from.id}`;
    clearConversation(sessionId);
    await ctx.reply('🔄 Conversation cleared. Ask me anything!');
  });

  // Handle all text messages
  bot.on('message:text', async (ctx) => {
    const chatType = ctx.chat?.type; // 'private', 'group', or 'supergroup'
    const botUsername = bot.botInfo?.username || '';

    // In group chats, only respond if bot is @mentioned or replied to
    if (chatType === 'group' || chatType === 'supergroup') {
      const isMentioned = botUsername && ctx.message.text.toLowerCase().includes(`@${botUsername.toLowerCase()}`);
      const isReplyToBot = ctx.message.reply_to_message?.from?.id === bot.botInfo?.id;
      if (!isMentioned && !isReplyToBot) return;
    }

    const sessionId = `telegram-${ctx.from.id}`;
    // Strip @botusername mention from the message so the AI gets a clean prompt
    let userMessage = ctx.message.text;
    if (botUsername) {
      userMessage = userMessage.replace(new RegExp(`@${botUsername}`, 'gi'), '').trim();
    }

    // Show typing indicator (non-fatal if network hiccups)
    await ctx.replyWithChatAction('typing').catch(() => {});

    try {
      const response = String(await chat(sessionId, userMessage, db, currentStoreNo, 'telegram') || '').trim();
      if (!response) {
        await ctx.reply('I did not receive a response. Please try again.');
        return;
      }

      // Telegram has a 4096 char limit per message
      if (response.length > 4000) {
        const chunks = splitMessage(response, 4000);
        for (const chunk of chunks) {
          await ctx.reply(chunk, { parse_mode: 'Markdown' }).catch(async () => {
            // Fallback to plain text if markdown fails
            await ctx.reply(chunk).catch(() => {});
          });
        }
      } else {
        await ctx.reply(response, { parse_mode: 'Markdown' }).catch(async () => {
          await ctx.reply(response).catch(() => {});
        });
      }
    } catch (error) {
      console.error('[Telegram Bot] Error:', error.message);
      await ctx.reply('❌ Sorry, something went wrong. Please try again.');
    }
  });

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
