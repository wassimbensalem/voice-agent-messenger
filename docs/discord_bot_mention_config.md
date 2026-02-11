# Discord Bot Mentions: Configuration vs Code Issues

## Research Date: February 10, 2026

## Executive Summary

**Verdict: This is primarily a Discord configuration issue, not a code issue.**

Discord bot mentions require specific server configurations beyond just bot permissions. The system has layered restrictions that must all be satisfied for mentions to work correctly.

---

## 1. Discord Bot Permissions for Mentions

### Key Permission Required
- **Permission Name**: "Mention @everyone, @here, and All Roles"
- **Permission Bit**: `0x200000000` (33rd bit)
- **Purpose**: Allows the bot to use @everyone, @here, and role mention syntax in messages

### Additional Considerations
- The bot must be invited with this permission granted
- Server administrators can override some mention restrictions
- 2FA may be required for certain permission combinations if the server mandates it

---

## 2. Can Bots Mention Users? Can Bots Mention Other Bots?

### User Mentions
✅ **YES** - Bots can mention regular users using the format `<@userID>`
- No special permissions needed beyond basic message sending
- Works by default in most configurations
- Example: `await channel.send("<@123456789>")`

### Bot Mentions
✅ **YES** - Bots can mention other bots using the same `<@botUserID>` format
- Treated the same as user mentions
- The target bot's user ID is used (not application ID)
- Example: `await channel.send("<@987654321>")` where 987654321 is another bot's user ID

### @everyone and @here Mentions
⚠️ **RESTRICTED** - Require the "Mention @everyone, @here, and All Roles" permission
- Must explicitly include `@everyone` or `@here` in the message content
- Often requires additional API configuration (see Section 4)

---

## 3. Server Configuration Affecting Bot Mentions

### Critical Setting: Role Mentionability

**"Allow anyone to @mention this role"** (Role-specific setting)

This is the most common configuration issue:

1. **Location**: Server Settings → Roles → Edit Role → Permissions tab
2. **What it does**: Controls whether anyone can ping the role and have it actually notify members
3. **Important**: Even if a bot has the "Mention everyone" permission, it CANNOT make a role mention ping unless:
   - The role has "Allow anyone to @mention this role" enabled, OR
   - The message sender is a server administrator

### Recent Discord Changes (2020+)
- **Administrators can now ping roles even if "Allow anyone to @mention this role" is disabled**
- This applies to both human admins and bots with Administrator permission
- Regular users/bots still need the role to be mentionable

---

## 4. Discord API Limitations on Bot Mentions

### allowed_mentions Parameter
The Discord API includes an `allowed_mentions` field in message payloads:

```json
{
  "content": "@everyone Hello!",
  "allowed_mentions": {
    "parse": ["everyone"],  // or ["roles"], ["users"]
    "roles": ["123456789"],
    "users": ["987654321"]
  }
}
```

### Limitations
1. **parse array**: Controls which mention types are allowed
   - `["users"]` - user mentions
   - `["roles"]` - role mentions  
   - `["everyone"]` - @everyone/@here mentions

2. **Explicit allow lists**: You can whitelist specific roles/users even if parse restrictions apply

3. **Library defaults**: Many bot libraries (discord.py, discord.js) have default `allowed_mentions` settings that may restrict @everyone mentions for safety

### Deprecation Notice (Resolved)
- GitHub issue #1604 highlighted that role mentions still required the server setting even after API changes
- The 60-day deprecation period confirmed this is by design, not a bug

---

## 5. Permission Requirements Summary

| Mention Type | Bot Permission Required | Server Setting Required |
|-------------|------------------------|------------------------|
| Regular User `<@id>` | None (just Send Messages) | None |
| Bot User `<@botID>` | None (just Send Messages) | None |
| Role `<@&id>` | "Mention @everyone, here, and All Roles" | "Allow anyone to @mention this role" OR admin |
| @everyone | "Mention @everyone, here, and All Roles" | None (permission sufficient) |
| @here | "Mention @everyone, here, and All Roles" | None (permission sufficient) |

---

## Diagnosis: Configuration vs Code Issue

### Signs It's a Configuration Issue
1. ✅ Bot has permission but mentions don't ping
2. ✅ Role mentions show up as text but don't notify
3. ✅ @everyone/@here don't trigger notifications
4. ✅ Some channels work, others don't (channel-level permissions)

### Signs It's a Code Issue
1. ❌ Mentions not being sent at all (wrong format)
2. ❌ Using wrong user/role IDs
3. ❌ Missing `allowed_mentions` configuration in API call
4. ❌ Syntax errors in mention strings

### Common Fixes (Configuration)
1. **Check bot permissions**: Ensure "Mention @everyone, here, and All Roles" is granted
2. **Check role settings**: Enable "Allow anyone to @mention this role" for target roles
3. **Check channel permissions**: Ensure permissions are set at channel level if needed
4. **Admin override**: Server admins can always ping roles

### Common Fixes (Code)
1. **Format correctly**: Use `<@userID>` for users, `<@&roleID>` for roles
2. **Configure allowed_mentions**: Set appropriate parse options for @everyone/@here
3. **Verify IDs**: Ensure you're using correct user/bot/role IDs
4. **Check library defaults**: Some libraries restrict mentions by default

---

## References

- Discord Developer Portal: [Permissions Documentation](https://discord.com/developers/docs/topics/permissions)
- Discord API GitHub: [Issue #1604 - allowed_mentions ping requirements](https://github.com/discord/discord-api-docs/issues/1604)
- Stack Overflow: [Discord bot can't mention everyone despite having permission](https://stackoverflow.com/questions/55455719/discord-bot-cant-mention-everyone-despite-having-its-permission)
- Discord Permissions Calculator: [discordapi.com/permissions](https://discordapi.com/permissions.html)

---

## Conclusion

**Discord bot mention issues are predominantly configuration-related, not code-related.**

The system has been deliberately designed with these layered protections to prevent spam and abuse. The two-level system (bot permission + role mentionability) means both must be configured correctly for mentions to function as expected.

When troubleshooting, always verify:
1. Bot has the correct permission in its role
2. Target role has "Allow anyone to @mention this role" enabled (or sender is admin)
3. Code is using correct mention format (`<@id>`, `<@&id>`, `@everyone`)
4. API calls include appropriate `allowed_mentions` configuration if needed
