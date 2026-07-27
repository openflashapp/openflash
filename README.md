<div align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="./public/logo_white.png" />
    <img src="./public/logo_black.png" alt="OpenFlash" width="360" />
  </picture>

  <p><strong>⚡ Flashcards for focused learning.</strong></p>
  <p>Learn locally or sign in to keep your account in sync across devices.</p>
  <p>🔐 Accounts & sync &nbsp;·&nbsp; 🎨 Many themes &nbsp;·&nbsp; 🤖 Bring your own AI</p>

  <a href="#what-it-does"><img src="https://img.shields.io/badge/Accounts-Local--first%20sync-665CFF?style=for-the-badge" alt="Accounts and local-first sync" /></a>
  <a href="#local-development"><img src="https://img.shields.io/badge/Stack-React%20%2B%20Express-111229?style=for-the-badge" alt="React and Express" /></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-GPL--3.0-2E8B57?style=for-the-badge" alt="GPL v3.0" /></a>

  <p>
    <a href="#local-development">Local development</a> &middot;
    <a href="#ai-providers">AI providers</a>
  </p>

  <p>
    <a href="README.md">English</a> &middot;
    <a href="README.ru.md">Русский</a> &middot;
    <a href="README.de.md">Deutsch</a> &middot;
    <a href="README.fr.md">Français</a> &middot;
    <a href="README.pt.md">Português</a> &middot;
    <a href="README.zh.md">简体中文</a>
  </p>
</div>

## ✨ Why OpenFlash

OpenFlash is a flashcard application that combines a fast local-first interface, account sync, and AI-assisted card generation. Use it on the hosted web app with your own account, or deploy the complete stack on your own server when you need full infrastructure control.

## 🎨 Designed for Focus

Both the visual system and focus-first product direction draw inspiration from Monkeytype: minimal UI, speed, and no unnecessary distractions. OpenFlash includes a broad collection of built-in themes, so each learner can choose a calm workspace that fits their style.

> **Focus first.** Pick a theme, keep your hands on the keyboard, and let the interface stay out of the way. ⚡

## What It Does

- ✦ Create, organize, search, import, and export flashcard decks.
- ⏱ Study with spaced repetition, daily limits, review forecasts, and statistics.
- 📁 Group decks into folders, pin important decks, and customize deck appearance.
- 💾 Work as a guest with local browser storage or sign in and sync account data.
- 🤖 Generate cards with a provider and model of your choice.
- 🛡 Protect accounts with password authentication, TOTP two-factor authentication, passkeys, and optional Google, GitHub, or Apple OAuth.
- 🔒 Store sessions in secure HttpOnly cookies; encrypt stored TOTP and AI provider secrets.

## Stack

- Client: React 19, TypeScript, Vite
- API: Express 5, TypeScript
- Database: PostgreSQL
- Deployment: hosted web app

## AI Providers

OpenFlash supports configurable OpenAI-compatible providers and Anthropic-style APIs. Built-in presets include Mistral, OpenRouter, OpenAI, Anthropic, Gemini, DeepSeek, Meta, xAI, Ollama, and LM Studio.

Provider API keys are account-scoped. They are not included in learning-data snapshots or backups, and the server encrypts persisted provider secrets.

## Local Development

Requirements: Node.js 22+, npm, and PostgreSQL.

```sh
npm install
npm install --prefix server
cp server/.env.example server/.env
```

Set `DATABASE_URL` in `server/.env`, then run the client and API in separate terminals:

```sh
npm run dev
npm run dev:server
```

The client runs at `http://localhost:5173` and proxies `/api` requests to the API at `http://localhost:3001`.

Run the full verification suite with:

```sh
npm run check
```

## Security Notes

- Never commit `.env` files, database passwords, OAuth credentials, or encryption keys.
- Set independent `JWT_SECRET` and `ENCRYPTION_SECRET` values in production.
- Use HTTPS and set `SERVER_URL`, `CLIENT_URL`, `CLIENT_URLS`, and `WEBAUTHN_RP_ID` to the public domain.

## Built With AI

OpenFlash is developed with the assistance of AI models, including OpenAI models, DeepSeek V4 Flash, and others. They are used as implementation collaborators; deployment configuration, security settings, and production changes should always be reviewed by a human operator before release.

## License

OpenFlash is licensed under the [GNU GPL v3.0](LICENSE).
