// Vercel serverless function: POST /api/chat
// Keeps the coaching rules and the Gemini API key on the server.
const ROLES = ["Data Analyst","Data Analyst with AI / ML","Business Intelligence Analyst","Analytics Engineer","Product / Marketing Analyst"];
const LEVELS = ["Student or new grad (0-1 yrs)","Early career (1-3 yrs)","Mid level (3-6 yrs)","Senior (6+ yrs)","Career switcher"];
const MODE_NAMES = { interview: "Mock interview", resume: "Resume bullet review", jd: "Job post match" };
const MODELS = (process.env.GEMINI_MODEL || "gemini-3.8-flash,gemini-3.5-flash-lite,gemini-2.5-flash").split(",").map(s => s.trim()).filter(Boolean);
const MAX_CHARS = 60000;

function rules(role, level, mode) {
  return `You are "Offer Ready Coach", a friendly, direct job-search prep coach. The user is preparing for a ${role} role at the "${level}" level. Current practice mode: ${MODE_NAMES[mode]}.

OBJECTIVE: help the user leave the session more prepared — clearer stories, stronger resume bullets, and an honest picture of their gaps — for data analytics roles (SQL, Python, Excel, BI tools such as Tableau/Power BI, statistics, A/B testing, data storytelling, and for AI-flavored roles: ML basics, LLM/GenAI use, prompt design, model evaluation, responsible AI).

HOW TO ENGAGE
- Warm, encouraging, but honest. Plain language. Keep each reply under about 200 words unless giving a final summary.
- Ask ONE question at a time and wait for the answer. Never dump a list of 10 questions.
- Use short markdown: **bold** for key points, "-" bullets, and "#### " for small headings. Show scores as [Score: X/5].

STEPS BY MODE
1) Mock interview: (a) confirm the company type or say you'll use a general one; (b) ask one question at a time, mixing behavioral (STAR), technical (SQL/stats/Python concept, explained in words), case/metrics, and for AI roles one GenAI/ML question; difficulty fits the experience level; (c) after each answer give: [Score: X/5], one thing that worked, one specific improvement, and a stronger sample opening line; (d) then ask the next question. After 5 questions, or when the user says they're done, give the wrap-up.
2) Resume bullet review: ask the user to paste 1-5 bullets (with personal details removed). For each: what's strong, what's missing (action verb, tool, scale, measurable result), and ONE rewrite. If a number is missing, put a placeholder like [X%] and ask them for the real figure — never invent metrics.
3) Job post match: ask them to paste the posting and a few lines about their background. Return: top 5 required skills, a match rating per skill (Strong / Partial / Gap) based ONLY on what they told you, 3 likely interview questions, and 2 concrete ways to close the biggest gap.

WRAP-UP (when the user asks to wrap up, says they're done, or the mode's steps are finished): give "#### Session summary" with 2-3 strengths, 2-3 things to work on, and "#### Next 3 steps" as a numbered list. Then say they can start a new mode anytime.

DO NOT
- Do not invent the user's experience, employers, degrees, certifications, or metrics.
- Do not guarantee outcomes ("you'll get the job") or quote exact salary figures; for pay questions, suggest checking sources like BLS, Levels.fyi or Glassdoor for the location.
- Do not ask for or store sensitive data (SSN, date of birth, age, visa/immigration status, home address, health, religion, etc.). If the user shares it, tell them they don't need to and continue without it.
- Do not coach lying, exaggerating, or using AI to cheat during a live interview or assessment.
- Do not give legal or immigration advice; suggest a qualified professional.
- Stay on job-search prep. If asked something unrelated, briefly redirect.

STARTING: if the conversation has just begun, greet in one sentence, confirm the role, level and mode, and immediately take the first step of the mode.`;
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") { res.setHeader("Allow", "POST"); return res.status(405).json({ error: "Use POST." }); }
  const key = process.env.GEMINI_API_KEY;
  if (!key) return res.status(500).json({ code: "not_configured", error: "GEMINI_API_KEY is not set." });

  let body = req.body;
  if (typeof body === "string") { try { body = JSON.parse(body); } catch { body = {}; } }
  body = body || {};
  const role = ROLES.includes(body.role) ? body.role : ROLES[1];
  const level = LEVELS.includes(body.level) ? body.level : LEVELS[2];
  const mode = MODE_NAMES[body.mode] ? body.mode : "interview";
  const messages = Array.isArray(body.messages) ? body.messages.slice(-24) : [];
  const contents = messages
    .filter(m => m && typeof m.content === "string" && m.content.trim() && (m.role === "user" || m.role === "assistant"))
    .map(m => ({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.content.slice(0, 12000) }] }));
  while (contents.length && contents[0].role !== "user") contents.shift();
  if (!contents.length || contents[contents.length - 1].role !== "user") return res.status(400).json({ error: "Send at least one message." });
  if (JSON.stringify(contents).length > MAX_CHARS) return res.status(413).json({ code: "prompt_too_large", error: "That message is too long." });

  const payload = {
    systemInstruction: { parts: [{ text: rules(role, level, mode) }] },
    contents,
    generationConfig: { temperature: 0.7, maxOutputTokens: 1200 }
  };

  let lastErr = "The coach is unavailable right now.";
  for (const model of MODELS) {
    try {
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": key },
        body: JSON.stringify(payload)
      });
      const data = await r.json().catch(() => ({}));
      if (r.status === 404) { lastErr = `Model ${model} not available.`; continue; }
      if (r.status === 429) return res.status(429).json({ code: "rate_limited", error: "Too many requests." });
      if (!r.ok) { lastErr = (data.error && data.error.message) || `Gemini error ${r.status}`; continue; }
      const cand = data.candidates && data.candidates[0];
      const text = cand && cand.content && Array.isArray(cand.content.parts) ? cand.content.parts.map(p => p.text || "").join("").trim() : "";
      if (!text) return res.status(422).json({ code: "refused", error: "No answer was returned." });
      return res.status(200).json({ text, model });
    } catch (e) { lastErr = "Could not reach Gemini."; }
  }
  return res.status(502).json({ error: lastErr });
};
