---
description: Add a new AI prompt from Gemini to the project database
---

Use this workflow to quickly add a prompt you generated with Google Gemini into the project's seed data.

### Steps

1. **Copy the Prompt**: Copy the prompt text and any metadata (title, style, etc.) from your Gemini conversation.
2. **Provide Details**: Send the following information to the agent:
   - **Title**: (e.g., "Cyberpunk Forest")
   - **Prompt Text**: (The actual AI prompt)
   - **Tags**: Genres, Styles, or Moods (comma separated)
   - **Image URL**: (Optional) Link to the generated image or a local path.
3. **Agent Implementation**: The agent will run the `pnpm add-prompt` command or update the `data/prompts.seed.json` file directly.

// turbo
4. Run the following command to finalize (example):
```bash
pnpm add-prompt "My Title" "The prompt text..." "Fantasy,Epic" "Cinematic" "Heroic" "https://example.com/image.png"
```
