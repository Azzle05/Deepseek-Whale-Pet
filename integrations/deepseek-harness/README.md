# DeepSeek Harness bridge

This Cordis plugin observes DeepSeek Harness session events and writes a small, privacy-preserving JSONL status stream for DeepSeek Whale Pet.

It records only timestamps, sequence numbers, session identifiers, event names, normalized pet states, tool/command names, and turn-end reasons. It never records prompts, assistant text, reasoning text, tool arguments, tool output, tokens, or credentials.

The Electron application copies this directory into its user-data integrations folder, creates a junction in the selected DSH profile, and writes the resolved log path into `bridge-config.json`.
