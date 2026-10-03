const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();

// CORS ve Body Parser Middleware Ayarları
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Tüm istekleri karşılayan ana işleyici
app.all('*', async (req, res) => {
  // 1. CORS Preflight istekleri için hızlı yanıt
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // 2. Sadece POST ve PATCH kabul et (Diğer methodları doğrudan reddet)
  if (!['POST', 'PATCH'].includes(req.method)) {
    return res.status(405).json({
      error: 'Metod izin verilmedi! Bu proxy servisi sadece POST ve PATCH isteklerini kabul eder.'
    });
  }

  try {
    // Safety check: req.body undefined ise boş obje ata (Çökmeyi önler)
    const body = req.body || {};

    // Header veya Body üzerinden parametreleri al
    const targetUrl = req.headers['x-target-url'] || body.targetUrl;
    const targetMethod = (req.headers['x-target-method'] || body.targetMethod || 'POST').toUpperCase();

    // Hedef URL Doğrulaması
    if (!targetUrl) {
      return res.status(400).json({ 
        error: 'Hedef URL bulunamadı! Lütfen "x-target-url" header\'ı veya body içinde "targetUrl" belirtin.' 
      });
    }

    if (!['POST', 'PATCH'].includes(targetMethod)) {
      return res.status(400).json({ 
        error: 'Geçersiz hedef metod! Sadece POST veya PATCH desteklenmektedir.' 
      });
    }

    // Proxy verisini hazırlama (Kontrol değişkenlerini temizle)
    const payload = { ...body };
    delete payload.targetUrl;
    delete payload.targetMethod;

    // Hedefe gönderilecek başlıkları (Headers) hazırlama
    const forwardHeaders = {
      'Content-Type': 'application/json',
      'User-Agent': 'Mozilla/5.0 (Vercel-Serverless-Proxy)'
    };

    // İstemciden (BDFD) gelen Authorization başlığı varsa bunu hedef servise aktar
    if (req.headers['authorization']) {
      forwardHeaders['Authorization'] = req.headers['authorization'];
    }

    // Hedef URL'ye Axios ile istek gönderme
    const response = await axios({
      method: targetMethod,
      url: targetUrl,
      data: payload,
      headers: forwardHeaders,
      timeout: 8000 // Vercel Free planı timeout sınırı için güvenli alan (8s)
    });

    // Başarılı yanıtı döndür
    return res.status(response.status).json(response.data);

  } catch (error) {
    if (error.response) {
      // Hedef sunucudan gelen hatayı ilet (Örn: Discord 401/400 hataları)
      return res.status(error.response.status).json({
        proxyError: true,
        status: error.response.status,
        data: error.response.data
      });
    }

    // Sunucu/Ağ Hatası
    return res.status(500).json({
      error: 'İstek iletilirken bir sunucu hatası oluştu.',
      details: error.message
    });
  }
});

module.exports = app;
