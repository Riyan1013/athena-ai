
# Athena AI 

> A modular AI platform built around wisdom, truth, and strategic assistance.

Athena AI is a modular AI platform built with **TypeScript** and **Node.js**, currently using **Discord.js** as its first interface.

The project is designed with scalability in mind, separating the **application core, AI providers, memory system, conversation management, and platform interfaces** into independent modules.

Discord is currently Athena's first interface, with additional platforms such as web and mobile planned for the future.

>  This project is currently under active development.

## Current Features

###  Athena Core

- Modular AI Core
- `AIProvider` abstraction
- Google Gemini integration
- Provider-independent AI architecture
- Response strategy system
- Token, usage, and latency tracking
- Athena Constitution and system prompting

### 💬 Conversation

- Conversation management
- Conversation history
- User and conversation isolation
- Conversation summaries
- Conversation summarization
- Conversation summary injection into AI prompts
- Summary source-message tracking

###  Memory

- Long-term memory system
- User profiles
- Explicit user memories
- Memory retrieval
- Memory management
- Conversation summary memories
- User and conversation memory isolation

###  Discord

- Discord Bot
- Slash Commands
- Modular Command Architecture
- Discord.js v14

### Commands

- `/ping`
- `/help`
- `/about`
- `/ask`
- `/remember`
- `/memories`
- `/forget`

## Architecture

Athena is designed around a modular architecture where the AI core is independent from the platform used to interact with it.

```text
                    Discord
                       │
                       ▼
                    Commands
                       │
                       ▼
                 ┌─────────────┐
                 │ Athena Core │
                 └──────┬──────┘
                        │
          ┌─────────────┼─────────────┐
          ▼             ▼             ▼
   Conversation      Memory       AIProvider
    Management      Management    Abstraction
                                      │
                                      ▼
                                    Gemini
````

The architecture is designed so that future interfaces can use the same Athena Core:

```text
                  Athena Core
                       │
            ┌──────────┼──────────┐
            ▼          ▼          ▼
         Discord      Web       Mobile
```

## Memory Architecture

Athena separates memory management from memory storage through a repository abstraction.

```text
Athena
   │
   ▼
MemoryManager
   │
   ▼
MemoryRepository
   │
   ▼
In-Memory Repository
```

The current implementation uses in-memory storage.

Persistent storage, including PostgreSQL, is planned for a future stage without requiring a redesign of the memory architecture.

Athena currently supports different types of memory:

* `USER_PROFILE` — user profile information
* `EXPLICIT` — information the user explicitly asks Athena to remember
* `CONVERSATION_SUMMARY` — compressed representations of conversations

Users have explicit control over long-term memories through:

```text
/remember
/memories
/forget
```

## Conversation Summaries

Athena can summarize conversations into dedicated conversation-summary memories.

Each summary tracks the number of conversation messages it represents using:

```text
sourceMessageCount
```

This allows Athena to determine how much new conversation has accumulated since the last summary.

```text
Conversation
      │
      ▼
Summarization
      │
      ▼
Conversation Summary
      │
      └── sourceMessageCount
```

Conversation summaries can then be injected into future prompts as contextual reference material.

## Tech Stack

* **TypeScript**
* **Node.js**
* **Discord.js v14**
* **pnpm**
* **Zod**
* **Google Gemini**
* **In-memory repository architecture**

## Project Status

Athena AI is actively under development.

Future development will focus on improving Athena's intelligence, long-term context, persistence, and support for additional interfaces.

## Testing

Athena is developed incrementally with deterministic tests covering core functionality, conversation management, memory, and summarization behavior.

The project emphasizes maintaining existing functionality as new capabilities are introduced.

## Developer

Created by **Riyan**

