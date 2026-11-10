// ==================== Localized content regression guards ====================
// These exist because of a real report: the interface switched to বাংলা but the
// Anti-D page kept rendering its English article, tables and dose cards, and
// apostrophes showed up as the literal text "&#39;".
//
// Guards in here:
//   1. every bundled reference string carries en / bn / ar
//   2. the localizer picks the right locale, falls back, and decodes entities
//   3. English content arriving from the API/CMS is translated by source match
//   4. the rendered /antid page in bn and ar contains NO English article text
//   5. no double-escaped HTML entities anywhere in the rendered HTML
//   6. the navbar shows the logo only — no duplicate "BloodOra" wordmark
//   7. switching language changes the page on the very next request
import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "module";

const require = createRequire(import.meta.url);

// No backend: the page must still render its complete built-in reference.
process.env.PORT ||= "4597";
process.env.SESSION_SECRET ||= "test-secret";
process.env.TURSO_DATABASE_URL ||= "file:/tmp/bloodora-unit-i18n.db";
process.env.JWT_SECRET ||= "unit-test-secret-not-for-production";

const { antidReference, compatibilityReference, resourcesReference } = await import("../../src/web/utils/content.js");
const localize = await import("../../src/web/utils/localize.js");
const i18n = await import("../../src/web/i18n.js");
const { default: createApp } = await import("../../src/app.ts");
const app = createApp();

function request(server, urlPath, headers = {}) {
  return new Promise((resolve, reject) => {
    const req = require("http").request(
      { host: "127.0.0.1", port: server.address().port, method: "GET", path: urlPath, headers },
      (res) => {
        let data = "";
        res.on("data", (c) => (data += c));
        res.on("end", () => resolve({ status: res.statusCode, headers: res.headers, body: data }));
      }
    );
    req.on("error", reject);
    req.end();
  });
}

/** Everything a visitor can actually read: no markup, scripts, styles or comments. */
function visibleText(html) {
  return decode(html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<[^>]+>/g, " "));
}

function decode(s) {
  return s
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

// ---------------------------------------------------------------------------
// 1. Bundled reference content is fully trilingual
// ---------------------------------------------------------------------------
test("every bundled reference string has English, Bangla and Arabic", () => {
  const incomplete = [];
  let records = 0;
  const visit = (node, path) => {
    if (Array.isArray(node)) return node.forEach((v, i) => visit(v, `${path}[${i}]`));
    if (!node || typeof node !== "object") return;
    if (localize.isLocalized(node)) {
      records += 1;
      for (const code of ["en", "bn", "ar"]) {
        if (typeof node[code] !== "string" || !node[code].trim()) incomplete.push(`${path}.${code}`);
      }
      return;
    }
    for (const [k, v] of Object.entries(node)) visit(v, path ? `${path}.${k}` : k);
  };
  visit(antidReference, "antid");
  visit(compatibilityReference, "compatibility");
  visit(resourcesReference, "resources");

  assert.ok(records > 150, `expected a substantial set of translation records, found ${records}`);
  assert.deepEqual(incomplete, [], `records missing a locale: ${incomplete.join(", ")}`);
});

// ---------------------------------------------------------------------------
// 2. The localizer itself
// ---------------------------------------------------------------------------
test("localizeReference resolves every field to the requested locale", () => {
  const bn = localize.localizeReference(null, antidReference, "bn");
  assert.equal(bn.whatItIs[0].title, antidReference.whatItIs[0].title.bn);
  assert.equal(bn.indications[0].who, antidReference.indications[0].who.bn);
  assert.equal(bn.dosing[0].scenario, antidReference.dosing[0].scenario.bn);
  assert.equal(bn.safety.storage[0], antidReference.safety.storage[0].bn);
  assert.equal(bn.faq[0].a, antidReference.faq[0].a.bn);

  const ar = localize.localizeReference(null, antidReference, "ar");
  assert.equal(ar.whatItIs[0].title, antidReference.whatItIs[0].title.ar);
});

test("units and medical abbreviations are never mangled by localization", () => {
  const bn = localize.localizeReference(null, antidReference, "bn");
  assert.equal(bn.dosing[0].dose, "1500 IU (300 mcg) IM", "dose strings stay exact");
  assert.equal(bn.dosing[4].dose, "300 mcg (1500 IU)");
});

test("the compatibility matrix data stays machine-readable after localization", () => {
  const bn = localize.localizeReference(null, compatibilityReference, "bn");
  const abPlus = bn.rbc.find((r) => r.group === "AB+");
  assert.deepEqual(
    abPlus.donatesTo.split(",").map((s) => s.trim()),
    ["AB+"],
    "donatesTo must stay a plain group list or the donor→recipient matrix breaks"
  );
  for (const row of bn.rbc) {
    assert.match(row.group, /^[ABO]{1,2}[−+]$/, `group symbol changed: ${row.group}`);
  }
});

test("localizeReference falls back to English and never exposes a raw record", () => {
  const partial = { summary: { en: "Only English here" }, whatItIs: [{ title: "T", body: "B" }] };
  const out = localize.localizeReference(partial, antidReference, "bn");
  assert.equal(out.summary, "Only English here", "English fallback, not the key");
  assert.equal(typeof out.whatItIs[0].title, "string");
  assert.ok(!out.whatItIs[0].title.includes("[object"), "no leaked record");
});

test("decodeEntities repairs pre-escaped CMS text without emitting markup", () => {
  assert.equal(localize.decodeEntities("the mother&#39;s blood"), "the mother's blood");
  assert.equal(localize.decodeEntities("Cord blood group &amp; DAT"), "Cord blood group & DAT");
  assert.equal(localize.decodeEntities("FMH &lt; 4 mL"), "FMH < 4 mL");
  assert.equal(localize.decodeEntities("5&nbsp;mg"), "5 mg");
  assert.equal(localize.decodeEntities(null), "");
  // "&#39;" typed as a literal (already escaped once) must survive as text
  assert.equal(localize.decodeEntities("&amp;#39;"), "&#39;");
});

// ---------------------------------------------------------------------------
// 3. ROOT CAUSE — English content served by the API/CMS must still be translated
// ---------------------------------------------------------------------------
test("English reference content arriving from the API renders in the active locale", () => {
  // This is exactly what the backend used to send: the bundled English strings.
  const englishPayload = JSON.parse(JSON.stringify(antidReference));
  const flatten = (node) => {
    if (Array.isArray(node)) return node.map(flatten);
    if (node && typeof node === "object" && !localize.isLocalized(node)) {
      return Object.fromEntries(Object.entries(node).map(([k, v]) => [k, flatten(v)]));
    }
    return localize.isLocalized(node) ? node.en : node;
  };

  const bn = localize.localizeReference(flatten(englishPayload), antidReference, "bn");
  assert.equal(bn.whatItIs[0].title, "অ্যান্টি-ডি আসলে কী");
  assert.notEqual(bn.whatItIs[1].body, englishPayload.whatItIs[1].body.en);
  assert.ok(!bn.whatItIs[1].body.includes("About 15% of people are RhD-negative"));

  const ar = localize.localizeReference(flatten(englishPayload), antidReference, "ar");
  assert.equal(ar.whatItIs[2].title, "ما الذي يسببه التحسّس");
});

test("localized objects sent by the CMS are honoured directly", () => {
  const cms = {
    summary: { en: "CMS EN", bn: "সিএমএস বাংলা", ar: "CMS AR" },
    whatItIs: [{ title: { en: "E", bn: "বি", ar: "ع" }, body: "plain english body" }],
  };
  const out = localize.localizeReference(cms, antidReference, "bn");
  assert.equal(out.summary, "সিএমএস বাংলা");
  assert.equal(out.whatItIs[0].title, "বি");
});

test("unknown CMS text is kept as authored instead of crashing", () => {
  const out = localize.localizeReference(
    { summary: "A brand new paragraph nobody translated", whatItIs: [] },
    antidReference,
    "bn"
  );
  assert.equal(out.summary, "A brand new paragraph nobody translated");
});

// ---------------------------------------------------------------------------
// 4. The rendered pages
// ---------------------------------------------------------------------------
// The exact English strings from the bug report. After the fix none of them may
// appear on a Bengali or Arabic Anti-D page.
const REPORTED_ENGLISH = [
  "What Anti-D actually is",
  "Why it is needed — the Rh problem",
  "What sensitisation causes",
  "Anti-D Immunoglobulin is purified human IgG anti-RhD",
  "About 15% of people are RhD-negative",
  "Haemolytic Disease of the Fetus and Newborn (HDFN)",
  "Routine antenatal prophylaxis",
  "Every RhD-negative pregnant woman",
  "Antenatal prophylaxis (28 weeks)",
  "Large fetomaternal haemorrhage",
  "First-trimester event",
  "Intramuscular, deltoid or anterolateral thigh",
  "Check maternal blood group, RhD type",
  "Pain, tenderness, redness or a small lump",
  "I already received Anti-D at 28 weeks",
  "Store at 2 °C to 8 °C",
];

const EXPECTED_BN = [
  "অ্যান্টি-ডি আসলে কী",
  "কেন প্রয়োজন — Rh সমস্যা",
  "সংবেদনশীলতার পরিণতি",
  "প্রতিটি Rh-নেগেটিভ গর্ভবতী নারী",
  "প্রসবপূর্ব প্রোফিল্যাক্সিস (২৮ সপ্তাহ)",
  "অধিক ফেটোম্যাটার্নাল রক্তক্ষরণ",
  "প্রথম ত্রৈমাসিকের ঘটনা",
  "ডেল্টয়েড",
  "২° সে. থেকে ৮° সে.",
  "২৮ সপ্তাহে আমি অ্যান্টি-ডি নিয়েছি",
];

const EXPECTED_AR = [
  "ما هو مضاد D في الواقع",
  "لماذا يُحتاج إليه — مشكلة عامل ريسوس",
  "ما الذي يسببه التحسّس",
  "كل امرأة حامل سالبة RhD",
  "الوقاية قبل الولادة (الأسبوع 28)",
  "نزف جنيني أمومي كبير",
  "حدث في الثلث الأول من الحمل",
  "العضلة الدالية",
];

for (const [lang, expected] of [["bn", EXPECTED_BN], ["ar", EXPECTED_AR]]) {
  test(`GET /antid in ${lang} renders the full page in ${lang} and no English article`, async () => {
    const server = app.listen(0);
    try {
      const res = await request(server, "/antid", { cookie: `lang=${lang}` });
      assert.equal(res.status, 200);
      assert.ok(res.body.includes(`lang="${lang}"`));

      const text = visibleText(res.body);
      for (const needle of expected) {
        assert.ok(text.includes(needle), `missing ${lang} text: ${needle}`);
      }
      for (const needle of REPORTED_ENGLISH) {
        assert.ok(!text.includes(needle), `English content still rendered in ${lang}: ${needle}`);
      }
      if (lang === "ar") {
        assert.ok(res.body.includes('dir="rtl"'), "Arabic must flip the document to RTL");
        assert.ok(res.body.includes("bootstrap.rtl.min.css"), "Arabic must load RTL bootstrap");
      }
    } finally { server.close(); }
  });
}

test("GET /antid in English still renders the complete English reference", async () => {
  const server = app.listen(0);
  try {
    const res = await request(server, "/antid", { cookie: "lang=en" });
    assert.equal(res.status, 200);
    const text = visibleText(res.body);
    for (const needle of [
      "What Anti-D actually is",
      "Every RhD-negative pregnant woman",
      "Intramuscular, deltoid or anterolateral thigh",
      "ACOG Practice Bulletin No. 181",
    ]) {
      assert.ok(text.includes(needle), `missing English text: ${needle}`);
    }
  } finally { server.close(); }
});

test("apostrophes render as apostrophes — no double-escaped entities", async () => {
  const server = app.listen(0);
  try {
    for (const lang of ["en", "bn", "ar"]) {
      for (const path of ["/antid", "/compatibility", "/resources", "/"]) {
        const res = await request(server, path, { cookie: `lang=${lang}` });
        assert.equal(res.status, 200, `${path} ${lang}`);
        for (const bad of ["&amp;#39;", "&amp;amp;", "&amp;lt;", "&amp;quot;", "&amp;#"]) {
          assert.ok(!res.body.includes(bad), `${path} in ${lang} double-escaped into ${bad}`);
        }
        // and the decoded text shows real characters
        const text = visibleText(res.body);
        assert.ok(!text.includes("&#39;"), `${path} in ${lang} leaks a literal &#39;`);
        assert.ok(!text.includes("&amp;"), `${path} in ${lang} leaks a literal &amp;`);
      }
    }
    const en = await request(server, "/antid", { cookie: "lang=en" });
    assert.ok(visibleText(en.body).includes("mother's immune system"), "apostrophe must render correctly");
  } finally { server.close(); }
});

test("compatibility and resources pages are localized end to end", async () => {
  const server = app.listen(0);
  try {
    const bnCompat = await request(server, "/compatibility", { cookie: "lang=bn" });
    const text = visibleText(bnCompat.body);
    assert.ok(text.includes("সার্বজনীন লোহিত রক্তকণিকা দাতা"), "RBC role must be Bengali");
    assert.ok(text.includes("প্লেটলেটে ABO অ্যান্টিজেন খুবই দুর্বল থাকে"), "platelet detail must be Bengali");
    assert.ok(!text.includes("Universal red-cell donor"), "English role text must be gone");

    const bnRes = await request(server, "/resources", { cookie: "lang=bn" });
    const rtext = visibleText(bnRes.body);
    assert.ok(rtext.includes("কে রক্ত দিতে পারেন?"), "article titles must be Bengali");
    assert.ok(rtext.includes("দান"), "category labels must be Bengali");
    assert.ok(!rtext.includes("Who can donate blood?"), "English article title must be gone");
    assert.ok(!rtext.includes("min min read"), "read-time must not repeat the unit");

    const arRes = await request(server, "/resources", { cookie: "lang=ar" });
    assert.ok(arRes.body.includes('dir="rtl"'));
    assert.ok(visibleText(arRes.body).includes("من يمكنه التبرّع بالدم؟"));
  } finally { server.close(); }
});

// ---------------------------------------------------------------------------
// 5. Header identity
// ---------------------------------------------------------------------------
test("the navbar shows the logo only — no duplicate BloodOra wordmark", async () => {
  const server = app.listen(0);
  try {
    const res = await request(server, "/");
    assert.equal(res.status, 200);
    const nav = res.body.match(/<nav[\s\S]*?<\/nav>/)[0];
    assert.ok(nav.includes("<img"), "the logo image must still be there");
    assert.ok(nav.includes('alt="BloodOra"'), "the name must remain as the image's alt text");
    assert.ok(!/>\s*BloodOra\s*</.test(nav), "no separate BloodOra text node beside the logo");

    const footer = res.body.match(/<footer[\s\S]*?<\/footer>/)[0];
    assert.ok(!/>\s*BloodOra\s*</.test(footer.split("©")[0]), "footer must not repeat the wordmark next to the logo");
  } finally { server.close(); }
});

// ---------------------------------------------------------------------------
// 6. Live switching + persistence
// ---------------------------------------------------------------------------
test("switching language re-renders the current page immediately, without a restart", async () => {
  const server = app.listen(0);
  try {
    const en = await request(server, "/antid", { cookie: "lang=en" });
    const bn = await request(server, "/antid", { cookie: "lang=bn" });
    const ar = await request(server, "/antid", { cookie: "lang=ar" });
    const enAgain = await request(server, "/antid", { cookie: "lang=en" });

    assert.ok(visibleText(en.body).includes("What Anti-D actually is"));
    assert.ok(visibleText(bn.body).includes("অ্যান্টি-ডি আসলে কী"));
    assert.ok(visibleText(ar.body).includes("ما هو مضاد D في الواقع"));
    assert.ok(visibleText(enAgain.body).includes("What Anti-D actually is"), "switching back must work too");
  } finally { server.close(); }
});

test("the language choice survives a redirect from /set-language and a fresh request", async () => {
  const server = app.listen(0);
  try {
    const set = await request(server, "/set-language/bn?next=/antid");
    assert.equal(set.status, 302);
    const cookie = (set.headers["set-cookie"] || []).find((c) => c.startsWith("lang="));
    assert.ok(cookie, "the lang cookie must be written");

    const page = await request(server, "/antid", { cookie: "lang=bn" });
    assert.ok(page.body.includes('lang="bn"'));
    assert.ok(visibleText(page.body).includes("অ্যান্টি-ডি আসলে কী"), "persisted Bengali must still localize content");
  } finally { server.close(); }
});

// ---------------------------------------------------------------------------
// 7. Dev-time detection of untranslated content
// ---------------------------------------------------------------------------
test("missing translation keys raise a development warning", () => {
  i18n.resetI18nWarnings();
  const out = i18n.translate("bn", "this_key_does_not_exist");
  assert.equal(out, "this_key_does_not_exist", "still renders something rather than crashing");
  assert.ok(
    i18n.i18nWarnings().some((w) => w.includes("this_key_does_not_exist")),
    "the unknown key must be reported in development"
  );
});

test("content that has no translation raises a development warning", () => {
  localize.resetLocalizationWarnings();
  localize.localizeReference({ summary: "Completely untranslated sentence", whatItIs: [] }, antidReference, "bn");
  assert.ok(
    localize.missingTranslations().length > 0,
    "untranslated CMS content must be detectable in development"
  );
});

// ---------------------------------------------------------------------------
// 8. Structural guards so the fix cannot silently regress
// ---------------------------------------------------------------------------
test("no view re-introduces a manual HTML escaper on top of EJS escaping", async () => {
  const { readdirSync, readFileSync } = await import("fs");
  const walk = (dir) =>
    readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
      e.isDirectory() ? walk(`${dir}/${e.name}`) : e.name.endsWith(".ejs") ? [`${dir}/${e.name}`] : []
    );
  const offenders = walk("views").filter((f) => /const _esc\d?\s*=/.test(readFileSync(f, "utf8")));
  assert.deepEqual(offenders, [], `views with a manual escaper (double-escapes output): ${offenders.join(", ")}`);
});

test("no public route hardcodes an English page title", async () => {
  const { readdirSync, readFileSync } = await import("fs");
  const offenders = [];
  for (const f of readdirSync("src/routes")) {
    const src = readFileSync(`src/routes/${f}`, "utf8");
    for (const m of src.matchAll(/res\.render\(\s*"([^"]+)"\s*,\s*\{[^}]*?title:\s*"([^"]+)"/g)) {
      const [, view, title] = m;
      if (view.startsWith("admin/")) continue; // the admin panel is English-only by design
      offenders.push(`${f} -> ${view}: "${title}"`);
    }
  }
  assert.deepEqual(offenders, [], `hardcoded titles must go through t(): ${offenders.join(", ")}`);
});

test("the reported English sentences only exist inside complete translation records", async () => {
  // Every English string must be the `en` member of a record that also carries
  // bn and ar — otherwise it can leak onto a localized page.
  const reported = [
    "What Anti-D actually is",
    "Why it is needed — the Rh problem",
    "What sensitisation causes",
    "Anti-D Immunoglobulin is purified human IgG anti-RhD",
    "About 15% of people are RhD-negative",
    "Haemolytic Disease of the Fetus and Newborn",
  ];

  const owners = new Map(); // english text -> record
  const visit = (node) => {
    if (Array.isArray(node)) return node.forEach(visit);
    if (!node || typeof node !== "object") return;
    if (localize.isLocalized(node)) {
      if (typeof node.en === "string") owners.set(node.en, node);
      return;
    }
    Object.values(node).forEach(visit);
  };
  visit(antidReference);

  for (const needle of reported) {
    const match = [...owners.entries()].find(([en]) => en.includes(needle));
    assert.ok(match, `"${needle}" must live in a translation record`);
    const record = match[1];
    assert.ok(record.bn && record.bn.trim(), `"${needle}" is missing its Bengali text`);
    assert.ok(record.ar && record.ar.trim(), `"${needle}" is missing its Arabic text`);
  }
});

test("no rendered page ever prints a raw translation record", async () => {
  const server = app.listen(0);
  try {
    for (const lang of ["en", "bn", "ar"]) {
      for (const path of ["/", "/antid", "/compatibility", "/resources", "/faq", "/contact", "/shop", "/reviews"]) {
        const res = await request(server, path, { cookie: `lang=${lang}` });
        assert.equal(res.status, 200, `${path} ${lang}`);
        assert.ok(!res.body.includes("[object Object]"), `${path} in ${lang} leaked a raw object`);
        // visible text only — inline scripts legitimately contain the word
        const shown = visibleText(res.body);
        assert.ok(!shown.includes("undefined"), `${path} in ${lang} rendered "undefined" to the visitor`);
        assert.ok(!shown.includes("[object"), `${path} in ${lang} rendered "[object …]" to the visitor`);
      }
    }
  } finally { server.close(); }
});

test("the resources category filter offers translated labels with canonical values", async () => {
  const server = app.listen(0);
  try {
    const bn = visibleText((await request(server, "/resources", { cookie: "lang=bn" })).body);
    assert.ok(bn.includes("দান"), "Bengali category label");
    const html = (await request(server, "/resources", { cookie: "lang=bn" })).body;
    assert.ok(html.includes('value="Donation"'), "the filter value must stay the canonical English key");
    assert.ok(!html.includes('value="[object Object]"'));
  } finally { server.close(); }
});

test("every EJS template compiles — including the ones behind login", async () => {
  // Page smoke tests only reach public routes; a syntax error in a dashboard or
  // admin template would otherwise ship unnoticed. (This caught a real
  // pre-existing broken template: views/dashboard/requests.ejs.)
  const ejs = require("ejs");
  const { readdirSync, readFileSync } = await import("fs");
  const walk = (dir) =>
    readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
      e.isDirectory() ? walk(`${dir}/${e.name}`) : e.name.endsWith(".ejs") ? [`${dir}/${e.name}`] : []
    );
  const broken = [];
  const files = walk("views");
  for (const f of files) {
    try { ejs.compile(readFileSync(f, "utf8"), { filename: f }); }
    catch (e) { broken.push(`${f}: ${e.message.split("\n")[0]}`); }
  }
  assert.ok(files.length > 50, `expected the whole view tree, found ${files.length}`);
  assert.deepEqual(broken, [], `templates that do not compile:\n${broken.join("\n")}`);
});
