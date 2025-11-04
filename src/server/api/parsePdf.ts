import { Router } from 'express';
import multer from 'multer';
import pdfParse from 'pdf-parse';

const router = Router();
const upload = multer({ limits: { fileSize: 15 * 1024 * 1024 } });

// POST /api/parse-pdf
// Accepts either a multipart file (field name: "file") or JSON body with { pdfUrl }
router.post('/parse-pdf', upload.single('file'), async (req: any, res: any) => {
  try {
    // Prefer uploaded file
    if (req.file && req.file.buffer) {
      const data = await pdfParse(req.file.buffer);
      const cleanedText = (data.text || '')
        .replace(/\s+/g, ' ')
        .trim()
        .substring(0, 20000);
      if (!cleanedText || cleanedText.length < 20) {
        return res.status(400).json({ error: 'Could not extract meaningful text from PDF' });
      }
      return res.status(200).json({ success: true, text: cleanedText, pages: data.numpages, info: data.info });
    }

    // Fallback to URL in JSON body
    const pdfUrl = req.body?.pdfUrl;
    if (!pdfUrl) {
      return res.status(400).json({ error: 'No PDF file or pdfUrl provided' });
    }

    const response = await fetch(pdfUrl);
    if (!response.ok) {
      return res.status(400).json({ error: `Failed to fetch PDF: ${response.statusText}` });
    }
    const arrayBuf = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuf);
    const data = await pdfParse(buffer);
    const cleanedText = (data.text || '')
      .replace(/\s+/g, ' ')
      .trim()
      .substring(0, 20000);
    if (!cleanedText || cleanedText.length < 20) {
      return res.status(400).json({ error: 'Could not extract meaningful text from PDF' });
    }
    return res.status(200).json({ success: true, text: cleanedText, pages: data.numpages, info: data.info });
  } catch (error: any) {
    console.error('PDF parsing error:', error);
    return res.status(500).json({ error: 'Failed to parse PDF', details: error?.message || 'Unknown error' });
  }
});

export default router;


