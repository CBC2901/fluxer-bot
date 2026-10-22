const { ensureUser, updateDatabase } = require('../database');

const animals = [
  { species: 'rabbit', rarity: 'Yaygın', weight: 50, power: 5, reward: 12 },
  { species: 'fox', rarity: 'Yaygın', weight: 30, power: 8, reward: 18 },
  { species: 'wolf', rarity: 'Nadir', weight: 12, power: 18, reward: 45 },
  { species: 'griffin', rarity: 'Destansı', weight: 6, power: 35, reward: 100 },
  { species: 'dragon', rarity: 'Efsanevi', weight: 2, power: 70, reward: 250 },
];

const rarityNames = {
  Yaygın: { az: 'Adi', en: 'Common', es: 'Común' },
  Nadir: { az: 'Nadir', en: 'Rare', es: 'Raro' },
  Destansı: { az: 'Epik', en: 'Epic', es: 'Épico' },
  Efsanevi: { az: 'Əfsanəvi', en: 'Legendary', es: 'Legendario' },
};

function firstMention(message) {
  if (Array.isArray(message.mentions)) return message.mentions[0] || null;
  return message.mentions?.users?.first() || null;
}

function pickAnimal() {
  const ticket = Math.random() * animals.reduce((sum, animal) => sum + animal.weight, 0);
  let cursor = 0;
  return animals.find((animal) => {
    cursor += animal.weight;
    return ticket < cursor;
  });
}

function secondsRemaining(lastUsed, cooldown) {
  return Math.max(0, Math.ceil((lastUsed + cooldown - Date.now()) / 1000));
}

function getCachedUser(client, userId) {
  return client.users?.get?.(userId) || client.users?.cache?.get?.(userId) || null;
}

async function executeEconomy({ message, args, language, prefix, t, client }) {
  const author = message.author;
  const aliases = {
    daily: ['günlük', 'daily'],
    balance: ['bakiye', 'cash', 'balance'],
    hunt: ['avlan', 'hunt'],
    animals: ['hayvanlarım', 'hayvanlarim', 'zoo', 'envanter', 'inventory'],
    transfer: ['gönder', 'gonder', 'pay', 'send'],
    battle: ['savaş', 'savas', 'battle'],
  };
  const command = args.command;
  const userProfile = { id: author.id, username: author.username, tag: author.tag };

  if (aliases.daily.includes(command)) {
    const result = updateDatabase((state) => {
      const user = ensureUser(state, userProfile);
      const remaining = secondsRemaining(user.lastDaily, 86_400_000);
      if (remaining) return { remaining };
      const amount = 100 + Math.floor(Math.random() * 101);
      user.balance += amount;
      user.lastDaily = Date.now();
      return { amount, balance: user.balance };
    });
    return message.reply(result.remaining
      ? t('cooldown', { time: result.remaining })
      : t('dailySuccess', result));
  }

  if (aliases.balance.includes(command)) {
    const user = updateDatabase((state) => ensureUser(state, userProfile));
    return message.reply(t('balance', {
      user: author.username,
      balance: user.balance,
      xp: user.xp,
    }));
  }

  if (aliases.hunt.includes(command)) {
    const result = updateDatabase((state) => {
      const user = ensureUser(state, userProfile);
      const remaining = secondsRemaining(user.lastHunt, 30_000);
      if (remaining) return { remaining };
      const animal = pickAnimal();
      const captured = { species: animal.species, rarity: animal.rarity, power: animal.power };
      user.animals.push(captured);
      user.balance += animal.reward;
      user.xp += 10 + animal.power;
      user.lastHunt = Date.now();
      return {
        animal: t(`animalNames.${animal.species}`),
        rarity: language === 'tr' ? animal.rarity : rarityNames[animal.rarity][language],
        power: animal.power,
        reward: animal.reward,
        xp: 10 + animal.power,
      };
    });
    return message.reply(result.remaining
      ? t('cooldown', { time: result.remaining })
      : t('huntSuccess', { ...result, user: author.username }));
  }

  if (aliases.animals.includes(command)) {
    const user = updateDatabase((state) => ensureUser(state, userProfile));
    if (!user.animals.length) return message.reply(t('animalsEmpty', { prefix }));
    const animalList = user.animals.slice(-20).map((animal, index) => t('animalEntry', {
      index: index + 1,
      name: animal.species ? t(`animalNames.${animal.species}`) : animal.name,
      rarity: language === 'tr' ? animal.rarity : rarityNames[animal.rarity]?.[language] || animal.rarity,
      power: animal.power,
      powerLabel: t('powerLabel'),
    })).join('\n');
    return message.reply(t('animalsList', {
      user: author.username,
      count: user.animals.length,
      animals: animalList,
    }));
  }

  if (aliases.transfer.includes(command)) {
    const amount = Number(args.tokens.at(-1));
    const recipientToken = args.tokens.slice(0, -1).join(' ').replace(/[<@!>]/g, '');
    if (!args.tokens.length || !Number.isSafeInteger(amount)) {
      return message.reply(t('transferUsage', { prefix }));
    }
    if (amount <= 0) return message.reply(t('transferAmountInvalid'));

    const mentionId = firstMention(message)?.id;
    const targetId = mentionId || (/^\d{17,20}$/.test(recipientToken) ? recipientToken : null);
    const result = updateDatabase((state) => {
      const sender = ensureUser(state, userProfile);
      let recipient;
      if (targetId) {
        const cachedRecipient = getCachedUser(client, targetId);
        recipient = ensureUser(state, {
          id: targetId,
          username: cachedRecipient?.username || targetId,
          tag: cachedRecipient?.tag || cachedRecipient?.username || targetId,
        });
      } else {
        const search = recipientToken.toLocaleLowerCase();
        const matches = Object.values(state.users).filter((user) =>
          [user.username, user.tag].some((name) => name?.toLocaleLowerCase() === search));
        if (matches.length !== 1) return { invalid: true };
        recipient = matches[0];
      }
      if (recipient.id === sender.id) return { self: true };
      if (sender.balance < amount) return { insufficient: true };
      sender.balance -= amount;
      recipient.balance += amount;
      return { balance: sender.balance, recipientId: recipient.id };
    });
    if (result.invalid) return message.reply(t('transferInvalid'));
    if (result.self) return message.reply(t('transferSelf'));
    if (result.insufficient) return message.reply(t('transferInsufficient'));
    const knownRecipient = getCachedUser(client, result.recipientId);
    return message.reply(t('transferSuccess', {
      sender: author.username,
      amount,
      recipient: knownRecipient ? knownRecipient.username : `<@${result.recipientId}>`,
      balance: result.balance,
    }));
  }

  if (aliases.battle.includes(command)) {
    const opponentId = firstMention(message)?.id
      || args.tokens.find((token) => /^\d{17,20}$/.test(token));
    const result = updateDatabase((state) => {
      const user = ensureUser(state, userProfile);
      const remaining = secondsRemaining(user.lastBattle, 15_000);
      if (remaining) return { remaining };
      if (!user.animals.length) return { noAnimals: true };

      let opponent;
      let opponentName;
      if (opponentId) {
        if (opponentId === author.id) return { self: true };
        const known = getCachedUser(client, opponentId);
        opponent = state.users[opponentId];
        opponentName = known?.username || opponent?.username || opponentId;
        if (!opponent?.animals?.length) return { opponentNoAnimals: true };
      } else {
        opponentName = 'Bot';
      }

      const teamPower = (animalsOwned) => animalsOwned
        .slice(-3)
        .reduce((sum, animal) => sum + animal.power, 0);
      const ownPower = teamPower(user.animals);
      const otherPower = opponent ? teamPower(opponent.animals) : 25 + Math.floor(Math.random() * 70);
      const ownScore = ownPower + Math.floor(Math.random() * 21);
      const otherScore = otherPower + Math.floor(Math.random() * 21);
      user.lastBattle = Date.now();
      if (ownScore === otherScore) return { draw: true, own: ownPower, other: otherPower };

      const winnerIsAuthor = ownScore > otherScore;
      const winner = winnerIsAuthor ? user : opponent;
      const reward = opponent ? 60 : 35;
      winner.balance += reward;
      winner.xp += 20;
      return {
        winner: winnerIsAuthor ? author.username : opponentName,
        reward,
        own: ownPower,
        other: otherPower,
      };
    });
    if (result.remaining) return message.reply(t('cooldown', { time: result.remaining }));
    if (result.noAnimals) return message.reply(t('battleNoAnimals'));
    if (result.opponentNoAnimals) return message.reply(t('battleOpponentNoAnimals'));
    if (result.self) return message.reply(t('battleUsage', { prefix }));
    if (result.draw) return message.reply(t('battleDraw', result));
    return message.reply(t('battleWin', result));
  }

  return null;
}

module.exports = { executeEconomy, firstMention };
