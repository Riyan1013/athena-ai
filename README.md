# Athena AI 

Athena AI is a modular AI assistant built with **TypeScript**, **Node.js**, and **Discord.js**.

The project is designed with scalability in mind, separating the application core, AI providers, memory system, conversation management, and platform interfaces into independent modules.

Discord is the first interface for Athena, with support for additional platforms planned for the future.

>  This project is currently under active development.

## Current Features

### Core
- Modular AI Core
- AIProvider abstraction
- Google Gemini integration
- Provider-independent AI architecture
- Response strategy and token/usage tracking

### Discord
- Discord Bot
- Slash Commands
- Modular Command Architecture
- Discord.js v14

### Conversation
- Conversation management
- Conversation history
- Conversation summaries
- Conversation summary injection into AI prompts
- Conversation summarization

### Memory
- Long-term memory system
- User profiles
- Explicit user memories
- Memory retrieval
- Memory management
- Conversation summary memories
- User/conversation memory isolation

### Commands
- `/ping`
- `/help`
- `/about`
- `/remember`
- `/memories`
- `/forget`

## Tech Stack

- TypeScript
- Node.js
- Discord.js
- pnpm
- Zod
- Google Gemini
- In-memory repository architecture

## Architecture

Athena is designed around a modular architecture:

```text
Discord
   ↓
Commands
   ↓
Athena Core
   ├── Conversation Management
   ├── Memory Management
   └── AI Provider
          ↓
       Gemini
