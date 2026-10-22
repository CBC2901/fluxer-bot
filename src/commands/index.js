const { ensureGuild, ensureUser, readDatabase, updateDatabase } = require('../database');
const { translate } = require('../locales');
const { executeEconomy } = require('./economy');
const { executeMusic } = require('./music');
const { executeRoleplay } = require('./roleplay');
const { PermissionFlags } = require('@fluxerjs/core');

const languages = new Set(['tr', 'az', 'en', 'es']);

function localeFor(guildId) {
  if (!guildId) return 'tr';
  return readDatabase().guilds[guildId]?.language || 'tr';
}

async function handleMessage(message, client) {
  if (message.author.bot || !message.guildId) return;
  const state = readDatabase();
  const guild = state.guilds[message.guildId];
  const prefix = guild?.prefix || '₺';
  if (!message.content.startsWith(prefix)) return;

  const language = state.users[message.author.id]?.language || guild?.language || 'tr';
  const t = (key, values) => translate(language, key, values);
  const input = message.content.slice(prefix.length).trim();
  if (!input) return;
  const tokens = input.split(/\s+/);
  const command = tokens.shift().toLocaleLowerCase();
  const args = { command, tokens };

  if (['prefix'].includes(command)) {
    if (!message.member?.permissions?.has(PermissionFlags.ManageGuild)) return message.reply(t('noPermission'));
    const newPrefix = tokens[0];
    if (!newPrefix || newPrefix.length > 8 || /\s/.test(newPrefix)) {
      return message.reply(t('prefixUsage', { prefix }));
    }
    updateDatabase((database) => {
      ensureGuild(database, message.guildId).prefix = newPrefix;
    });
    return message.reply(t('prefixSet', { prefix: newPrefix }));
  }

  if (['dil', 'lang'].includes(command)) {
    const selectedLanguage = tokens[0]?.toLowerCase();
    if (!languages.has(selectedLanguage)) {
      return message.reply(tokens.length
        ? t('unknownLanguage')
        : t('languageUsage', { prefix }));
    }
    if (message.member?.permissions?.has(PermissionFlags.ManageGuild)) {
      updateDatabase((database) => {
        ensureGuild(database, message.guildId).language = selectedLanguage;
        ensureUser(database, {
          id: message.author.id,
          username: message.author.username,
          tag: message.author.tag,
        }).language = null;
      });
      return message.reply(translate(selectedLanguage, 'languageSet'));
    }
    updateDatabase((database) => {
      ensureUser(database, {
        id: message.author.id,
        username: message.author.username,
        tag: message.author.tag,
      }).language = selectedLanguage;
    });
    return message.reply(translate(selectedLanguage, 'userLanguageSet'));
  }

  if (['yardım', 'yardim', 'help'].includes(command)) {
    return message.reply(t('help', { prefix }));
  }

  const profile = {
    id: message.author.id,
    username: message.author.username,
    tag: message.author.tag,
  };
  updateDatabase((database) => {
    ensureGuild(database, message.guildId);
    ensureUser(database, profile);
  });

  const common = { message, args, language, prefix, t, client };
  const economyResult = await executeEconomy(common);
  if (economyResult) return economyResult;
  const roleplayResult = await executeRoleplay({ message, command, language, t });
  if (roleplayResult) return roleplayResult;
  const musicResult = await executeMusic({ message, command, args, t, client });
  if (musicResult) return musicResult;
}

module.exports = { handleMessage, localeFor };
