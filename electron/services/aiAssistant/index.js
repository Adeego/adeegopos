const { toolDefinitions, executeTool } = require('./tools');
const { getOpenAIClient, getOpenAIModel } = require('../openaiAuth');

// In-memory conversation histories keyed by session ID
const conversations = new Map();

// Shopping period detection (reused from aiAnalysisService pattern)
function getShoppingPeriod() {
  const now = new Date();
  const day = now.getDate();
  const dayOfWeek = now.getDay();

  if (day >= 25 || day <= 5) return { name: 'End/Start of Month', description: 'High spending period — customers receive salaries' };
  if (day >= 13 && day <= 17) return { name: 'Mid-Month', description: 'Moderate spending — mid-month budgets' };
  if (dayOfWeek === 5 || dayOfWeek === 6) return { name: 'Weekend', description: 'Higher foot traffic expected' };
  return { name: 'Regular Weekday', description: 'Standard business day' };
}

function buildSystemPrompt(storeNo, channel) {
  const now = new Date();
  const period = getShoppingPeriod();

  return `You are Adeego AI, a smart business assistant built into AdeegoPOS.
You help store operators understand their business by querying real-time POS data.

Context:
- Store: ${storeNo}
- Date: ${now.toLocaleDateString('en-GB', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
- Time: ${now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
- Shopping Period: ${period.name} — ${period.description}
- Currency: KES (Kenyan Shillings)
- Channel: ${channel}

Rules:
- Always use the available tools to get real data. NEVER make up numbers or estimates.
- Format monetary values as "KES X,XXX" with comma separators.
- Be concise and direct. Use bullet points for lists.
- If a query returns too many results, summarize the top/most relevant items.
- You can record expenses. Before calling createExpense, ALWAYS summarize the details (amount, description, expense type, account, date) and ask the user to confirm. Only call createExpense after explicit confirmation.
- To record an expense, first call getAllExpenseTypes and getAllAccounts to discover valid options, then present the details for confirmation.
- A negative customer balance means they owe money (debt). A positive balance means store credit.
- When showing dates, use a human-readable format (e.g. "Feb 9, 2026").
- For Telegram responses, use Telegram-compatible markdown (bold with *, not **).`;
}

// Strip internal/irrelevant fields from large docs (e.g. _rev, variants blobs)
function trimToolResult(toolName, result) {
  // Products: strip _rev, variants, barCode — keep business-relevant fields
  if (toolName === 'getAllProducts' && Array.isArray(result)) {
    return result.map(p => ({
      name: p.name,
      stock: p.stock,
      buyPrice: p.buyPrice,
      category: p.category || 'Uncategorized',
      status: p.status || (p.stock > 0 ? 'In Stock' : 'Out of Stock'),
      restockThreshold: p.restockThreshold,
      uom: p.uom,
    }));
  }

  // Customers: strip _rev, _id, storeNo internals
  if (toolName === 'getAllCustomers' && Array.isArray(result)) {
    return result.map(c => ({
      name: c.name,
      balance: c.balance,
      phoneNumber: c.phoneNumber,
      credit: c.credit,
      status: c.status,
    }));
  }

  if ((toolName === 'getStockIntelligenceReport' || toolName === 'getLatestStockAiPlan') && result?.plan) {
    const plan = result.plan;
    return {
      success: result.success,
      reportType: result.reportType || 'full',
      plan: {
        date: plan.date,
        generatedAt: plan.generatedAt,
        summary: plan.summary,
        buyingList: {
          buyToday: (plan.buyingList?.buyToday || []).slice(0, 15),
          buyThisWeek: (plan.buyingList?.buyThisWeek || []).slice(0, 15),
          doNotRestock: (plan.buyingList?.doNotRestock || []).slice(0, 15),
          checkShelfCount: (plan.buyingList?.checkShelfCount || []).slice(0, 15),
        },
        morningReport: {
          ...plan.morningReport,
          stockoutRisks: (plan.morningReport?.stockoutRisks || []).slice(0, 15),
          reorderToday: (plan.morningReport?.reorderToday || []).slice(0, 15),
          doNotRestock: (plan.morningReport?.doNotRestock || []).slice(0, 15),
        },
        eveningReport: {
          ...plan.eveningReport,
          fastestMoversToday: (plan.eveningReport?.fastestMoversToday || []).slice(0, 15),
          stockCountMismatches: (plan.eveningReport?.stockCountMismatches || []).slice(0, 15),
          runningLowerThanExpected: (plan.eveningReport?.runningLowerThanExpected || []).slice(0, 15),
          tomorrowBuyingPriorities: (plan.eveningReport?.tomorrowBuyingPriorities || []).slice(0, 15),
        },
        cashProtection: (plan.cashProtection || []).slice(0, 20),
        stockErrors: (plan.stockErrors || []).slice(0, 20),
      },
    };
  }

  return result;
}

// Main chat function — handles a single user message through the agent loop
async function chat(sessionId, userMessage, db, storeNo, channel = 'in-app', callbacks = {}) {
  const { onChunk, onToolCall, onComplete, onError } = callbacks;

  try {
    // Get or create conversation history
    if (!conversations.has(sessionId)) {
      conversations.set(sessionId, []);
    }
    const messages = conversations.get(sessionId);

    // Add system prompt if this is the first message
    if (messages.length === 0) {
      messages.push({ role: 'system', content: buildSystemPrompt(storeNo, channel) });
    }

    // Add user message
    messages.push({ role: 'user', content: userMessage });

    // Agent loop — keep going until we get a text response (no more tool calls)
    let loopCount = 0;
    const MAX_LOOPS = 10;

    while (loopCount < MAX_LOOPS) {
      loopCount++;

      const openai = await getOpenAIClient();
      const response = await openai.chat.completions.create({
        model: getOpenAIModel(),
        messages: messages,
        tools: toolDefinitions,
        tool_choice: 'auto',
        stream: false,
      });

      const choice = response.choices[0];
      const assistantMessage = choice.message;
      if (Array.isArray(assistantMessage.tool_calls)) {
        assistantMessage.tool_calls = assistantMessage.tool_calls.filter((toolCall) => toolCall.function?.name);
      }

      // Add assistant message to history
      messages.push(assistantMessage);

      // If no tool calls, we have the final response
      if (!assistantMessage.tool_calls || assistantMessage.tool_calls.length === 0) {
        const content = (assistantMessage.content || '').trim() ||
          'I could not generate a text response. Please try again with a more specific question.';
        if (onChunk) onChunk(content);
        if (onComplete) onComplete();
        return content;
      }

      // Execute tool calls
      for (const toolCall of assistantMessage.tool_calls) {
        const toolName = toolCall.function.name;
        let args = {};
        try {
          args = JSON.parse(toolCall.function.arguments || '{}');
        } catch (e) {
          args = {};
        }

        console.log(`[AI Assistant] Calling tool: ${toolName}`, args);
        if (onToolCall) onToolCall(toolName);

        const rawResult = await executeTool(toolName, args, db, storeNo);
        const trimmedResult = trimToolResult(toolName, rawResult);

        // Add tool result to conversation
        messages.push({
          role: 'tool',
          tool_call_id: toolCall.id,
          content: JSON.stringify(trimmedResult),
        });
      }
    }

    // If we hit max loops, return what we have
    const fallback = 'I was unable to complete the analysis within the allowed number of steps. Please try a more specific question.';
    if (onChunk) onChunk(fallback);
    if (onComplete) onComplete();
    return fallback;

  } catch (error) {
    console.error('[AI Assistant] Error:', error.message);
    if (onError) onError(error.message);
    throw error;
  }
}

// Clear conversation history for a session
function clearConversation(sessionId) {
  conversations.delete(sessionId);
  return { success: true };
}

// Get conversation history for a session
function getConversation(sessionId) {
  return conversations.get(sessionId) || [];
}

module.exports = { chat, clearConversation, getConversation };
