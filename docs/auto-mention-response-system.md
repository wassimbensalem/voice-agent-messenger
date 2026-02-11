# OpenClaw Auto-Mention Response System Research

**Research Date:** 2026-02-11  
**Topic:** How to build auto-mention response system for OpenClaw  
**Goal:** Enable real-time agent responses to Discord mentions (@Scout, @Max, @John, @Maya)

---

## Summary

**Yes, OpenClaw has built-in support for auto-spawn/response on mention.** This is achieved through a combination of:

1. **Channel-level mention gating** (`requireMention: true`)
2. **Agent-level mention patterns** (`agents.list[].groupChat.mentionPatterns`)
3. **Binding configuration** to route messages to specific agents
4. **Event monitoring via Discord Gateway** (automatically handled)

---

## 1. Built-in Support for Auto-Spawn on Mention?

**Answer: YES** ✅

OpenClaw automatically:
- Listens to Discord Gateway events (messages, mentions)
- Detects when the bot is mentioned in guild channels
- Routes messages to appropriate agents based on configuration
- Spawns session context when messages are detected

**How it works:**
- The Discord channel integration connects to Discord's Gateway API
- Message events are monitored in real-time
- Mentions trigger agent routing based on configured patterns
- No additional webhooks or custom event monitoring needed

---

## 2. Config Changes Needed in openclaw.json

### Core Configuration Structure

```json
{
  "channels": {
    "discord": {
      "enabled": true,
      "token": "YOUR_BOT_TOKEN",
      "groupPolicy": "allowlist",
      "dm": {
        "enabled": false  // Recommended: disable DMs, focus on guild mentions
      },
      "guilds": {
        "YOUR_GUILD_ID": {
          "requireMention": true,  // Key: Bot only replies when mentioned
          "users": ["ALLOWED_USER_IDS"],
          "channels": {
            "GENERAL_CHANNEL": {
              "allow": true,
              "requireMention": true
            }
          }
        }
      }
    }
  },
  
  "messages": {
    "groupChat": {
      "mentionPatterns": ["@openclaw", "@Scout", "@Max", "@John", "@Maya"]
    }
  }
}
```

### Agent-Specific Configuration (for each agent)

```json
{
  "agents": {
    "list": [
      {
        "id": "scout",
        "name": "Scout",
        "workspace": "~/.openclaw/workspace-scout",
        "identity": {
          "name": "Scout",
          "mentionPatterns": ["@Scout", "@scout"]
        },
        "groupChat": {
          "mentionPatterns": ["@Scout", "@scout"]
        },
        "tools": {
          "allow": ["web_search", "web_fetch", "read", "memory_list"],
          "deny": ["exec", "write", "edit"]
        }
      },
      {
        "id": "max",
        "name": "Max",
        "workspace": "~/.openclaw/workspace-max",
        "identity": {
          "name": "Max"
        },
        "groupChat": {
          "mentionPatterns": ["@Max", "@max"]
        }
      },
      {
        "id": "john",
        "name": "John",
        "workspace": "~/.openclaw/workspace-john",
        "groupChat": {
          "mentionPatterns": ["@John", "@john"]
        }
      },
      {
        "id": "maya",
        "name": "Maya",
        "workspace": "~/.openclaw/workspace-maya",
        "groupChat": {
          "mentionPatterns": ["@Maya", "@maya"]
        }
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
          "id": "YOUR_CHANNEL_ID"
        }
      }
    }
  ]
}
```

### Key Configuration Parameters

| Parameter | Location | Purpose |
|-----------|----------|---------|
| `requireMention` | `channels.discord.guilds.*` | Gate bot responses to require mentions |
| `mentionPatterns` | `agents.list[].groupChat` | Define what triggers each agent |
| `mentionPatterns` | `messages.groupChat` | Global mention patterns |
| `guilds.*.requireMention` | Channel level | Override per-guild mention requirement |
| `channels.*.requireMention` | Per-channel | Override per-channel mention requirement |
| `groupPolicy` | Channel level | Control guild channel access |

---

## 3. Webhooks or Event Monitoring Needed?

**Answer: NO** ❌

OpenClaw handles all event monitoring automatically through its Discord Gateway integration.

### What's Built-in:
- ✅ Discord Gateway connection (real-time message events)
- ✅ Mention detection in messages
- ✅ Automatic message routing to agents
- ✅ Session spawning on mention detection
- ✅ Reaction events monitoring
- ✅ Channel/guild state management

### What You DON'T Need:
- ❌ Custom webhooks
- ❌ External event listeners
- ❌ Discord API polling loops
- ❌ Manual message fetching

### How Events Are Handled:

```
Discord Message with @Mention 
    ↓
Discord Gateway Event
    ↓
OpenClaw Channel Integration
    ↓
Mention Pattern Matching (agents.list[].groupChat.mentionPatterns)
    ↓
Agent Binding Resolution
    ↓
Session Spawn/Routing
    ↓
Response Generation
```

---

## 4. How to Define Mention Triggers

### Method 1: Agent-Level Patterns (Recommended for Multiple Agents)

Configure each agent with their own mention patterns:

```json
{
  "agents": {
    "list": [
      {
        "id": "scout",
        "name": "Scout",
        "groupChat": {
          "mentionPatterns": [
            "@Scout",
            "@scout",
            "@Scout ",
            "hey Scout",
            "Scout, "
          ]
        }
      },
      {
        "id": "max",
        "name": "Max",
        "groupChat": {
          "mentionPatterns": [
            "@Max",
            "@max",
            "@Max ",
            "hey Max",
            "Max, "
          ]
        }
      }
    ]
  }
}
```

### Method 2: Global Message Patterns

Set default patterns for all agents:

```json
{
  "messages": {
    "groupChat": {
      "mentionPatterns": [
        "@openclaw",
        "@OpenClaw",
        "@all",
        "@team"
      ],
      "requireMention": true
    }
  }
}
```

### Method 3: Channel-Level RequireMention

Force mention requirement at channel level:

```json
{
  "channels": {
    "discord": {
      "guilds": {
        "YOUR_GUILD_ID": {
          "requireMention": true,
          "channels": {
            "general": {
              "allow": true,
              "requireMention": true
            },
            "help": {
              "allow": true,
              "requireMention": true
            }
          }
        }
      }
    }
  }
}
```

### Pattern Matching Rules

- **Exact matches:** `@Scout` matches `@Scout`
- **Prefix matches:** `@Scout ` matches `@Scout` followed by space
- **Contains:** `hey Scout` matches "hey Scout" anywhere in message
- **Case insensitive:** `@scout` matches `@Scout`
- **Mention syntax:** `<@BOT_ID>` Discord mentions are detected

### Priority Order

1. Agent-specific `mentionPatterns` (highest priority)
2. Channel-level `requireMention` gating
3. Guild-level `requireMention` gating
4. Global `messages.groupChat.mentionPatterns`

---

## 5. Examples and Documentation

### Example 1: Single Bot with Multiple Agents (Discord Guild)

**Use Case:** One Discord server with multiple specialized agents responding to different mentions.

```json
{
  "channels": {
    "discord": {
      "enabled": true,
      "token": "YOUR_DISCORD_BOT_TOKEN",
      "dm": {
        "enabled": false
      },
      "guilds": {
        "123456789012345678": {
          "requireMention": true,
          "users": ["987654321098765432"],
          "channels": {
            "general": {
              "allow": true,
              "requireMention": true
            },
            "research": {
              "allow": true,
              "requireMention": true
            },
            "dev": {
              "allow": true,
              "requireMention": true
            }
          }
        }
      },
      "actions": {
        "reactions": true,
        "messages": true
      }
    }
  },
  
  "agents": {
    "list": [
      {
        "id": "scout",
        "name": "Scout",
        "workspace": "~/.openclaw/workspace-scout",
        "identity": {
          "name": "Scout"
        },
        "groupChat": {
          "mentionPatterns": ["@Scout", "@scout"]
        },
        "model": "claude-sonnet-4-20250514"
      },
      {
        "id": "max",
        "name": "Max",
        "workspace": "~/.openclaw/workspace-max",
        "identity": {
          "name": "Max"
        },
        "groupChat": {
          "mentionPatterns": ["@Max", "@max"]
        },
        "model": "claude-opus-4-6"
      },
      {
        "id": "john",
        "name": "John",
        "workspace": "~/.openclaw/workspace-john",
        "identity": {
          "name": "John"
        },
        "groupChat": {
          "mentionPatterns": ["@John", "@john"]
        },
        "model": "claude-sonnet-4-5"
      },
      {
        "id": "maya",
        "name": "Maya",
        "workspace": "~/.openclaw/workspace-maya",
        "identity": {
          "name": "Maya"
        },
        "groupChat": {
          "mentionPatterns": ["@Maya", "@maya"]
        },
        "model": "claude-sonnet-4-5"
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
          "id": "123456789012345678"
        }
      }
    },
    {
      "agentId": "max",
      "match": {
        "channel": "discord",
        "peer": {
          "kind": "channel",
          "id": "123456789012345678"
        }
      }
    },
    {
      "agentId": "john",
      "match": {
        "channel": "discord",
        "peer": {
          "kind": "channel",
          "id": "123456789012345678"
        }
      }
    },
    {
      "agentId": "maya",
      "match": {
        "channel": "discord",
        "peer": {
          "kind": "channel",
          "id": "123456789012345678"
        }
      }
    }
  ]
}
```

### Example 2: Channel-Specific Agent Routing

Route different Discord channels to different agents:

```json
{
  "channels": {
    "discord": {
      "enabled": true,
      "token": "YOUR_BOT_TOKEN",
      "guilds": {
        "123456789012345678": {
          "requireMention": true,
          "channels": {
            "research": {
              "allow": true,
              "requireMention": true
            },
            "development": {
              "allow": true,
              "requireMention": true
            },
            "general": {
              "allow": true,
              "requireMention": true
            }
          }
        }
      }
    }
  },
  
  "agents": {
    "list": [
      {
        "id": "scout",
        "name": "Scout",
        "workspace": "~/.openclaw/workspace-scout",
        "groupChat": {
          "mentionPatterns": ["@Scout"]
        }
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
          "id": "RESEARCH_CHANNEL_ID"
        }
      }
    },
    {
      "agentId": "max",
      "match": {
        "channel": "discord",
        "peer": {
          "kind": "channel",
          "id": "DEVELOPMENT_CHANNEL_ID"
        }
      }
    }
  ]
}
```

### Example 3: Family Agent (from Official Docs)

This pattern shows mentionPatterns with bindings:

```json
{
  "agents": {
    "list": [
      {
        "id": "family",
        "name": "Family",
        "workspace": "~/.openclaw/workspace-family",
        "identity": {
          "name": "Family Bot"
        },
        "groupChat": {
          "mentionPatterns": ["@family", "@familybot", "@Family Bot"]
        },
        "sandbox": {
          "mode": "all",
          "scope": "agent"
        },
        "tools": {
          "allow": [
            "exec",
            "read",
            "sessions_list",
            "sessions_history",
            "sessions_send",
            "sessions_spawn",
            "session_status"
          ],
          "deny": ["write", "edit", "apply_patch", "browser", "canvas", "nodes", "cron"]
        }
      }
    ]
  },
  "bindings": [
    {
      "agentId": "family",
      "match": {
        "channel": "whatsapp",
        "peer": {
          "kind": "group",
          "id": "123456789@group.whatsapp"
        }
      }
    }
  ]
}
```

---

## Implementation Checklist

### Step 1: Setup Discord Bot
- [ ] Create Discord application and bot
- [ ] Enable Message Content Intent (required)
- [ ] Enable Server Members Intent (recommended)
- [ ] Copy bot token
- [ ] Invite bot to server with permissions

### Step 2: Configure openclaw.json
- [ ] Add Discord channel configuration
- [ ] Set `channels.discord.enabled: true`
- [ ] Configure `channels.discord.token`
- [ ] Set `dm.enabled: false` (guild-only mode)
- [ ] Configure guild ID and channel IDs
- [ ] Set `requireMention: true` for all channels

### Step 3: Configure Agents
- [ ] Create agent entries for Scout, Max, John, Maya
- [ ] Set unique `id` and `name` for each
- [ ] Configure unique `groupChat.mentionPatterns` for each
- [ ] Set appropriate workspaces
- [ ] Configure tool permissions per agent

### Step 4: Configure Bindings
- [ ] Create binding for each agent
- [ ] Match on Discord channel/peer
- [ ] Ensure deterministic routing (most-specific first)

### Step 5: Test
- [ ] Start OpenClaw gateway: `openclaw gateway start`
- [ ] Test mention in Discord: `@Scout hello`
- [ ] Verify agent responds in correct channel
- [ ] Test each agent mention pattern

---

## Key Documentation References

1. **Discord Channel Docs:** https://docs.openclaw.ai/channels/discord
2. **Multi-Agent Routing:** https://docs.openclaw.ai/concepts/multi-agent
3. **Configuration Reference:** https://openclaw.im/docs/channels/discord
4. **GitHub Repository:** https://github.com/openclaw/openclaw

---

## Troubleshooting Common Issues

### Bot connects but never replies:
- ✅ Check `requireMention: true` is set
- ✅ Verify Message Content Intent is enabled
- ✅ Ensure bot has channel permissions (View/Send/Read History)
- ✅ Confirm user is in allowlist (if configured)

### Mentions not triggering agents:
- ✅ Check `mentionPatterns` include the exact mention format
- ✅ Verify pattern case sensitivity
- ✅ Ensure `messages.groupChat.mentionPatterns` includes global patterns
- ✅ Check bindings match the correct channel

### Wrong agent responding:
- ✅ Review binding order (first match wins)
- ✅ Verify `mentionPatterns` are unique per agent
- ✅ Check for overlapping patterns
- ✅ Ensure agent IDs match bindings

---

## Advanced Configuration

### Per-Channel Agent Override

Route same mention to different agents based on channel:

```json
{
  "bindings": [
    {
      "agentId": "scout",
      "match": {
        "channel": "discord",
        "peer": {
          "kind": "channel",
          "id": "RESEARCH_CHANNEL_ID"
        }
      }
    },
    {
      "agentId": "max",
      "match": {
        "channel": "discord",
        "peer": {
          "kind": "channel",
          "id": "DEV_CHANNEL_ID"
        }
      }
    }
  ]
}
```

### History Context

Include recent messages as context:

```json
{
  "channels": {
    "discord": {
      "historyLimit": 20  // Include last 20 messages as context
    }
  }
}
```

### Reaction Notifications

Configure bot to react to its own messages:

```json
{
  "channels": {
    "discord": {
      "guilds": {
        "YOUR_GUILD_ID": {
          "reactionNotifications": "own"  // or "all" or "off"
        }
      }
    }
  }
}
```

---

## Conclusion

OpenClaw provides **comprehensive built-in support** for auto-mention response systems through:

1. ✅ **Native Discord Gateway integration** (no webhooks needed)
2. ✅ **Pattern-based mention detection** (`mentionPatterns`)
3. ✅ **Channel-level gating** (`requireMention`)
4. ✅ **Multi-agent routing** via bindings
5. ✅ **Automatic session spawning** on mention

The configuration is straightforward and requires only changes to `openclaw.json`. No custom code, webhooks, or external event monitoring is needed - it's all built into the platform.

**For the specific use case (@Scout, @Max, @John, @Maya), configure each agent with unique `mentionPatterns` and create bindings to route messages appropriately.**
