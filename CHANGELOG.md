# Değişiklik günlüğü / Changelog

## 0.3.2 — 2026-10-29

**Türkçe**
- Hız ölçer sonuçları sadeleşti: önce ⚡ sabit hızıyla uyan hayaletler gösteriliyor; "yakın zamanda birini gördüyse bu hızda da olabilir" grubu kapalı başlıyor.
- 🌕 Kanlı Ay seçeneği ölçüm alanının hemen yanına taşındı; açıkken Kanıtlar sekmesinde hatırlatma çıkıyor.
- Kanıtları sıfırlamak (Sıfırla / Num0) Kanlı Ay'ı da kapatıyor; önceki haritadan açık kalıp normal hayaletleri yanlışlıkla elemiyor.

**English**
- Simpler speed meter results: ⚡ ghosts matching a normal speed come first; the "could also be this fast if it saw someone recently" group starts collapsed.
- 🌕 Blood Moon toggle moved right next to the meter, with a reminder on the Evidence tab while it's on.
- Resetting evidence (Reset / Num0) also turns Blood Moon off, so it can't carry over to a normal map and wrongly rule out ghosts.

## 0.3.1 — 2026-10-29

**Türkçe**
- Hız ölçer düzeltmesi: hayaletlerin birini gördükten sonra hızlanması ve ~65 sn boyunca hızlı kalması artık hesaba katılıyor; bu yüzden gerçek hayalet yanlışlıkla elenmiyordu (ör. 2,00 m/s'de Yurei).
- Ölçüm artık bir aralıkla gösteriliyor (ör. 2,00 m/s · 1,82–2,22) ve elle vuruş hatası (±50 ms) hesaba katılıyor.
- Sonuç üç grupta: sabit hızıyla uyuyor ⚡ / bu hızda da olabilir / bu hıza hiç çıkamaz (sadece bunlar soluk).
- Kanlı Ay hava durumu (+%15 hız) seçeneği eklendi.
- Ritim çok düzensizse "hız ölçüm sırasında değişmiş olabilir" uyarısı.
- Kanıtları sıfırlamak eski hız ölçümünü de temizliyor.
- Her sürümden önce otomatik çalışan 4.000+ hız testi.

**English**
- Speed meter fix: ghosts speeding up after seeing someone and staying fast for ~65 s is now accounted for, so the real ghost is no longer ruled out by mistake (e.g. a Yurei at 2.00 m/s).
- Readings now show a range (e.g. 2.00 m/s · 1.82–2.22) and account for hand-tapping error (±50 ms).
- Results in three groups: matches a normal speed ⚡ / could also be this fast / can never reach this speed (only these are dimmed).
- Added Blood Moon weather (+15% speed) option.
- Warning when the tap rhythm is too irregular (the speed probably changed mid-measurement).
- Resetting evidence also clears an old speed reading.
- 4,000+ speed tests run automatically before every release.

## 0.3.0 — 2026-10-29

**Türkçe**
- Kısayollar artık Ayarlar'dan değiştirilebiliyor: tıkla, yeni tuşa bas. Esc vazgeçer, Backspace kaldırır, "Varsayılanlara dön" hepsini sıfırlar.
- Çakışan tuşlar otomatik çözülüyor; oyunda kullanılabilecek tek tuşlar (harf, rakam) için uyarı; başka uygulamanın kullandığı tuşlar ⚠ ile işaretleniyor.
- Uygulamadaki tuş ipuçları seçtiğin tuşlara göre güncelleniyor.
- Yeni uygulama simgesi (fener ışığında hayalet).

**English**
- Shortcuts can now be changed in Settings: click, then press the new key. Esc cancels, Backspace removes, "Reset to defaults" restores all.
- Conflicting keys are resolved automatically; warning for single keys you may use in-game (letters, digits); keys taken by another app are marked ⚠.
- Key hints across the app follow your chosen keys.
- New app icon (a ghost in a flashlight beam).

## 0.2.2 — 2026-10-29

**Türkçe**
- Yeni Bilgi sekmesi: Ekipman ve Lanetli alt bölümleri.
- 21 ekipmanın I / II / III seviye farkları ve hayalet tespiti için ipuçları.
- Lanetli eşyalar bölümü Bilgi sekmesine taşındı.

**English**
- New Info tab with Equipment and Cursed sections.
- Tier I / II / III differences for 21 items, with ghost-identification tips.
- Cursed possessions moved into the Info tab.

## 0.2.1 — 2026-10-29

**Türkçe**
- İlk herkese açık sürüm: kanıt takipçisi (0–3 kanıt, zorunlu kanıtlar, Numpad kısayolları), 30 hayaletin ayrıntılı ansiklopedisi, tütsü ve av zamanlayıcıları, hız ölçer, lanetli eşyalar.
- Otomatik güncelleme, Türkçe/İngilizce arayüz.

**English**
- First public release: evidence tracker (0–3 evidence, forced evidence, Numpad shortcuts), detailed encyclopedia of 30 ghosts, incense and hunt timers, speed meter, cursed possessions.
- Automatic updates, Turkish/English interface.
