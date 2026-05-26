---
name: vercel-deploy
description: "Use to deploy the application to Vercel using Vercel CLI. Triggers: deploy to Vercel, push to Vercel, vercel deploy, publish to vercel."
metadata:
  author: vercel-deploy
  version: "0.1.0"
---

# Vercel Deployment Skill

This skill contains instructions for deploying the project to Vercel.

## Core Deployment Commands

When deploying this project, use the Vercel CLI via `npx` with the pre-configured Vercel Token.

### 1. Production Deployment

To trigger a production deployment using the linked project configurations, run:

```bash
npx vercel --prod --token $VERCEL_TOKEN --yes
```

> [!NOTE]
> The `--yes` flag runs the command in non-interactive mode and skips prompts by accepting defaults.
> The `--prod` flag deploys directly to the production domain.

### 2. Preview Deployment

To deploy a preview version of the current code without routing it to the production URL, run:

```bash
npx vercel --token $VERCEL_TOKEN --yes
```

## Vercel Project Linkage

The deployment targets the project configured in:
- [.vercel/project.json](file:///.vercel/project.json)

Ensure the project ID and organization ID in this file are correct.

## Troubleshooting Builds

If the deployment fails or builds get stuck:
1. View the deployment dashboard URL returned by the CLI (under "Inspect:").
2. Check env variables on the Vercel Dashboard if there are database connection or API key issues.
