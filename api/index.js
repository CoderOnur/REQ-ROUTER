const express = require('express');
const { Client, GatewayIntentBits, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const cors = require('cors');

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.post('*', async (req, res) => {
  try {
    // BDFD'den veya Header'dan gelecek parametreler
    const token = req.headers['authorization']?.replace('Bot ', '') || req.body.token;
    const channelId = req.headers['x-channel-id'] || req.body.channelId;
    const messageId = req.headers['x-message-id'] || req.body.messageId;
    const buttonsData = req.body.buttons || []; // Buton dizisi

    // Zorunlu alan kontrolleri
    if (!token || !channelId || !messageId) {
      return res.status(400).json({
        error: 'Eksik parametre! "token", "channelId" ve "messageId" zorunludur.'
      });
    }

    // Geçici bir Discord Client oluşturuyoruz
    const client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages
      ]
    });

    // Bot giriş yapıp hazır olduğunda çalışacak mantık
    client.once('ready', async () => {
      try {
        const channel = await client.channels.fetch(channelId);
        if (!channel) {
          await client.destroy();
          return res.status(444).json({ error: 'Kanal bulunamadı!' });
        }

        const message = await channel.messages.fetch(messageId);
        if (!message) {
          await client.destroy();
          return res.status(404).json({ error: 'Mesaj bulunamadı!' });
        }

        // Butonları oluşturma (ActionRow)
        const row = new ActionRowBuilder();
        
        if (Array.isArray(buttonsData) && buttonsData.length > 0) {
          buttonsData.forEach(btn => {
            const button = new ButtonBuilder()
              .setCustomId(btn.customId || 'btn_default')
              .setLabel(btn.label || 'Buton')
              .setStyle(btn.style || ButtonStyle.Primary); // 1: Primary, 2: Secondary, 3: Success, 4: Danger

            if (btn.emoji) button.setEmoji(btn.emoji);

            row.addComponents(button);
          });
        }

        // Mesajı butonlar ile güncelleme
        await message.edit({
          components: [row]
        });

        // İstemci oturumunu kapat ve yanıt dön
        await client.destroy();
        return res.status(200).json({ success: true, message: 'Butonlar başarıyla eklendi!' });

      } catch (err) {
        await client.destroy();
        return res.status(500).json({ error: 'Discord.js işlemi sırasında hata:', details: err.message });
      }
    });

    // Bot oturumunu başlat
    await client.login(token);

  } catch (error) {
    return res.status(500).json({
      error: 'Sunucu hatası veya geçersiz Token!',
      details: error.message
    });
  }
});

module.exports = app;
