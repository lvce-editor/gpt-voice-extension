# builtin.gpt-voice

gpt-voice extension for Lvce Editor.

This is an unofficial community extension. It uses OpenAI models but is not
affiliated with, endorsed by, or sponsored by OpenAI.

## Voice providers

When you are signed in to LVCE Editor, voice uses the editor backend and your
shared monthly AI allowance by default. Audio still flows directly between the
editor and OpenAI over WebRTC; the authenticated backend control connection
creates and meters the session without exposing an OpenAI credential.

If the allowance is exhausted, the session stops and the view offers an explicit
**Use your own API key** action. The extension never switches to personal billing
automatically.

Logged-out users can use their own OpenAI API key. The key is stored using
extension secret storage when available (`Extensions.storeSecret`) and falls
back to a cache-based local storage implementation when secrets are not
supported. This personal-key path fetches an ephemeral token directly from
OpenAI.

To remove/re-enter a key, use **Change API key** in the extension view.

## Architecture

The extension entry point is a view adapter. It renders worker-owned state,
forwards user events, and exposes the editor-only capabilities that cannot run
inside a Web Worker, including secret storage and renderer WebRTC commands.

The `voice-session-worker` owns the voice session state machine: provider and
authentication handling, OpenAI token and SDP exchange, the funded control
socket, Realtime event and tool-response processing, fixture recording and
replay, and audio-debug persistence. It asks the extension adapter to start or
stop WebRTC through the extension `createRpc` command map. Network permissions
are therefore scoped to the voice-session worker rather than the view worker.

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
