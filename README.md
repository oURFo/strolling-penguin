# 散步企鵝

用 WASD、方向鍵或拖曳雪地移動。靠近落單企鵝或海豹一秒即可招募。隊友需要幫助時，回到牠附近，按空白鍵、E 或右下角的喇叭呼喚。第一次移動或呼喚時會啟動背景音樂與雪地腳步聲。右上角可切換音樂和音效，也可開啟玩法說明。

## 本機執行

需要 Node.js 24 與支援 WebGL 2 的瀏覽器。

```sh
npm ci
npm run dev
```

開啟終端機印出的網址。進度會定期自動儲存，切換分頁或離開前也會儲存。用同一瀏覽器開啟同一網址，即可接續上次的位置、隊伍、附近動物和還未消失的腳印。北極的總夥伴數量會合計目前隊伍與雪屋住戶。

## GitHub Pages

將這個資料夾作為名為 strolling-penguin 的 GitHub 儲存庫根目錄。在該儲存庫的 Settings → Pages，將 Source 設成 GitHub Actions，再推送 main 分支。網站的基底路徑為 /strolling-penguin/。本機可用 npm run build 產生 dist。

## 素材來源

雪地和羽色、冰山、冰晶與雪堆使用內建 ImageGen 生成，裁切並壓縮為 public/textures 內的 WebP。雪面法線與粗糙度由雪地原圖派生。企鵝表情、腳印、雪粉、聲波和介面圖示由程式繪製，音效由 Web Audio 合成。

### ImageGen 提示詞

- Square 2 by 2 production texture atlas for an original cozy 3D penguin snow game. Four equal square texture swatches touching, hard quadrant boundaries, no margins or text. Upper left: nearly white fine powdered snow from directly overhead, extremely subtle granules, flat illumination and no identifiable objects, tileable in spirit. Upper right: even charcoal navy fine adult penguin feather down material. Bottom left: pale warm gray fluffy chick down, evenly lit. Bottom right: powder blue watercolor snow grains. Subtle hand-painted gouache, no objects, no gradients across tiles.
- Square transparent game sprite sheet, three objects on genuine transparent background, in a clear horizontal row with generous empty space between and around all objects. Left third: a wide pale blue distant Antarctic iceberg silhouette with several asymmetric peaks. Middle third: a compact cluster of three translucent blue pointed ice crystals. Right third: low rounded soft white wind-blown snow mound with pale blue shade. Each object fully isolated, no text, no frame, no drop shadow on transparent background, baseline about halfway down the square. Cozy pastel gouache children's-book game props, in soft winter light.

## 信箱排程

使用 `npm run mail:add -- <letter.json>` 新增信件。JSON 格式如下。請為每封信使用唯一 ID，並在觸發時間加上時區。

```json
{
  "id": "winter-gift-001",
  "triggerAt": "2027-01-01T09:00:00+08:00",
  "title": "雪地來信",
  "body": "送你一些企鵝金幣。",
  "reward": { "kind": "penguin-coins", "amount": 25 }
}
```

可加上帶時區的 `expiresAt` 來設定停止領取的時間。新增信件時，指令會把已到領取期限的舊信從 `src/mail-schedule.json` 移到 `mail-archive.json`。沒有設定期限的舊信則在已達觸發時間時封存。遊戲只讀取現行排程，領取紀錄與金幣一起保存在瀏覽器。
