# Athena AI — Memory System (Phase 3 Design)

Status: **on progress**
This document is the source of truth for Phase 3. It defines the architecture,
boundaries, and vocabulary for Athena's memory system before any code,
database, or dependency is introduced.

---

## 1. Memory System Overview

Athena currently has **conversation context**, not **memory**. Every
`Conversation` held by `ConversationManager` lives only for the lifetime of
the process and only for the duration of that specific conversation. When the
process restarts, or when a different conversation begins, that context is
gone. This is correct and intentional for Phase 2 — it is short-term working
memory for a single exchange.

**Memory** is different in kind, not just duration. Memory is information
Athena retains _about a user_ (or, later, about a project or topic) that
persists **across conversations**, **across restarts**, and eventually
**across interfaces** (Discord today; Web, Mobile, Desktop, or a Portfolio
Widget later).

|                           | Conversation Context     | Memory                             |
| ------------------------- | ------------------------ | ---------------------------------- |
| Owned by                  | `ConversationManager`    | Memory System                      |
| Lifetime                  | One conversation         | Indefinite, until forgotten        |
| Survives restart          | No                       | Yes                                |
| Survives new conversation | No                       | Yes                                |
| Scope                     | A single exchange        | A user (or entity) over time       |
| Retrieval                 | Entire history, in order | Selective, relevant subset         |
| Written on                | Every message            | Explicit or meaningful events only |

Athena's intelligence in Phase 2 comes from _what is said in this
conversation_. Athena's intelligence in Phase 3 comes from _what Athena has
learned about this user over time_, brought back in at the right moment.

---

## 2. Memory Principles

These principles govern every future memory decision. They are intentionally
few and simple — Phase 3 is designed to avoid premature complexity.

- **Explicit boundaries** — Memory is a distinct system with a distinct
  responsibility. It is never merged into `Conversation` or `ConversationManager`.
- **User ownership** — Memory belongs to the user it describes. The user can
  always see, correct, and delete it.
- **Minimal necessary storage** — Athena stores what is useful, not
  everything that is said. Silence is the default; storage is the exception.
- **Provider independence** — Memory is not coupled to Gemini or any AI
  provider. It is plain, storable data that any `AIProvider` can be given as
  context.
- **Interface independence** — Memory is not coupled to Discord. It belongs
  to the Athena platform, addressable by user, not by channel.
- **Retrievability** — Anything stored must be retrievable in a useful,
  scoped way — not just as an ever-growing dump.
- **Deletability** — Anything stored must be as easy to remove as it was to
  create. There is no memory without a matching way to forget it.
- **Future scalability** — The design should not block smarter retrieval
  (e.g. embeddings) later, but it must not require it now.

---

## 3. Types of Memory

Phase 3 introduces a small, closed set of memory types. Anything not listed
here is explicitly future work (see Section 3.4).

### 3.1 User Profile

Stable, low-volatility information associated with a user.

Examples:

- Name / preferred name
- Communication preferences (e.g. concise vs. detailed answers)
- General interests relevant to how Athena should respond

User Profile is **not** a place for sensitive personal data by default (see
Section 5). It is inferred slowly and conservatively, and it is always
editable and deletable by the user.

### 3.2 Explicit User Memories

Information the user _intentionally_ asks Athena to remember.

Example:

> "Remember that I prefer concise answers."
> "Remember that I'm working on a project called Athena AI."

These are the highest-confidence, highest-priority memories, because the
user directly asserted them. They are stored close to verbatim, with minimal
interpretation.

### 3.3 Conversation Summaries

Condensed representations of _past_ conversations, not raw transcripts.

A raw conversation history is:

- Large
- Full of transient, moment-specific detail
- Expensive to keep and to feed back into a prompt indefinitely

A summary is:

- Small
- Focused on durable takeaways ("the user is learning TypeScript",
  "the user asked Athena to help design a Discord bot")
- Cheap to store and retrieve repeatedly

Summaries exist so Athena can recall _the shape_ of a past conversation
without re-reading it in full. Raw conversation history remains the
responsibility of `ConversationManager`, and is never itself long-term
memory.

### 3.4 Future Memory Types (not implemented in Phase 3)

Mentioned here only to show the design leaves room for them:

- **Semantic memories** — freeform facts retrieved by meaning/similarity
  rather than by fixed category.
- **Project memories** — durable context tied to a specific project the user
  is working on, rather than to the user in general.
- **Knowledge memories** — reference material Athena has been taught, as
  distinct from things Athena was told about the user.

These require retrieval strategies (e.g. embeddings) that Phase 3
deliberately does not introduce. They are named here so Phase 3's data model
doesn't need to be redesigned to accommodate them later.

---

## 4. What Athena Should Remember

Memory creation should be **conservative and criteria-driven**, not
automatic. Reasonable triggers:

- **Explicit "remember this" requests** — the strongest and simplest signal.
- **Stable preferences** — things unlikely to change turn-to-turn (tone,
  verbosity, general interests).
- **Useful recurring information** — facts the user references more than
  once, suggesting durable relevance.
- **Information that improves future interactions** — a low bar to reject
  by default: if it wouldn't change how Athena responds later, it isn't
  memory.

---

## 5. What Athena Should NOT Automatically Remember

Explicit non-goals for automatic storage:

- Temporary, one-off statements with no forward relevance.
- Every message in a conversation (that's `ConversationManager`'s job, and
  even there it isn't permanent).
- Sensitive personal information, by default.
- Passwords.
- API keys.
- Authentication credentials or tokens.
- Secrets of any kind.
- Information irrelevant to future interactions.

If Athena is ever uncertain whether something crosses one of these lines, the
correct default is **do not store it**.

---

## 6. Memory Lifecycle

Every memory, of any type, moves through the same conceptual lifecycle:

```
Creation
   ↓
Storage
   ↓
Retrieval
   ↓
Usage
   ↓
Update
   ↓
Deletion
```

- **Creation** — A memory-worthy moment is identified (Section 4) and a
  memory record is produced.
- **Storage** — The record is persisted, associated with its owning user
  (and, later, possibly a project or other scope).
- **Retrieval** — Given a new request, the subset of memories relevant to
  _this_ moment is selected — not the entire memory store.
- **Usage** — Retrieved memories are injected into the prompt Athena sends
  to the `AIProvider` (Section 9), shaping the response.
- **Update** — A memory can be revised (e.g. a preference changes) without
  being fully deleted and recreated, where practical.
- **Deletion** — A memory is permanently removed, either by explicit user
  request ("forget that") or future memory-management policy.

Not every memory necessarily reaches every stage on every use — a User
Profile entry may be created once and simply retrieved/used many times with
no update; an Explicit Memory may be created, used, and later deleted with no
update in between. The lifecycle describes the _possible_ stages, not a
mandatory pipeline.

---

## 7. Memory vs. Conversation

This is the most important boundary in the entire design, and it is not
allowed to blur:

**`ConversationManager` / `Conversation`**

- Manages the _active_ conversation's context.
- Maintains message order within that conversation.
- Handles conversation isolation (one conversation's messages never leak
  into another).
- Is short-term: scoped to a single conversation's lifetime.
- Has no concept of "the user" beyond the current conversation.

**Memory System**

- Manages information that outlives any single conversation.
- Is user-oriented, not conversation-oriented.
- Is selectively retrieved — Athena asks "what's relevant right now?",
  never "give me everything."
- Has no concept of message order or turn-taking; it stores durable facts
  and summaries, not transcripts.

`ConversationManager` answers _"what has been said in this conversation?"_
Memory answers _"what do I know about this user, beyond this conversation?"_

These responsibilities are never merged into one class or one abstraction.

---

## 8. Memory Retrieval

Conceptual flow for a future request:

```
User request
   ↓
Athena
   ↓
Memory retrieval  (Memory Manager asked: "what's relevant to this user/request?")
   ↓
Relevant memories  (a small, bounded set — not the full store)
   ↓
Prompt construction  (Constitution + Memory + Conversation + Current Message)
   ↓
AI Provider
```

Phase 3 retrieval is **criteria-based**, not semantic:

- Always include the user's Profile (it's small and always relevant).
- Include Explicit Memories relevant by simple matching (e.g. recency,
  or straightforward keyword relevance) rather than embedding similarity.
- Include the most recent relevant Conversation Summary/Summaries, bounded
  in count.

No embeddings, no vector search, and no semantic ranking are introduced in
Phase 3. Retrieval is intentionally simple and explainable; smarter
retrieval is a Phase 6+ concern (Section 14).

---

## 9. Memory Injection into Prompts

Retrieved memory must be **clearly separated** from conversation history in
the prompt, so Athena (and anyone debugging a prompt) can tell what is
"known about the user" versus "what was just said."

Conceptually, `Athena.buildPrompt()` evolves from:

```
System Prompt

Conversation:
...
```

to:

```
System Prompt

Memory:
...

Conversation:
...

Current User Message:
...
```

The **Memory** block is a distinct, labeled section — never interleaved into
the conversation history, and never presented as if the user just said it in
this conversation. This keeps the AI Provider's context honest about the
difference between "recalled" and "just stated."

(This section describes structure only; no prompt-building code is defined
here — that remains an implementation task.)

---

## 10. Memory Management

Future operations the Memory System must expose, at a conceptual level:

- **Remember** — create a new memory (explicit or system-derived).
- **Recall** — retrieve memory relevant to a given context.
- **Update** — revise an existing memory.
- **Forget** — delete a specific memory.
- **List memories** — let a user see everything Athena has stored about
  them.

These are architectural concepts for Phase 3 planning only — their exact
interfaces, command surfaces (e.g. a future `/forget` Discord command), and
implementations are not defined here.

---

## 11. Privacy and User Control

- **User ownership** — a user's memories belong to them, not to Athena, not
  to Discord, not to any single interface.
- **Forgetting memories** — a user can always ask Athena to forget something
  specific, and Athena complies rather than negotiating.
- **Deleting memories** — deletion is a first-class, always-available
  operation, not an edge case bolted on later.
- **Avoiding secrets** — Athena does not store credentials, tokens, or
  secrets under any memory type (Section 5).
- **Avoiding unnecessary sensitive data** — memory creation stays
  conservative (Section 4); sensitive personal data is not stored by
  default even if mentioned in passing.
- **Future account-level data separation** — as Athena gains multiple
  interfaces and, eventually, accounts (Phase 7), memory must remain
  separable and exportable per user, not entangled across users.

This section intentionally avoids legal or compliance language — these are
design principles for how Athena behaves, not a compliance framework.

---

## 12. Storage Architecture

Phase 3 design assumes memory will eventually be persisted, but **no
database or ORM is chosen or implemented here**. The important part of this
section is the conceptual layering, which keeps storage swappable and keeps
Athena itself ignorant of storage details:

```
Athena
   ↓
Memory Service / Memory Manager   (business rules: what/when/how to remember)
   ↓
Memory Repository                 (abstraction: store/retrieve, no SQL/driver specifics)
   ↓
Persistent Storage                (a concrete database — chosen later)
```

- **Memory Service / Memory Manager** is the only thing Athena talks to. It
  decides _whether_ something is memory-worthy (Section 4/5) and orchestrates
  retrieval for prompt construction (Section 8).
- **Memory Repository** is an abstraction — analogous in spirit to
  `AIProvider` — so the concrete storage technology can change without
  touching the Memory Service or Athena.
- **Persistent Storage** is a specific database (Postgres, SQLite, etc.),
  chosen and implemented later. Its choice must not leak upward into Athena
  or into the Memory Service's interface.

This mirrors the existing `AIProvider` → `GeminiProvider` pattern: an
abstraction the rest of the system depends on, with one concrete
implementation swappable behind it.

---

## 13. Interface Independence

Memory must behave identically regardless of which interface the user is
on:

- Discord (current)
- Web
- Mobile
- Desktop
- Portfolio Widget
- API

This means memory is addressed **by user identity**, not by Discord user ID,
channel ID, or any interface-specific identifier. Just as `AIProvider` keeps
Athena independent of Gemini, the Memory System keeps Athena independent of
Discord. Discord (via `AskCommand` → `Athena.ask()`) is simply the first
interface that will exercise this system — it is not baked into it.

Concretely, this implies a future user-identity concept that is stable
across interfaces. Defining that identity model is out of scope for this
document and is called out as a prerequisite in Section 15.

---

## 14. Future Evolution

This design deliberately leaves room for, without implementing:

- **Embeddings** — vector representations enabling similarity-based recall.
- **Semantic retrieval** — finding relevant memories by meaning, not
  keyword/category matching.
- **RAG (Retrieval-Augmented Generation)** — using retrieved memory/knowledge
  as grounding context at generation time, beyond simple prompt injection.
- **Project memory** — memory scoped to a project rather than only a user.
- **Knowledge bases** — larger reference material Athena can draw on,
  distinct from user-specific memory.
- **Multiple AI providers** — memory content is provider-agnostic text, so
  it can be handed to any future `AIProvider` implementation unchanged.

None of these are implemented in Phase 3. They are named so today's data
model and boundaries (Sections 3, 7, 12) don't have to be reworked to
accommodate them later.

---

## 15. Phase 3 Implementation Order

Recommended sequence, structured so each step is independently testable and
nothing later blocks something earlier:

1. **Memory types** — define the data shapes for User Profile, Explicit
   Memory, and Conversation Summary (no persistence yet).
2. **User identity concept** — a stable identifier for "who" memory belongs
   to, independent of Discord (needed before anything can be _owned_).
3. **Repository abstraction** — define the Memory Repository interface
   (in-memory implementation first, exactly as `ConversationManager` works
   today).
4. **Memory Manager/Service** — the orchestration layer Athena talks to;
   implements the storage criteria from Sections 4–5.
5. **User Profile** — first concrete memory type, since it's the simplest
   and most stable.
6. **Explicit Memories** — "remember that..." handling, since it's
   user-driven and high-confidence.
7. **Retrieval** — wire criteria-based retrieval (Section 8) into
   `Athena.buildPrompt()`, behind the Memory block (Section 9).
8. **Conversation Summaries** — requires deciding _when_ a conversation is
   summarized (e.g. on conversation end); introduced after retrieval exists
   so summaries have somewhere to feed into.
9. **Memory management operations** — recall/update/forget/list, exposed
   first internally, then via a Discord surface (e.g. future commands).
10. **Tests** — error handling, retrieval correctness, deletion correctness,
    mirroring the AIProviderError test approach already used for provider
    error handling.
11. **Persistence integration** — swap the in-memory Repository
    implementation for a real database, with zero changes required above
    the Repository boundary.

This order intentionally puts the **repository abstraction before any real
database**, exactly as `AIProvider` was defined before `GeminiProvider`.

---

## 16. Relationship to Existing Architecture

```
Discord / Web / Mobile / Desktop / API   (interfaces — present and future)
              ↓
          AskCommand (or equivalent per interface)
              ↓
           Athena.ask()
        ┌──────┴───────┐
        ↓               ↓
ConversationManager   Memory Manager / Memory Service
        ↓               ↓
   Conversation     Memory Repository
        ↓               ↓
        └──────┬────────┘
               ↓
    Athena.buildPrompt()
   (Constitution + Memory + Conversation + Current Message)
               ↓
          AIProvider
               ↓
        GeminiProvider
               ↓
         Gemini API
```

- **Athena** remains the single orchestrator. It now consults _two_ sources
  of context — `ConversationManager` (short-term) and the Memory Manager
  (long-term) — rather than one.
- **ConversationManager** is unchanged in responsibility; it is not extended
  to do memory's job.
- **AIProvider / GeminiProvider** are unaffected — they still just receive a
  finished prompt string and generation config, unaware that part of that
  prompt came from memory.
- **Discord** (`AskCommand`, `CommandHandler`) is unaffected structurally;
  it still only bridges Discord and Athena. Memory is invisible to it.
- Memory sits **below Athena and above persistence** — a peer to
  `ConversationManager` in Athena's eyes, not a subordinate of it.

---

## 17. Non-Goals (Phase 3)

Explicitly out of scope for Phase 3:

- Vector database
- Embeddings
- RAG
- Autonomous agents
- Multiple AI providers
- Complex knowledge graphs
- Production database infrastructure
- Automatic long-term storage of every conversation

Phase 3 delivers a working, provider-independent, interface-independent
memory _architecture_ with simple, explainable retrieval — not an
intelligent or automatic memory system. That refinement is future work
(Section 14), built on top of the boundaries defined here.

# SHORT VERSION

# Athena AI — Memory System

**Phase 3 Design — Architecture Only**

> **Status:** Design only — not yet implemented.

This document is the source of truth for Athena AI's Phase 3 Memory System. It defines the architecture, responsibilities, boundaries, and terminology that will guide implementation.

Phase 3 introduces persistent memory while keeping Athena's existing conversation architecture intact.

---

# 1. Memory System Overview

Athena currently has **conversation context**, not persistent memory.

`ConversationManager` maintains the messages belonging to an active conversation. This context exists only for that conversation and currently lives in memory.

**Memory is different from conversation context.**

Memory is persistent information Athena retains about a **user, project, or other explicitly defined entity** across conversations and, eventually, across interfaces.

The Memory System is therefore responsible for information that should remain useful beyond a single conversation.

| Conversation Context                 | Memory System                                       |
| ------------------------------------ | --------------------------------------------------- |
| Owned by `ConversationManager`       | Owned by Memory System                              |
| Short-term                           | Long-term                                           |
| Scoped to one conversation           | Scoped to a user, project, or entity                |
| Maintains message order              | Stores durable information                          |
| Contains conversation messages       | Contains selected facts, preferences, and summaries |
| Entire active history may be used    | Only relevant memories are retrieved                |
| Temporary                            | Persistent                                          |
| Interface-independent through Athena | Interface-independent through Athena                |

The distinction is fundamental:

> **Conversation tells Athena what has been said. Memory tells Athena what is worth knowing beyond the current conversation.**

---

# 2. Memory Principles

The following principles govern the Memory System.

## Explicit Boundaries

Memory is a separate system with a separate responsibility.

Memory must never be merged into:

- `Conversation`
- `ConversationManager`
- Discord-specific code
- AI provider implementations

---

## User Ownership

Memory belongs to the entity it describes.

For user memory, the user should be able to:

- View it
- Correct it
- Update it
- Delete it

Memory must not become something Athena secretly controls.

---

## Minimal Necessary Storage

Athena should not store everything.

The default behavior should be:

> **If information does not provide meaningful future value, do not store it.**

Memory is selective rather than a permanent transcript.

---

## Provider Independence

Memory must not depend on Gemini or any other AI provider.

Memory is application data.

Any future provider should be able to receive retrieved memory as part of the prepared prompt.

---

## Interface Independence

Memory must not depend on Discord.

The same memory should eventually be usable through:

- Discord
- Web
- Mobile
- Desktop
- Portfolio Widget
- API

---

## Retrievability

Stored information must be retrievable in a useful and controlled way.

The Memory System should never simply inject the entire memory store into every prompt.

---

## Deletability

Every stored memory must have a corresponding way to remove it.

> **There should be no memory without a way to forget it.**

---

## Future Scalability

The Phase 3 design should allow more advanced retrieval systems later without requiring a complete architectural rewrite.

Possible future technologies include:

- Embeddings
- Semantic retrieval
- Vector search
- RAG

These are not required for the initial implementation.

---

# 3. Types of Memory

Phase 3 begins with a small set of clearly defined memory types.

## 3.1 User Profile

A User Profile contains relatively stable information associated with a user.

Examples:

- Name / preferred name
- Communication preferences
- General interests
- Other stable information that improves future interactions

User Profile should remain conservative.

Sensitive personal information is not automatically stored by default.

---

## 3.2 Explicit User Memories

Explicit memories are pieces of information the user intentionally asks Athena to remember.

Examples:

> "Remember that I prefer concise answers."

> "Remember that I'm working on Athena AI."

These are the highest-confidence memories because the user explicitly requested storage.

Explicit memories should be stored with minimal interpretation.

---

## 3.3 Conversation Summaries

Conversation summaries are condensed representations of previous conversations.

They are different from raw conversation history.

Raw conversation history:

- Contains every message
- Preserves exact turn order
- Can become large
- Is temporary in the current architecture

Conversation summaries:

- Capture important conclusions
- Capture durable context
- Are significantly smaller
- Can persist beyond the original conversation
- Can be retrieved later

The summary should represent useful information rather than becoming another transcript.

---

## 3.4 Future Memory Types

The architecture may later support additional memory scopes.

These are **not implemented in Phase 3**.

### Project Memory

Durable information associated with a project.

Example:

```text
Project: Athena AI

Known information:
- TypeScript is the primary language.
- Gemini is currently the active provider.
- Discord is the first interface.
```
