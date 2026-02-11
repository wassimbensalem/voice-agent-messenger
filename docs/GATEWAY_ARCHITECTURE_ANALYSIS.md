# OpenClaw Gateway Architecture - Discord Messages & Events Analysis

## Executive Summary

This document explores the OpenClaw Gateway architecture to understand how Discord messages and events work, specifically focusing on where to hook in to generate events when agents send messages.

## Architecture Overview

The OpenClaw Gateway follows a layered architecture:

1. **Gateway Server** (`src/gateway/`) - Central HTTP/WebSocket server handling RPC methods
2. **Channel Plugins** (`src/channels/plugins/`) - Protocol-specific implementations (Discord, Slack, etc.)
3. **Agents** (`src/agents/`) - AI agent logic and tool execution
4. **Infra Layer** (`src/infra/`) - Event systems, outbound delivery, and core utilities

## Key Files for Discord Integration

### Message Sending Pipeline

#### 1. **Discord Outbound Adapter**
- **File**: `src/channels/plugins/outbound/discord.ts`
- **Purpose**: Channel plugin that adapts core messaging to Discord
- **Key Export**: `discordOutbound` - implements `ChannelOutboundAdapter`

#### 2. **Core Discord Send**
- **File**: `src/discord/send.outbound.ts`
- **Key Functions**:
  - `sendMessageDiscord()` - Main message sending function
  - `sendPollDiscord()` - Poll creation
  - `sendStickerDiscord()` - Sticker sending
- **Features**:
  - Handles forum/media channels with automatic thread creation
  - Text chunking for long messages
  - Media attachment support
  - Activity recording via `recordChannelActivity()`

#### 3. **Discord Send Shared Utilities**
- **File**: `src/discord/send.shared.ts`
- **Key Functions**:
  - `createDiscordClient()` - Creates REST API client
  - `sendDiscordText()` / `sendDiscordMedia()` - Low-level send operations
  - `resolveChannelId()` - Channel ID resolution
  - `parseAndResolveRecipient()` - Recipient parsing

### Event Generation

#### 1. **Agent Events System**
- **File**: `src/infra/agent-events.ts`
- **Purpose**: Central event emission system for agent lifecycle
- **Key Exports**:
  - `emitAgentEvent()` - Emit events with automatic sequencing
  - `onAgentEvent()` - Subscribe to events
  - `registerAgentRunContext()` - Register run context
- **Event Streams**:
  - `lifecycle` - Start/end events
  - `tool` - Tool execution events
  - `assistant` - Assistant message events
  - `error` - Error events

#### 2. **Subagent Registry**
- **File**: `src/agents/subagent-registry.ts`
- **Purpose**: Tracks subagent runs and manages lifecycle
- **Key Functions**:
  - `registerSubagentRun()` - Register new subagent run
  - `ensureListener()` - Set up lifecycle event listener
  - `waitForSubagentCompletion()` - Wait for subagent to finish

#### 3. **Subagent Announce Flow**
- **File**: `src/agents/subagent-announce.ts`
- **Purpose**: Announces subagent completion back to requester
- **Key Function**: `runSubagentAnnounceFlow()`
- **Process**:
  1. Waits for subagent completion
  2. Reads latest assistant reply
  3. Builds stats and status message
  4. Queues announcement via `maybeQueueSubagentAnnounce()`
  5. Calls `sendAnnounce()` to deliver back

### Gateway Request Handling

#### 1. **Send Handler**
- **File**: `src/gateway/server-methods/send.ts`
- **Method**: `send`
- **Flow**:
  1. Validates params
  2. Resolves outbound target
  3. Calls `deliverOutboundPayloads()`
  4. Returns message ID

#### 2. **Agent Handler**
- **File**: `src/gateway/server-methods/agent.ts`
- **Method**: `agent`
- **Flow**:
  1. Validates params
  2. Loads/creates session
  3. Registers agent run context
  4. Calls `agentCommand()`
  5. Returns run ID

### Discord-Specific Files

- `src/discord/index.ts` - Main exports, gateway emitter utilities
- `src/discord/monitor.gateway.ts` - Gateway connection monitoring
- `src/discord/monitor/system-events.ts` - System event detection
- `src/discord/resolve-channels.ts` - Channel resolution
- `src/discord/send.channels.ts` - Channel operations
- `src/discord/send.guild.ts` - Guild operations
- `src/discord/send.reactions.ts` - Reaction handling
- `src/discord/gateway-logging.ts` - Gateway logging
- `src/discord/directory-live.ts` - Directory integration

### Channel Plugin Actions

- **File**: `src/channels/plugins/actions/discord.ts`
- **Purpose**: Message action handlers
- **Key Handler**: `handleDiscordMessageAction()`

- **File**: `src/channels/plugins/actions/discord/handle-action.ts`
- **Purpose**: Specific Discord action handling
- **Actions**: send, poll, react, read, edit, delete, pin, thread-create, etc.

## How Messages Flow Through the System

### Outbound Message Flow (Agent → Discord)

```
1. Agent calls tool (e.g., sendMessage)
   ↓
2. Tool handler (handleDiscordMessageAction)
   ↓
3. Discord action handler (handleDiscordAction → handleDiscordMessagingAction)
   ↓
4. sendMessageDiscord() (src/discord/send.outbound.ts)
   ↓
5. deliverOutboundPayloads() (src/infra/outbound/deliver.ts)
   ↓
6. Discord REST API call
   ↓
7. Response returned
```

### Agent Spawning Flow

```
1. User sends message (via Discord gateway)
   ↓
2. Discord gateway receives MESSAGE_CREATE
   ↓
3. Message routed to agent handler
   ↓
4. Session created/loaded
   ↓
5. agentCommand() called
   ↓
6. Agent runs and executes tools
   ↓
7. Tools may call sendMessageDiscord()
   ↓
8. Response sent back to user
```

### Subagent Spawning Flow

```
1. Main agent calls sessions_spawn tool
   ↓
2. sessions_spawn_tool.execute() (src/agents/tools/sessions-spawn-tool.ts)
   ↓
3. Gateway RPC: agent() with lane=subagent
   ↓
4. Child agent runs
   ↓
5. Child completes → runSubagentAnnounceFlow()
   ↓
6. Announcement queued or sent back to main agent
   ↓
7. Main agent announces to user
```

## Where to Hook for Agent Message Events

### Option 1: Agent Events System (`src/infra/agent-events.ts`)

**Best for**: Agent lifecycle events (start/end)

```typescript
// Listen to all agent events
onAgentEvent((evt) => {
  if (evt.stream === "assistant" && evt.runId) {
    // Agent sent a message
  }
});
```

**Pros**:
- Already centralized
- Works for all channels
- Includes session context

**Cons**:
- Not Discord-specific
- May include internal messages

### Option 2: Discord Send Functions

**Best for**: Discord-specific outbound messages

**Hook Points**:
1. `sendMessageDiscord()` - Main send function
2. `sendDiscordText()` / `sendDiscordMedia()` - Low-level
3. `recordChannelActivity()` - Already tracks outbound

**Location**: `src/discord/send.outbound.ts`

```typescript
// After successful send in sendMessageDiscord
recordChannelActivity({
  channel: "discord",
  accountId: accountInfo.accountId,
  direction: "outbound",
});
// Emit event here
emitAgentEvent({
  runId: messageId,
  stream: "assistant",
  data: { /* message details */ }
});
```

**Pros**:
- Discord-specific
- Includes message ID and channel

**Cons**:
- Only outbound, not incoming

### Option 3: Subagent Registry

**Best for**: Subagent completion announcements

**Hook Point**: `runSubagentAnnounceFlow()` in `src/agents/subagent-announce.ts`

**Pros**:
- Includes task completion status
- Rich context (stats, output)

**Cons**:
- Only for subagents
- Announcement timing may vary

### Option 4: Outbound Delivery (`src/infra/outbound/deliver.ts`)

**Hook Point**: `deliverOutboundPayloads()`

**Flow**:
```
deliverOutboundPayloads()
  ↓
createChannelHandler()
  ↓
handler.sendText() / handler.sendMedia()
  ↓
Discord REST API
```

**Pros**:
- Works for all channels
- Centralized outbound point
- Can intercept before/after send

**Cons**:
- May include non-agent messages

### Option 5: Discord Gateway Events

**Hook Point**: `src/discord/monitor.gateway.ts`

**Events**:
- `ready` - Gateway connected
- `messageCreate` - New message
- `messageUpdate` - Message edited
- `messageDelete` - Message deleted

**Pros**:
- Discord-specific
- Full event data

**Cons**:
- Only incoming events
- Doesn't track outbound separately

## Recommended Hook Points

### For Agent Outbound Messages (Agent → Discord)

**Best location**: `src/discord/send.outbound.ts` → `sendMessageDiscord()`

**Implementation**:
```typescript
export async function sendMessageDiscord(...) {
  // ... existing code ...
  
  // After successful send, emit event
  emitAgentEvent({
    runId: result.messageId,
    stream: "assistant",
    data: {
      channel: "discord",
      channelId: result.channel_id,
      accountId: accountInfo.accountId,
      direction: "outbound",
      text: textWithTables,
      // ... other fields
    }
  });
  
  return result;
}
```

### For All Discord Messages (Incoming + Outgoing)

**Best location**: `src/discord/monitor.gateway.ts`

**Events to track**:
1. `messageCreate` - All messages (check author for bot)
2. Custom outbound events from send functions

### For Subagent Completions

**Best location**: `src/agents/subagent-announce.ts` → `runSubagentAnnounceFlow()`

**Implementation**:
```typescript
async function runSubagentAnnounceFlow(params) {
  // ... existing code ...
  
  // Before announcing, emit event
  emitAgentEvent({
    runId: params.childRunId,
    stream: "lifecycle",
    data: {
      phase: "announce",
      task: params.task,
      outcome,
      reply,
    }
  });
  
  // ... continue with announcement ...
}
```

## Session Context Tracking

**Key Context Fields**:
- `sessionKey` - Unique session identifier
- `channel` - Channel type (discord, slack, etc.)
- `accountId` - Account identifier
- `to` - Message recipient
- `threadId` - Thread/channel ID
- `runId` - Agent run identifier
- `spawnedBy` - Parent session key (for subagents)

**Files**:
- `src/channels/session.ts` - Session recording
- `src/config/sessions.ts` - Session storage
- `src/utils/delivery-context.ts` - Delivery context utilities

## Event Schema

### Agent Event Payload

```typescript
{
  runId: string;        // Unique run identifier
  seq: number;          // Sequence number (monotonic per run)
  stream: string;       // Event stream (lifecycle, tool, assistant, error)
  ts: number;           // Timestamp (Unix ms)
  data: Record<string, unknown>;  // Event-specific data
  sessionKey?: string;  // Session context
}
```

### Assistant Event Data

```typescript
{
  role: "assistant" | "user" | "system";
  content: string;
  channel?: string;
  accountId?: string;
  to?: string;
  threadId?: string;
  messageId?: string;
  direction?: "inbound" | "outbound";
}
```

## Summary

The OpenClaw Gateway architecture provides multiple hook points for generating events when agents send messages:

1. **Agent Events System** (`src/infra/agent-events.ts`) - Centralized, recommended
2. **Discord Send Functions** (`src/discord/send.outbound.ts`) - Discord-specific outbound
3. **Subagent Announce Flow** (`src/agents/subagent-announce.ts`) - Subagent completions
4. **Outbound Delivery** (`src/infra/outbound/deliver.ts`) - Centralized outbound
5. **Discord Gateway** (`src/discord/monitor.gateway.ts`) - Discord-specific events

For generating events specifically when agents send Discord messages, the recommended approach is to hook into `sendMessageDiscord()` in `src/discord/send.outbound.ts` and emit agent events after successful message delivery, including message ID, channel, and content in the event data.
