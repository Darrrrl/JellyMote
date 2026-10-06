import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from './config/index.js';
import { api } from './routes/api.js';

const app = express();
app.disable('x-powered-by');
app.use('/api', api);

const frontendDist = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../frontend/dist');
app.use(express.static(frontendDist));
app.get('/{*path}', (_req, res) => res.sendFile(path.join(frontendDist, 'index.html')));

app.listen(config.port, '0.0.0.0', () => {
  console.log(`JellyMote listening on port ${config.port}`);
});
