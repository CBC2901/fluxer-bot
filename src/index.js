require('dotenv').config();

const http = require('node:http');
const { Client, Events, Webhook } = require('@fluxerjs/core');
const { getVoiceManager } = require('@fluxerjs/voice');
const { ensureDatabase } = require('./database');
const { handleMessage, localeFor } = require('./commands');
const { translate } = require('./locales');

ensureDatabase();

const port = Number.parseInt(process.env.PORT || '3000', 10);
if (!Number.isInteger(port) || port < 1 || port > 65_535) {
  throw new Error('PORT must be a valid TCP port from 1 to 65535.');
}

const healthServer = http.createServer((request, response) => {
  if (request.url === '/health' || request.url === '/') {
    response.writeHead(200, { 'content-type': 'text/plain; charset=utf-8' });
    response.end('Fluxer Bot is running\n');
    return;
  }
  response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
  response.end('Not found\n');
});

healthServer.listen(port, '0.0.0.0', () => {
  console.log(`Health server listening on port ${port}.`);
});

const client = new Client({
  rest: process.env.FLUXER_API_URL ? { api: process.env.FLUXER_API_URL } : undefined,
});

getVoiceManager(client);
client.localeFor = localeFor;

client.on(Events.Ready, async () => {
  console.log(`Logged in to Fluxer as ${client.user?.username || 'bot'}.`);
  if (process.env.FLUXER_WEBHOOK_URL) {
    try {
      const webhookUrl = new URL(process.env.FLUXER_WEBHOOK_URL);
      const match = webhookUrl.pathname.match(/\/webhooks\/(\d+)\/([^/]+)\/?$/);
      if (!match) throw new Error('FLUXER_WEBHOOK_URL must contain /webhooks/<id>/<token>.');
      const webhook = Webhook.fromToken(client, match[1], decodeURIComponent(match[2]));
      await webhook.send('Fluxer bot is online.');
    } catch (error) {
      console.error('Fluxer webhook notification failed:', error.message);
    }
  }
});

client.on(Events.MessageCreate, (message) => {
  void handleMessage(message, client).catch(async (error) => {
    console.error(`Command processing failed in guild ${message.guildId || 'DM'}:`, error);
    if (message.guildId) {
      try {
        await message.reply(translate(localeFor(message.guildId), 'commandError'));
      } catch (replyError) {
        console.error('Unable to send command error reply:', replyError);
      }
    }
  });
});

if (!process.env.FLUXER_BOT_TOKEN) {
  console.error('FLUXER_BOT_TOKEN is missing; refusing to start the Fluxer bot.');
  healthServer.close();
  process.exitCode = 1;
} else {
  client.login(process.env.FLUXER_BOT_TOKEN).catch((error) => {
    console.error('Fluxer login failed:', error);
    healthServer.close();
    process.exitCode = 1;
  });
}

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    client.destroy();
    healthServer.close(() => process.exit(0));
  });
}
