# OpenClaw Built-in Task Tracking Research

**Research Date:** 2026-02-10  
**Researcher:** Scout (Subagent)

## Executive Summary

**OpenClaw does NOT have a built-in task tracking or mission control dashboard.** However, it has powerful session management, scheduling, and workflow capabilities that can be leveraged for task management.

---

## What OpenClaw Has (Built-in)

### 1. **Session Management**
- **Location:** `/concepts/session`
- **Features:**
  - Per-sender, per-channel, and per-group session isolation
  - Session lifecycle management (reset policies, idle timeouts)
  - Session key mapping for routing
  - `openclaw sessions --json` to list all sessions
  - `/status` command to view session state
  - `/stop` to abort runs
  - `/context list` to see context

### 2. **Scheduling & Automation**
- **Heartbeat:** Periodic checks (default 30 min) with `HEARTBEAT.md` checklist
  - Location: `/automation/cron-vs-heartbeat`
  - Batches multiple checks: inbox, calendar, notifications
  - Context-aware (shares main session context)

- **Cron Jobs:** Precise scheduling
  - Location: `/automation/cron-jobs`
  - `openclaw cron add` for scheduling
  - Isolated sessions (doesn't pollute main history)
  - Model overrides per job
  - One-shot reminders with `--at`
  - Examples:
    ```bash
    openclaw cron add --name "Morning brief" --cron "0 7 * * *" --session isolated --message "Generate today's briefing" --announce
    ```

### 3. **Sub-Agents**
- **Location:** `/tools/subagents.md`
- Run in their own session
- Return summaries to main chat
- Keep main chat responsive
- Use `/subagents` or ask to "spawn a sub-agent"

### 4. **Workflow Engine: Lobster** ✅
- **Location:** `/tools/lobster`
- **Type:** Optional plugin (not built-in, but official)
- **Features:**
  - Multi-step tool pipelines
  - Deterministic execution
  - Explicit approval checkpoints
  - Resumable workflows with tokens
  - JSON-only LLM steps via `llm-task` plugin
  - Workflow files (`.lobster`)

### 5. **Control UI Dashboard**
- **Location:** `/web/control-ui`
- **URL:** `http://127.0.0.1:18789/`
- **Features:**
  - Chat interface
  - Session list and management
  - Cron job management (list/add/run/enable/disable)
  - Channel status and configuration
  - Node management
  - Config editing
  - Debug tools and logs

---

## What OpenClaw LACKS (No Built-in)

❌ **Task boards** (kanban-style tracking)  
❌ **Mission control UI** (dedicated dashboard for monitoring)  
❌ **Progress tracking** (visual progress bars, status dashboards)  
❌ **Multi-agent coordination** (built-in squad management)  
❌ **Task dependencies** (A must finish before B starts)  
❌ **Task assignment** (assigning work to specific agents)  

---

## Third-Party Mission Control Options

### 1. **Claw.so - The Operator Cockpit**
- **URL:** https://claw.so/
- **Description:** Desktop operator cockpit for OpenClaw agents
- **Features:**
  - Monitor agents and task workflows
  - Send tasks that run overnight
  - Unified Mission Control for local and remote agents

### 2. **openclaw-mission-control (by manish-raana)**
- **URL:** https://github.com/manish-raana/openclaw-mission-control
- **Stack:** Convex + React
- **Features:**
  - Real-time web UI
  - Track task state, agent activity, live logs
  - Instant synchronization (no polling)

### 3. **mission-control (by crshdn)**
- **URL:** https://github.com/crshdn/mission-control
- **Features:**
  - AI Agent Orchestration Dashboard
  - Manage agents, assign tasks
  - Coordinate multi-agent collaboration

### 4. **Dan Malone's Mission Control Dashboard**
- **Blog:** https://www.dan-malone.com/blog/mission-control-ai-agent-squads
- **Features:**
  - Activity Feed (chronological stream)
  - Agent check-ins, task completions, mentions, errors
  - Real-time monitoring

### 5. **Sub-Agents Dashboard Gist**
- **URL:** https://gist.github.com/bdennis-dev/6ddd4d0647a90d3f72db64825ed50d66
- **Features:**
  - Sub-Agents section with session listing
  - Shows label, model, token count, running status
  - Quick info panel (human name, GitHub username, workspace path)

---

## Recommendation

### **Should We Build or Integrate?**

**RECOMMENDATION: INTEGRATE + BUILD LIGHTWEIGHT OVERLAY**

**Rationale:**

1. **OpenClaw's strengths:** Session management, scheduling, and Lobster workflows are excellent foundations
2. **Gaps:** No visual task board or real-time monitoring dashboard
3. **Best approach:** 
   - Integrate with an existing Mission Control (claw.so or community project)
   - Build lightweight overlay on top of `openclaw sessions --json` and Control UI APIs
   - Leverage Lobster for workflow/task pipelines

### **Recommended Implementation Path:**

1. **Phase 1: Dashboard Overlay**
   - Use Control UI existing capabilities
   - Add session monitoring extension
   - Display sub-agent status

2. **Phase 2: Task Integration**
   - Map tasks to Lobster workflows
   - Track via session metadata
   - Use cron/heartbeat for status updates

3. **Phase 3: Full Mission Control**
   - Integrate with claw.so or community project
   - Add visual task board
   - Enable multi-agent coordination

---

## Documentation References

- **Main Docs:** https://docs.openclaw.ai
- **Session Management:** https://docs.openclaw.ai/concepts/session
- **Automation:** https://docs.openclaw.ai/automation/cron-vs-heartbeat
- **Lobster Workflow:** https://docs.openclaw.ai/tools/lobster
- **Sub-Agents:** https://docs.openclaw.ai/tools/subagents
- **Control UI:** https://docs.openclaw.ai/web/control-ui
- **CLI Reference:** `/usr/lib/node_modules/openclaw/docs/cli/`

---

## Key Commands

```bash
# Session management
openclaw sessions --json                    # List all sessions
openclaw sessions --active 120              # Active in last 120 min
openclaw status                             # Gateway status

# Scheduling
openclaw cron add --name "Task" --cron "0 7 * * *" --session isolated --message "..." --announce
openclaw cron list                          # List cron jobs

# Control UI
openclaw dashboard                          # Open Control UI
openclaw dashboard --no-open               # Print URL only

# Sub-agents
/subagents                                  # List sub-agents in chat
```

---

## Conclusion

OpenClaw provides **robust session and workflow foundations** but **lacks a visual task tracking/mission control interface**. Building a lightweight overlay using existing APIs and sessions data is the most efficient path, potentially integrating with community tools like claw.so for more advanced features.
