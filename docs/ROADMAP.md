# Athena AI Roadmap

## Phase 1 — Foundation ✅

- [x] Project setup
- [x] TypeScript
- [x] Discord integration
- [x] Slash command framework
- [x] /ping
- [x] /help
- [x] /about

## Phase 2 — Athena Intelligence ✅

- [x] AI Provider abstraction
- [x] Gemini integration
- [x] /ask command
- [x] Athena Constitution
- [x] System Prompt
- [x] Response Strategy
- [x] Token / usage / latency tracking
- [x] Conversation management
- [x] Conversation isolation
- [x] Error / provider handling

## Phase 3 — Memory 🚧

[x] Long-term memory
[x] User profiles
[x] Conversation summaries
[x] Memory retrieval
[x] Memory management
[x] Conversation summary injection
[x] sourceMessageCount foundation
[x] Automatic summary triggering
[ ] Persistent memory storage

## Phase 4 — Tools & Services ⏳

- [ ] Tool calling architecture
- [ ] Web search
- [ ] Calculator
- [ ] PDF analysis
- [ ] Image understanding
- [ ] Image generation
- [ ] External API tools

## Phase 5 — Interfaces ⏳

- [ ] Web API
- [ ] Web Chat
- [ ] Portfolio Widget
- [ ] Mobile Application
- [ ] Desktop Application

## Phase 6 — Advanced Intelligence ⏳

- [ ] Voice input
- [ ] Voice output
- [ ] Multiple AI providers
- [ ] Task classification
- [ ] Intelligent model routing
- [ ] Capability-based model selection
- [ ] Multi-model task orchestration

## Phase 7 — Production ⏳

- [ ] Authentication
- [ ] User accounts
- [ ] Dashboard
- [ ] API security
- [ ] Usage limits
- [ ] Logging / monitoring
- [ ] Database
- [ ] Cloud deployment
- [ ] Production infrastructure

## Milestones

✅ Milestone 1 — Athena Foundation

✅ Milestone 2 — Athena Intelligence & Conversation

⬜ Milestone 3 — Memory System

⬜ Milestone 4 — Tool Calling & Services

⬜ Milestone 5 — Web Chat

⬜ Milestone 6 — Portfolio Widget

⬜ Milestone 7 — Mobile / Desktop Interfaces

⬜ Milestone 8 — Voice

⬜ Milestone 9 — Multiple AI Providers

⬜ Milestone 10 — Intelligent Model Routing

⬜ Milestone 11 — Production Deployment

## Current Implementation Status

The deterministic Phase 3 memory foundation is implemented.

### Implemented

- Memory data model
- MemoryRepository abstraction
- InMemoryMemoryRepository
- MemoryManager lifecycle operations
- User profile lifecycle
- Explicit memory lifecycle
- Deterministic memory retrieval
- Memory context injection into Athena
- Explicit long-term memory API
- User ownership enforcement
- Discord `/remember`
- Discord `/memories`
- Discord `/forget`

### Not Yet Implemented

- Persistent memory storage
- Conversation summaries
- Automatic memory inference
- Semantic memory retrieval
- Embeddings / vector search
- Relevance-based memory ranking

### Storage Limitation

The current implementation uses `InMemoryMemoryRepository`.

Memories therefore exist only for the lifetime of the running Athena
process and are lost when the application restarts.

Persistent storage will be introduced in a later phase without changing
the MemoryManager business-facing API.
