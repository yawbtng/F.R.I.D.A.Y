import type { Stagehand } from "@browserbasehq/stagehand";

export async function compressScreenshot(stagehand: Stagehand): Promise<string> {
  const page = stagehand.context.activePage();
  if (!page) throw new Error("No active page");
  const buffer = await page.screenshot({
    type: "jpeg",
    quality: 60,
    clip: { x: 0, y: 0, width: 1280, height: 800 },
  });
  return buffer.toString("base64");
}
