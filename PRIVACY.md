# Privacy

Project Session Manager is designed as a local-first browser extension.

## Data handled

The extension may read visible ChatGPT conversation text in the active ChatGPT page in order to estimate conversation size, infer likely project assignment, and build continuation handover information.

It stores project/session metadata in the browser extension's local storage.

## Data not intentionally sent elsewhere

The extension does not include its own analytics service, advertising system, telemetry endpoint, or project-data server. It does not intentionally transmit conversation text or project metadata to the repository owner.

The normal ChatGPT website continues to operate under OpenAI's own terms and privacy practices; this extension does not alter those arrangements.

## Export

Users can explicitly export the local project registry as JSON. Exported files are controlled by the user.
