# Açık veri: Türkiye trafik kazası verileri

Emniyet Genel Müdürlüğü'nün **PDF olarak** yayımladığı aylık trafik bültenleri ve İBB'nin açık veri portalındaki kaza kayıtları. Burada hepsi **makinece okunabilir JSON ve CSV** olarak duruyor. Araştırmacılar, gazeteciler, belediyeler ve geliştiriciler PDF'lerle uğraşmadan doğrudan kullanabilir.

EGM verileri **her gün otomatik olarak kontrol edilir**. Yeni bülten yayımlandığında birkaç saat içinde buraya eklenir (bkz. [otomatik güncelleme](#nasıl-güncelleniyor)).

## Hızlı başlangıç

Tüm dosyalar herkese açık adreslerden, kayıt veya anahtar gerekmeden indirilebilir:

```
https://raw.githubusercontent.com/gorkemguler/kaza-analiz-paneli/main/acik-veri/<dosya>
```

Tarayıcıdan veya uygulamalardan erişim için CDN adresi de kullanılabilir:

```
https://cdn.jsdelivr.net/gh/gorkemguler/kaza-analiz-paneli@main/acik-veri/<dosya>
```

Hangi dosyaların olduğunu, dönem aralığını ve dosya adreslerini [`index.json`](index.json) listeler.

**Python (pandas):**

```python
import pandas as pd

base = "https://raw.githubusercontent.com/gorkemguler/kaza-analiz-paneli/main/acik-veri"
iller = pd.read_csv(f"{base}/egm/iller-aylik.csv")
print(iller[iller.donem == iller.donem.max()].nlargest(10, "olu")[["il", "olu", "yarali"]])
```

**JavaScript:**

```js
const base = 'https://raw.githubusercontent.com/gorkemguler/kaza-analiz-paneli/main/acik-veri'
const ulke = await fetch(`${base}/egm/ulke-aylik.json`).then((r) => r.json())
console.log(ulke.at(-1)) // en son ay
```

**R:**

```r
iller <- read.csv("https://raw.githubusercontent.com/gorkemguler/kaza-analiz-paneli/main/acik-veri/egm/iller-aylik.csv", fileEncoding = "UTF-8-BOM")
```

## Dosyalar

### EGM aylık trafik bültenleri (`egm/`)

Kaynak: [EGM Trafik Başkanlığı: Aylık Trafik İstatistik Bülteni](https://trafik.gov.tr/istatistikler37)

| Dosya | İçerik |
| --- | --- |
| `egm/ulke-aylik.csv` / `.json` | Ülke geneli aylık toplamlar, yerleşim yeri içi ve dışı ayrımıyla |
| `egm/iller-aylik.csv` / `.json` | 81 ilin aylık kaza, ölü ve yaralı sayıları (uzun format) |
| `egm/tablolar-aylik.csv` / `.json` | Diğer tüm tablolar tek dosyada: oluş şekli, sürücü kusurları, araç cinsleri, cezalar… |
| `egm/bultenler/YYYY-AA.json` | Bir bültenin tamamı: ay ve yılbaşından beri değerler, tüm tablolar |

#### `egm/ulke-aylik`

| Alan | Açıklama |
| --- | --- |
| `donem` | Yıl-ay, örn. `2026-08` |
| `toplam_kaza` | Toplam kaza sayısı (tarafların kendi aralarında tutanak tuttuğu maddi hasarlı kazalar hariç) |
| `olumlu_kaza` | Ölümlü kaza sayısı |
| `yaralanmali_kaza` | Yaralanmalı kaza sayısı |
| `maddi_hasarli_kaza` | Maddi hasarlı kaza sayısı |
| `olu` | Ölü sayısı, **yalnızca kaza yerinde** |
| `yarali` | Yaralı sayısı |
| `yerlesim_yeri_*`, `yerlesim_yeri_disi_*` | Aynı alanların yerleşim yeri içi ve dışı kırılımı |

#### `egm/iller-aylik`

| Alan | Açıklama |
| --- | --- |
| `donem` | Yıl-ay |
| `plaka` | İl plaka kodu (1–81) |
| `il` | İl adı |
| `olumlu_yaralanmali_kaza` | Ölümlü ve yaralanmalı kaza sayısı |
| `maddi_hasarli_kaza` | Maddi hasarlı kaza sayısı |
| `olu` | Kaza yerinde ölü sayısı |
| `yarali` | Yaralı sayısı |
| `hesaplanan_alan` | Genelde boştur. PDF'te boş bırakılmış bir hücre TOPLAM satırından geri hesaplandıysa o sütunun adını içerir. |

#### `egm/tablolar-aylik`

| Alan | Açıklama |
| --- | --- |
| `donem` | Yıl-ay |
| `tablo` | Tablonun adı (aşağıdaki listeye bakın) |
| `kalem` | Satır adı, PDF'teki yazımıyla |
| `sayi` | O ayın değeri |

`tablo` alanının alabileceği değerler:

- `kaza_olus_sekli`: ölümlü-yaralanmalı kazaların oluş şekli (yandan çarpma, yayaya çarpma…)
- `karisan_arac_sayisi`: tek araçlı, iki araçlı, çok araçlı
- `kusur_unsurlari`: sürücü, yaya, yolcu, araç, yol
- `surucu_kusurlari`: 2918 sayılı Kanun maddelerine göre sürücü kusurları
- `karisan_arac_cinsi`: otomobil, motosiklet, kamyonet…
- `trafik_cezalari`: yaya, yolcu, sürücü ve plakaya uygulanan cezalar
- `diger_ekip_faaliyetleri`: alkollü sürücü, trafikten men edilen araç, hız ihlali…

### İstanbul (`ibb/`)

Kaynak: [İBB Açık Veri Portalı](https://data.ibb.gov.tr), İBB Açık Veri Lisansı

| Dosya | İçerik |
| --- | --- |
| `ibb/istanbul-kaza-duyurulari.csv` | Ulaşım Yönetim Merkezi'nin konumlu kaza duyuruları (2013–2025, ~106 bin kayıt, ~17 MB) |
| `ibb/yillik-olumlu-yaralanmali-kaza.csv` / `.json` | 2012'den beri Türkiye ve İstanbul'da yıllık ölümlü-yaralanmalı kaza sayısı |

#### `ibb/istanbul-kaza-duyurulari.csv`

| Alan | Açıklama |
| --- | --- |
| `id` | İBB duyuru numarası |
| `zaman` | Duyuru başlangıcı, İstanbul yerel saati (`YYYY-AA-GG SS:DD`) |
| `enlem`, `boylam` | WGS84 koordinat |
| `sonuc` | `Maddi hasarlı`, `Yaralanmalı`, `Ölümlü` ya da `Belirtilmemiş`. Duyuru metninden çıkarılmıştır. |
| `zincirleme` | Duyuruda zincirleme kaza geçiyorsa `1` |
| `yol` | Ana aks: D100 (E-5), TEM, Basın Ekspres, Sahil Yolu… ya da `Diğer` |
| `kapali_serit` | Kapanan şerit sayısı |
| `duyuru_metni` | Orijinal duyuru metni |

## Verileri kullanırken dikkat

- **Ölü sayıları kaza yerindekilerle sınırlı.** 30 gün içindeki ölümleri de içeren kesin rakamları TÜİK yıllık olarak yayımlar. EGM, aylık bültenleri TÜİK yayınına kadar "geçici" kabul eder.
- **İBB kayıtları duyurudur, resmi tutanak değildir.** Ağırlıkla ana arterlerdeki ve kamera görüş alanındaki kazaları kapsar. Nadiren aynı kaza iki kez duyurulmuş olabilir.
- **Kaza sonucu metinden çıkarıldı.** İBB kayıtlarının yaklaşık %20'sinde sonuç belirtilmemiştir.
- **Doğrulama:** EGM tablolarının her birinde satırların toplamı PDF'teki TOPLAM satırıyla karşılaştırılır. 81 ilin toplamı ülke toplamıyla, yerleşim yeri içi ve dışı toplamı da genel toplamla kontrol edilir. Tutmayan bülten yayımlanmaz.

## Nasıl güncelleniyor?

- **EGM:** [GitHub Actions](../.github/workflows/veri-guncelle.yml) her sabah trafik.gov.tr'yi kontrol eder. Yeni bülten varsa indirir, ayrıştırır ve doğrular. Testler geçerse bu klasöre ekleyip commit atar. PDF biçimi değişip ayrıştırma başarısız olursa depoda otomatik bir issue açılır.
- **İBB:** Her pazartesi kontrol edilir.

Değişikliklerin geçmişi için bu klasörün [commit geçmişine](https://github.com/gorkemguler/kaza-analiz-paneli/commits/main/acik-veri) bakabilirsiniz.

## Lisans ve atıf

Veriler kaynak kurumlara aittir: EGM Trafik Başkanlığı ve İstanbul Büyükşehir Belediyesi. Bu klasördeki derleme ve dönüştürme [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/deed.tr) ile paylaşılır. Kullanırken hem kaynak kurumu hem bu depoyu belirtin. Örnek:

> Kaynak: EGM Trafik Başkanlığı Aylık Trafik İstatistik Bülteni; kaza-analiz-paneli (github.com/gorkemguler/kaza-analiz-paneli) tarafından derlenmiştir.

Hata ya da tutarsızlık görürseniz lütfen bir [issue açın](https://github.com/gorkemguler/kaza-analiz-paneli/issues).
