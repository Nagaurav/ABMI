const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

// Your Gemini API Key should be set in Supabase project's Environment Variables
const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent?key=${GEMINI_API_KEY}`;

/**
 * Calls Gemini with the full resume text to get questions.
 */
async function callGeminiWithContext(resumeText: string) {
  const prompt = `
    You are an expert technical recruiter and interview coach.
    You will be given the full text of a candidate's resume.
    Your task is to analyze the resume and generate 10-15 insightful, personalized interview questions that probe their skills, experience, and project work.

    Guidelines:
    - Generate a mix of behavioral ("Tell me about a time..."), technical ("How would you..."), and project-specific questions.
    - The questions should be directly based on the technologies, roles, and accomplishments listed in the resume.
    - Do not ask basic "keyword" questions. Ask questions that force the candidate to elaborate on *how* they used their skills.
    - Return ONLY a valid JSON array of strings, like ["question 1", "question 2"]. Do not include any other text or markdown.

    Here is the resume text:
    ---
    ${resumeText}
    ---
  `;

  const response = await fetch(GEMINI_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      contents: [{
        parts: [{ text: prompt }],
      }],
    }),
  });

  if (!response.ok) {
    throw new Error(`Gemini API error: ${await response.text()}`);
  }

  const data = await response.json();

  // Extract the JSON string from Gemini's response
  const jsonString = data.candidates[0].content.parts[0].text
    .replace(/```json/g, '')
    .replace(/```/g, '')
    .trim();

  return JSON.parse(jsonString);
}

/**
 * Main Deno server handler
 * Now simplified - only accepts JSON with resumeText (files are parsed client-side)
 */
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const contentType = req.headers.get('Content-Type');

    if (!contentType || !contentType.includes('application/json')) {
      throw new Error('Content-Type must be application/json');
    }

    const body = await req.json();
    
    if (!body.resumeText) {
      throw new Error('No "resumeText" provided in JSON body');
    }

    const resumeText = body.resumeText.trim();

    if (!resumeText) {
      throw new Error('Resume text cannot be empty');
    }

    // --- Call Gemini with the extracted text ---
    const questions = await callGeminiWithContext(resumeText);

    return new Response(
      JSON.stringify({ questions }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});

