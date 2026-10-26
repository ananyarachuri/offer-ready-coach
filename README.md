# Offer Ready Coach

An AI job-search prep chatbot for people targeting **Data Analyst** and **Data Analyst with AI** roles. Built for the AIML-500 AI Lab (Assignment 1.4) using design thinking.

## What it does

- **Mock interview:** asks one question at a time, scores each answer out of 5, and suggests a stronger opening line.
- **Resume bullet review:** rewrites bullets to show tools, scale and results. It never invents numbers and uses placeholders like `[X%]` instead.
- **Job post match:** rates your skills against a posting (Strong / Partial / Gap) and lists likely interview questions.
- **Session scorecard:** tracks your average score across the session.

The coach won't invent experience, guarantee outcomes, quote exact salaries, ask for sensitive personal data, or help anyone be dishonest with an employer.

## How it works

| File | Role |
| --- | --- |
| `index.html` | The whole interface (HTML, CSS, JS). No build step. |
| `api/chat.js` | Vercel serverless function. It holds the coaching rules and calls the Google Gemini API using a key stored on the server. |

Conversations are not stored anywhere. They exist only in the open browser tab.

## Deploy your own

1. Get a free Gemini API key at [Google AI Studio](https://aistudio.google.com/apikey).
2. Import this repo in [Vercel](https://vercel.com/new). No framework or build settings are needed.
3. In **Settings → Environment Variables**, add `GEMINI_API_KEY` with your key, then redeploy.
4. Optional: set `GEMINI_MODEL` to a comma-separated list of model IDs to try in order (default: `gemini-3.8-flash,gemini-3.5-flash-lite,gemini-2.5-flash`).

## Local testing

```bash
npm i -g vercel
vercel dev
```
