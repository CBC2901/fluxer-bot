const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');
const { DB_PATH, ensureGuild, ensureUser, updateDatabase } = require('../src/database');
const { executeEconomy, firstMention } = require('../src/commands/economy');
const { translate } = require('../src/locales');

test('database preserves global profiles and supports direct-ID cross-server transfers', async () => {
  const backup = fs.existsSync(DB_PATH) ? fs.readFileSync(DB_PATH) : null;
  try {
    updateDatabase((state) => {
      const user = ensureUser(state, { id: 'test-user', username: 'Test', tag: 'Test#1234' });
      user.balance = 321;
      user.language = 'es';
      assert.deepEqual(ensureGuild(state, 'test-guild'), { prefix: '₺', language: 'tr' });
    });

    test('mention handling accepts Fluxer user arrays', () => {
      const user = { id: '12345678901234567' };
      assert.equal(firstMention({ mentions: [user] }), user);
      assert.equal(firstMention({ mentions: [] }), null);
    });
    let replyText;
    const message = {
      author: { id: 'test-user', username: 'Test', tag: 'Test#1234' },
      mentions: { users: { first: () => null } },
      reply: async (content) => { replyText = content; return content; },
    };
    await executeEconomy({
      message,
      args: { command: 'pay', tokens: ['12345678901234567', '23'] },
      language: 'en',
      prefix: '₺',
      t: (key, values) => translate('en', key, values),
      client: { users: { cache: { get: () => null } } },
    });
    assert.match(replyText, /sent \*\*23\*\* coins/);
    updateDatabase((state) => {
      const user = ensureUser(state, { id: 'test-user', username: 'Test' });
      assert.equal(user.balance, 298);
      assert.equal(user.language, 'es');
      assert.equal(ensureUser(state, { id: '12345678901234567' }).balance, 23);
    });
  } finally {
    if (backup) fs.writeFileSync(DB_PATH, backup);
    else fs.rmSync(DB_PATH, { force: true });
  }
});
