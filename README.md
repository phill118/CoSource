# CoSource

Agent-native commerce intelligence.

CoSource is intended to become a cross-merchant commerce intelligence and purchasing workspace where humans retain intent and final authority while an AI agent collaborates through structured WebMCP tools.

## Status

This repository contains the frontend engineering foundation and a tested, provider-independent commerce domain with a Shopify Global Catalog adapter. There is no product-search UI yet. Recommendation logic, purchasing workflows, and WebMCP integrations are not implemented.

The project is being prepared for The WebMCP Challenge. Its architectural principle is: humans provide intent and final authority; CoSource supplies trusted application and commerce intelligence; an AI agent plans and collaborates; WebMCP provides the structured browser interface; and authorised commerce providers remain the source of external commerce data.

## Local development

Requires a current stable Node.js release and npm.

```sh
npm install
npm run dev
npm run typecheck
npm run lint
npm run test
npm run build
```

## Technology

React, TypeScript, Vite, ESLint, and Vitest.

## Licence

Licensed under the [MIT License](LICENSE).
