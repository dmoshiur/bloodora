import { all, get, run, transaction } from "../db/query.js";
import { ApiError, randomId } from "../utils/errors.js";
import type { AiResult } from "../types.js";

export const aiConversationRepo = {
  async ensure(id: string, owner: string, userId: string | null) {
    if (!/^[a-zA-Z0-9_-]{1,128}$/.test(id)) throw ApiError.badRequest("Invalid conversation ID");
    await transaction(async tx => {
      const existing = await tx.get<{owner_key: string}>("SELECT owner_key FROM ai_conversations WHERE id = ?", [id]);
      if (existing) {
        if (existing.owner_key !== owner) throw ApiError.notFound("Conversation not found");
        return;
      }
      // Legacy transcripts had no trustworthy ownership. Never let callers claim them.
      if (await tx.get("SELECT id FROM ai_messages WHERE conversation_id = ? LIMIT 1", [id])) throw ApiError.notFound("Conversation not found");
      const now = new Date().toISOString();
      await tx.run("INSERT INTO ai_conversations VALUES (?, ?, ?, ?, ?)", [id, owner, userId, now, now]);
    });
  },
  async owned(id: string, owner: string) {
    if (!await get("SELECT id FROM ai_conversations WHERE id = ? AND owner_key = ?", [id, owner])) throw ApiError.notFound("Conversation not found");
  },
  async list(owner: string) {
    return all("SELECT id, created_at, updated_at FROM ai_conversations WHERE owner_key = ? ORDER BY updated_at DESC LIMIT 100", [owner]);
  },
  async claim(id: string, key: string, message: string): Promise<string | null> {
    return transaction(async tx => {
      const row = await tx.get<{message: string; status: string; response: string}>("SELECT * FROM ai_submissions WHERE conversation_id = ? AND request_id = ?", [id, key]);
      if (row) {
        if (row.message !== message) throw new ApiError(409, "IDEMPOTENCY_CONFLICT", "Request ID was used for a different message");
        if (row.status === "completed") return row.response;
        throw new ApiError(409, "AI_SUBMISSION_EXISTS", "This submission is pending or failed. Retrieve history before starting a new submission.");
      }
      await tx.run("INSERT INTO ai_submissions VALUES (?, ?, ?, 'pending', NULL, ?)", [id, key, message, new Date().toISOString()]);
      return null;
    });
  },
  async complete(id: string, key: string, userId: string | null, question: string, result: AiResult, response: unknown) {
    await transaction(async tx => {
      for (const [role, content] of [["user", question], ["assistant", result.answer]]) {
        await tx.run("INSERT INTO ai_messages (id, conversation_id, user_id, role, content, model, tokens, reasoning_chars) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
          [randomId(), id, userId, role, content, result.model, role === "assistant" ? result.tokens : null, role === "assistant" ? result.reasoningChars ?? 0 : 0]);
      }
      await tx.run("UPDATE ai_submissions SET status = 'completed', response = ? WHERE conversation_id = ? AND request_id = ?", [JSON.stringify(response), id, key]);
      await tx.run("UPDATE ai_conversations SET updated_at = ? WHERE id = ?", [new Date().toISOString(), id]);
    });
  },
  async fail(id: string, key: string) {
    await run("UPDATE ai_submissions SET status = 'failed' WHERE conversation_id = ? AND request_id = ? AND status = 'pending'", [id, key]);
  },
};
