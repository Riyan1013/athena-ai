# Athena Architecture

## Overview

Athena is a modular AI platform designed around a simple principle:

> **Athena is the platform. Discord is only the first interface.**

The architecture separates the core intelligence from platform-specific integrations, allowing Athena to expand beyond Discord without major redesigns.

---

# High-Level Architecture

```text
                 +----------------------+
                 |      Discord         |
                 +----------------------+
                            │
                            ▼
                 +----------------------+
                 |   Discord Adapter    |
                 +----------------------+
                            │
                            ▼
                 +----------------------+
                 |     Athena Core      |
                 +----------------------+
                  │      │        │
          ┌───────┘      │        └────────┐
          ▼              ▼                 ▼
   AI Provider       Memory System     Services
          │              │                 │
          ▼              ▼                 ▼
     Gemini API      SQLite/Postgres   Weather, PDF,
                                      Search, etc.
```

Future clients such as a web application, mobile application, or API will connect to the same Athena Core rather than implementing separate business logic.

---

# Project Structure

```text
src/
│
├── ai/
├── config/
├── core/
├── database/
├── discord/
│   ├── client/
│   ├── commands/
│   ├── events/
│   └── interactions/
│
├── memory/
├── services/
├── types/
├── utils/
└── index.ts
```

---

# Folder Responsibilities

## core/

Athena's brain.

Responsible for:

- Conversation orchestration
- Personality
- Decision-making
- Prompt management
- Future agent system

The core must never depend directly on Discord.

---

## ai/

Responsible for communication with AI providers.

Current provider:

- Google Gemini

Future providers:

- Ollama
- OpenAI
- Anthropic Claude

The rest of Athena communicates only with the AI abstraction layer.

---

## discord/

Contains everything related to Discord.

Examples:

- Client
- Events
- Slash Commands
- Message Handling
- Embeds

Discord-specific code must remain inside this module.

---

## memory/

Responsible for storing and retrieving user memory.

Future features include:

- Long-term memory
- User preferences
- Conversation summaries
- Embeddings

---

## services/

Contains reusable capabilities such as:

- Weather
- Calculator
- PDF Analysis
- Web Search

These services should be reusable by any future platform.

---

## database/

Responsible for:

- Prisma
- Database connection
- Models
- Migrations
- Repositories

Development uses SQLite.

Production uses PostgreSQL.

---

## config/

Application configuration.

Examples:

- Environment variables
- Constants
- Feature flags

---

## utils/

Contains only generic utility functions.

Utility functions that belong to a single feature should remain inside that feature's folder.

---

## types/

Shared TypeScript interfaces and types.

---

# Architecture Principles

## Platform First

Athena is the product.

Discord is a client.

Future platforms should integrate with Athena Core instead of duplicating business logic.

---

## Single Responsibility

Every folder should have one clear purpose.

---

## Provider Abstraction

Athena communicates with an AI provider interface rather than directly with Gemini.

This allows future AI providers to be added without changing the rest of the application.

---

## Scalability

The architecture is designed to support future expansion to:

- Web
- Mobile
- API
- Voice
- Multiple AI providers
- Agent workflows
- Knowledge retrieval (RAG)

without major structural changes.
