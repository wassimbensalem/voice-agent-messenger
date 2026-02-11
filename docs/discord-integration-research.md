# OpenClaw Discord Bot Integration Research

**Research Date:** 2026-02-10  
**Researcher:** Scout (Sub-agent)  
**Session:** agent:scout:subagent:ddab5ea9-5565-4045-8f54-193fc7e97dd9

---

## Executive Summary

This research covers Discord bot integration for OpenClaw sub-agents, including OAuth2 scopes, permissions, multi-bot configuration, message routing, and alternative approaches. OpenClaw supports Discord via its official Bot API with comprehensive channel monitoring, multi-agent routing, and thread support.

---

## 1. Bot Permissions & OAuth2 Scopes

### Required Discord Developer Portal Setup

**Step 1: Create Discord Application & Bot**
- Go to Discord Developer Portal → Applications → New Application
- Navigate to Bot → Add Bot
- Copy the Bot Token (used in `DISCORD_BOT_TOKEN` env var or `channels.discord.token` config)

**Step 2: Enable Privileged Gateway Intents**
In Bot → Privileged Gateway Intents, enable:
- **Message Content Intent** ⭐ REQUIRED - Without this, bot cannot read message text
- **Server Members Intent** - Recommended for member lookups and allowlist matching
- Presence Intent - NOT needed (only for receiving presence updates about other members)

**Step 3: OAuth2 Scopes (URL Generator)**
Required scopes:
- ✅ `bot` - Basic bot functionality
- ✅ `applications.commands` - Required for native slash commands

**Step 4: Bot Permissions (Minimum)**
At minimum, grant:
- ✅ **Send Messages** - Core functionality
- ✅ **Read Message History** - Context retrieval
- ✅ **View Channels** - See channel existence
- ✅ **Embed Links** - Rich embed support
- ✅ **Attach Files** - File uploads
- ✅ **Add Reactions** (optional but recommended)
- ✅ **Use External Emojis/Stickers** (optional)

⚠️ Avoid "Administrator" unless debugging - only grant needed permissions

---

## 2. Multi-Bot & Multiple Agent Identity Configuration

### Option A: Single Bot, Multiple Agent Identities

OpenClaw supports **multiple Discord bot accounts** via the `channels.discord.accounts` configuration:

```json
{
  "channels": {
    "discord": {
      "enabled": true,
      "accounts": {
        "agent1": {
          "token": "BOT_TOKEN_1",
          "name": "Research Bot"
        },
        "agent2": {
          "token": "BOT_TOKEN_2",
          "name": "Marketing Bot"
        }
      }
    }
  },
  "agents": {
    "list": [
      {
        "id": "research",
        "workspace": "~/.openclaw/workspace-research"
      },
      {
        "id": "marketing",
        "workspace": "~/.openclaw/workspace-marketing"
      }
    ]
  },
  "bindings": [
    {
      "agentId": "research",
      "match": {
        "channel": "discord",
        "accountId": "agent1"
      }
    },
    {
      "agentId": "marketing",
      "match": {
        "channel": "discord",
        "accountId": "agent2"
      }
    }
  ]
}
```

### Option B: Single Bot, Different Guild Channels → Different Agents

Route different Discord channels/guilds to different agents:

```json
{
  "bindings": [
    {
      "agentId": "scout",
      "match": {
        "channel": "discord",
        "guildId": "123456789012345678"
      }
    }
  ],
  "channels": {
    "discord": {
      "token": "YOUR_BOT_TOKEN",
      "guilds": {
        "123456789012345678": {
          "slug": "research-server",
          "channels": {
            "research-results": {
              "allow": true,
              "requireMention": true
            },
            "general": {
              "allow": false
            }
          }
        }
      }
    }
  }
}
```

### Option C: Single Bot, Same Guild → Multiple Channels → Multiple Agents

```json
{
  "agents": {
    "list": [
      {
        "id": "scout",
        "workspace": "~/.openclaw/workspace-scout"
      },
      {
        "id": "fawzi",
        "workspace": "~/.openclaw/workspace-fawzi"
      }
    ]
  },
  "bindings": [
    {
      "agentId": "scout",
      "match": {
        "channel": "discord",
        "guildId": "SERVER_ID",
        "peer": {
          "kind": "thread",
          "id": "THREAD_ID_1"
        }
      }
    },
    {
      "agentId": "fawzi",
      "match": {
        "channel": "discord",
        "guildId": "SERVER_ID",
        "peer": {
          "kind": "thread",
          "id": "THREAD_ID_2"
        }
      }
    }
  ]
}
```

### Key Concepts

- **agentId**: One "brain" with separate workspace, auth, and session store
- **accountId**: One Discord bot account instance
- **guildId**: Discord server ID
- **peer**: Exact channel/thread ID (most specific match)

---

## 3. Sub-Agent Message Routing to Discord

### How OpenClaw Routes Messages

OpenClaw uses a **deterministic binding system** where "most specific match wins":

1. **Peer match** - Exact DM/group/channel/thread ID (highest priority)
2. **guildId** - Discord server ID
3. **accountId** - Specific bot account
4. **channel-level** - Fallback to channel-wide match
5. **Default agent** - Fallback (agents.list[].default or first entry)

### Routing Configuration Pattern

```json
{
  "agents": {
    "list": [
      {
        "id": "scout",
        "name": "Research Scout",
        "workspace": "~/.openclaw/workspace-scout"
      }
    ]
  },
  "bindings": [
    {
      "agentId": "scout",
      "match": {
        "channel": "discord",
        "peer": {
          "kind": "channel",
          "id": "1470157790159966331"
        }
      }
    }
  ]
}
```

### Reply Routing

- Replies always go back to the **originating channel**
- Direct messages collapse into the agent's main session (`agent:main:main`)
- Guild channels stay isolated as `agent::discord:channel:` (display names use `discord:#`)
- Threads inherit parent channel config unless explicitly configured

### Message Delivery

- **DMs**: Use user ID or mention; all turns land in main session
- **Guilds**: Use channel ID; mentions required by default (`requireMention: true`)
- **Threads**: Treated as separate channels; configurable per-thread

---

## 4. Known Issues with OpenClaw Sub-Agent Discord Posting

### Common Problems & Solutions

| Error | Cause | Fix |
|-------|-------|-----|
| "The application did not respond" | Gateway not running or bot misconfigured | Run `openclaw gateway status`, check logs |
| "You are not authorized" | User not in OpenClaw allowlist | Add user ID to `guilds.users` array |
| "Unknown Channel" | Channel ID wrong or bot lacks permissions | Verify channel ID, check bot permissions |
| "Missing Access" | Bot not in server or lacks permissions | Re-invite bot with proper scopes |
| Duplicate messages | Multiple gateway instances running | Stop old instances, keep only openclaw-gateway |
| "Used disallowed intents" | Message Content Intent not enabled | Enable in Developer Portal, restart gateway |

### Critical Configuration Issues

1. **Missing Message Content Intent** - Most common failure point
2. **OpenClaw vs Discord Authorization** - Discord admin ≠ OpenClaw allowlist
3. **Channel Allowlist** - `groupPolicy: "allowlist"` blocks unconfigured channels
4. **Duplicate Gateway Instances** - Old processes cause duplicate messages
5. **Bot Invitation Issues** - Wrong scopes/permissions or incorrect channel ID
6. **Session Isolation** - Credentials don't carry between channels/threads

### Troubleshooting Commands

```bash
# Check Discord channel connection
openclaw channels status --probe

# List pending Discord DM pairing requests
openclaw pairing list discord

# Approve Discord pairing request
openclaw pairing approve discord <code>

# Full status check (detects duplicate agents)
openclaw status --deep

# Restart gateway
openclaw gateway restart

# Watch live Discord-related logs
openclaw logs --follow
```

---

## 5. Alternative Approaches

### Option A: Webhook Integration

Discord Webhooks are an alternative to bot accounts for **one-way notifications**:

**Pros:**
- No bot token required
- Simpler setup
- No presence/rate limits
- Free to use unlimited webhooks per channel

**Cons:**
- One-way only (cannot receive messages)
- No conversation threading
- Limited interaction capabilities
- Cannot use slash commands

**Implementation:**
```bash
# Create webhook (requires Manage Webhooks permission)
# Send messages via POST to webhook URL
curl -X POST "https://discord.com/api/webhooks/WEBHOOK_ID/WEBHOOK_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"content": "Message from OpenClaw agent"}'
```

**When to use:** Status updates, alerts, notifications (no reply needed)

### Option B: Forum Threads

Discord Forum Channels provide **thread-based organization**:

**Pros:**
- Organized discussion threads
- Built-in tags and filtering
- Thread creation support in OpenClaw
- Clean separation of topics

**Cons:**
- Still requires bot account
- More complex thread management

**OpenClaw Support:**
- Create threads via `discord.threadCreate`
- Reply via `discord.threadReply`
- List threads via `discord.threadList`

### Option C: Thread Replies

Use Discord's **reply functionality** for conversational context:

**Configuration:**
```json
{
  "channels": {
    "discord": {
      "replyToMode": "off" | "first" | "all"
    }
  }
}
```

**Modes:**
- **off** (default): Ignore reply tags
- **first**: Only first outbound chunk/attachment is a reply
- **all**: Every outbound chunk/attachment is a reply

**Usage:**
```
[[reply_to_current]] — Reply to the triggering Discord message
[[reply_to:MESSAGE_ID]] — Reply to a specific message ID
```

---

## 6. Complete Configuration Reference

### Minimal Setup

```json
{
  "channels": {
    "discord": {
      "enabled": true,
      "token": "YOUR_BOT_TOKEN"
    }
  }
}
```

### Full Configuration

```json
{
  "channels": {
    "discord": {
      "enabled": true,
      "token": "YOUR_BOT_TOKEN",
      "groupPolicy": "allowlist",
      "mediaMaxMb": 8,
      "textChunkLimit": 2000,
      "maxLinesPerMessage": 17,
      "chunkMode": "length",
      "historyLimit": 20,
      
      "dm": {
        "enabled": true,
        "policy": "pairing",
        "allowFrom": ["123456789012345678"],
        "groupEnabled": false,
        "groupChannels": []
      },
      
      "guilds": {
        "*": {
          "requireMention": true,
          "channels": {
            "general": { "allow": true }
          }
        }
      },
      
      "actions": {
        "reactions": true,
        "stickers": true,
        "emojiUploads": true,
        "stickerUploads": true,
        "polls": true,
        "permissions": true,
        "messages": true,
        "threads": true,
        "pins": true,
        "search": true,
        "memberInfo": true,
        "roleInfo": true,
        "roles": false,
        "channelInfo": true,
        "channels": true,
        "voiceStatus": true,
        "events": true,
        "moderation": false,
        "presence": false
      },
      
      "replyToMode": "off",
      
      "execApprovals": {
        "enabled": true,
        "approvers": ["123456789012345678"]
      }
    }
  }
}
```

### Agent Binding Examples

**Route all Discord to single agent:**
```json
{
  "bindings": [
    { "agentId": "main", "match": { "channel": "discord" } }
  ]
}
```

**Route by guild:**
```json
{
  "bindings": [
    { 
      "agentId": "scout", 
      "match": { 
        "channel": "discord",
        "guildId": "SERVER_ID" 
      } 
    }
  ]
}
```

**Route by channel/thread:**
```json
{
  "bindings": [
    {
      "agentId": "scout",
      "match": {
        "channel": "discord",
        "peer": {
          "kind": "thread",
          "id": "THREAD_ID"
        }
      }
    }
  ]
}
```

---

## 7. Security Best Practices

### Token Security
- **Prefer env vars**: Use `DISCORD_BOT_TOKEN` instead of config file
- Lock down config file permissions if storing in config
- Never commit tokens to version control

### Permission Principles
- Grant minimum permissions needed (avoid Administrator)
- Use per-channel allowlists instead of global access
- Set `dm.policy: "pairing"` for secure DM access

### Isolated Workspaces
- Each agent has separate workspace, auth, and sessions
- Never reuse `agentDir` across agents (causes auth/session collisions)
- Copy `auth-profiles.json` manually if sharing credentials

---

## 8. Sources & References

- **Official Docs:** https://docs.openclaw.ai/channels/discord
- **Multi-Agent Routing:** https://docs.openclaw.ai/concepts/multi-agent
- **Discord Developer Portal:** https://discord.com/developers/applications
- **OpenClaw Discord Community:** https://discord.com/invite/clawd
- **DeepWiki Integration Guide:** https://deepwiki.com/openclaw/openclaw/8.4-discord-integration

---

## Summary: Key Takeaways

1. **Permissions**: Enable Message Content + Server Members intents; grant Send Messages, Read Message History, View Channels
2. **Multiple Agents**: Use `channels.discord.accounts` for multiple bots; use bindings for routing
3. **Message Routing**: Deterministic binding system (most-specific-wins); replies return to originating channel
4. **Common Issues**: Missing intents, duplicate gateways, authorization confusion
5. **Alternatives**: Webhooks (one-way), Forum Threads (organized), Thread Replies (context)

