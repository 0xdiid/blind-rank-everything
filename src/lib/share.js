export const SHARE_FILENAME = "blindrank.png";
export const GAME_URL =
  import.meta.env?.VITE_PUBLIC_URL ||
  "https://0xdiid.github.io/blind-rank-everything/";
export const SHARE_WIDTH = 1600;
export const SHARE_HEIGHT = 900;

export function imageShareData(file, count = 10) {
  return {
    files: [file],
    title: "My blind ranking",
    text: `My blind ranking of ${count} Wikipedia articles${count === 30 ? " (Expert mode)" : ""}. ${GAME_URL}`,
  };
}

export async function copyRankingImage(
  image,
  browser = navigator,
  Item = globalThis.ClipboardItem,
) {
  if (!browser.clipboard?.write || typeof Item !== "function")
    throw new Error("Image copying is unavailable.");
  await browser.clipboard.write([new Item({ "image/png": image.blob })]);
}

export function rankingAltText(articles) {
  return `My blind ranking, from best to worst: ${articles.map((article, index) => `${index + 1}. ${article.title}`).join("; ")}.`;
}

export function canShareImage(file, browser = navigator) {
  try {
    return Boolean(browser.share && browser.canShare?.({ files: [file] }));
  } catch {
    return false;
  }
}

function loadImage(src) {
  return new Promise((resolve) => {
    const image = new Image();
    const finish = (value) => {
      clearTimeout(timeout);
      image.onload = image.onerror = null;
      resolve(value);
    };
    const timeout = setTimeout(() => finish(null), 6000);
    image.crossOrigin = "anonymous";
    image.onload = () => finish(image);
    image.onerror = () => finish(null);
    image.src = src;
  });
}

// Wrap by measured pixels, including titles with a long unbroken word.
export function wrapText(context, text, width) {
  const lines = [];
  let line = "";
  for (const word of text.trim().split(/\s+/)) {
    const candidate = line ? `${line} ${word}` : word;
    if (context.measureText(candidate).width <= width) {
      line = candidate;
      continue;
    }
    if (line) lines.push(line);
    line = "";
    for (const character of word) {
      if (line && context.measureText(line + character).width > width) {
        lines.push(line);
        line = "";
      }
      line += character;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function drawTitle(context, title, x, centerY, width) {
  let size = 30;
  let lines;
  do {
    context.font = `${size}px Arial, sans-serif`;
    lines = wrapText(context, title, width);
    if (lines.length <= 3 || size === 20) break;
    size -= 2;
  } while (size >= 20);
  if (lines.length > 3) {
    lines = lines.slice(0, 3);
    while (context.measureText(lines[2] + "…").width > width)
      lines[2] = lines[2].slice(0, -1);
    lines[2] += "…";
  }
  const lineHeight = size + 4;
  const firstY = centerY - ((lines.length - 1) * lineHeight) / 2;
  context.fillStyle = "#36c";
  lines.forEach((line, index) =>
    context.fillText(line, x, firstY + index * lineHeight),
  );
}

export async function createRankingImage(articles) {
  if (
    ![10, 30].includes(articles.length) ||
    articles.some((article) => !article?.title)
  )
    throw new Error("Complete all ranks before sharing.");
  const expert = articles.length === 30;
  const columns = expert ? 3 : 2;
  const rows = articles.length / columns;
  const rowHeight = expert ? 100 : 112;
  const imageSize = expert ? 64 : 72;
  const images = await Promise.all(
    articles.map((article) => loadImage(article.image)),
  );
  const canvas = document.createElement("canvas");
  canvas.width = expert ? 2400 : SHARE_WIDTH;
  canvas.height = expert ? 1350 : SHARE_HEIGHT;
  const columnWidth = (canvas.width - 96) / columns;
  const tableBottom = 190 + rows * rowHeight;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Your browser could not create the image.");
  context.fillStyle = "#fff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = "#202122";
  context.font = "48px Georgia, serif";
  context.fillText("Blind rank everything", 48, 86);
  context.font = "28px Arial, sans-serif";
  context.fillText(
    expert ? "Expert mode · Your ranking" : "Your ranking",
    48,
    151,
  );
  context.fillStyle = "#54595d";
  context.textAlign = "right";
  context.fillText(`1 best · ${articles.length} worst`, canvas.width - 48, 151);
  context.textAlign = "left";
  context.textBaseline = "middle";

  articles.forEach((article, index) => {
    const left = 48 + Math.floor(index / rows) * columnWidth;
    const top = 190 + (index % rows) * rowHeight;
    const centerY = top + rowHeight / 2;
    const imageTop = top + (rowHeight - imageSize) / 2;
    context.fillStyle = "#f8f9fa";
    context.fillRect(left, top, columnWidth, rowHeight);
    context.strokeStyle = "#c8ccd1";
    context.lineWidth = 2;
    context.strokeRect(left, top, columnWidth, rowHeight);
    context.fillStyle = "#c8ccd1";
    context.fillRect(left + 70, top, 2, rowHeight);
    context.fillStyle = "#54595d";
    context.font = "28px Arial, sans-serif";
    context.textAlign = "center";
    context.fillText(String(index + 1), left + 35, centerY);
    context.textAlign = "left";
    const image = images[index];
    context.fillStyle = "#eaecf0";
    context.fillRect(left + 90, imageTop, imageSize, imageSize);
    if (image) {
      const ratio = Math.min(
        imageSize / image.naturalWidth,
        imageSize / image.naturalHeight,
      );
      const width = image.naturalWidth * ratio;
      const height = image.naturalHeight * ratio;
      context.drawImage(
        image,
        left + 90 + (imageSize - width) / 2,
        imageTop + (imageSize - height) / 2,
        width,
        height,
      );
    } else {
      context.fillStyle = "#72777d";
      context.textAlign = "center";
      context.font = "30px Georgia, serif";
      context.fillText(article.title[0], left + 90 + imageSize / 2, centerY);
      context.textAlign = "left";
    }
    drawTitle(context, article.title, left + 182, centerY, columnWidth - 206);
  });
  context.strokeStyle = "#a2a9b1";
  context.strokeRect(48, 190, canvas.width - 96, rows * rowHeight);
  context.fillStyle = "#54595d";
  context.font = "24px Arial, sans-serif";
  context.textAlign = "right";
  context.fillText(
    `${articles.length} of ${articles.length} ranked`,
    canvas.width - 48,
    tableBottom + 46,
  );
  context.textAlign = "left";
  context.fillStyle = "#36c";
  context.fillText(GAME_URL.replace(/^https:\/\//, ""), 48, tableBottom + 46);
  context.fillStyle = "#54595d";
  context.font = "20px Arial, sans-serif";
  context.fillText("Articles from Wikipedia", 48, tableBottom + 99);
  const blob = await new Promise((resolve, reject) =>
    canvas.toBlob(
      (value) =>
        value
          ? resolve(value)
          : reject(new Error("The image could not be created.")),
      "image/png",
    ),
  );
  return {
    blob,
    width: canvas.width,
    height: canvas.height,
    file: new File([blob], SHARE_FILENAME, { type: "image/png" }),
    missingImages: images.filter((image) => !image).length,
  };
}
