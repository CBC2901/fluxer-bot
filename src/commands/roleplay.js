const { EmbedBuilder } = require('@fluxerjs/core');
const { firstMention } = require('./economy');

const actions = {
  'sarıl': 'hug',
  saril: 'hug',
  hug: 'hug',
  'öp': 'kiss',
  op: 'kiss',
  kiss: 'kiss',
  tokat: 'slap',
  slap: 'slap',
  'okşa': 'pat',
  oksa: 'pat',
  pat: 'pat',
};

async function executeRoleplay({ message, command, language, t }) {
  const action = actions[command];
  if (!action) return null;
  const target = firstMention(message);
  if (!target) return message.reply(t('rpUsage'));
  if (target.id === message.author.id) return message.reply(t('rpSelf'));

  const endpoints = {
    hug: 'hug',
    kiss: 'kiss',
    slap: 'slap',
    pat: 'pat',
  };
  try {
    const response = await fetch(`https://api.waifu.pics/sfw/${endpoints[action]}`, {
      signal: AbortSignal.timeout(8_000),
    });
    if (!response.ok) throw new Error(`Anime API responded with HTTP ${response.status}`);
    const payload = await response.json();
    if (typeof payload.url !== 'string' || !/^https:\/\/.+\.(gif|png|jpe?g|webp)(\?.*)?$/i.test(payload.url)) {
      throw new Error('Anime API returned an invalid image URL.');
    }
    return message.reply({
      content: t('rpMessage', {
        actor: message.author.toString(),
        target: target.toString(),
        action: t(`rpActions.${action}`),
      }),
      embeds: [new EmbedBuilder().setImage(payload.url)],
    });
  } catch (error) {
    console.error(`Anime RP request failed (${language}/${action}):`, error);
    return message.reply(t('rpError'));
  }
}

module.exports = { executeRoleplay };
