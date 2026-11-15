// Renders scripts/sample-pdf.html to public/samples/sample-resume-fictional.pdf (fictional person).
const path = require("node:path");
const { chromium } = require("playwright-core");
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage();
  await p.goto("file://" + path.resolve(__dirname, "sample-pdf.html"));
  await p.pdf({ path: path.resolve(__dirname, "../public/samples/sample-resume-fictional.pdf"), format: "Letter" });
  await b.close();
})();
