// Simple API handler for PDF parsing
const pdf = require('pdf-parse');

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { pdfUrl } = req.body;

    if (!pdfUrl) {
      return res.status(400).json({ error: 'PDF URL is required' });
    }

    console.log('Parsing PDF from URL:', pdfUrl);

    // Fetch the PDF file
    const response = await fetch(pdfUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch PDF: ${response.statusText}`);
    }

    // Get the PDF buffer
    const pdfBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(pdfBuffer);

    // Parse the PDF using pdf-parse
    const data = await pdf(buffer);
    
    // Clean up the extracted text
    const cleanedText = data.text
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim()
      .substring(0, 5000); // Limit to 5000 characters

    console.log('Successfully extracted text from PDF:', cleanedText.substring(0, 200) + '...');

    if (cleanedText.length < 50) {
      throw new Error('Could not extract meaningful text from PDF');
    }

    return res.status(200).json({
      success: true,
      text: cleanedText,
      pages: data.numpages,
      info: data.info
    });

  } catch (error: any) {
    console.error('PDF parsing error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to parse PDF',
      details: error.message
    });
  }
}

// Increase the body size limit for PDF files
export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb',
    },
  },
}
