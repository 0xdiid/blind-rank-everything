import test from "node:test";
import assert from "node:assert/strict";
import {
  canShareImage,
  copyRankingImage,
  createRankingImage,
  imageShareData,
  rankingAltText,
  wrapText,
} from "../src/lib/share.js";

test("sharing copies the PNG without substituting a text ranking", async () => {
  const image = { blob: new Blob(["png"], { type: "image/png" }) };
  class Item {
    constructor(data) {
      this.data = data;
    }
  }
  const writes = [];
  await copyRankingImage(
    image,
    { clipboard: { write: async (items) => writes.push(items) } },
    Item,
  );
  assert.equal(writes.length, 1);
  assert.deepEqual(Object.keys(writes[0][0].data), ["image/png"]);
  assert.equal(writes[0][0].data["image/png"], image.blob);
  await assert.rejects(copyRankingImage(image, {}, Item), /unavailable/);
  await assert.rejects(
    copyRankingImage(
      image,
      {
        clipboard: {
          write: async () => {
            throw new Error("Permission denied");
          },
        },
      },
      Item,
    ),
    /Permission denied/,
  );
});

test("native sharing carries the image and the canonical game URL", () => {
  const file = new File(["png"], "blindrank.png", { type: "image/png" });
  const data = imageShareData(file);
  assert.equal(data.files[0], file);
  assert.ok(
    data.text.includes("https://0xdiid.github.io/blind-rank-everything/"),
  );
  assert.equal(data.title, "My blind ranking");
  assert.match(
    imageShareData(file, 30).text,
    /30 Wikipedia articles \(Expert mode\)/,
  );
});

test("both result images contain every rank in reading order, even when thumbnails fail", async (t) => {
  // Exercise the canvas renderer without relying on Wikimedia or a browser.
  const previous = { Image: globalThis.Image, document: globalThis.document };
  t.after(() => Object.assign(globalThis, previous));
  globalThis.Image = class {
    set src(_) {
      queueMicrotask(() => this.onerror?.());
    }
  };
  for (const count of [10, 30]) {
    const drawn = [];
    const context = {
      fillRect() {},
      strokeRect() {},
      measureText: (text) => ({ width: text.length * 15 }),
      fillText: (text, x, y) => drawn.push({ text, x, y }),
    };
    const canvas = {
      getContext: () => context,
      toBlob: (callback) => callback(new Blob(["png"], { type: "image/png" })),
    };
    globalThis.document = { createElement: () => canvas };
    const articles = Array.from({ length: count }, (_, i) => ({
      title: `Article ${i + 1}`,
      image: "unavailable",
    }));
    const result = await createRankingImage(articles);
    assert.equal(result.width / result.height, 16 / 9);
    assert.equal(result.width, count === 30 ? 2400 : 1600);
    assert.equal(result.missingImages, count);
    assert.deepEqual(
      drawn
        .filter(({ text }) => /^Article \d+$/.test(text))
        .map(({ text }) => text),
      articles.map((a) => a.title),
    );
    assert.deepEqual(
      drawn
        .filter(({ text }) => /^\d+$/.test(text))
        .map(({ text }) => Number(text)),
      Array.from({ length: count }, (_, i) => i + 1),
    );
    assert.ok(
      drawn.every(
        ({ x, y }) =>
          x >= 0 && x <= canvas.width && y >= 0 && y < canvas.height,
      ),
    );
    assert.ok(drawn.some(({ text }) => text === `${count} of ${count} ranked`));
    if (count === 30)
      assert.ok(drawn.some(({ text }) => text.includes("Expert mode")));
  }
  await assert.rejects(
    createRankingImage(Array(30).fill(null)),
    /Complete all ranks/,
  );
});

test("file sharing requires both share support and acceptance of this PNG", () => {
  const file = new File(["png"], "ranking.png", { type: "image/png" });
  assert.equal(canShareImage(file, {}), false);
  assert.equal(
    canShareImage(file, { share() {}, canShare: () => false }),
    false,
  );
  assert.equal(
    canShareImage(file, {
      share() {},
      canShare: () => {
        throw new Error("Blocked");
      },
    }),
    false,
  );
  assert.equal(
    canShareImage(file, {
      share() {},
      canShare: ({ files }) => files[0] === file,
    }),
    true,
  );
});

test("image text wraps long titles and unbroken words without losing characters", () => {
  const context = {
    measureText: (text) => ({ width: Array.from(text).length * 10 }),
  };
  const title = "Figure skating at the 2026 Winter Olympics – Women's singles";
  const lines = wrapText(context, title, 200);
  assert.equal(lines.join(" "), title);
  assert.ok(lines.every((line) => context.measureText(line).width <= 200));
  const unbroken = "Supercalifragilisticexpialidocious";
  const split = wrapText(context, unbroken, 100);
  assert.equal(split.join(""), unbroken);
  assert.ok(split.every((line) => context.measureText(line).width <= 100));
});

test("accessible ranking preserves the exact order and incomplete rounds cannot export", async () => {
  const articles = [{ title: "Ramen" }, { title: "The Renaissance" }];
  assert.match(rankingAltText(articles), /1\. Ramen; 2\. The Renaissance/);
  await assert.rejects(createRankingImage(articles), /Complete all ranks/);
  await assert.rejects(
    createRankingImage(Array(10).fill(null)),
    /Complete all ranks/,
  );
});
