const { VoiceChannel } = require('@fluxerjs/core');
const { getVoiceManager } = require('@fluxerjs/voice');
const play = require('play-dl');

const queues = new Map();
let spotifyConfigured = false;

function queueFor(guildId) {
  if (!queues.has(guildId)) {
    queues.set(guildId, {
      tracks: [],
      playing: false,
      currentTrack: null,
      endTimer: null,
      stream: null,
      streamError: null,
      connection: null,
      connectionError: null,
      channelId: null,
      textChannel: null,
      t: null,
      manager: null,
    });
  }
  return queues.get(guildId);
}

async function resolveTrack(query, t) {
  let durationInSec;
  if (/open\.spotify\.com\//i.test(query)) {
    if (!/open\.spotify\.com\/track\//i.test(query)) {
      throw new Error(t('spotifyTrackOnly'));
    }
    const { SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET, SPOTIFY_REFRESH_TOKEN } = process.env;
    if (!SPOTIFY_CLIENT_ID || !SPOTIFY_CLIENT_SECRET || !SPOTIFY_REFRESH_TOKEN) {
      throw new Error(t('spotifyConfig'));
    }
    if (!spotifyConfigured) {
      await play.setToken({
        spotify: {
          client_id: SPOTIFY_CLIENT_ID,
          client_secret: SPOTIFY_CLIENT_SECRET,
          refresh_token: SPOTIFY_REFRESH_TOKEN,
          market: process.env.SPOTIFY_MARKET || 'US',
        },
      });
      spotifyConfigured = true;
    }
    const spotifyTrack = await play.spotify(query);
    durationInSec = spotifyTrack.durationInSec;
    const artists = Array.isArray(spotifyTrack.artists)
      ? spotifyTrack.artists.map((artist) => typeof artist === 'string' ? artist : artist.name).filter(Boolean).join(' ')
      : '';
    query = `${spotifyTrack.name} ${artists}`;
  }

  if (play.yt_validate(query) === 'video') {
    const info = await play.video_basic_info(query);
    return { title: info.video_details.title, url: query, durationInSec: info.video_details.durationInSec };
  }
  const results = await play.search(query, { limit: 1 });
  if (!results.length) throw new Error(t('musicNoResults'));
  return {
    title: results[0].title,
    url: results[0].url,
    durationInSec: results[0].durationInSec || durationInSec,
  };
}

async function playNext(guildId) {
  const queue = queues.get(guildId);
  if (!queue || queue.playing || !queue.tracks.length) return;
  const track = queue.tracks[0];
  queue.playing = true;
  queue.currentTrack = track;

  try {
    const channel = queue.manager.client.channels.get(queue.channelId);
    if (!(channel instanceof VoiceChannel)) throw new Error(queue.t('musicVoice'));
    const connection = queue.manager.getConnection(queue.channelId)
      || await queue.manager.join(channel);
    queue.connection = connection;
    const stream = await play.stream(track.url);
    if (queues.get(guildId) !== queue || queue.currentTrack !== track) return;
    if (stream.type !== 'webm/opus') throw new Error(queue.t('musicUnsupportedFormat'));
    queue.stream = stream.stream;
    queue.connectionError = (error) => void finishTrack(guildId, queue, track, error);
    queue.streamError = queue.connectionError;
    connection.once('error', queue.connectionError);
    stream.stream.once('error', queue.streamError);
    stream.stream.once('end', () => {
      queue.endTimer = setTimeout(() => {
        void finishTrack(guildId, queue, track);
      }, 1_500);
    });
    await connection.play(stream.stream);
    if (queues.get(guildId) !== queue || queue.currentTrack !== track) return;
    await queue.textChannel.send(queue.t('musicPlaying', { title: track.title }));
  } catch (error) {
    await finishTrack(guildId, queue, track, error);
  }
}

async function finishTrack(guildId, queue, track, error) {
  if (queues.get(guildId) !== queue || queue.currentTrack !== track) return;
  if (queue.endTimer) clearTimeout(queue.endTimer);
  queue.endTimer = null;
  if (queue.stream && queue.streamError) queue.stream.off('error', queue.streamError);
  if (error) queue.stream?.destroy();
  queue.stream = null;
  queue.streamError = null;
  if (queue.connection && queue.connectionError) {
    queue.connection.off('error', queue.connectionError);
  }
  queue.connectionError = null;
  if (error) {
    console.error(`Fluxer music playback failed in guild ${guildId}:`, error);
    try {
      await queue.textChannel.send(queue.t('musicError', { error: error.message }));
    } catch (sendError) {
      console.error(`Unable to report music playback error in guild ${guildId}:`, sendError);
    }
  }
  queue.tracks.shift();
  queue.currentTrack = null;
  queue.playing = false;
  void playNext(guildId);
}

async function executeMusic({ message, command, args, t, client }) {
  const aliases = {
    play: ['çal', 'cal', 'play'],
    stop: ['durdur', 'stop'],
    skip: ['geç', 'gec', 'skip'],
    queue: ['sıra', 'sira', 'queue'],
  };
  const operation = Object.keys(aliases).find((key) => aliases[key].includes(command));
  if (!operation) return null;

  const guildId = message.guildId;
  if (!guildId) return message.reply(t('musicGuildOnly'));
  const manager = getVoiceManager(client);
  const queue = queueFor(guildId);
  queue.textChannel = message.channel;
  queue.t = t;
  queue.manager = manager;

  if (operation === 'queue') {
    if (!queue.tracks.length) return message.reply(t('musicEmpty'));
    return message.reply(t('musicQueue', {
      tracks: queue.tracks.slice(0, 10).map((track, index) => `${index + 1}. ${track.title}`).join('\n'),
    }));
  }

  if (operation === 'play') {
    const query = args.tokens.join(' ').trim();
    if (!query) return message.reply(t('musicNoTrack'));
    if (queue.tracks.length >= 50) return message.reply(t('musicQueueLimit'));

    const voiceChannelId = manager.getVoiceChannelId(guildId, message.author.id);
    if (!voiceChannelId) return message.reply(t('musicVoice'));
    const voiceChannel = client.channels.get(voiceChannelId);
    if (!(voiceChannel instanceof VoiceChannel)) return message.reply(t('musicVoice'));
    if (queue.channelId && queue.channelId !== voiceChannelId) return message.reply(t('musicSameVoice'));

    try {
      const track = await resolveTrack(query, t);
      queue.channelId = voiceChannelId;
      queue.tracks.push(track);
      await message.reply(t('musicAdded', { title: track.title }));
      void playNext(guildId);
      return;
    } catch (error) {
      console.error(`Music command failed in guild ${guildId}:`, error);
      return message.reply(t('musicError', { error: error.message }));
    }
  }

  if (!queue.tracks.length) return message.reply(t('musicEmpty'));
  const connection = queue.channelId ? manager.getConnection(queue.channelId) : null;
  if (operation === 'stop') {
    queue.tracks = [];
    if (queue.endTimer) clearTimeout(queue.endTimer);
    if (queue.stream && queue.streamError) queue.stream.off('error', queue.streamError);
    queue.stream?.destroy();
    if (queue.connection && queue.connectionError) queue.connection.off('error', queue.connectionError);
    queue.stream = null;
    queue.streamError = null;
    queue.endTimer = null;
    queue.connectionError = null;
    queue.currentTrack = null;
    queue.playing = false;
    connection?.stop();
    if (queue.channelId) manager.leaveChannel(queue.channelId);
    queues.delete(guildId);
    return message.reply(t('musicStopped'));
  }
  if (operation === 'skip') {
    if (queue.endTimer) clearTimeout(queue.endTimer);
    if (queue.stream && queue.streamError) queue.stream.off('error', queue.streamError);
    queue.stream?.destroy();
    if (queue.connection && queue.connectionError) queue.connection.off('error', queue.connectionError);
    queue.stream = null;
    queue.streamError = null;
    queue.endTimer = null;
    queue.connectionError = null;
    queue.tracks.shift();
    queue.currentTrack = null;
    queue.playing = false;
    connection?.stop();
    void playNext(guildId);
    return message.reply(t('musicSkipped'));
  }
  return null;
}

module.exports = { executeMusic };
