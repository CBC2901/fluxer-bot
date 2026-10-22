const fs = require('node:fs');
const path = require('node:path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const DB_PATH = path.join(DATA_DIR, 'database.json');

const initialState = () => ({
  guilds: {},
  users: {},
});

function ensureDatabase() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(DB_PATH)) {
    writeDatabase(initialState());
  }
}

function writeDatabase(state) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const temporaryPath = `${DB_PATH}.tmp`;
  fs.writeFileSync(temporaryPath, `${JSON.stringify(state, null, 2)}\n`, 'utf8');
  fs.renameSync(temporaryPath, DB_PATH);
}

function readDatabase() {
  ensureDatabase();
  try {
    const state = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
    if (!state || typeof state !== 'object' || !state.guilds || !state.users) {
      throw new Error('Database must contain guilds and users objects.');
    }
    return state;
  } catch (error) {
    throw new Error(`Unable to read database at ${DB_PATH}: ${error.message}`, { cause: error });
  }
}

function updateDatabase(mutator) {
  const state = readDatabase();
  const result = mutator(state);
  writeDatabase(state);
  return result;
}

function ensureUser(state, user) {
  const existing = state.users[user.id] || {};
  state.users[user.id] = {
    id: user.id,
    username: user.username || existing.username || user.id,
    tag: user.tag || existing.tag || user.username || user.id,
    balance: Number.isSafeInteger(existing.balance) ? existing.balance : 0,
    xp: Number.isSafeInteger(existing.xp) ? existing.xp : 0,
    animals: Array.isArray(existing.animals) ? existing.animals : [],
    language: ['tr', 'az', 'en', 'es'].includes(existing.language) ? existing.language : null,
    lastDaily: Number.isFinite(existing.lastDaily) ? existing.lastDaily : 0,
    lastHunt: Number.isFinite(existing.lastHunt) ? existing.lastHunt : 0,
    lastBattle: Number.isFinite(existing.lastBattle) ? existing.lastBattle : 0,
  };
  return state.users[user.id];
}

function ensureGuild(state, guildId) {
  const existing = state.guilds[guildId] || {};
  state.guilds[guildId] = {
    prefix: typeof existing.prefix === 'string' ? existing.prefix : '₺',
    language: ['tr', 'az', 'en', 'es'].includes(existing.language) ? existing.language : 'tr',
  };
  return state.guilds[guildId];
}

module.exports = {
  DB_PATH,
  ensureDatabase,
  ensureGuild,
  ensureUser,
  readDatabase,
  updateDatabase,
};
