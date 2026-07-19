import 'dotenv/config';
import { createApp } from './app';

const PORT = process.env['PORT'] ? parseInt(process.env['PORT'], 10) : 3000;

const app = createApp();

app.listen(PORT, () => {
  console.log(JSON.stringify({ level: 'info', message: `Server started`, port: PORT }));
});
