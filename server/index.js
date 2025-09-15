import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import multer from 'multer';
import fs from 'fs';
import dotenv from 'dotenv';
import pdf from 'pdf-parse';
dotenv.config();

// ================== App setup ==================
const app = express();
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// ================== Auth (email+password handled by frontend provider) ==================
// No OTP endpoints

// ================== Resume upload setup ==================
const upload = multer({ dest: 'uploads/' });

// New unified endpoint used by frontend
app.post('/uploads/resume', upload.single('resume'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'File required' });
  const resumePath = req.file.path;
  console.log('[resume] uploaded:', resumePath);
  res.json({ ok: true, path: resumePath, filename: req.file.filename });
});

// Backward-compatible old path
app.post('/upload-resume', upload.single('resume'), (req, res) => {
  if (!req.file) return res.status(400).json({ success: false, message: 'File required' });
  const resumePath = req.file.path;
  console.log('[resume] uploaded (legacy):', resumePath);
  res.json({ success: true, message: 'Resume uploaded', file: req.file.filename });
});

// ================== GitHub integration ==================
app.post('/github-link', (req, res) => {
  const { githubUrl } = req.body;
  if (!githubUrl) return res.status(400).json({ success: false, message: 'GitHub URL required' });
  console.log('[github] URL submitted:', githubUrl);
  res.json({ success: true, message: 'GitHub link received' });
});

function extractSkills(text) {
  const skills = [];
  const skillKeywords = ['javascript','typescript','react','node','express','python','java','docker','kubernetes','aws','azure','gcp','sql','mongodb','postgres','graphql','tailwind','css','html'];
  for (const kw of skillKeywords) {
    const re = new RegExp(`\\b${kw}\\b`, 'i');
    if (re.test(text)) skills.push(kw);
  }
  return Array.from(new Set(skills));
}

function generateQuestions(skills, repos) {
  const questions = [];
  for (const s of skills) {
    questions.push(`Explain a challenging problem you solved using ${s}.`);
    questions.push(`How do you optimize performance in ${s}?`);
  }
  for (const repo of repos.slice(0, 5)) {
    questions.push(`Walk me through the architecture of your project "${repo.name}".`);
    questions.push(`What trade-offs did you make while building "${repo.name}"?`);
  }
  return questions.slice(0, 20);
}

// Endpoint used by frontend to analyze resume+GitHub and return questions
app.post('/analyze/resume-github', async (req, res) => {
  try {
    const { resumePath, githubUrl } = req.body;
    if (!resumePath || !githubUrl) return res.status(400).json({ error: 'resumePath and githubUrl required' });

    const buffer = fs.readFileSync(resumePath);
    const parsed = await pdf(buffer);
    const skills = extractSkills(parsed.text || '');

    const match = githubUrl.match(/github.com\/([^/]+)(?:\/)?/i);
    const username = match ? match[1] : undefined;
    let repos = [];
    if (username) {
      const resp = await fetch(`https://api.github.com/users/${username}/repos?per_page=100`);
      if (resp.ok) {
        const json = await resp.json();
        repos = json.map(r => ({ name: r.name, description: r.description }));
      }
    }

    const questions = generateQuestions(skills, repos);
    res.json({ ok: true, skills, repos, questions });
  } catch (error) {
    console.error('[analyze] failed', error?.message);
    res.status(500).json({ error: 'Failed to analyze inputs' });
  }
});

// ================== Interview recording ==================
const recordingUpload = multer({ dest: 'recordings/' });

// New unified endpoint used by frontend
app.post('/uploads/recording', recordingUpload.single('recording'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Recording required' });
  console.log('[recording] saved:', req.file.path);
  res.json({ ok: true, path: req.file.path, filename: req.file.filename });
});

// Backward-compatible old path
app.post('/upload-recording', recordingUpload.single('recording'), (req, res) => {
  if (!req.file) return res.status(400).json({ success: false, message: 'Recording required' });
  console.log('[recording] saved (legacy):', req.file.path);
  res.json({ success: true, message: 'Recording uploaded', file: req.file.filename });
});

// ======== Recordings list/play/download/delete (mock + fs) ========
app.get('/recordings', (req, res) => {
  try {
    const dir = 'recordings';
    if (!fs.existsSync(dir)) return res.json({ ok: true, items: [] });
    const files = fs.readdirSync(dir)
      .filter(f => !f.startsWith('.'))
      .map(f => ({ id: f, name: f, path: `${dir}/${f}`, created_at: fs.statSync(`${dir}/${f}`).mtime }));
    res.json({ ok: true, items: files });
  } catch (e) {
    console.error('[recordings] list error', e?.message);
    // Fallback mock data
    res.json({ ok: true, items: [
      { id: 'mock1.webm', name: 'mock1.webm', path: 'recordings/mock1.webm', created_at: new Date().toISOString() }
    ]});
  }
});

app.get('/recordings/:id', (req, res) => {
  const file = `recordings/${req.params.id}`;
  if (!fs.existsSync(file)) return res.status(404).json({ error: 'Not found' });
  res.sendFile(file, { root: process.cwd() });
});

app.get('/recordings/:id/download', (req, res) => {
  const file = `recordings/${req.params.id}`;
  if (!fs.existsSync(file)) return res.status(404).json({ error: 'Not found' });
  res.download(file);
});

app.delete('/recordings/:id', (req, res) => {
  try {
    const file = `recordings/${req.params.id}`;
    if (!fs.existsSync(file)) return res.status(404).json({ error: 'Not found' });
    fs.unlinkSync(file);
    res.json({ ok: true });
  } catch (e) {
    console.error('[recordings] delete error', e?.message);
    res.status(500).json({ error: 'Failed to delete' });
  }
});

// ================== Start server ==================
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`[server] listening on http://localhost:${PORT}`));
