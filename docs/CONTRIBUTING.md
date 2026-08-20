# Contributing to Athena AI

Thank you for your interest in Athena AI.

Athena AI is currently an actively developed personal project, and the architecture is evolving as new capabilities are introduced.

## Development Guidelines

When working on Athena AI:

- Keep changes focused and avoid unrelated refactoring.
- Preserve the modular architecture.
- Keep the Athena Core independent from platform-specific interfaces.
- Use the existing `AIProvider` abstraction for AI integrations.
- Keep memory storage behind the `MemoryRepository` abstraction.
- Add or update tests when introducing new functionality.
- Run the TypeScript type-check before submitting changes.
- Avoid introducing new dependencies unless they are necessary.

## Architecture

Athena is organized around several independent areas:

```text
Athena Core
├── AI Providers
├── Conversation Management
├── Memory Management
└── Platform Interfaces
