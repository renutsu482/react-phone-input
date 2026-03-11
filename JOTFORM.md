# Jotform Widget Olarak Ekleme

Widget’ı kendi sunucunda yayınladıktan sonra Jotform’a şöyle ekleyebilirsin:

## 1. Widget’ı yayınla

```bash
npm run build
```

`dist/` klasörünü kendi domain’ine (HTTPS) yükle. Örnek: `https://senin-domain.com/phone-widget/`

## 2. Jotform’da widget’ı kaydet

1. [Jotform Add Widgets](https://www.jotform.com/widgets/#add-widget) sayfasına git.
2. **Name:** Örn. "Phone Input"
3. **Widget Type:** "iFrame Widget" seç.
4. **Widget IFrame URL:** Widget’ının tam URL’sini yaz (örn. `https://senin-domain.com/phone-widget/`).
5. **Widget width and height:** Örn. 400 x 120 (gerekirse sonra değiştirirsin).
6. Kaydet.

## 3. Formuna ekle

1. Jotform Form Builder’da formunu aç.
2. **Add Element** → **Widgets** sekmesi.
3. Listeden "Phone Input" (veya verdiğin isim) widget’ını seç.
4. Forma sürükleyip bırak.

Bu widget Jotform Custom Widget API ile konuşur: değer değiştikçe `sendData`, form gönderilirken `sendSubmit` ile telefon numarası forma yazılır ve gönderimde kaydedilir.
