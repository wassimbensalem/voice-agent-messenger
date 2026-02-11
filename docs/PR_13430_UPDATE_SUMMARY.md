# PR #13430 Update Summary

## Overview
Three commits addressing Discord mention routing for agent-to-agent communication.

---

## Commit 1: `@everyone` Routing Fix
**Hash:** `d2b8b9a7`  
**Type:** Bug Fix  
**File Modified:** `src/discord/monitor/message-handler.preflight.ts`

### Problem
Bot-sent `@everyone` mentions were incorrectly triggering routing logic because the code didn't distinguish between user-sent and bot-sent `@everyone` mentions.

### Solution
Changed the condition from:
```typescript
message.mentionedEveryone && (message.mentionedUsers?.length ?? 0) > 0
```
to:
```typescript
message.mentionedEveryone && author.id !== botId
```

### Behavior
- **User @everyone** → Triggers routing (author is user, not bot)
- **Bot @everyone** → Ignored (author is bot)
- **All other mentions** → Unchanged

---

## Commit 2: Agent Message Events
**Hash:** `f2c41096`  
**Type:** Feature  
**File Modified:** `src/discord/send.outbound.ts`

### Problem
Agent-sent messages with `@mentions` didn't trigger other agents because they only made REST API calls without generating events.

### Solution
Added `emitOutboundMentionEvent()` function that:
1. Extracts user mentions from message text using regex `/<@!?(\d+)>/g`
2. Emits agent events after successful message delivery via `emitAgentEvent()`
3. Includes metadata: channel, channelId, accountId, text, mentions

### Changes
- Added `extractMentions()` helper function
- Added `emitOutboundMentionEvent()` function
- Called `emitOutboundMentionEvent()` in two places within `sendMessageDiscord()`:
  - After channel message delivery
  - After forum thread reply delivery

---

## Commit 3: Import Path Fix
**Hash:** `3ff29225`  
**Type:** Bug Fix (Critical)  
**File Modified:** `src/discord/send.outbound.ts`

### Problem
Import path was resolving outside the `src/` directory, causing build failure.

### Solution
Changed import path from:
```typescript
import { emitAgentEvent } from "../../infra/agent-events.ts";
```
to:
```typescript
import { emitAgentEvent } from "../infra/agent-events.js";
```

---

## Summary Table

| Commit | Type | Files | Lines | Description |
|--------|------|-------|-------|-------------|
| d2b8b9a7 | Bug Fix | 1 | ±1 | Fix @everyone routing for bot messages |
| f2c41096 | Feature | 1 | +56 | Emit events for agent-sent mentions |
| 3ff29225 | Bug Fix | 1 | ±1 | Fix import path (build-breaking) |

**Total:** 3 commits, 2 files, ~58 lines changed

---

## Ready to Push
✅ Tests passing → Push to remote
