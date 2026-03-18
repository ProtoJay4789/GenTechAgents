---
name: telegram-setup
description: Walk through creating a Telegram bot and connecting it to {{portalName}}
---

# Telegram Setup Skill

## Trigger

When the user wants to connect {{portalName}} to Telegram, or asks about Telegram integration.

## Overview

{{portalName}} connects to Telegram via the Bot API using long polling. This requires a bot token from `@BotFather`.

## Steps

### 1. Guide the User Through Bot Creation

Tell the user:

> To connect {{portalName}} to Telegram, you need a bot token. Here's how:
>
> 1. Open Telegram and message **@BotFather**
> 2. Send `/newbot`
> 3. Choose a **display name** (e.g. "Jinn AI")
> 4. Choose a **username** ending in `bot` (e.g. `jinn_ai_bot`)
> 5. BotFather replies with your **bot token** — copy it
>
> The token looks like: `123456789:ABCdefGHIjklMNOpqrsTUVwxyz`
>
> **Optional bot customization** (send these to @BotFather):
> - `/setdescription` — set the bot's description shown in profiles
> - `/setabouttext` — set the short bio
> - `/setuserpic` — upload a profile photo
> - `/setcommands` — add command menu (e.g. `/new - Start fresh session`)

### 2. Collect the Bot Token

Ask the user to paste their bot token.

### 3. Update Configuration

Write the token to `~/.jinn/config.yaml` under the `connectors.telegram` section:

```yaml
connectors:
  telegram:
    botToken: "123456789:ABCdefGHIjklMNOpqrsTUVwxyz"
    ignoreOldMessagesOnBoot: true
```

The gateway will hot-reload the config automatically.

### 4. Optional: Restrict Access

If the user wants to limit who can interact with the bot, ask for their Telegram user IDs:

```yaml
connectors:
  telegram:
    botToken: "..."
    allowFrom:
      - "123456789"    # User's Telegram ID
```

To find a Telegram user ID: message `@userinfobot` or `@RawDataBot` on Telegram.

### 5. Verify Connection

Tell the user to restart the gateway (or it will auto-reload), then:
1. Open Telegram and message the bot directly
2. Send a test message like "Hello"
3. The bot should respond

### 6. Explain Agent Routing

Explain how agents work with Telegram:
- **Default**: All messages route to {{portalName}} (the executive/COO)
- **@mentions**: Type `@dev do X` to route to the dev agent
- **Groups**: Add the bot to a group and it will respond to all messages

### 7. Optional: Group Setup

If the user wants the bot in a Telegram group:
1. Go to **@BotFather** → `/setprivacy` → select the bot → choose **Disable**
   (This allows the bot to see all messages in groups, not just commands)
2. Add the bot to the group
3. The bot will respond to all messages in the group

## Error Handling

- If the token is invalid, the gateway will log authentication errors — tell the user to check the token with @BotFather
- If the bot doesn't respond in groups, privacy mode may be enabled — disable it via @BotFather's `/setprivacy`
- If polling errors occur, check network connectivity and token validity
