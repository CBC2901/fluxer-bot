# Fluxer Bot Kurulum Rehberi

## Gereksinimler

- Node.js 22.13 veya üzeri ve npm
- Fluxer Developer Portal'dan oluşturulmuş bot ve bot token'ı

## Yerel kurulum

1. Proje dizininde `npm install` çalıştırın.
2. `.env.example` dosyasını `.env` olarak kopyalayın ve `FLUXER_BOT_TOKEN` değerini Fluxer bot token'ınızla doldurun. `FLUXER_WEBHOOK_URL` isteğe bağlıdır; tanımlandığında bot hazır olduğunda bu Fluxer webhook'una çevrimiçi bildirimi gönderilir. `FLUXER_API_URL` yalnızca özel API host'u kullanıyorsanız gereklidir.
3. `npm start` ile botu başlatın.

Bot, Fluxer.js'in `@fluxerjs/core` gateway istemcisiyle bağlanır; bot token gereklidir. Webhook tek başına komut almak için yeterli değildir, yalnızca isteğe bağlı çevrimiçi bildirimi gönderir. Bot ilk başladığında `data/database.json` dosyasını oluşturur. Prefix, sunucu dili ve ekonomi profilleri bu dosyada saklanır. Bakiyeler sunucuya değil Fluxer kullanıcı ID'sine bağlıdır. `.env` ve veritabanı dosyası Git'e eklenmez.

## Komutlar

Varsayılan prefix `₺`:

- `₺prefix <yeni_prefix>` — sunucu yöneticisi sunucunun prefix'ini değiştirir (en fazla 8 boşluksuz karakter).
- `₺dil <tr|az|en|es>` / `₺lang <tr|az|en|es>` — kullanıcı kendi dil tercihini; sunucu yöneticisi sunucunun varsayılan dilini seçer.
- `₺avlan` / `₺hunt`, `₺hayvanlarım` / `₺zoo`, `₺savaş [@rakip]` / `₺battle [@rakip]`
- `₺günlük` / `₺daily`, `₺bakiye` / `₺cash`, `₺gönder <@kişi|ID|benzersiz kullanıcı adı> <miktar>` / `₺pay`
- `₺sarıl`, `₺öp`, `₺tokat`, `₺okşa` (aynı zamanda hug/kiss/slap/pat); yanıt başına yalnızca tek anime GIF'i gönderilir.
- `₺çal <şarkı adı|YouTube URL|Spotify parça URL>`, `₺durdur`, `₺geç`, `₺sıra`

Dil ve prefix ayarları sunucuya özeldir. Anime GIF'leri waifu.pics API'sinden alınır. Müzik komutları `@fluxerjs/voice` ve `play-dl` kullanır; ses çaları WebM/Opus akışlarına sınırlar. Fluxer.js ses API'sinin yeniden düzenlenmekte olduğu upstream rehberinde belirtilmiştir; üretim ortamında değişikliklere hazır olun. Spotify parça bağlantısı parça adını alıp oynatılabilir kaynağı YouTube'da arar; Spotify bağlantıları için Spotify Developer hesabından alınan istemci bilgileri ve `SPOTIFY_REFRESH_TOKEN` `.env` dosyasına girilmelidir. Spotify playlist ve albüm bağlantıları desteklenmez.

Global para transferinde kullanıcı ID'si doğrudan kullanılabilir; alıcı başka sunucuda olsa veya botun önbelleğinde bulunmasa bile transfer yapılabilir. Kullanıcı adı/etiket araması yalnızca botun daha önce gördüğü profillerde çalışır ve tekil eşleşme gerektirir. Kullanıcı adları değişebileceğinden ID kullanılması önerilir.

## Render ve çalışma süresi

Web servisi `PORT` (varsayılan `3000`) üzerinde HTTP sunucusu açar ve `/health` yolunda sağlık yanıtı verir. Render'da **Web Service** oluşturun, build komutu olarak `npm install`, start komutu olarak `npm start` girin ve `FLUXER_BOT_TOKEN` ortam değişkenini ekleyin. İsteğe bağlı `FLUXER_WEBHOOK_URL` ve Render'ın sağladığı `PORT` değerlerini de tanımlayın.

Ücretsiz bulut katmanları servisi uykuya alabilir veya dosya sistemini yeniden oluşturabilir; HTTP keep-alive endpoint'i tek başına 7/24 çalışma ya da kalıcı disk garantisi vermez. Kalıcı ekonomi verisi için Render'da `data/` dizinine bağlı kalıcı disk veya kalıcı depolama sunan bir plan kullanın. Kesintisiz çalışma gerekiyorsa uyumayan bir plan/host seçin.

## Kontroller

- `npm test` — veritabanı ve locale testleri
- `npm run check` — JavaScript dosyalarında sözdizimi kontrolleri
