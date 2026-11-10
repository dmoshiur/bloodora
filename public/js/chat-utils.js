// ==================== BloodOra shared chat utilities (browser + tests) =====
// Loaded as a classic <script> in the footer (sets window.BOSanitize) and
// imported in Node tests via createRequire (module.exports). One source of
// truth for:
//   1. stripThink()         - remove AI internal reasoning BEFORE it reaches
//                             the DOM. Never hidden with CSS: the text is
//                             deleted from the string, so it can never flash.
//   2. createMessageStore() - id-keyed registry that makes live-chat dedup
//                             exact: every server message renders exactly once
//                             no matter how many channels (POST response, SSE
//                             stream, polling) deliver it, or in which order.
//                             Optimistic bubbles are reconciled by server id,
//                             never by comparing message text.
(function (root, factory) {
  "use strict";
  var api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api; // Node (tests)
  root.BOSanitize = api;                                                     // browser
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  // ---------------------------------------------------------------------------
  // stripThink - remove <think>...</think> reasoning from model output.
  // Handles: complete blocks, incomplete (unclosed) blocks from stream cutoffs,
  // multiline content, case variants, escaped tags (\<think>, <\/think>),
  // HTML-escaped tags (&lt;think&gt;), markdown-fenced blocks, and multiple or
  // nested-looking opens. Operates on RAW text before any HTML escaping, so
  // stripped content never enters the DOM at all.
  // ---------------------------------------------------------------------------
  function stripThink(text) {
    if (text == null) return "";
    var out = String(text);

    // Normalize disguised think tags: drop backslashes anywhere inside the tag
    // and canonicalize spacing (\<think>, <\think>, <\/think>, < think >)
    // so every variant is removed by the passes below. Only the tag itself is
    // rewritten - the user-facing answer text is never touched.
    out = out.replace(/\\?<\\?\/?\s*think\s*\\?>/gi, function (m) {
      return m.indexOf("/") !== -1 ? "</think>" : "<think>";
    });

    // Remove complete <think>...</think> blocks (non-greedy, DOTALL,
    // case-insensitive, tolerant of whitespace inside the tag).
    out = out.replace(/<\s*think\s*>[\s\S]*?<\s*\/\s*think\s*>/gi, "");

    // Remove an unclosed trailing <think>... (streamed/partial response):
    // everything from the open tag to the end of the text is reasoning.
    out = out.replace(/<\s*think\s*>[\s\S]*$/gi, "");

    // HTML-escaped variants that may survive upstream escaping:
    // &lt;think&gt; ... &lt;/think&gt; and an unclosed &lt;think&gt;.
    out = out.replace(/&lt;\s*think\s*&gt;[\s\S]*?&lt;\s*\/\s*think\s*&gt;/gi, "");
    out = out.replace(/&lt;\s*think\s*&gt;[\s\S]*$/gi, "");

    // Leftover stray closing tags (e.g. reasoning wrapped in a markdown fence
    // where the opening fence was consumed): drop them, plus any now-empty
    // fence pair that only existed to wrap the reasoning.
    out = out.replace(/<\s*\/\s*think\s*>/gi, "");
    out = out.replace(/&lt;\s*\/\s*think\s*&gt;/gi, "");
    out = out.replace(/```\s*```/g, "");

    // Collapse the whitespace scar left by removal (keep single newlines).
    out = out.replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
    return out;
  }

  // ---------------------------------------------------------------------------
  // createMessageStore - exact id-keyed deduplication for the live chat.
  //
  // Contract:
  //   store.accept(msg) -> true   the message is NEW: render it now.
  //                    -> false  the message id was already seen: do NOT
  //                              render again (reconcile the optimistic copy).
  //   Messages without an id (local greetings/system lines) are always
  //   accepted - the store only guards server-backed messages.
  //   store.lastId() feeds the `after=` polling cursor so reconnects and
  //   refreshes never re-render history.
  //   store.reset() clears everything when a conversation is (re)opened.
  // ---------------------------------------------------------------------------
  function createMessageStore() {
    var ids = new Set();
    var lastId = 0;
    return {
      accept: function (msg) {
        if (!msg) return false;
        var id = msg.id;
        if (id === undefined || id === null || id === "") return true; // no id -> always render
        if (ids.has(id)) return false;                                 // duplicate -> suppress
        ids.add(id);
        if (Number(id) > lastId) lastId = Number(id);
        return true;
      },
      seen: function (id) { return ids.has(id); },
      lastId: function () { return lastId; },
      reset: function () { ids = new Set(); lastId = 0; }
    };
  }

  return { stripThink: stripThink, createMessageStore: createMessageStore };
});
