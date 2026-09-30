# Contributing

Issues, testing notes and pull requests are welcome.

Please keep changes focused on improving project/session organisation, long-conversation usability, continuation handovers, accessibility, browser compatibility, privacy or resilience to ChatGPT interface changes.

## Design principles

- Prefer local-first operation.
- Do not collect analytics or conversation content without clear user consent.
- Do not fight deliberate user scrolling.
- Fail safely when ChatGPT DOM/state detection is uncertain.
- Keep project assignment suggestions advisory rather than automatic.
- Keep the extension lightweight.

When changing selectors or streaming-state detection, document the reason because the ChatGPT web interface can evolve over time.
