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
  await assert.rejects(createRankingImage(articles), /Complete all ten/);
  await assert.rejects(
    createRankingImage(Array(10).fill(null)),
    /Complete all ten/,
  );
});
