# OpenClaw Multi-Agent Discord Channel Access Research Report

**Date:** 2026-02-10
**Researcher:** Scout (Research Specialist)
**Target:** @fawzi

---

## Executive Summary

This report provides comprehensive guidance on granting all OpenClaw agents (Scout, Max, John, Maya) full access to all Discord channels without breaking the gateway. Based on analysis of OpenClaw's architecture and Discord integration, I've identified the key configuration approaches, best practices, and potential pitfalls.

---

## 1. Current Issue Analysis

### How OpenClaw Handles Discord Channels

OpenClaw treats Discord channels with specific isolation patterns:

- **Direct Messages (DMs):** Collapse into the agent's main session (`agent:<agentId>:discord:dm:<userId>`)
- **Guild Channels:** Stay isolated as `agent:<agentId>:discord:channel:<channelId>`
- **Session Isolation:** Each agent has separate session stores under `~/.openclaw/agents/<agentId>/sessions/`
- **Channel Routing:** Messages are routed to agents via `bindings` configuration

### The Core Challenge

By default, OpenClaw's channel isolation means:
- Each guild channel creates its own session per agent
- Agents don't automatically share channel access
- Config must explicitly allow channels for each agent
- Gateway stability requires careful permission management

---

## 2. Solution Options

### Option A: Global Guild Access (Recommended for Full Access)

Configure the Discord channel to allow all agents access to all guild channels:

```json
{
  "channels": {
    "discord": {
      "enabled": true,
      "token": "YOUR_DISCORD_BOT_TOKEN",
      "groupPolicy": "open",
      "dm": {
        "enabled": true,
        "policy": "pairing"
      },
      "guilds": {
        "*": {
          "channels": {
            "*": {
              "allow": true,
              "requireMention": false
            }
          }
        }
      }
    }
  }
}
```

**Pros:**
- Simplest configuration
- All channels accessible by default
- Works with multiple agents seamlessly

**Cons:**
- Less granular control
- Requires careful agent binding setup

### Option B: Role-Based Access Control

Use Discord roles combined with OpenClaw's guild configuration:

```json
{
  "channels": {
    "discord": {
      "guilds": {
        "GUILD_ID": {
          "roles": {
            "ROLE_ID": {
              "allow": true,
              "skills": ["research", "build"]
            }
          }
        }
      }
    }
  }
}
```

**Pros:**
- Fine-grained permissions
- Leverages Discord's native role system
- Easier to manage large teams

**Cons:**
- More complex configuration
- Requires Discord role management

### Option C: Per-Agent Channel Allowlists

Configure specific channel access per agent:

```json
{
  "agents": {
    "list": [
      {
        "id": "scout",
        "groupChat": {
          "mentionPatterns": ["@scout"],
          "discordChannels": ["*"]
        }
      },
      {
        "id": "max",
        "groupChat": {
          "mentionPatterns": ["@max"],
          "discordChannels": ["*"]
        }
      },
      {
        "id": "john",
        "groupChat": {
          "mentionPatterns": ["@john"],
          "discordChannels": ["*"]
        }
      },
      {
        "id": "maya",
        "groupChat": {
          "mentionPatterns": ["@maya"],
          "discordChannels": ["*"]
        }
      }
    ]
  },
  "bindings": [
    {
      "agentId": "scout",
      "match": {
        "channel": "discord",
        "guildId": "*"
      }
    },
    {
      "agentId": "max",
      "match": {
        "channel": "discord",
        "guildId": "*"
      }
    },
    {
      "agentId": "john",
      "match": {
        "channel": "discord",
        "guildId": "*"
      }
    },
    {
      "agentId": "maya",
      "match": {
        "channel": "discord",
        "guildId": "*"
      }
    }
  ]
}
```

**Pros:**
- Maximum control per agent
- Each agent can have unique skills/prompts
- Clear separation of concerns

**Cons:**
- Verbose configuration
- Requires careful binding order (most-specific first)

### Option D: Combined Approach (Recommended)

Use global access with agent-specific routing:

```json
{
  "channels": {
    "discord": {
      "enabled": true,
      "token": "YOUR_BOT_TOKEN",
      "groupPolicy": "allowlist",
      "guilds": {
        "*": {
          "requireMention": false,
          "channels": {
            "*": {
              "allow": true,
              "requireMention": false
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
        "default": true,
        "name": "Scout",
        "workspace": "~/.openclaw/workspace-scout",
        "groupChat": {
          "mentionPatterns": ["@scout", "@research"]
        }
      },
      {
        "id": "max",
        "name": "Max",
        "workspace": "~/.openclaw/workspace-max",
        "groupChat": {
          "mentionPatterns": ["@max", "@builder"]
        }
      },
      {
        "id": "john",
        "name": "John",
        "workspace": "~/.openclaw/workspace-john",
        "groupChat": {
          "mentionPatterns": ["@john"]
        }
      },
      {
        "id": "maya",
        "name": "Maya",
        "workspace": "~/.openclaw/workspace-maya",
        "groupChat": {
          "mentionPatterns": ["@maya"]
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
          "kind": "direct"
        }
      }
    },
    {
      "agentId": "max",
      "match": {
        "channel": "discord",
        "mentionPattern": "@max"
      }
    },
    {
      "agentId": "scout",
      "match": {
        "channel": "discord",
        "mentionPattern": "@scout"
      }
    },
    {
      "agentId": "scout",
      "match": {
        "channel": "discord",
        "mentionPattern": "@research"
      }
    }
  ]
}
```

---

## 3. Recommended Approach

### For Full Multi-Agent Discord Access

**Recommended Configuration:**

```json
{
  "channels": {
    "discord": {
      "enabled": true,
      "token": "YOUR_DISCORD_BOT_TOKEN",
      "groupPolicy": "allowlist",
      "dm": {
        "enabled": true,
        "policy": "pairing",
        "allowFrom": ["YOUR_USER_ID"]
      },
      "guilds": {
        "YOUR_GUILD_ID": {
          "slug": "your-server",
          "requireMention": false,
          "users": ["YOUR_USER_ID"],
          "channels": {
            "*": {
              "allow": true,
              "requireMention": false
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
        "identity": {
          "name": "Scout"
        },
        "groupChat": {
          "mentionPatterns": ["@scout"]
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
          "mentionPatterns": ["@max"]
        }
      },
      {
        "id": "john",
        "name": "John",
        "workspace": "~/.openclaw/workspace-john",
        "identity": {
          "name": "John"
        },
        "groupChat": {
          "mentionPatterns": ["@john"]
        }
      },
      {
        "id": "maya",
        "name": "Maya",
        "workspace": "~/.openclaw/workspace-maya",
        "identity": {
          "name": "Maya"
        },
        "groupChat": {
          "mentionPatterns": ["@maya"]
        }
      }
    ]
  },
  "bindings": [
    {
      "agentId": "scout",
      "match": {
        "channel": "discord",
        "guildId": "YOUR_GUILD_ID",
        "mentionPattern": "@scout"
      }
    },
    {
      "agentId": "max",
      "match": {
        "channel": "discord",
        "guildId": "YOUR_GUILD_ID",
        "mentionPattern": "@max"
      }
    },
    {
      "agentId": "john",
      "match": {
        "channel": "discord",
        "guildId": "YOUR_GUILD_ID",
        "mentionPattern": "@john"
      }
    },
    {
      "agentId": "maya",
      "match": {
        "channel": "discord",
        "guildId": "YOUR_GUILD_ID",
        "mentionPattern": "@maya"
      }
    }
  ]
}
```

---

## 4. Step-by-Step Implementation

### Step 1: Prepare Discord Bot

1. **Create Discord Application:**
   - Go to Discord Developer Portal → Applications → New Application
   - Add Bot → Copy Bot Token

2. **Enable Privileged Intents:**
   - Message Content Intent (required for reading messages)
   - Server Members Intent (recommended for member lookups)

3. **Generate Invite URL:**
   - OAuth2 → URL Generator
   - Scopes: `bot`, `applications.commands`
   - Permissions: `View Channels`, `Send Messages`, `Read Message History`, `Embed Links`, `Attach Files`, `Add Reactions`
   - Copy URL and invite bot to server

4. **Get IDs:**
   - Enable Developer Mode in Discord settings
   - Copy Server ID (guild ID)
   - Copy channel IDs for all channels
   - Copy your User ID

### Step 2: Configure OpenClaw

1. **Create/Edit Config File:**
   ```bash
   nano ~/.openclaw/openclaw.json
   ```

2. **Add Discord Configuration:**
   - Use the recommended configuration above
   - Replace placeholders with actual IDs and tokens

3. **Configure Agents:**
   - Create separate workspaces for each agent
   - Set unique mention patterns
   - Configure agent-specific settings

4. **Set Up Bindings:**
   - Order bindings by specificity (most specific first)
   - Use guildId and mentionPattern for routing

### Step 3: Verify Gateway Stability

1. **Test Configuration:**
   ```bash
   openclaw gateway restart
   openclaw channels status --probe
   openclaw security audit
   ```

2. **Check Logs:**
   ```bash
   openclaw logs
   ```

3. **Test Each Agent:**
   - Send @mentions to each agent in Discord
   - Verify responses come from correct agents
   - Check session isolation works properly

---

## 5. Risk Mitigation

### Common Pitfalls and Solutions

| Pitfall | Solution |
|---------|----------|
| **Bot lacks channel permissions** | Ensure bot has View Channels, Send Messages, and Read Message History permissions in each channel |
| **Missing Message Content Intent** | Enable Message Content Intent in Discord Developer Portal and restart gateway |
| **Messages not routing correctly** | Check binding order - most specific bindings must come first |
| **Agents responding to wrong mentions** | Use unique mention patterns per agent |
| **Gateway breaking after config change** | Use `openclaw gateway restart` instead of manual process kill |
| **Session mixing between agents** | Ensure each agent has unique agentId and workspace |
| **Bot-to-bot reply loops** | Set `requireMention: true` and use allowlists |
| **Rate limiting** | Configure retry policy in channels.discord.retry |

### Security Considerations

1. **DM Access Control:**
   - Use `dm.policy: "pairing"` for unknown senders
   - Only use `"open"` with explicit allowlist: `allowFrom: ["*"]`

2. **Guild Access:**
   - Use `groupPolicy: "allowlist"` instead of `"open"`
   - Explicitly list allowed channels under `channels`

3. **Tool Restrictions:**
   - Apply per-agent tool policies for sensitive operations
   - Use sandboxing for untrusted agents

4. **Session Isolation:**
   - Consider `session.dmScope: "per-channel-peer"` for multi-user environments
   - Use unique session stores per agent

### Gateway Stability Best Practices

1. **Always use numeric IDs** for guilds, channels, and users
2. **Test configurations incrementally** before full deployment
3. **Monitor logs** after configuration changes
4. **Keep backup** of working configurations
5. **Use version control** for config files
6. **Run security audit** after changes: `openclaw security audit`

---

## 6. Alternative Approaches Summary

| Approach | Best For | Complexity |
|----------|----------|------------|
| **Global Guild Access** | Full channel access for all agents | Low |
| **Role-Based Access** | Teams with different permission levels | Medium |
| **Per-Agent Allowlists** | Fine-grained control per agent | High |
| **Combined Approach** | Balanced access + control | Medium-High |

---

## 7. Conclusion

For giving all OpenClaw agents (Scout, Max, John, Maya) full access to all Discord channels:

1. **Use the Combined Approach** with:
   - Global guild access (`channels.discord.guilds.*.channels.*.allow: true`)
   - Per-agent mention patterns for routing
   - Proper binding configuration
   - Security-conscious DM policies

2. **Key Success Factors:**
   - Each agent needs unique workspace and session store
   - Mention patterns must be unique per agent
   - Bindings should be ordered by specificity
   - Test thoroughly before production use

3. **Gateway Stability:**
   - Follow the step-by-step implementation
   - Run security audit after changes
   - Monitor logs for issues
   - Keep configurations version-controlled

---

## References

- OpenClaw Discord Documentation: https://docs.openclaw.ai/channels/discord
- Multi-Agent Routing: https://docs.openclaw.ai/concepts/multi-agent
- Security Guidelines: https://docs.openclaw.ai/gateway/security
- Channel Routing: https://deepwiki.com/openclaw/openclaw/8.1-channel-routing-and-access-control

---

**Report prepared by Scout**
**Report date:** 2026-02-10
