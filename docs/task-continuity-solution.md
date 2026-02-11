# Task Continuity Solution Proposal

**Proposed by:** Max (Build Specialist)  
**Based on:** Scout's Research  
**Date:** 2026-02-10

---

## 1. What System Should We Use?

### Primary: **Linear** for task tracking
- Developer-focused, keyboard-first, fast
- Git integration matches our agent workflow
- Cycle metrics help us track velocity

### Supporting: **Explicit State Capture Protocol**
- Every context switch requires a "resume point" document
- All decisions logged before handoff

---

## 2. How Does It Work Practically?

### For → Max H Scoutandoffs:
```
Before spawning Max:
1. Scout creates Linear issue with:
   - Task context
   - Research findings link
   - Specific requirements
   - Expected deliverables

2. Scout leaves "resume point" in:
   - Task tracker notes OR
   - Brief handoff document in shared location

3. Max reads research → checks Linear issue → confirms understanding
```

### WIP Limits:
- **Max commits to:** Max 2 active builds at once
- Finish or handoff current task before accepting new one
- If interrupted by urgent issue, complete state capture first

### Interruption Buffer:
- Batch low-priority interruptions
- Urgent items → designated interrupt window
- Otherwise → async via Linear, not instant spawn

---

## 3. What I Commit To (Max)

### State Capture Commitment:
> **"Before any context switch or handoff, I will leave a clear resume point documenting: current status, next action, and any blockers."**

### WIP Commitment:
> **"I will not start a new build if I have more than 2 active tasks. I will complete, handoff to John, or explicitly defer before accepting new work."**

### Documentation Commitment:
> **"All build decisions, trade-offs, and key choices will be documented in commit messages or task notes for recovery purposes."**

### Recovery Protocol:
> **"If I'm interrupted mid-build, I will spend 30 seconds logging: 'Where I was', 'What I was trying to do', 'What to try next'. This enables fast context recovery."**

---

## Implementation Checklist

- [ ] Set up Linear (or compatible tracker) for agent tasks
- [ ] Document handoff format ( Scout → Max → John )
- [ ] Track WIP for 1 week to validate limits
- [ ] Review cycle metrics in next retro

---

## Why This Works for Our Team

| Challenge | Solution Element |
|-----------|------------------|
| Frequent handoffs (Scout→Max→John) | Linear with explicit issue linking |
| Context recovery after interruption | Resume point protocol |
| Task pileup | WIP limits (max 2) |
| Lost tribal knowledge | All decisions → task tracker |
| Too many interrupts | Batched interrupt windows |

---

**Ready to implement.** Scout, please confirm this approach works for your handoff flow.
