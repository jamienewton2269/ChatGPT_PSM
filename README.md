# ChatGPT Project Session Manager

A lightweight browser extension for Chrome and Microsoft Edge that improves long-running ChatGPT project workflows.

It adds canonical project organisation, conversation-length monitoring, structured continuation handovers, intelligent project inference, and streaming-aware auto-follow to the ChatGPT web interface.

## Features

### Project organisation
Group multiple ChatGPT conversations into canonical projects and classify them as:

- Current active
- Current on hold
- Long-term hold
- Research

Each project can retain its latest known-good state, next action, dependencies, notes, last activity and associated ChatGPT sessions.

### Conversation-length monitoring
The extension estimates the size of the visible conversation and warns when a fresh continuation session may be useful. Token counts are approximate because the extension does not have access to ChatGPT's internal tokenizer or context accounting.

It can generate a structured continuation prompt containing the current project state so work can move to a fresh chat without manually rebuilding the project context.

### Streaming-aware auto-follow
During an active ChatGPT response, the extension can keep the newest part of the reply visible.

- While ChatGPT is actively generating and you are following the bottom, the live response stays in view.
- If you deliberately scroll upward, auto-follow pauses instead of fighting you.
- A **Resume live follow** control returns to the current response.
- When generation finishes, the extension releases the viewport completely.
- Unrelated interface changes after generation do not trigger unwanted scrolling.

### Intelligent project inference
For an unassigned chat, the extension compares its title and visible context with existing project names, aliases, known-good state, dependencies, notes and next actions, then suggests a likely project. Assignment remains under user control.

### Local-first privacy
Project metadata is stored in browser extension storage. The extension has no analytics service and no project-data server.

See [PRIVACY.md](PRIVACY.md) for details.

## Current release

**v0.3.1**

## Install from source

### Microsoft Edge
1. Download or clone this repository.
2. Open `edge://extensions`.
3. Enable **Developer mode**.
4. Choose **Load unpacked**.
5. Select the repository folder.
6. Refresh any open ChatGPT tabs.

### Google Chrome
1. Download or clone this repository.
2. Open `chrome://extensions`.
3. Enable **Developer mode**.
4. Choose **Load unpacked**.
5. Select the repository folder.
6. Refresh any open ChatGPT tabs.

## Why this exists

This project is a practical proof of concept for small interface improvements that can make long-running AI-assisted technical, research and project-management work easier to navigate.

Where a feature would be better implemented natively in ChatGPT, this extension should be viewed as a demonstrator rather than an attempt to permanently duplicate platform functionality.

## Acknowledgements

Special acknowledgement is given to **Ken Newton, Becki, and Bailey** for their contribution, support and association with the project.

### Becki line artwork

![Becki line artwork](assets/becki-line-art.png)

Becki's line artwork is included as part of the project's acknowledgements and historical identity. The artwork is not licensed under the MIT software licence; see [LICENSE](LICENSE) and [ARTWORK_NOTICE.md](ARTWORK_NOTICE.md).

## Licence

The software source code is available under the [MIT License](LICENSE). Artwork and other separately identified creative assets are excluded from the MIT software grant unless explicitly stated otherwise.

Contributions and constructive testing are welcome.
