# OpenClaw Discord Mention Routing - Relevant Files

## Repository Information
- **Original Repository**: https://github.com/openclaw/openclaw
- **Branch**: `fix/discord-mention-routing`
- **Status**: Cloned and ready for development

## Core Mention Handling Files

### 1. Mention Detection & Pattern Matching
- **`src/auto-reply/reply/mentions.ts`** - Core mention detection logic
  - `buildMentionRegexes()` - Builds regex patterns from agent config
  - `matchesMentionPatterns()` - Checks if text matches mention patterns
  - `matchesMentionWithExplicit()` - Handles explicit mentions (Discord @mentions)
  - `deriveMentionPatterns()` - Derives patterns from agent identity (name/emoji)
  - `normalizeMentionText()` - Cleans mention text for matching

### 2. Mention Gating (Channel-Level Control)
- **`src/channels/mention-gating.ts`** - Gate logic for requiring mentions
  - `resolveMentionGating()` - Basic mention gate
  - `resolveMentionGatingWithBypass()` - Advanced gate with bypass support
  - Controls when messages require mentions in group chats

### 3. Group Mentions Plugin
- **`src/channels/plugins/group-mentions.ts`** - Provider-level mention handling

## Discord-Specific Files

### 4. Allowlist & Channel Configuration
- **`src/discord/monitor/allow-list.ts`** - Discord-specific allowlist resolution
  - `resolveDiscordShouldRequireMention()` - Determines if mention is required
  - `normalizeDiscordAllowList()` - Normalizes Discord user/role mentions
  - `resolveDiscordChannelConfig()` - Resolves channel-level config
  - `resolveDiscordGuildEntry()` - Resolves guild-level config
  - `resolveDiscordUserAllowed()` - Checks if user is allowed

### 5. Message Preflight (Inbound Processing)
- **`src/discord/monitor/message-handler.preflight.ts`** - Main inbound message processor
  - **Key Logic**: Processes Discord messages before routing
  - **Mention Detection**:
    ```typescript
    const mentionRegexes = buildMentionRegexes(params.cfg, route.agentId);
    const explicitlyMentioned = Boolean(
      botId && message.mentionedUsers?.some((user: User) => user.id === botId),
    );
    const wasMentioned = matchesMentionWithExplicit({
      text: baseText,
      mentionRegexes,
      explicit: {
        hasAnyMention,
        isExplicitlyMentioned: explicitlyMentioned,
        canResolveExplicit: Boolean(botId),
      },
    });
    ```
  - **Mention Gate Application**: Applies `resolveMentionGatingWithBypass()`
  - **Route Resolution**: Calls `resolveAgentRoute()` for routing

### 6. Message Handler
- **`src/discord/monitor/message-handler.ts`** - Creates Discord message handler
  - `createDiscordMessageHandler()` - Factory for message handlers
  - Manages debouncing and event queuing
  - Integrates with preflight and processing

### 7. Event Listeners
- **`src/discord/monitor/listeners.ts`** - Discord gateway event listeners
  - `DiscordMessageListener` - Handles MessageCreate events
  - `DiscordReactionListener` - Handles reaction events
  - `DiscordPresenceListener` - Handles presence updates
  - Routes events to appropriate handlers

### 8. Message Processing
- **`src/discord/monitor/message-handler.process.ts`** - Post-preflight processing
  - `processDiscordMessage()` - Main processing pipeline
  - Handles agent invocation and response delivery

### 9. Message Utilities
- **`src/discord/monitor/message-utils.ts`** - Message parsing utilities
  - `resolveDiscordMessageText()` - Extracts message content
  - `buildMentionRegexes()` - Discord-specific regex building

### 10. Threading Support
- **`src/discord/monitor/threading.ts`** - Thread-specific logic
  - Handles thread parent resolution
  - Manages thread binding inheritance

## Routing & Session Management

### 11. Agent Route Resolution
- **`src/routing/resolve-route.ts`** - Core routing logic
  - `resolveAgentRoute()` - Determines which agent handles a message
  - Matches against bindings, guilds, teams, channels
  - Returns `ResolvedAgentRoute` with agentId, sessionKey, matchedBy

### 12. Route Reply (Response Routing)
- **`src/auto-reply/reply/route-reply.ts`** - Routes responses back to origin
  - `routeReply()` - Sends replies to originating channel
  - Provider-agnostic reply routing

### 13. Session Key Management
- **`src/routing/session-key.ts`** - Session key generation
  - `buildAgentSessionKey()` - Creates unique session identifiers
  - `buildAgentPeerSessionKey()` - Peer-specific session keys

### 14. Bindings
- **`src/routing/bindings.ts`** - Route binding definitions
  - `listBindings()` - Lists configured route bindings

## Configuration Files

### 15. Channel Configuration
- **`src/channels/channel-config.ts`** - Generic channel config resolution
- **`src/channels/allowlist-match.ts`** - Allowlist matching types

### 16. Discord Configuration
- **`src/discord/monitor/provider.ts`** - Discord provider setup

## Test Files (Reference for Expected Behavior)

### 17. Mention Tests
- **`src/discord/monitor.tool-result.accepts-guild-messages-mentionpatterns-match.test.ts`** - Mention pattern tests
- **`src/channels/mention-gating.test.ts`** - Gate logic tests
- **`src/auto-reply/reply/mentions.test.ts`** - Mention detection tests

## Key Data Types

```typescript
// From message-handler.preflight.ts
type DiscordMessagePreflightContext = {
  wasMentioned: boolean;
  shouldRequireMention: boolean;
  canDetectMention: boolean;
  effectiveWasMentioned: boolean;
  shouldBypassMention: boolean;
  route: ResolvedAgentRoute;
  // ... more fields
}

// From resolve-route.ts
type ResolvedAgentRoute = {
  agentId: string;
  channel: string;
  accountId: string;
  sessionKey: string;
  mainSessionKey: string;
  matchedBy: "binding.peer" | "binding.peer.parent" | "binding.guild" | "binding.team" | "binding.account" | "binding.channel" | "default";
};
```

## Message Flow for Discord Mentions

```
Discord Gateway Event
    ↓
DiscordMessageListener (listeners.ts)
    ↓
createDiscordMessageHandler() → debouncer.enqueue() (message-handler.ts)
    ↓
preflightDiscordMessage() (message-handler.preflight.ts)
    ├─→ buildMentionRegexes() (mentions.ts)
    ├─→ Check explicitlyMentioned (Discord @bot)
    ├─→ Check hasAnyMention (@everyone, @roles, @users)
    ├─→ matchesMentionWithExplicit() (mentions.ts)
    ├─→ resolveMentionGatingWithBypass() (mention-gating.ts)
    ├─→ resolveAgentRoute() (resolve-route.ts)
    └─→ Return context or null (drop)
    ↓
processDiscordMessage() (message-handler.process.ts)
    ↓
Agent invocation & response delivery
```

## Configuration Points

### Guild-Level (discord.guilds[id])
```typescript
{
  requireMention?: boolean;  // Default for all channels
  channels?: {
    [channelId]: {
      requireMention?: boolean;  // Per-channel override
      allow?: boolean;
      users?: Array<string | number>;  // User allowlist
    }
  }
}
```

### Agent-Level (agents.list[id].groupChat)
```typescript
{
  mentionPatterns?: string[];  // Custom @patterns
}
```

## Files Modified for Mention Fix

**Primary targets for Discord mention routing fix:**
1. `src/discord/monitor/message-handler.preflight.ts` - Core mention detection logic
2. `src/channels/mention-gating.ts` - Mention gate implementation
3. `src/auto-reply/reply/mentions.ts` - Pattern matching
4. `src/discord/monitor/allow-list.ts` - Discord-specific config resolution
5. `src/routing/resolve-route.ts` - Route resolution integration

**Secondary considerations:**
6. `src/discord/monitor/message-utils.ts` - Message parsing
7. `src/discord/monitor/message-handler.ts` - Handler setup
8. `src/discord/monitor/listeners.ts` - Event registration
