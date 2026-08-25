const { toolDefinitions, executeTool } = require('./tools');
const { getOpenAIClient, getOpenAIModel } = require('../openaiAuth');
const accountService = require('../finance/accountService');
const expenseTypeService = require('../finance/expenseTypeService');
const { getOpenRegisterSession } = require('../postingService');

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

function safeList(items = [], mapper, limit = 20) {
  return items.slice(0, limit).map(mapper).filter(Boolean);
}

function findDefaultAccount(accounts = [], suffix, namePattern) {
  return accounts.find((account) => String(account.accountNumber || '').endsWith(suffix)) ||
    accounts.find((account) => namePattern.test(String(account.name || '')));
}

function cleanStoreNo(value) {
  return String(value || '').trim();
}

function storeNoFromDocumentId(value) {
  const text = String(value || '').trim();
  if (!text.includes(':')) {
    return '';
  }

  return cleanStoreNo(text.split(':')[0]);
}

async function getStoreNosFromDocs(db) {
  const docs = await db.find({
    selector: {
      storeNo: { $exists: true },
    },
    limit: 500,
  }).then((result) => result.docs || []).catch(() => []);

  return [...new Set(
    docs
      .map((doc) => cleanStoreNo(doc.storeNo))
      .filter(Boolean)
  )];
}

async function resolveStoreNo(db, incomingStoreNo, storeContext = {}) {
  const directStoreNo = cleanStoreNo(incomingStoreNo || storeContext.storeNo);
  if (directStoreNo) {
    return directStoreNo;
  }

  const prefixedStoreNo = storeNoFromDocumentId(storeContext.defaultCustId || storeContext.defaultCustomerId);
  if (prefixedStoreNo) {
    return prefixedStoreNo;
  }

  const wholeSalers = await db.find({
    selector: { type: 'wholeSaler' },
    limit: 20,
  }).then((result) => result.docs || []).catch(() => []);

  const contextName = String(storeContext.name || '').trim().toLowerCase();
  if (contextName) {
    const matchedStore = wholeSalers.find((store) =>
      String(store.name || '').trim().toLowerCase() === contextName && cleanStoreNo(store.storeNo)
    );
    if (matchedStore) {
      return cleanStoreNo(matchedStore.storeNo);
    }
  }

  const wholeSalerStoreNos = [...new Set(wholeSalers.map((store) => cleanStoreNo(store.storeNo)).filter(Boolean))];
  if (wholeSalerStoreNos.length === 1) {
    return wholeSalerStoreNos[0];
  }

  const docStoreNos = await getStoreNosFromDocs(db);
  if (docStoreNos.length === 1) {
    return docStoreNos[0];
  }

  return '';
}

async function buildRuntimeContext(db, storeNo, channel, storeContext = {}) {
  const now = new Date();
  const [accountsResult, expenseTypesResult, openRegister] = await Promise.all([
    storeNo ? accountService.getAllAccounts(db, storeNo).catch((error) => ({ success: false, error: error.message })) : null,
    storeNo ? expenseTypeService.getAllExpenseTypes(db, storeNo).catch((error) => ({ success: false, error: error.message })) : null,
    storeNo ? getOpenRegisterSession(db, storeNo).catch(() => null) : null,
  ]);

  const accounts = accountsResult?.success ? accountsResult.accounts || [] : [];
  const expenseTypes = expenseTypesResult?.success ? expenseTypesResult.expenseTypes || [] : [];
  const cashAccount = findDefaultAccount(accounts, '001', /cash/i);
  const mpesaAccount = findDefaultAccount(accounts, '002', /m-?pesa|till/i);

  const profile = {
    storeNo,
    name: storeContext.name || '',
    phone: storeContext.phone || '',
    location: storeContext.location || '',
    defaultCustId: storeContext.defaultCustId || '',
    channel,
    nowIso: now.toISOString(),
    storeNoSource: cleanStoreNo(storeContext.storeNo) ? 'frontend wsinfo' : (storeNo ? 'backend fallback' : 'missing'),
  };

  return `Runtime store context:
- Prefilled storeNo: ${profile.storeNo || 'missing'}
- storeNo source: ${profile.storeNoSource}
- Store name: ${profile.name || 'unknown'}
- Store phone: ${profile.phone || 'unknown'}
- Store location: ${profile.location || 'unknown'}
- Current timestamp: ${profile.nowIso}
- Channel: ${profile.channel}
- Register status: ${openRegister?._id ? `open (${openRegister._id})` : 'not open or unavailable'}
- Default cash account: ${cashAccount ? `${cashAccount.name} (${cashAccount._id})` : 'not found'}
- Default M-Pesa account: ${mpesaAccount ? `${mpesaAccount.name} (${mpesaAccount._id})` : 'not found'}
- Active accounts: ${JSON.stringify(safeList(accounts, (account) => ({
    id: account._id,
    name: account.name,
    accountNumber: account.accountNumber,
    accountType: account.accountType,
    balance: account.balance,
  })))}
- Active expense types: ${JSON.stringify(safeList(expenseTypes, (type) => ({
    id: type._id,
    name: type.name,
    description: type.description || '',
  }), 30))}

Prefill rules:
- Do not ask the user for storeNo; it is already provided above and all tools receive it server-side.
- If Prefilled storeNo is present, trust it. Never say you cannot access storeNo from tool context.
- If the user says cash and the default cash account exists, use it.
- If the user says M-Pesa, mpesa, till, or phone payment and the default M-Pesa account exists, use it.
- If there is only one sensible account or expense type for the user's wording, use it in draftFinanceRecord.
- Ask only for missing or ambiguous customer, supplier, account, expense type, amount, or date details.`;
}

function upsertRuntimeContext(messages, runtimeContext) {
  const marker = 'Runtime store context:';
  const index = messages.findIndex((message) =>
    message.role === 'system' && String(message.content || '').startsWith(marker)
  );

  const nextMessage = { role: 'system', content: runtimeContext };
  if (index >= 0) {
    messages[index] = nextMessage;
    return;
  }

  messages.splice(Math.min(1, messages.length), 0, nextMessage);
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
- You can help record expenses, customer payments/refunds, supplier payments/refunds, and supplier invoices.
- Recording workflow is strict:
  1. Use the runtime store context for prefilled storeNo, default accounts, and expense types when it is clear.
  2. Use getRecordingReferenceData when you need valid accounts, expense types, customers, or suppliers not already clear from runtime context.
  3. Call draftFinanceRecord to validate details, resolve real records, and check possible duplicates. This does not save anything.
  4. Show the returned summary, warnings, and duplicate matches to the user.
  5. Ask for explicit confirmation. Do not call commitFinanceRecord until the user clearly confirms the exact draft.
  6. If draftFinanceRecord reports ambiguity, missing data, or possible duplicate matches, pause and ask the user to choose or confirm.
- Never invent customer, supplier, account, or expense type names. If unsure, look them up and ask the user to pick.
- Never directly record financial data without the draftFinanceRecord -> user confirmation -> commitFinanceRecord sequence.
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
async function chat(sessionId, userMessage, db, storeNo, channel = 'in-app', callbacks = {}, storeContext = {}) {
  const { onChunk, onToolCall, onComplete, onError } = callbacks;

  try {
    const resolvedStoreNo = await resolveStoreNo(db, storeNo, storeContext);
    const resolvedStoreContext = {
      ...storeContext,
      storeNo: resolvedStoreNo,
    };

    // Get or create conversation history
    if (!conversations.has(sessionId)) {
      conversations.set(sessionId, []);
    }
    const messages = conversations.get(sessionId);

    // Keep base context fresh in case the chat opened before wsinfo/storeNo was hydrated.
    const baseSystemPrompt = { role: 'system', content: buildSystemPrompt(resolvedStoreNo, channel) };
    if (messages.length === 0 || messages[0].role !== 'system') {
      messages.unshift(baseSystemPrompt);
    } else {
      messages[0] = baseSystemPrompt;
    }

    const runtimeContext = await buildRuntimeContext(db, resolvedStoreNo, channel, resolvedStoreContext);
    upsertRuntimeContext(messages, runtimeContext);

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

        const rawResult = await executeTool(toolName, args, db, resolvedStoreNo);
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
