# Athena AI Architecture

## Overview

Athena AI is a modular AI assistant platform built around a simple principle:

> **One assistant. Multiple interfaces.**

Rather than embedding AI logic into individual applications, Athena centralizes intelligence so every interface shares the same AI capabilities, memory, and services.

The Discord bot is the first interface to Athena, but the architecture is designed to support future applications such as a web app, mobile app, desktop app, portfolio widget, and API without duplicating business logic.

---

# High-Level Architecture

```text
                      ATHENA AI
              (Your Personal AI Assistant)

        ┌──────────────┬──────────────┬──────────────┐
        │              │              │              │
        ▼              ▼              ▼              ▼
   Discord Bot     Web App     Mobile App     Portfolio Widget
        │              │              │              │
        └──────────────┴──────────────┴──────────────┘
                       │
                       ▼
                    Athena
                       │
        ┌──────────────┼──────────────┐
        │              │              │
        ▼              ▼              ▼
   AI Providers     Memory        Services
        │              │              │
        ▼              ▼              ▼
     Gemini      User Memory   Search, PDF,
                               Images, Weather
```

Every interface communicates with Athena rather than implementing AI logic independently. This ensures AI capabilities, memory, and shared services are implemented once and reused across every platform.

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

> **Note:** This represents the intended long-term architecture. Some modules will be introduced as Athena AI evolves.

---

# Folder Responsibilities

## core/

Contains **Athena**, the central orchestrator of the platform.

Responsible for:

- Conversation orchestration
- Personality
- Decision-making
- Prompt management
- Future agent workflows
- Coordinating memory and services

The core must remain independent of any interface such as Discord, Web, or Mobile.

---

## ai/

Responsible for communication with AI providers.

Current provider:

- Google Gemini

Future providers:

- OpenAI
- Anthropic Claude
- Ollama

Athena communicates with AI providers through this module rather than interacting directly with any specific model.

---

## discord/

Provides the Discord interface for Athena.

Responsible for:

- Discord client
- Slash commands
- Events
- Interactions

Discord-specific code should remain inside this module. Shared business logic belongs inside Athena.

---

## memory/

Responsible for storing and retrieving user memory.

Future features include:

- Long-term memory
- User preferences
- Conversation summaries
- Semantic search
- Embeddings

---

## services/

Contains reusable capabilities that can be used by any interface.

Examples:

- Weather
- Calculator
- PDF Analysis
- Web Search
- Image Generation

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

Contains generic utility functions shared across the application.

Utility functions that belong to a single feature should remain inside that feature's module.

---

## types/

Shared TypeScript interfaces and type definitions.

---

# Architecture Principles

## Platform First

Athena AI is the product.

Discord, Web, Mobile, Portfolio, Desktop, and future integrations are simply different interfaces through which users interact with Athena.

---

## Interface Independence

Every interface communicates with Athena rather than implementing AI logic directly.

Platform-specific code belongs inside its own module, while Athena owns shared intelligence, memory, AI providers, and services.

---

## Single Responsibility

Every folder and module should have one clear responsibility.

---

## Provider Abstraction

Athena communicates with an AI provider abstraction rather than directly with Gemini.

This allows new AI providers to be added without affecting the rest of the platform.

---

## Scalability

The architecture is designed to support future expansion including:

- Web Application
- Mobile Application
- Desktop Application
- REST API
- Voice Interfaces
- Multiple AI Providers
- Agent Workflows
- Knowledge Retrieval (RAG)

without requiring major architectural changes.
