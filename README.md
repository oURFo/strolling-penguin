# 散步企鵝

用 WASD、方向鍵或拖曳雪地移動。靠近落單企鵝一秒即可招募。隊友需要幫助時，回到牠附近，按空白鍵、E 或右下角的喇叭呼喚。第一次移動或呼喚時會啟動背景音樂與雪地腳步聲。右上角可切換音樂和音效，也可開啟玩法說明。

## 本機執行

需要 Node.js 24 與支援 WebGL 2 的瀏覽器。

```sh
npm ci
npm run dev
```

開啟終端機印出的網址。隊伍最高紀錄會留在該瀏覽器。

## GitHub Pages

將這個資料夾作為名為 strolling-penguin 的 GitHub 儲存庫根目錄。在該儲存庫的 Settings → Pages，將 Source 設成 GitHub Actions，再推送 main 分支。網站的基底路徑為 /strolling-penguin/。本機可用 npm run build 產生 dist。

## 素材來源

雪地和羽色、冰山、冰晶與雪堆使用內建 ImageGen 生成，裁切並壓縮為 public/textures 內的 WebP。雪面法線與粗糙度由雪地原圖派生。企鵝表情、腳印、雪粉、聲波和介面圖示由程式繪製，音效由 Web Audio 合成。

### ImageGen 提示詞

- Square 2 by 2 production texture atlas for an original cozy 3D penguin snow game. Four equal square texture swatches touching, hard quadrant boundaries, no margins or text. Upper left: nearly white fine powdered snow from directly overhead, extremely subtle granules, flat illumination and no identifiable objects, tileable in spirit. Upper right: even charcoal navy fine adult penguin feather down material. Bottom left: pale warm gray fluffy chick down, evenly lit. Bottom right: powder blue watercolor snow grains. Subtle hand-painted gouache, no objects, no gradients across tiles.
- Square transparent game sprite sheet, three objects on genuine transparent background, in a clear horizontal row with generous empty space between and around all objects. Left third: a wide pale blue distant Antarctic iceberg silhouette with several asymmetric peaks. Middle third: a compact cluster of three translucent blue pointed ice crystals. Right third: low rounded soft white wind-blown snow mound with pale blue shade. Each object fully isolated, no text, no frame, no drop shadow on transparent background, baseline about halfway down the square. Cozy pastel gouache children's-book game props, in soft winter light.
