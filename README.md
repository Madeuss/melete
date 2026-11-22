# melete

Practice job interviews out loud. Melete asks you questions by voice, listens to your answers,
and gives you structured feedback: STAR scores, clarity, what worked, what to improve, a stronger
version of your answer, filler words and speaking pace.

It's built for practicing interviews in English (Portuguese works too), with the interface in
Portuguese, English or Spanish.

> Melete was the Greek muse of practice. Her sisters were Mneme (memory) and Aoide (voice).

## How it works

1. **Bring your own key.** Pick a provider (OpenAI, OpenRouter, Groq, Gemini, Anthropic, Ollama,
   LM Studio or any OpenAI-compatible API) and paste your key. Ollama and LM Studio are free and
   run on your machine.
2. **Write your stories.** Save real situations from your work in STAR form (situation, task,
   action, result) with tags. Questions are planned around them.
3. **Run an interview.** Behavioral, technical or mixed; role, seniority and an optional job
   description; 1–15 questions; optional follow-ups when part of an answer is missing.
4. **Answer by voice or by typing.** Fix the transcript before sending if recognition got
   something wrong.
5. **Read the report.** Feedback after each answer or only at the end, plus a session summary.
   Everything stays in your history.

## Privacy

There is no Melete server. The app is a static page; everything happens in your browser.

- **Your API key** is stored only in this browser (IndexedDB) and sent only to the provider you
  chose, straight from the browser. It never appears in exports, logs or error messages.
- **Your stories, transcripts and reports** live in IndexedDB in this browser. You can export
  everything to a JSON file (without the key), import it elsewhere, or delete it all in Settings.
- **Audio is never stored.** Only the transcript is saved.
- **Speech recognition in Chrome sends your voice to Google.** That's how the browser's Web Speech
  API works there. If you'd rather not, choose "Type only" in Settings and type your answers.
- Questions and answers are sent to the LLM provider you configured, under that provider's terms.

## Run it for free with Ollama

1. Install [Ollama](https://ollama.com/download) and pull a model:

   ```bash
   ollama pull qwen3:8b
   ```

2. Start Ollama allowing the app's origin (otherwise the browser blocks the calls):

   ```bash
   # macOS / Linux
   OLLAMA_ORIGINS="https://madeuss.github.io,http://localhost:5173" ollama serve
   ```

   ```powershell
   # Windows (PowerShell) — quit Ollama from the tray first
   $env:OLLAMA_ORIGINS="https://madeuss.github.io,http://localhost:5173"; ollama serve
   ```

3. In Melete, open **Settings**, pick **Ollama**, type the model name (`qwen3:8b`) and press
   **Test connection**. Your browser may ask permission to access devices on your local network:
   allow it.

LM Studio works the same way: load a model, turn on **Enable CORS** in the server settings and
pick **LM Studio** in Melete.

Smaller local models sometimes return malformed feedback. Melete validates every response and
retries up to twice; if it keeps failing, try a larger model.

## Browser support

| | Voice answers | Read questions aloud |
| --- | --- | --- |
| Chrome, Edge (desktop and Android) | Yes (via Google) | Yes |
| Safari (macOS, iOS) | Yes | Yes |
| Firefox | No — type instead | Yes |
| Chromium on Linux | Often missing — type instead | Voices vary in quality |

Typed answers always work.

## Development

Requires Node 22 and Yarn 1.

```bash
yarn            # install
yarn dev        # http://localhost:5173 (the design review page is at #/styleguide)
yarn test       # unit and component tests, no network
yarn typecheck
yarn lint
yarn build      # static site in dist/
yarn evals      # compare providers on example answers (see evals/README.md)
```

The spec and the decisions behind the code are in [docs/SPEC.md](docs/SPEC.md).

### Layout

```text
src/
  providers/   LLM (OpenAI-compatible client, presets, structured output), STT, TTS, test fakes
  interview/   engine (session state machine), versioned prompts, metrics
  schemas/     Zod schemas, the source of truth for all data types
  storage/     Dexie (IndexedDB) and repositories
  features/    one folder per screen
  ui/          base components on top of the design tokens
  i18n/        pt-BR, en, es
evals/         fixtures and the provider comparison script
```

## License

[AGPL-3.0](LICENSE). If you run a modified version as a service, you must share its source.
