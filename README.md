# Bir Kelime Bir İşlem — Çoklu Cihaz v2

Yenilikler:
- ✅ Parantezli işlem desteği: `(100-25)×5+3` gibi
- ✅ Çözülebilir bulmacalar (her işlem turunun en az bir çözümü var)
- ✅ Süre bitince otomatik sonuç ekranı
- ✅ Host "Süreyi Bitir" tuşu

## Render.com'a Yükleme

1. Yeni bir GitHub repo aç (Public)
2. Bu klasörün **içindeki** dosyaları yükle:
   - `server.js`
   - `package.json`
   - `public/index.html` (public klasörüyle birlikte)
3. Render.com → New + → Web Service → GitHub repo'nu seç
4. Ayarlar:
   - Build Command: `npm install`
   - Start Command: `npm start`
   - Instance Type: **Free**
   - Region: Frankfurt
5. Deploy Web Service tıkla, 2-3 dakika bekle
6. URL'i arkadaşlarınla paylaş

## Oynanış

- Host yeni oda kurar, 4 karakter kod alır
- Arkadaşlar aynı linke girip kodu yazar
- Herkes kendi cihazından oynar
- Bir Kelime: 9 harften en uzun kelime (TDK kontrolü)
- Bir İşlem: 6 sayıdan hedefe ulaş (parantez kullanabilirsin)
- Joker hakkı: oyun başına 1-2 (kelime için, -2 puan)
