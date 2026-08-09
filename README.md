# builtin.gpt-voice

gpt-voice extension for Lvce Editor.

## OpenAI API key setup

The extension now fetches ephemeral tokens directly from OpenAI, so no local node token server is used.

On first start, the view shows a welcome form where you save your OpenAI API key.
The key is stored using extension secret storage when available (`Extensions.storeSecret`)
and falls back to a cache-based local storage implementation when secrets are not supported.

To remove/re-enter a key, use **Change API key** in the extension view.

## Development

```sh
npm ci
npm run build
npm test
```

### Voice e2e fixtures

The voice e2e tests replay committed Realtime API event traces, so the regular
test suite does not need a microphone, network access, or an OpenAI API key.
Client events are checkpoints: fixture replay fails if a tool result or its
follow-up `response.create` event is missing or different.

Generate a fixture from text with the real application and OpenAI APIs:

```sh
OPENAI_API_KEY=... npm run fixture:generate -- \
  --name weather-paris \
  --text "What is the weather in Paris?"
```

The generator uses OpenAI text-to-speech to create a WAV file, launches the
Electron app with that file as its fake microphone, records both sides of the
Realtime data channel, and normalizes volatile IDs. It writes `input.wav` and
`fixture.json` under `packages/e2e/fixtures/<name>/`, plus a self-contained
replay test under `packages/e2e/src/`. Existing `fixture.json` files are reused
by default, which rebuilds the replay test without an API key or paid OpenAI
requests. Pass `--regenerate-existing` to record an existing fixture again;
`--force` remains available as an alias. Raw capture data stays under
`.tmp/voice-fixtures/` when generation fails, which makes API changes easier to
diagnose.

Output audio is intentionally not part of replay. The stable test contract is
the transcript, tool-call UI, and exact client JSON generated in response to
recorded server events.
