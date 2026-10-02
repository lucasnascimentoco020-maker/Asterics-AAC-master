const express = require('express');
const dotenvFlow = require('dotenv-flow');
const { createUsageApi } = require('./usageApi');

dotenvFlow.config({ silent: true });

const app = express();
const port = Number(process.env.USAGE_API_PORT) || 3000;

app.use(express.json({ limit: '100kb' }));
app.use('/api/usage', createUsageApi());

app.listen(port, () => {
    console.log(`Usage and AI API listening on port ${port}`);
});
