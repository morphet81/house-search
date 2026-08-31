# LIFULL HOME'S (homes.co.jp) — Buy Search Filters

Scraped 2026-09-01 from Tokyo list pages + **「すべてのこだわり条件をみる」** modal.  
Scope: **買う** only (not 賃貸).

> **UI note (matches mobile「検索条件を変更する」):** screen shows ~12 sections.  
> The first block looks like ~7 “main” filters (価格→リフォーム), then 人気こだわり (5) + **すべてのこだわり条件を見る** opens the big modal (100+).  
> Doc §A = what’s on that sheet; §B = full modal groups.

---

## How search works

1. Choose family hub:
   - **一戸建て** → `/kodate/shinchiku/` | `/kodate/chuko/`
   - **マンション** → `/mansion/shinchiku/` | `/mansion/chuko/`
   - **土地** → `/tochi/`
2. Pick area via **地域 / 路線・駅 / 地図 / 路線図**.
3. List page sidebar = `cond[...]` form; apply → refresh list.
4. Open **すべてのこだわり条件をみる** for full feature checkboxes (modal `#persistence-list-view`).

| Category | New | Used / only |
|----------|-----|-------------|
| 一戸建て | `/kodate/shinchiku/{pref}/list/` | `/kodate/chuko/{pref}/list/` |
| マンション | `/mansion/shinchiku/{pref}/list/` | `/mansion/chuko/{pref}/list/` |
| 土地 | — | `/tochi/{pref}/list/` |

Sidebar **物件種別** can switch buy type on the same list (新築/中古マンション・一戸建て・土地・店舗…).

---

## 1. 一戸建て (`kodate`) — detached house

### A. Core filter fields — matches「検索条件を変更する」(中古一戸建て)

Order below = mobile/condition sheet (user screenshot). Desktop list sidebar same fields + a few extras.

| # | Field (as labeled) | Control | Options / notes |
|---|-------------------|---------|-----------------|
| 1 | 物件種別 | pill + 変更 | e.g. 売買：中古一戸建て |
| 2 | 価格 | min–max selects | 下限なし … 上限なし |
| 3 | 建物面積 | min–max selects | |
| 4 | 土地面積 | min–max selects | |
| 5 | 間取り | 13 checkboxes | ワンルーム, 1K, 1DK, 1LDK, 2K, 2DK, 2LDK, 3K, 3DK, 3LDK, 4K, 4DK, 4LDK以上 |
| 6 | 駅徒歩分 | select + checkbox | 指定なし…; **バス乗車時間含む** |
| 7 | 築年数 | select | 指定なし… |
| 8 | リフォーム・リノベーション済 | checkboxes | **全面（水回り＋内装）** (詳細を見る), **水回りまたは内装** |
| 9 | 人気のこだわり条件 | 5 checkboxes + expand | 駐車場あり, 南向き, 追焚機能, 浴室乾燥機, システムキッチン → **すべてのこだわり条件を見る** (full modal, §B) |
| 10 | 画像 | checkboxes | 間取り図あり, 画像あり, パノラマあり |
| 11 | 情報の公開日 | select | 指定なし… |
| 12 | キーワードで絞り込む | text + 検索 | freeword |

**Desktop list extras** (not always on this sheet): 月々支払額, 通勤・通学駅までの所要時間, keyword match mode (すべて含む/いずれか/除外), plus finer remodel ticks (全面 / 水回り / 内装 separate).

**New-build extras:** 未定除く, 売主・代理, 土地を含まない; remodel/monthly often differ.

### B. こだわり modal (102 options, 9 groups)

#### 位置 (11)
低層住宅地, 角地, 南向き, 南道路, 整形地, 前面道路6m以上, 隣家との間隔が広い, 平坦地, 高台, オーシャンビュー, 眺望が良い

#### キッチン (9)
IHコンロ, コンロ三口以上, システムキッチン, カウンターキッチン, 食器洗い乾燥機, 浄水器・活水器, ガスコンロ, アイランドキッチン, オープンキッチン

#### セキュリティ (2)
TVモニタ付インターホン, セキュリティ充実

#### 設備・サービス (29)
上下水道, 都市ガス, オール電化, 太陽光発電など, 追焚機能, シャワー付洗面化粧台, 温水洗浄便座, 浴室乾燥機, 浴室1.6×2.0m以上, 浴室1.6×1.6m以上, トイレ2ヶ所以上, 節水型トイレ, 床暖房, ウォークインクローゼット, パントリー, 全居室収納, 専用庭, バリアフリー, 10m2以上の庭, 和室, 屋上・ルーフバルコニー, スマートキー, 省エネ給湯器, ワイドバルコニー, 南面バルコニー, ウッドデッキ・テラス, 断熱窓（複層ガラス、内窓等）, 温泉付, 宅配ボックス

#### 物件の状況 (3)
オーナーチェンジを除く, 見学可能, 即入居可

#### その他 (30)
高齢者歓迎, 所有権, ブロードバンド, LDK15帖以上, 二世帯住宅向き, 照明器具付き, 全室2面採光, 全室フローリング, 駐車場2台以上, 駐車場3台以上, 駐車場あり, EV充電設備, ハイルーフ駐車場, デザイナーズ, 外断熱, 別荘向け, 古民家風, ログハウス, 平屋, 2階建て, 3階建て以上, 免震構造, 耐震構造（新耐震基準適合）, 制震構造, 鉄筋系, 鉄骨系, 木造, 複数路線, 最寄り駅が始発駅, バス停3分以内

#### 評価・証明書 (10)
長期優良住宅, 設計住宅性能評価書, フラット35・S適合証明書, 建設住宅性能評価書（新築時）, 低炭素住宅, インスペクション（建物検査）報告書, 新築時・増改築時の設計図書, 省エネ性能ラベルあり, LIFULL HOME'S 認定物件, LIFULL HOME'S 住宅評価

#### オンライン対応 (1)
オンライン相談可

#### 周辺環境 (7)
スーパー 800ｍ以内, コンビニ 400ｍ以内, 小学校 800ｍ以内, 総合病院 800ｍ以内, 公園 400ｍ以内, 中学校 800m以内, 商店街 800m以内

**Kodate-leaning:** 建物面積+土地面積, 平屋/階数, 木造等構造, 庭・角地・南道路, 複数台駐車, EV充電.

Raw: `docs/kodate-kodawari-modal.json`, `docs/kodate-chuko-tokyo-filters.json`

---

## 2. マンション (`mansion`) — apartment

### A. Core filter fields (sidebar)

| # | Field | Type | Param / notes |
|---|-------|------|----------------|
| 1 | 選択中の地域 / 路線・駅 | location | |
| 2 | 物件種別 | multi checkbox | |
| 3 | 月々支払額 | range select | used; + **管理費・修繕積立金を含む** |
| 4 | 価格 | range select | `moneyroom` / `moneyroomh` |
| 5 | 専有面積 | range select | `housearea` / `houseareah` (not 建物面積) |
| 6 | バルコニー面積20m²以上 | checkbox | used |
| 7 | 間取り | checkboxes | same 13 as kodate |
| 8 | 駅徒歩分 | select | + バス乗車時間含む |
| 9 | 通勤・通学駅までの所要時間 | tool | |
| 10 | 築年数 | select | used; new → 築1年未満のみ |
| 11 | リフォーム・リノベーション済 | checkboxes | used (4 options) |
| 12 | 人気のこだわり条件 | checkboxes | e.g. 2階以上, 駐車場, 南向き, オートロック, 追焚 |
| 13 | 画像 | checkboxes | 間取り図 / 画像 / パノラマ |
| 14 | 情報の公開日 | select | used |
| 15 | キーワード | text + match mode | |

**New-build extras:** 未定除く; thinner age/media. **No 土地面積.**

### B. こだわり modal (111 options, 10 groups)

#### 位置 (8)
低層住宅地, 1階の物件, 2階以上, 最上階, 角部屋, 南向き, オーシャンビュー, 眺望が良い

#### キッチン (10)
IHコンロ, コンロ三口以上, システムキッチン, カウンターキッチン, 食器洗い乾燥機, ディスポーザー, 浄水器・活水器, ガスコンロ, アイランドキッチン, オープンキッチン

#### セキュリティ (6)
オートロック, 防犯カメラ, 24時間セキュリティ, TVモニタ付インターホン, セキュリティ充実, 管理人常駐

#### 設備・サービス (30)
オール電化, 太陽光発電など, 追焚機能, シャワー付洗面化粧台, 温水洗浄便座, 浴室乾燥機, 浴室1.6×2.0m以上, 浴室1.6×1.6m以上, 節水型トイレ, 床暖房, トランクルーム, ウォークインクローゼット, パントリー, 全居室収納, メゾネット, 専用庭, バリアフリー, ルーフバルコニー, 和室, スマートキー, 省エネ給湯器, ワイドバルコニー, 南面バルコニー, 断熱窓（複層ガラス、内窓等）, 温泉付, エレベーター, ごみ出し24時間OK, フロントサービス, キッズルーム, 宅配ボックス

#### 物件規模 (4)
大規模マンション, タワーマンション, 低層マンション, 総戸数・総区画数30以上

#### 物件の状況 (3)
オーナーチェンジを除く, 見学可能, 即入居可

#### その他 (35)
楽器相談可, 高齢者歓迎, ペット相談可, 大型犬相談可, 中型犬相談可, 小型犬相談可, 猫相談可, 多頭飼い相談可, 所有権, CATV, CS対応, BS対応, ブロードバンド, LDK15帖以上, 二世帯住宅向き, 照明器具付き, 全室フローリング, 駐車場あり, バイク置き場あり, 駐輪場あり, 自走式立体駐車場, 平面駐車場, ハイルーフ駐車場, デザイナーズ, 外断熱, 別荘向け, 免震構造, 耐震構造（新耐震基準適合）, 制震構造, 鉄筋系, 鉄骨系, リゾートマンション, 複数路線, 最寄り駅が始発駅, バス停3分以内

#### 評価・証明書 (7)
長期優良住宅, フラット35・S適合証明書, インスペクション（建物検査）報告書, 新築時・増改築時の設計図書, マンション管理評価書付き, LIFULL HOME'S 認定物件, LIFULL HOME'S 住宅評価

#### オンライン対応 (1)
オンライン相談可

#### 周辺環境 (7)
スーパー 800ｍ以内, コンビニ 400ｍ以内, 小学校 800ｍ以内, 総合病院 800ｍ以内, 公園 400ｍ以内, 中学校 800m以内, 商店街 800m以内

**Mansion-leaning:** 専有面積, 管理費込み, バルコニー面積, 階・角部屋・最上階, オートロック/EV/管理人, ペット系, タワー/大規模, 管理評価書.

Raw: `docs/mansion-kodawari-modal.json`, `docs/mansion-chuko-tokyo-filters.json`

---

## 3. 土地 (`tochi`) — land

### A. Core filter fields (sidebar)

| # | Field | Type | Param / notes |
|---|-------|------|----------------|
| 1 | 選択中の地域 / 路線・駅 | location | |
| 2 | 物件種別 | multi checkbox | |
| 3 | 価格 | range select | `moneyroom` / `moneyroomh` |
| 4 | 土地面積 | range select | `landarea` / `landareah` |
| 5 | 駅徒歩分 | select | + バス乗車時間含む |
| 6 | 通勤・通学駅までの所要時間 | tool | |
| 7 | 建築条件 | checkboxes | **建築条件付土地** / **建築条件なし土地** |
| 8 | 人気のこだわり条件 | checkboxes | 都市ガス, 所有権, 角地, 低層住宅地, 南道路 |
| 9 | 画像 | checkboxes | **外観画像あり**, 画像あり, パノラマあり |
| 10 | 情報の公開日 | select | `newdate` |
| 11 | キーワード | text + match mode | |

**No:** 月々支払額, 建物/専有面積, 間取り, 築年数, リフォーム.

### B. こだわり modal (25 options, 8 groups)

#### 位置 (7)
低層住宅地, 角地, 南道路, 整形地, 前面道路6m以上, 平坦地, 高台

#### 設備・サービス (2)
上下水道, 都市ガス

#### 物件規模 (1)
総戸数・総区画数30以上

#### 物件の状況 (2)
見学可能, 販売予定

#### その他 (5)
所有権, 自由設計対応, 更地, 古家あり, 複数路線

#### 評価・証明書 (1)
地盤調査済

#### オンライン対応 (1)
オンライン相談可

#### 周辺環境 (6)
スーパー 800ｍ以内, コンビニ 400ｍ以内, 小学校 800ｍ以内, 総合病院 800ｍ以内, 公園 400ｍ以内, 中学校 800m以内

**Land-leaning:** 建築条件付/なし, 更地/古家あり, 自由設計, 地盤調査済, 整形地・接道・高低.

Raw: `docs/tochi-kodawari-modal.json`, `docs/tochi-tokyo-filters.json`

---

## Totals (used Tokyo, modal + core)

| | Core sidebar fields | こだわり modal options | Modal groups |
|--|:-------------------:|:---------------------:|:------------:|
| 一戸建て | ~15 | **102** | 9 |
| マンション | ~15 | **111** | 10 |
| 土地 | ~11 | **25** | 8 |

---

## Cross-category (core fields only)

| Field | 一戸建て | マンション | 土地 |
|-------|:--------:|:----------:|:----:|
| 価格 | ✓ | ✓ | ✓ |
| 月々支払額 | ✓ used | ✓ used | — |
| 建物面積 | ✓ | — | — |
| 専有面積 | — | ✓ | — |
| 土地面積 | ✓ | — | ✓ |
| 間取り | ✓ | ✓ | — |
| 築年数 | ✓ | ✓ | — |
| 駅徒歩 / 通勤 | ✓ | ✓ | ✓ |
| リフォーム済 | ✓ used | ✓ used | — |
| 建築条件 | — | — | ✓ |
| 画像 / 公開日 / KW | ✓ | ✓ | ✓ |
| こだわり modal | ✓ | ✓ | ✓ |

---

## Scraping note

CloudFront blocks default Playwright UA. Use Chrome channel + real desktop UA + `ja-JP` locale (see prior session `/tmp/homes-pw-config.json`).
