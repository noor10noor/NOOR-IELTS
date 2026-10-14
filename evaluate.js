export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
    if (!GEMINI_API_KEY) {
        return res.status(500).json({
            feedback: "❌ GEMINI_API_KEY Vercel Environment Variables bo'limiga kiritilmagan!"
        });
    }

    const { mode, task, prompt, essay, questions, audioBase64, fallbackText, topic } = req.body;

    // 1. INFINITE WORLDWIDE IELTS MOCK GENERATOR MODE
    if (mode === 'generate_mock') {
        const genPrompt = `
You are an official Cambridge IELTS Test Writer. Create a complete, authentic Academic IELTS Mock Test centered around: "${topic}".
Return STRICTLY valid JSON (no markdown backticks) matching this exact schema:
{
  "id": "ai_custom",
  "title": "NOOR AI • ${topic}",
  "category": "Worldwide AI Exam Archive",
  "listening": {
    "parts": [
      {
        "part": 1,
        "title": "Part 1: Service Enquiry",
        "audioUrl": "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3",
        "ttsScript": "Write a 70-word realistic IELTS Part 1 dialogue script here...",
        "contextNote": "Complete the notes below. Write ONE WORD AND/OR A NUMBER.",
        "questions": [
          { "id": "L1", "num": 1, "type": "fill", "q": "Question 1 text...", "a": "answer" },
          { "id": "L2", "num": 2, "type": "fill", "q": "Question 2 text...", "a": "answer" }
        ]
      }
    ]
  },
  "reading": {
    "passages": [
      {
        "part": 1,
        "title": "Passage 1: Academic Article on ${topic}",
        "text": "<p class='mb-3'><strong>A.</strong> Detailed academic paragraph A...</p><p class='mb-3'><strong>B.</strong> Detailed paragraph B...</p>",
        "questions": [
          { "id": "R1", "num": 1, "type": "tfng", "q": "Statement 1...", "a": "TRUE" },
          { "id": "R2", "num": 2, "type": "fill", "q": "Fill in the blank ______...", "a": "word" }
        ]
      }
    ]
  },
  "writing": {
    "task1": {
      "type": "Academic Task 1",
      "prompt": "Realistic chart/process prompt about ${topic}..."
    },
    "task2": {
      "type": "Academic Task 2 Essay",
      "prompt": "Realistic Task 2 essay question about ${topic}..."
    }
  },
  "speaking": {
    "part1": { "topic": "${topic}", "questions": ["Q1?", "Q2?", "Q3?"] },
    "part2": { "topic": "Describe something related to ${topic}", "bullets": ["What it is", "How you know it", "Why it matters"] },
    "part3": { "topic": "Future of ${topic}", "questions": ["Deep question 1?", "Deep question 2?"] }
  }
}`;
        try {
            const response = await fetch(
                `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        contents: [{ parts: [{ text: genPrompt }] }],
                        generationConfig: { responseMimeType: "application/json" }
                    })
                }
            );
            const data = await response.json();
            const rawJson = data.candidates?.[0]?.content?.parts?.[0]?.text;
            const mockTest = JSON.parse(rawJson);
            return res.status(200).json({ mockTest });
        } catch (e) {
            return res.status(500).json({ error: e.message });
        }
    }

    // 2. WRITING & SPEAKING EXAMINER EVALUATION MODE
    let parts = [];
    if (mode === 'writing') {
        parts.push({
            text: `You are a Senior Cambridge IELTS Examiner at NOOR IELTS. Evaluate this Writing Task ${task}.
Prompt: ${prompt}
Essay: "${essay}"

Format strictly as:
BAND_SCORE: [number e.g. 7.0]

👑 NOOR IELTS OFFICIAL WRITING REPORT
🎯 OVERALL BAND: [X.X]
• Task Achievement/Response: [X]
• Coherence & Cohesion: [X]
• Lexical Resource: [X]
• Grammatical Range & Accuracy: [X]

🇬🇧 Detailed Examiner Feedback:
[Detailed critique]

🇺🇿 O'zbek tilida xatolar tahlili va Band 8.0+ uchun tavsiyalar:
[Actionable corrections]`
        });
    } else if (mode === 'speaking') {
        parts.push({
            text: `You are a Senior IELTS Speaking Examiner at NOOR IELTS. Evaluate the candidate's response for:
"${questions}"
${fallbackText ? `Transcript: "${fallbackText}"` : 'Listen to the candidate audio recording.'}

Format strictly as:
BAND_SCORE: [number e.g. 7.0]

👑 NOOR IELTS OFFICIAL SPEAKING REPORT
🎙 OVERALL BAND: [X.X]
📝 Transcription: "[What the candidate said]"
• Fluency & Coherence: [X]
• Lexical Resource: [X]
• Grammatical Range: [X]
• Pronunciation: [X]

🇺🇿 O'zbek tilida talaffuz va ravonlik bo'yicha maslahatlar:
[Detailed feedback]`
        });
        if (audioBase64) {
            parts.push({ inline_data: { mime_type: "audio/webm", data: audioBase64 } });
        }
    }

    try {
        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ contents: [{ parts }] })
            }
        );
        const data = await response.json();
        const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text || "No response from AI.";
        const match = rawText.match(/BAND_SCORE:\s*([0-9.]+)/i);
        const band = match ? parseFloat(match[1]) : 6.5;
        const cleanFeedback = rawText.replace(/BAND_SCORE:\s*[0-9.]+\n?/i, '').trim();
        return res.status(200).json({ band, feedback: cleanFeedback });
    } catch (err) {
        return res.status(500).json({ feedback: "Server error: " + err.message });
    }
}
