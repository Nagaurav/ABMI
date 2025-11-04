// Simple API handler for generating questions using Gemini AI
export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { resumeUrl, userId } = req.body;

    if (!resumeUrl) {
      return res.status(400).json({ error: 'Resume URL is required' });
    }

    // Fetch the resume content
    console.log('Fetching resume from:', resumeUrl);
    const resumeResponse = await fetch(resumeUrl);
    
    if (!resumeResponse.ok) {
      throw new Error(`Failed to fetch resume: ${resumeResponse.statusText}`);
    }

    // For now, we'll use a placeholder for resume text extraction
    // In a real implementation, you'd parse PDF/DOC files here
    const resumeText = `Resume content for user ${userId}. This is a placeholder - in production, you would extract actual text from the PDF/DOC file.`;

    // Create the prompt for Gemini
    const prompt = `
Based on the following resume, generate 5 personalized interview questions that are relevant to the candidate's experience and skills. 

Resume content:
${resumeText}

Please generate questions in the following JSON format:
[
  {
    "question": "Question text here",
    "category": "Technical|Behavioral|General|Experience",
    "difficulty": "easy|medium|hard",
    "timeLimit": 120
  }
]

Make sure the questions are:
1. Specific to the candidate's background
2. Progressive in difficulty
3. Cover different aspects (technical skills, experience, behavioral)
4. Professional and relevant for an interview setting

Return only the JSON array, no additional text.
`;

    // Generate questions using Gemini API directly
    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
    
    if (!GEMINI_API_KEY) {
      throw new Error('Gemini API key not configured');
    }

    // Call Gemini API directly
    const geminiResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: prompt
          }]
        }]
      })
    });

    if (!geminiResponse.ok) {
      throw new Error(`Gemini API error: ${geminiResponse.statusText}`);
    }

    const geminiData = await geminiResponse.json();
    const text = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || '';

    console.log('Gemini response:', text);

    // Parse the JSON response
    let questions;
    try {
      // Clean the response text (remove any markdown formatting)
      const cleanText = text.replace(/```json\n?|\n?```/g, '').trim();
      questions = JSON.parse(cleanText);
    } catch (parseError) {
      console.error('Failed to parse Gemini response:', parseError);
      // Fallback to default questions if parsing fails
      questions = [
        {
          question: "Tell me about your professional background and experience.",
          category: "General",
          difficulty: "easy",
          timeLimit: 120
        },
        {
          question: "Describe a challenging project you've worked on and how you overcame obstacles.",
          category: "Experience",
          difficulty: "medium",
          timeLimit: 180
        },
        {
          question: "What technical skills do you consider your strongest, and can you provide an example of how you've applied them?",
          category: "Technical",
          difficulty: "medium",
          timeLimit: 150
        },
        {
          question: "How do you handle working under pressure and tight deadlines?",
          category: "Behavioral",
          difficulty: "medium",
          timeLimit: 120
        },
        {
          question: "Where do you see yourself in the next 3-5 years, and how does this role align with your career goals?",
          category: "General",
          difficulty: "easy",
          timeLimit: 120
        }
      ];
    }

    // Validate questions array
    if (!Array.isArray(questions) || questions.length === 0) {
      throw new Error('Invalid questions format received from AI');
    }

    console.log('Generated questions:', questions);

    return res.status(200).json({ 
      questions,
      message: 'Questions generated successfully'
    });

  } catch (error) {
    console.error('Error generating questions:', error);
    return res.status(500).json({ 
      error: 'Failed to generate questions',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}
