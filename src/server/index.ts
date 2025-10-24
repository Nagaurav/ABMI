import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import analysisRoutes from './api/analysis';

export const createServer = () => {
  const app = express();
  
  // Middleware
  app.use(cors());
  app.use(bodyParser.json());
  
  // API Routes
  app.use('/api/analysis', analysisRoutes);
  
  // Health check endpoint
  app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok' });
  });
  
  return app;
};

// Start the server if this file is run directly
if (require.main === module) {
  const PORT = process.env.PORT || 3001;
  const server = createServer();
  
  server.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

export default createServer;
