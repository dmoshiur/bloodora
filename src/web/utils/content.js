// ==================== BloodOra Frontend - Built-in Reference Content ====================
// Static reference material used as an OFFLINE FALLBACK: when the backend API
// cannot be reached, /antid, /compatibility, /resources and /api/routes still
// render real content instead of an empty page. The API's own data always wins.
//
// This file is owned by the FRONTEND and is fully self-contained: the frontend
// never imports from the backend repository's source tree.
//
// --------------------------------------------------------------------------
// LOCALIZATION
// Every human-readable string is stored as a translation record:
//
//     L("English", "বাংলা", "العربية")   ->   { en, bn, ar }
//
// The route layer resolves them for the visitor's locale with
// `localizeReference()` (src/utils/localize.js) BEFORE rendering, so a view
// always receives plain, already-translated text and simply prints it with
// `<%= %>`. The same records let the frontend translate matching content that
// arrives from the backend/CMS in English.
//
// Deliberately NOT translated:
//   • blood-group symbols (O−, A+, AB− …) — international, and parsed by the
//     compatibility matrix in views/compatibility.ejs
//   • doses, units and temperatures (1500 IU, 300 mcg, 2–6 °C)
//   • product names (Rhophylac), test names (Kleihauer-Betke, HPLC), and the
//     titles of published guidelines in `sources` — proper nouns
// ==========================================================================

/** Build a translation record: en / bn / ar. */
const L = (en, bn, ar) => ({ en, bn, ar });

/**
 * Text that is deliberately identical in every locale — the official titles of
 * published guidelines, product names and other proper nouns. Declaring it as a
 * record keeps the localizer from reporting it as untranslated.
 */
const KEEP = (text) => L(text, text, text);

// ------------------------------------------------------------------ Anti-D
// Anti-D (RhD immunoglobulin) — complete clinical reference.
export const antidReference = {
  updated: L("2026", "২০২৬", "2026"),
  summary: L(
    "Anti-D Immunoglobulin (RhIg) is a sterile solution of human IgG antibodies against the RhD antigen. It is given to RhD-negative women so their immune system never becomes sensitised to RhD-positive fetal red cells, preventing Haemolytic Disease of the Fetus and Newborn (HDFN) in the current and every future pregnancy.",
    "অ্যান্টি-ডি ইমিউনোগ্লোবুলিন (RhIg) হলো RhD অ্যান্টিজেনের বিরুদ্ধে মানব IgG অ্যান্টিবডির একটি দ্রবণ। Rh-নেগেটিভ মায়েদের এটি দেওয়া হয় যাতে তাদের শরীর Rh-পজিটিভ ভ্রূণের লোহিত রক্তকণিকার প্রতি সংবেদনশীল না হয়ে ওঠে — ফলে বর্তমান ও ভবিষ্যতের প্রতিটি গর্ভাবস্থায় HDFN প্রতিরোধ হয়।",
    "الغلوبولين المناعي المضاد لـ D هو محلول معقّم من الأجسام المضادة البشرية IgG ضد مستضد RhD. يُعطى للنساء سالبات Rh حتى لا يتحسس جهازهن المناعي ضد كريات الدم الحمراء الجنينية موجبة Rh، مما يمنع انحلال دم الجنين وحديثي الولادة."
  ),
  whatItIs: [
    {
      title: L(
        "What Anti-D actually is",
        "অ্যান্টি-ডি আসলে কী",
        "ما هو مضاد D في الواقع"
      ),
      body: L(
        "Anti-D Immunoglobulin is purified human IgG anti-RhD, manufactured from the plasma of donors who have been deliberately immunised against the RhD antigen. It is a passive immunisation: the antibodies are supplied ready-made, they do not teach the mother's immune system anything, and they clear any RhD-positive red cells from her circulation before her own immune system can mount a memory response.",
        "অ্যান্টি-ডি ইমিউনোগ্লোবুলিন হলো পরিশোধিত মানব IgG অ্যান্টি-RhD, যা RhD অ্যান্টিজেনের বিরুদ্ধে ইচ্ছাকৃতভাবে টিকাদান করা দাতাদের প্লাজমা থেকে তৈরি। এটি একটি নিষ্ক্রিয় (প্যাসিভ) টিকাদান: অ্যান্টিবডিগুলো আগে থেকেই তৈরি অবস্থায় দেওয়া হয়, এগুলো মায়ের রোগ প্রতিরোধ ব্যবস্থাকে নতুন কিছু শেখায় না, এবং মায়ের নিজের রোগ প্রতিরোধ ব্যবস্থা স্মৃতি-প্রতিক্রিয়া গড়ে তোলার সুযোগ পাওয়ার আগেই এগুলো তাঁর রক্তপ্রবাহ থেকে Rh-পজিটিভ লোহিত রক্তকণিকা সরিয়ে ফেলে।",
        "الغلوبولين المناعي المضاد لـ D هو جسم مضاد بشري IgG نقي مضاد لـ RhD، يُصنَّع من بلازما متبرعين حُصِّنوا عمدًا ضد مستضد RhD. إنه تحصين سلبي: فالأجسام المضادة تُعطى جاهزة، ولا تعلّم الجهاز المناعي للأم شيئًا، وتزيل أي كريات دم حمراء موجبة RhD من دورتها الدموية قبل أن يتمكّن جهازها المناعي من تكوين استجابة ذاكرة."
      ),
    },
    {
      title: L(
        "Why it is needed — the Rh problem",
        "কেন প্রয়োজন — Rh সমস্যা",
        "لماذا يُحتاج إليه — مشكلة عامل ريسوس"
      ),
      body: L(
        "About 15% of people are RhD-negative. When an RhD-negative mother carries an RhD-positive baby, a small fetomaternal haemorrhage during pregnancy or delivery can push fetal red cells into the maternal circulation. Without Anti-D, roughly 16% of these women will become sensitised: they make permanent anti-D antibodies. Those antibodies cross the placenta in the NEXT pregnancy and destroy the baby's red cells — causing anaemia, hydrops fetalis, kernicterus or stillbirth.",
        "প্রায় ১৫% মানুষ Rh-নেগেটিভ। যখন একজন Rh-নেগেটিভ মা Rh-পজিটিভ শিশুর গর্ভধারণ করেন, তখন গর্ভাবস্থা বা প্রসবের সময় সামান্য ফেটোম্যাটার্নাল রক্তক্ষরণের কারণে ভ্রূণের লোহিত রক্তকণিকা মায়ের রক্তপ্রবাহে ঢুকে পড়তে পারে। অ্যান্টি-ডি না দিলে এই নারীদের প্রায় ১৬% সংবেদনশীল হয়ে পড়েন: তাঁদের শরীরে স্থায়ী অ্যান্টি-ডি অ্যান্টিবডি তৈরি হয়। পরবর্তী গর্ভাবস্থায় সেই অ্যান্টিবডি প্লাসেন্টা পার হয়ে শিশুর লোহিত রক্তকণিকা ধ্বংস করে — ফলে অ্যানিমিয়া, হাইড্রপস ফিটালিস, কার্নিক্টেরাস এমনকি মৃতসন্তান জন্ম হতে পারে।",
        "نحو 15% من الناس هم سالبو RhD. عندما تحمل أم سالبة RhD بجنين موجب RhD، يمكن لنزف جنيني أمومي صغير أثناء الحمل أو الولادة أن يدفع كريات الدم الحمراء الجنينية إلى الدورة الدموية للأم. دون مضاد D، تصبح نحو 16% من هؤلاء النساء محسَّسات: إذ يكوّنّ أجسامًا مضادة دائمة ضد D. تعبر تلك الأجسام المضادة المشيمة في الحمل التالي وتدمّر كريات دم الجنين — مسبّبة فقر الدم أو الاستسقاء الجنيني أو اليرقان النووي أو ولادة جنين ميت."
      ),
    },
    {
      title: L(
        "What sensitisation causes",
        "সংবেদনশীলতার পরিণতি",
        "ما الذي يسببه التحسّس"
      ),
      body: L(
        "Haemolytic Disease of the Fetus and Newborn (HDFN). Severity ranges from mild neonatal jaundice needing phototherapy to severe anaemia requiring intrauterine transfusion, to fetal death. Because maternal antibodies persist for life, the risk increases with every subsequent RhD-positive pregnancy. Routine Anti-D prophylaxis has cut the incidence of anti-D alloimmunisation by more than 90%.",
        "ভ্রূণ ও নবজাতকের হিমোলাইটিক রোগ (HDFN)। এর মাত্রা ফোটোথেরাপি প্রয়োজন এমন হালকা নবজাতক জন্ডিস থেকে শুরু করে জরায়ুতে রক্ত সঞ্চালন লাগে এমন তীব্র অ্যানিমিয়া, এমনকি ভ্রূণের মৃত্যু পর্যন্ত বিস্তৃত। মায়ের অ্যান্টিবডি আজীবন থেকে যাওয়ায় প্রতিটি পরবর্তী Rh-পজিটিভ গর্ভাবস্থায় ঝুঁকি বাড়তে থাকে। নিয়মিত অ্যান্টি-ডি প্রোফিল্যাক্সিসের ফলে অ্যান্টি-ডি অ্যালোইমিউনাইজেশনের হার ৯০% এর বেশি কমে গেছে।",
        "مرض انحلال الدم لدى الجنين وحديثي الولادة (HDFN). تتراوح شدّته من يرقان حديثي الولادة الخفيف الذي يحتاج إلى معالجة ضوئية، إلى فقر دم شديد يتطلّب نقل دم داخل الرحم، وصولًا إلى وفاة الجنين. ولأن الأجسام المضادة لدى الأم تبقى مدى الحياة، يزداد الخطر مع كل حمل تالٍ موجب RhD. وقد خفّض إعطاء مضاد D الروتيني نسبة التحصين المناعي ضد D بأكثر من 90%."
      ),
    },
  ],
  indications: [
    {
      condition: L("Routine antenatal prophylaxis", "নিয়মিত প্রসবপূর্ব প্রোফিল্যাক্সিস", "الوقاية الروتينية قبل الولادة"),
      who: L(
        "Every RhD-negative pregnant woman, whether or not any bleeding has occurred",
        "প্রতিটি Rh-নেগেটিভ গর্ভবতী নারী, রক্তক্ষরণ হয়েছে কি না তা নির্বিশেষে",
        "كل امرأة حامل سالبة RhD، سواء حدث نزف أم لا"
      ),
      when: L(
        "28 weeks (single dose) or 28 + 34 weeks (two-dose schedule)",
        "২৮ সপ্তাহ (একক ডোজ) অথবা ২৮ + ৩৪ সপ্তাহ (দুই ডোজের সূচি)",
        "الأسبوع 28 (جرعة واحدة) أو الأسبوعان 28 + 34 (نظام جرعتين)"
      ),
      note: L(
        "Covers the third-trimester silent fetomaternal haemorrhage.",
        "তৃতীয় ত্রৈমাসিকের নীরব ফেটোম্যাটার্নাল রক্তক্ষরণ প্রতিরোধ করে।",
        "يغطّي النزف الجنيني الأمومي الصامت في الثلث الثالث من الحمل."
      ),
    },
    {
      condition: L("Within 72 hours of delivery", "প্রসবের ৭২ ঘণ্টার মধ্যে", "خلال 72 ساعة من الولادة"),
      who: L(
        "RhD-negative mother of an RhD-positive (or unknown) newborn",
        "Rh-পজিটিভ (বা অজানা গ্রুপের) নবজাতকের Rh-নেগেটিভ মা",
        "الأم سالبة RhD لمولود موجب RhD (أو مجهول الفصيلة)"
      ),
      when: L("As soon as possible, ideally ≤72 hours after birth", "যত দ্রুত সম্ভব, আদর্শভাবে জন্মের ≤৭২ ঘণ্টার মধ্যে", "في أقرب وقت ممكن، ويُفضَّل خلال ≤72 ساعة من الولادة"),
      note: L(
        "Dose adjusted by Kleihauer-Betke / flow-cytometry FMH volume.",
        "Kleihauer-Betke / ফ্লো-সাইটোমেট্রি দিয়ে মাপা FMH পরিমাণ অনুযায়ী মাত্রা নির্ধারণ করা হয়।",
        "تُعدَّل الجرعة حسب حجم النزف الجنيني الأمومي المقاس باختبار Kleihauer-Betke أو قياس التدفق الخلوي."
      ),
    },
    {
      condition: L("Miscarriage, threatened or complete", "গর্ভপাত — হুমকির মুখে বা সম্পূর্ণ", "الإجهاض، المهدِّد أو المكتمل"),
      who: L(
        "RhD-negative woman, ≥12 weeks gestation (or any gestation with surgical evacuation)",
        "Rh-নেগেটিভ নারী, গর্ভকাল ≥১২ সপ্তাহ (অথবা অস্ত্রোপচারের মাধ্যমে গর্ভশূন্যকরণ হলে যেকোনো গর্ভকালে)",
        "امرأة سالبة RhD بعمر حمل ≥12 أسبوعًا (أو أي عمر حملي مع تفريغ جراحي)"
      ),
      when: L("Immediately at presentation", "পরিদর্শনে আসার সঙ্গে সঙ্গেই", "فورًا عند الحضور"),
      note: L(
        "Before 12 weeks a smaller 50–120 mcg dose is acceptable where available.",
        "১২ সপ্তাহের আগে কম মাত্রা ৫০–১২০ মাইক্রোগ্রাম গ্রহণযোগ্য, যদি তা পাওয়া যায়।",
        "قبل الأسبوع 12 تُقبل جرعة أصغر 50–120 ميكروغرام عند توفّرها."
      ),
    },
    {
      condition: L("Ectopic pregnancy / molar pregnancy", "এক্টোপিক গর্ভাবস্থা / মোলার গর্ভাবস্থা", "الحمل خارج الرحم / الحمل العنقودي"),
      who: L("All RhD-negative women", "সব Rh-নেগেটিভ নারী", "جميع النساء سالبات RhD"),
      when: L("At diagnosis or after treatment", "নির্ণয়ের সময় বা চিকিৎসার পর", "عند التشخيص أو بعد العلاج"),
      note: L("Trophoblastic tissue expresses RhD.", "ট্রফোব্লাস্টিক টিস্যুতে RhD অ্যান্টিজেন থাকে।", "يُعبّر النسيج الأرومي المغذّي عن مستضد RhD."),
    },
    {
      condition: L("Termination of pregnancy", "গর্ভসমাপ্তি", "إنهاء الحمل"),
      who: L("All RhD-negative women, any gestation", "সব Rh-নেগেটিভ নারী, যেকোনো গর্ভকালে", "جميع النساء سالبات RhD، في أي عمر حملي"),
      when: L("Same day as the procedure", "প্রক্রিয়ার দিনেই", "في يوم الإجراء نفسه"),
      note: L("Dose scales with gestational age.", "গর্ভকাল যত বেশি, মাত্রা তত বেশি।", "تزداد الجرعة مع تقدّم عمر الحمل."),
    },
    {
      condition: L("Invasive prenatal procedures", "প্রসবপূর্ব ইনভ্যাসিভ প্রক্রিয়া", "الإجراءات السابقة للولادة الباضعة"),
      who: L(
        "Amniocentesis, CVS, fetal blood sampling, external cephalic version, abdominal trauma",
        "অ্যামনিওসেন্টেসিস, CVS, ভ্রূণের রক্ত সংগ্রহ, এক্সটার্নাল সেফালিক ভার্সন, পেটে আঘাত",
        "بزل السلى، أخذ عيّنات الزغابات المشيمية، سحب دم الجنين، القلب الرأسي الخارجي، رضوض البطن"
      ),
      when: L("Within 72 hours of the event", "ঘটনার ৭২ ঘণ্টার মধ্যে", "خلال 72 ساعة من الحدث"),
      note: L(
        "Repeat dosing every 6 weeks if procedures are repeated.",
        "প্রক্রিয়া পুনরাবৃত্ত হলে প্রতি ৬ সপ্তাহ পর ডোজও পুনরাবৃত্তি করতে হয়।",
        "تُكرَّر الجرعة كل 6 أسابيع إذا تكرّرت الإجراءات."
      ),
    },
    {
      condition: L("Antepartum haemorrhage", "প্রসবপূর্ব রক্তক্ষরণ", "النزف قبل الولادة"),
      who: L("Any bleeding episode in an RhD-negative pregnancy", "Rh-নেগেটিভ গর্ভাবস্থায় যেকোনো রক্তক্ষরণের ঘটনা", "أي نوبة نزف أثناء حمل لدى امرأة سالبة RhD"),
      when: L(
        "Within 72 hours of each episode, repeated every 6 weeks if bleeding continues",
        "প্রতিটি ঘটনার ৭২ ঘণ্টার মধ্যে; রক্তক্ষরণ চলতে থাকলে প্রতি ৬ সপ্তাহ পর পুনরাবৃত্তি",
        "خلال 72 ساعة من كل نوبة، وتُكرَّر كل 6 أسابيع إذا استمر النزف"
      ),
      note: L("Do not wait for delivery.", "প্রসবের জন্য অপেক্ষা করা যাবে না।", "لا يجوز انتظار الولادة."),
    },
    {
      condition: L("Transfusion of RhD-positive blood", "Rh-পজিটিভ রক্ত সঞ্চালন", "نقل دم موجب RhD"),
      who: L(
        "RhD-negative girl or woman of childbearing potential wrongly transfused RhD-positive red cells or platelets",
        "যেসব Rh-নেগেটিভ বালিকা বা প্রজননক্ষম নারীকে ভুলবশত Rh-পজিটিভ লোহিত রক্তকণিকা বা প্লেটলেট দেওয়া হয়েছে",
        "فتاة أو امرأة في سن الإنجاب سالبة RhD نُقلت إليها خطأً كريات حمراء أو صفائح موجبة RhD"
      ),
      when: L("Immediately on discovery", "ভুলটি জানা মাত্রই", "فور اكتشاف الخطأ"),
      note: L(
        "≈20 mcg per mL of RhD-positive red cells; large volumes may need exchange transfusion.",
        "প্রতি মিলি Rh-পজিটিভ লোহিত রক্তকণিকার জন্য ≈২০ মাইক্রোগ্রাম; বেশি পরিমাণ হলে এক্সচেঞ্জ ট্রান্সফিউশন লাগতে পারে।",
        "≈20 ميكروغرام لكل مل من الكريات الحمراء موجبة RhD؛ وقد تتطلّب الكميات الكبيرة تبديل الدم."
      ),
    },
  ],
  dosing: [
    {
      scenario: L("Antenatal prophylaxis (28 weeks)", "প্রসবপূর্ব প্রোফিল্যাক্সিস (২৮ সপ্তাহ)", "الوقاية قبل الولادة (الأسبوع 28)"),
      dose: "1500 IU (300 mcg) IM",
      route: L(
        "Intramuscular, deltoid or anterolateral thigh",
        "পেশিপথে — ডেল্টয়েড বা উরুর সামনের-পার্শ্বীয় অংশে",
        "حقن عضلي في العضلة الدالية أو الفخذ الأمامي الوحشي"
      ),
      repeat: L(
        "Single dose; or 500 IU at 28 and 34 weeks in the two-dose schedule",
        "একক ডোজ; অথবা দুই ডোজের সূচিতে ২৮ ও ৩৪ সপ্তাহে ৫০০ IU করে",
        "جرعة واحدة؛ أو 500 وحدة دولية في الأسبوعين 28 و34 ضمن نظام الجرعتين"
      ),
    },
    {
      scenario: L(
        "Postnatal prophylaxis, standard FMH < 4 mL fetal red cells",
        "প্রসবোত্তর প্রোফিল্যাক্সিস, সাধারণ FMH < ৪ মিলি ভ্রূণীয় লোহিত রক্তকণিকা",
        "الوقاية بعد الولادة، نزف جنيني أمومي قياسي < 4 مل كريات حمراء جنينية"
      ),
      dose: "1500 IU (300 mcg) IM",
      route: L("Intramuscular", "পেশিপথে", "حقن عضلي"),
      repeat: L("Once, within 72 hours of birth", "একবার, জন্মের ৭২ ঘণ্টার মধ্যে", "مرة واحدة خلال 72 ساعة من الولادة"),
    },
    {
      scenario: L("Large fetomaternal haemorrhage", "অধিক ফেটোম্যাটার্নাল রক্তক্ষরণ", "نزف جنيني أمومي كبير"),
      dose: L(
        "Add 125 IU per extra 1 mL of fetal red cells above 4 mL",
        "৪ মিলির বেশি প্রতি অতিরিক্ত ১ মিলি ভ্রূণীয় লোহিত রক্তকণিকার জন্য ১২৫ IU যোগ করুন",
        "أضف 125 وحدة دولية لكل 1 مل إضافي من الكريات الحمراء الجنينية فوق 4 مل"
      ),
      route: L("IM (IV formulations where licensed)", "পেশিপথে (অনুমোদিত থাকলে শিরাপথেও)", "عضليًا (أو وريديًا للمستحضرات المرخّصة)"),
      repeat: L(
        "Guided by Kleihauer-Betke test at 48–72 hours postpartum",
        "প্রসবের ৪৮–৭২ ঘণ্টায় Kleihauer-Betke পরীক্ষার ফল অনুযায়ী",
        "بحسب اختبار Kleihauer-Betke بعد 48–72 ساعة من الولادة"
      ),
    },
    {
      scenario: L("First-trimester event (< 12 weeks)", "প্রথম ত্রৈমাসিকের ঘটনা (< ১২ সপ্তাহ)", "حدث في الثلث الأول من الحمل (< 12 أسبوعًا)"),
      dose: "50–120 mcg (250–600 IU)",
      route: L("Intramuscular", "পেশিপথে", "حقن عضلي"),
      repeat: L("Once", "একবার", "مرة واحدة"),
    },
    {
      scenario: L("Events from 12 weeks onwards", "১২ সপ্তাহের পরের ঘটনাসমূহ", "الأحداث من الأسبوع 12 فصاعدًا"),
      dose: "300 mcg (1500 IU)",
      route: L("Intramuscular", "পেশিপথে", "حقن عضلي"),
      repeat: L("Once per event", "প্রতিটি ঘটনায় একবার", "مرة واحدة لكل حدث"),
    },
    {
      scenario: L("Wrong-blood-group transfusion", "ভুল গ্রুপের রক্ত সঞ্চালন", "نقل فصيلة دم خاطئة"),
      dose: L(
        "≈20 mcg (100 IU) per 1 mL of RhD-positive red cells",
        "প্রতি ১ মিলি Rh-পজিটিভ লোহিত রক্তকণিকার জন্য ≈২০ মাইক্রোগ্রাম (১০০ IU)",
        "≈20 ميكروغرام (100 وحدة دولية) لكل 1 مل من الكريات الحمراء موجبة RhD"
      ),
      route: L("Divided IM/IV over days", "কয়েক দিনে ভাগ করে পেশিপথে/শিরাপথে", "مقسّمة عضليًا/وريديًا على عدة أيام"),
      repeat: L(
        "Until the transfused RhD-positive cells are cleared",
        "যতদিন না সঞ্চালিত Rh-পজিটিভ কণিকা শরীর থেকে সম্পূর্ণ সরে যায়",
        "حتى تُزال الكريات موجبة RhD المنقولة تمامًا"
      ),
    },
  ],
  timing: [
    {
      milestone: L("Booking visit", "প্রথম প্রসবপূর্ব পরিদর্শন", "زيارة التسجيل الأولى"),
      action: L(
        "Group and RhD type + antibody screen on every pregnant woman.",
        "প্রতিটি গর্ভবতী নারীর রক্তের গ্রুপ, RhD টাইপ ও অ্যান্টিবডি স্ক্রিন করা।",
        "تحديد فصيلة الدم ونوع RhD وفحص الأجسام المضادة لكل امرأة حامل."
      ),
    },
    {
      milestone: L("28 weeks", "২৮ সপ্তাহ", "الأسبوع 28"),
      action: L(
        "Give routine antenatal Anti-D to all RhD-negative women. Repeat antibody screen.",
        "সব Rh-নেগেটিভ নারীকে নিয়মিত প্রসবপূর্ব অ্যান্টি-ডি দিন। অ্যান্টিবডি স্ক্রিন পুনরাবৃত্তি করুন।",
        "أعطِ مضاد D الروتيني قبل الولادة لجميع النساء سالبات RhD، وأعد فحص الأجسام المضادة."
      ),
    },
    {
      milestone: L("Any sensitising event", "যেকোনো সংবেদনশীলতা-সৃষ্টিকারী ঘটনা", "أي حدث محسِّس"),
      action: L(
        "Give Anti-D within 72 hours — never assume an event is 'too small'.",
        "৭২ ঘণ্টার মধ্যে অ্যান্টি-ডি দিন — কোনো ঘটনাকেই 'খুব ছোট' ধরে নেবেন না।",
        "أعطِ مضاد D خلال 72 ساعة — ولا تفترض أبدًا أن الحدث «صغير جدًا»."
      ),
    },
    {
      milestone: L("Delivery", "প্রসব", "الولادة"),
      action: L(
        "Cord blood group & direct antiglobulin test. Give Anti-D within 72 hours if baby is RhD-positive or unknown.",
        "নাড়ির রক্তের গ্রুপ ও ডিরেক্ট অ্যান্টিগ্লোবিউলিন পরীক্ষা। শিশু Rh-পজিটিভ বা অজানা গ্রুপের হলে ৭২ ঘণ্টার মধ্যে অ্যান্টি-ডি দিন।",
        "فحص فصيلة دم الحبل السري واختبار الأجسام المضادة المباشر. أعطِ مضاد D خلال 72 ساعة إذا كان المولود موجب RhD أو مجهول الفصيلة."
      ),
    },
    {
      milestone: L("48–72 hours postpartum", "প্রসবোত্তর ৪৮–৭২ ঘণ্টা", "بعد 48–72 ساعة من الولادة"),
      action: L(
        "Kleihauer-Betke / flow cytometry to quantify FMH; top-up dose if needed.",
        "FMH পরিমাপের জন্য Kleihauer-Betke / ফ্লো-সাইটোমেট্রি; প্রয়োজনে অতিরিক্ত ডোজ।",
        "قياس النزف الجنيني الأمومي باختبار Kleihauer-Betke أو قياس التدفق الخلوي؛ وإعطاء جرعة تكميلية عند الحاجة."
      ),
    },
    {
      milestone: L("After a missed dose", "ডোজ বাদ পড়ে গেলে", "بعد فوات جرعة"),
      action: L(
        "Give it anyway — partial protection persists up to 28 days, though 72 hours remains the target.",
        "তবুও দিয়ে দিন — আংশিক সুরক্ষা ২৮ দিন পর্যন্ত থাকে, তবে লক্ষ্য ৭২ ঘণ্টাই।",
        "أعطِها على أي حال — تبقى حماية جزئية حتى 28 يومًا، وإن كانت 72 ساعة هي الهدف."
      ),
    },
  ],
  administration: [
    L(
      "Check maternal blood group, RhD type and current antibody screen before every dose.",
      "প্রতিটি ডোজের আগে মায়ের রক্তের গ্রুপ, RhD টাইপ ও সর্বশেষ অ্যান্টিবডি স্ক্রিন যাচাই করুন।",
      "تحقّق من فصيلة دم الأم ونوع RhD وفحص الأجسام المضادة الحالي قبل كل جرعة."
    ),
    L(
      "If anti-D is ALREADY present in the maternal plasma as an immune antibody, Anti-D prophylaxis is useless — refer to obstetric medicine for fetal surveillance.",
      "মায়ের প্লাজমায় ইতিমধ্যেই ইমিউন অ্যান্টিবডি হিসেবে অ্যান্টি-ডি থাকলে অ্যান্টি-ডি প্রোফিল্যাক্সিস নিরর্থক — ভ্রূণ পর্যবেক্ষণের জন্য প্রসূতি চিকিৎসাবিদ্যায় পাঠান।",
      "إذا كان مضاد D موجودًا بالفعل في بلازما الأم كجسم مضاد مناعي، فإن الوقاية بمضاد D عديمة الفائدة — تُحوَّل الحالة إلى طب الأمومة لمتابعة الجنين."
    ),
    L(
      "Deep intramuscular injection into the deltoid (or anterolateral thigh in small adults). Aspirate before injecting.",
      "ডেল্টয়েড পেশিতে (কম ওজনের প্রাপ্তবয়স্কদের ক্ষেত্রে উরুর সামনের-পার্শ্বীয় অংশে) গভীর পেশিপথে ইনজেকশন দিন। দেওয়ার আগে অ্যাসপিরেট করুন।",
      "حقن عضلي عميق في العضلة الدالية (أو الفخذ الأمامي الوحشي لدى البالغين ضعيفي البنية). اسحب المكبس قبل الحقن."
    ),
    L(
      "Never mix Anti-D with other drugs or vaccines in the same syringe. It may be given at a different site on the same day as routine vaccines, including live vaccines.",
      "একই সিরিঞ্জে অ্যান্টি-ডি অন্য কোনো ওষুধ বা টিকার সঙ্গে মেশাবেন না। একই দিনে ভিন্ন স্থানে নিয়মিত টিকার (জীবন্ত টিকাসহ) সঙ্গে দেওয়া যেতে পারে।",
      "لا تخلط مضاد D أبدًا مع أدوية أو لقاحات أخرى في المحقنة نفسها. يمكن إعطاؤه في موضع مختلف في اليوم نفسه مع اللقاحات الروتينية، بما فيها اللقاحات الحية."
    ),
    L(
      "Observe the patient for 20 minutes afterwards — anaphylaxis is rare but possible in IgA-deficient recipients.",
      "দেওয়ার পর ২০ মিনিট রোগীকে পর্যবেক্ষণে রাখুন — IgA-স্বল্পতায় আক্রান্তদের ক্ষেত্রে অ্যানাফাইল্যাক্সিস বিরল হলেও সম্ভব।",
      "راقب المريضة لمدة 20 دقيقة بعد الإعطاء — فالحساسية المفرطة نادرة ولكنها ممكنة لدى من لديهن نقص IgA."
    ),
    L(
      "Record the batch number, dose and date in the antenatal record and give the patient a card.",
      "ব্যাচ নম্বর, মাত্রা ও তারিখ প্রসবপূর্ব রেকর্ডে লিখে রাখুন এবং রোগীকে একটি কার্ড দিন।",
      "سجّل رقم الدفعة والجرعة والتاريخ في ملف متابعة الحمل، وأعطِ المريضة بطاقة."
    ),
    L(
      "A Kleihauer-Betke acid-elution test at 48–72 hours detects under-dosing; flow cytometry is preferred where available.",
      "৪৮–৭২ ঘণ্টায় Kleihauer-Betke অ্যাসিড-ইলিউশন পরীক্ষা কম মাত্রা শনাক্ত করে; ফ্লো-সাইটোমেট্রি থাকলে সেটিই অগ্রাধিকার।",
      "يكشف اختبار Kleihauer-Betke (الإماضة الحمضية) بعد 48–72 ساعة نقص الجرعة؛ ويُفضَّل قياس التدفق الخلوي عند توفّره."
    ),
  ],
  safety: {
    common: [
      L(
        "Pain, tenderness, redness or a small lump at the injection site (most frequent complaint)",
        "ইনজেকশনের স্থানে ব্যথা, স্পর্শকাতরতা, লালচে ভাব বা ছোট ফোলা অংশ (সবচেয়ে সাধারণ অভিযোগ)",
        "ألم أو مضض أو احمرار أو تورّم صغير في موضع الحقن (الشكوى الأكثر شيوعًا)"
      ),
      L("Low-grade fever, headache, malaise, mild chills", "সামান্য জ্বর, মাথাব্যথা, অস্বস্তি, হালকা শীতশীত ভাব", "حمى خفيفة، صداع، توعّك، قشعريرة خفيفة"),
      L("Transient skin rash or itching", "সাময়িক ত্বকের র‍্যাশ বা চুলকানি", "طفح جلدي عابر أو حكة"),
    ],
    rare: [
      L(
        "Anaphylaxis or anaphylactoid reaction — especially in IgA-deficient patients with anti-IgA antibodies",
        "অ্যানাফাইল্যাক্সিস বা অ্যানাফাইল্যাক্টয়েড প্রতিক্রিয়া — বিশেষত anti-IgA অ্যান্টিবডিযুক্ত IgA-স্বল্পতার রোগীদের ক্ষেত্রে",
        "الحساسية المفرطة أو تفاعل شبيه بها — خاصة لدى مرضى نقص IgA الذين لديهم أجسام مضادة لـ IgA"
      ),
      L("Urticaria, arthralgia, myalgia several days after injection", "ইনজেকশনের কয়েক দিন পর আমবাত, গাঁটে ব্যথা, পেশিতে ব্যথা", "شرى وألم مفاصل وألم عضلي بعد أيام من الحقن"),
      L(
        "Very rarely, disseminated intravascular coagulation in patients receiving large IV doses for wrong-blood-group transfusion",
        "অত্যন্ত বিরলভাবে, ভুল গ্রুপের রক্ত সঞ্চালনের কারণে শিরাপথে উচ্চমাত্রায় ডোজ নেওয়া রোগীদের ক্ষেত্রে ডিসেমিনেটেড ইন্ট্রাভাসকুলার কোয়াগুলেশন",
        "نادرًا جدًا، التخثّر المنتشر داخل الأوعية لدى من يتلقّون جرعات وريدية كبيرة بسبب نقل فصيلة دم خاطئة"
      ),
    ],
    contraindications: [
      L(
        "Known hypersensitivity to human immunoglobulin preparations or to any excipient (e.g. glycine, polysorbate 80)",
        "মানব ইমিউনোগ্লোবুলিন প্রস্তুতি বা যেকোনো এক্সসিপিয়েন্ট (যেমন গ্লাইসিন, পলিসরবেট ৮০) সম্পর্কে জানা অতিসংবেদনশীলতা",
        "فرط حساسية معروف لمستحضرات الغلوبولين المناعي البشري أو لأي سواغ (مثل الغلايسين أو بولي سوربات 80)"
      ),
      L(
        "RhD-positive women and RhD-negative women already alloimmunised to RhD (no benefit)",
        "Rh-পজিটিভ নারী এবং ইতিমধ্যেই RhD-তে অ্যালোইমিউনাইজড Rh-নেগেটিভ নারী (কোনো উপকার নেই)",
        "النساء موجبات RhD، وسالبات RhD المحصَّنات مسبقًا ضد RhD (لا فائدة)"
      ),
      L(
        "Severe thrombocytopenia or coagulopathy — prefer an IV formulation over intramuscular injection",
        "তীব্র থ্রম্বোসাইটোপেনিয়া বা কোয়াগুলোপ্যাথি — পেশিপথে ইনজেকশনের বদলে শিরাপথের প্রস্তুতি অগ্রাধিকার দিন",
        "نقص الصفائح الشديد أو اعتلال التخثّر — يُفضَّل المستحضر الوريدي على الحقن العضلي"
      ),
      L(
        "IgA deficiency with documented anti-IgA antibodies — use an IgA-depleted product or avoid",
        "প্রমাণিত anti-IgA অ্যান্টিবডিসহ IgA স্বল্পতা — IgA-মুক্ত পণ্য ব্যবহার করুন অথবা এড়িয়ে চলুন",
        "نقص IgA مع أجسام مضادة موثّقة لـ IgA — استخدم منتجًا منزوع IgA أو تجنّبه"
      ),
    ],
    storage: [
      L(
        "Store at 2 °C to 8 °C. DO NOT FREEZE — a frozen vial must be discarded.",
        "২° সে. থেকে ৮° সে. তাপমাত্রায় সংরক্ষণ করুন। বরফ হতে দেবেন না — হিমায়িত ভায়াল ফেলে দিতে হবে।",
        "يُحفظ بين 2 و8 درجات مئوية. لا يُجمَّد — يجب إتلاف أي قارورة متجمّدة."
      ),
      L("Protect from light in the original carton.", "মূল কার্টনে রেখে আলো থেকে রক্ষা করুন।", "يُحفظ في علبته الأصلية بعيدًا عن الضوء."),
      L(
        "After reconstitution use immediately; some products allow up to 4 hours at 2–8 °C.",
        "গুলে নেওয়ার সঙ্গে সঙ্গে ব্যবহার করুন; কিছু পণ্য ২–৮° সে. তাপমাত্রায় সর্বোচ্চ ৪ ঘণ্টা রাখা যায়।",
        "يُستخدم فورًا بعد الحل؛ وتسمح بعض المنتجات ببقائها حتى 4 ساعات عند 2–8 درجات مئوية."
      ),
      L(
        "The cold chain is the single most common cause of Anti-D failure in district-level practice in Bangladesh — verify the vaccine-carrier temperature log before injecting.",
        "বাংলাদেশের জেলা পর্যায়ে অ্যান্টি-ডি ব্যর্থতার প্রধানতম কারণ কোল্ড চেইন বিঘ্ন — ইনজেকশন দেওয়ার আগে ভ্যাকসিন ক্যারিয়ারের তাপমাত্রার রেকর্ড যাচাই করুন।",
        "سلسلة التبريد هي السبب الأول لفشل مضاد D في الممارسة على مستوى المناطق في بنغلاديش — تحقّق من سجل درجة حرارة حافظ اللقاح قبل الحقن."
      ),
    ],
  },
  faq: [
    {
      q: L(
        "I already received Anti-D at 28 weeks. Do I still need it after delivery?",
        "২৮ সপ্তাহে আমি অ্যান্টি-ডি নিয়েছি। প্রসবের পরেও কি এটি লাগবে?",
        "أخذت مضاد D بالفعل في الأسبوع 28. هل أحتاجه بعد الولادة؟"
      ),
      a: L(
        "Yes. The antenatal dose only protects the weeks it was given for. A separate postnatal dose within 72 hours of birth is required whenever the baby is RhD-positive or the baby's group is unknown.",
        "হ্যাঁ। প্রসবপূর্ব ডোজ শুধু সেই সপ্তাহগুলোকেই সুরক্ষা দেয় যার জন্য এটি দেওয়া হয়েছিল। শিশু Rh-পজিটিভ হলে বা শিশুর গ্রুপ অজানা হলে জন্মের ৭২ ঘণ্টার মধ্যে আলাদা একটি প্রসবোত্তর ডোজ দিতেই হয়।",
        "نعم. جرعة ما قبل الولادة تحمي الأسابيع التي أُعطيت لأجلها فقط. وتلزم جرعة منفصلة بعد الولادة خلال 72 ساعة من الميلاد كلما كان المولود موجب RhD أو كانت فصيلته مجهولة."
      ),
    },
    {
      q: L(
        "My husband is RhD-negative too. Do I still need Anti-D?",
        "আমার স্বামীও Rh-নেগেটিভ। তবুও কি আমার অ্যান্টি-ডি লাগবে?",
        "زوجي أيضًا سالب RhD. هل ما زلت أحتاج مضاد D؟"
      ),
      a: L(
        "If paternity is certain and the father is truly RhD-negative, the fetus will be RhD-negative and prophylaxis is unnecessary. In practice most guidelines still recommend it unless the father's group is confirmed, because a single missed dose risks every future pregnancy.",
        "পিতৃত্ব নিশ্চিত হলে এবং বাবা সত্যিই Rh-নেগেটিভ হলে ভ্রূণও Rh-নেগেটিভ হবে, তখন প্রোফিল্যাক্সিসের প্রয়োজন নেই। তবে বাবার গ্রুপ নিশ্চিতভাবে পরীক্ষা না করা পর্যন্ত বেশিরভাগ নির্দেশিকা এটি দেওয়ারই পরামর্শ দেয়, কারণ একটি ডোজ বাদ পড়লে ভবিষ্যতের প্রতিটি গর্ভাবস্থাই ঝুঁকিতে পড়ে।",
        "إذا كان نسب الجنين مؤكدًا والأب سالب RhD فعلًا، فسيكون الجنين سالب RhD ولا حاجة للوقاية. عمليًا، ما تزال معظم الإرشادات توصي بها ما لم تُؤكَّد فصيلة الأب، لأن جرعة واحدة فائتة تعرّض كل حمل مستقبلي للخطر."
      ),
    },
    {
      q: L(
        "It has been more than 72 hours. Is it too late?",
        "৭২ ঘণ্টার বেশি সময় পার হয়ে গেছে। কি অনেক দেরি হয়ে গেছে?",
        "مضى أكثر من 72 ساعة. هل فات الأوان؟"
      ),
      a: L(
        "Give it anyway. Protection declines but does not vanish — evidence supports benefit up to 28 days after the event. Do not withhold a late dose.",
        "তবুও দিয়ে দিন। সুরক্ষা কমে কিন্তু একেবারে থাকে না — ঘটনার ২৮ দিন পর্যন্ত উপকারের প্রমাণ আছে। দেরি হওয়া ডোজ আটকে রাখবেন না।",
        "أعطِها على أي حال. الحماية تقلّ لكنها لا تختفي — والأدلة تدعم الفائدة حتى 28 يومًا بعد الحدث. لا تحجب جرعة متأخرة."
      ),
    },
    {
      q: L("Does Anti-D harm the baby?", "অ্যান্টি-ডিতে কি শিশুর ক্ষতি হয়?", "هل يضرّ مضاد D الجنين؟"),
      a: L(
        "No. Anti-D does not cross into the fetus in a clinically meaningful amount and has an excellent safety record over five decades of use. The small amount that does cross can cause a weakly positive direct antiglobulin test in the newborn, which is harmless.",
        "না। অ্যান্টি-ডি নৈর্ঘ্যগতভাবে উল্লেখযোগ্য পরিমাণে ভ্রূণে পৌঁছায় না এবং পাঁচ দশকের ব্যবহারে এর নিরাপত্তা রেকর্ড চমৎকার। যে সামান্য অংশ পৌঁছায়, তার কারণে নবজাতকের ডিরেক্ট অ্যান্টিগ্লোবিউলিন পরীক্ষা হালকা পজিটিভ আসতে পারে — যা ক্ষতিকর নয়।",
        "لا. لا يعبر مضاد D إلى الجنين بكمية ذات أثر سريري، ولديه سجل سلامة ممتاز على مدى خمسة عقود من الاستخدام. والكمية الصغيرة التي تعبر قد تسبّب نتيجة إيجابية ضعيفة في اختبار الأجسام المضادة المباشر لدى المولود، وهي غير ضارة."
      ),
    },
    {
      q: L(
        "Can Anti-D be given with other vaccines?",
        "অ্যান্টি-ডি কি অন্য টিকার সঙ্গে দেওয়া যায়?",
        "هل يمكن إعطاء مضاد D مع لقاحات أخرى؟"
      ),
      a: L(
        "Yes, including live attenuated vaccines. Use a separate syringe and a separate injection site. Rubella vaccine given postpartum alongside Anti-D is standard practice.",
        "হ্যাঁ, জীবন্ত দুর্বলীকৃত টিকাসহ। আলাদা সিরিঞ্জ ও আলাদা ইনজেকশনের স্থান ব্যবহার করুন। প্রসবের পর অ্যান্টি-ডির সঙ্গে রুবেলা টিকা দেওয়া প্রচলিত নিয়ম।",
        "نعم، بما في ذلك اللقاحات الحية الموهنة. استخدم محقنة منفصلة وموضع حقن منفصلًا. وإعطاء لقاح الحصبة الألمانية بعد الولادة مع مضاد D ممارسة معتادة."
      ),
    },
    {
      q: L(
        "Where can I get it in Bangladesh?",
        "বাংলাদেশে এটি কোথায় পাব?",
        "أين أحصل عليه في بنغلاديش؟"
      ),
      a: L(
        "Anti-D is available in most district and upazila health complexes and in private hospitals. BloodOra's medical shop lists Rhophylac Anti-D 300 mcg under the Medicine category; you can order it for ৳10 delivery inside Kalai Upazila.",
        "বেশিরভাগ জেলা ও উপজেলা স্বাস্থ্য কমপ্লেক্স এবং বেসরকারি হাসপাতালে অ্যান্টি-ডি পাওয়া যায়। BloodOra-এর মেডিকেল দোকানে মেডিসিন ক্যাটাগরিতে Rhophylac Anti-D 300 mcg আছে; কলাই উপজেলার ভেতরে ৳১০ ডেলিভারি চার্জে অর্ডার করা যায়।",
        "يتوفّر مضاد D في معظم مجمّعات الصحة بالمناطق والنواحي وفي المستشفيات الخاصة. ويعرض متجر BloodOra الطبي منتج Rhophylac Anti-D 300 mcg ضمن فئة الأدوية؛ ويمكن طلبه مع توصيل بقيمة ৳10 داخل ناحية كالاي."
      ),
    },
  ],
  // Titles of published guidelines — proper nouns, kept exactly as issued in
  // every locale (translating a citation would make it unfindable).
  sources: [
    KEEP("ACOG Practice Bulletin No. 181 — Prevention of Rh D Alloimmunization"),
    KEEP("RCOG Green-top Guideline No. 65 — The Management of Rhesus Isoimmunisation in Pregnancy"),
    KEEP("WHO Recommendations on Antenatal Care for a Positive Pregnancy Experience"),
    KEEP("Bangladesh National Guideline on Maternal & Neonatal Care, DGHS"),
  ],
};

// ------------------------------------------------------------- Compatibility
// NOTE: `group`, `donatesTo` and `receivesFrom` stay untranslated on purpose —
// they are blood-group symbols AND they are parsed by the interactive matrix in
// views/compatibility.ejs (`row.donatesTo.split(',')`).
export const compatibilityReference = {
  // Red-cell (packed RBC) compatibility — donor group -> recipients
  rbc: [
    {
      group: "O−", donatesTo: "O−, O+, A−, A+, B−, B+, AB−, AB+", receivesFrom: "O−",
      donorType: L("Universal red-cell donor", "সার্বজনীন লোহিত রক্তকণিকা দাতা", "مانح كريات حمراء عام"),
      recipientType: L("Can receive only O−", "শুধু O− নিতে পারে", "لا يستقبل إلا O−"),
      note: L(
        "The emergency choice when a patient's group is unknown. In women of childbearing potential, always prefer group-specific O− and never give RhD-positive red cells.",
        "রোগীর গ্রুপ অজানা থাকলে জরুরি অবস্থায় এটাই বেছে নেওয়া হয়। প্রজননক্ষম নারীদের ক্ষেত্রে সর্বদা গ্রুপ-নির্দিষ্ট O− অগ্রাধিকার দিন এবং কখনোই Rh-পজিটিভ লোহিত রক্তকণিকা দেবেন না।",
        "هو الخيار في الطوارئ عندما تكون فصيلة المريض مجهولة. لدى النساء في سن الإنجاب، فضّل دائمًا O− المطابق للفصيلة ولا تعطِ كريات حمراء موجبة RhD أبدًا."
      ),
    },
    {
      group: "O+", donatesTo: "O+, A+, B+, AB+", receivesFrom: "O−, O+",
      donorType: L("Most commonly available donor in Bangladesh", "বাংলাদেশে সবচেয়ে সহজলভ্য দাতা", "المتبرع الأكثر توفّرًا في بنغلاديش"),
      recipientType: L("RhD-positive only", "শুধু Rh-পজিটিভ", "موجبو RhD فقط"),
      note: L("Approximately 35% of Bangladeshis are O+.", "বাংলাদেশিদের প্রায় ৩৫% O+।", "نحو 35% من البنغلاديشيين هم O+."),
    },
    {
      group: "A−", donatesTo: "A−, A+, AB−, AB+", receivesFrom: "O−, A−",
      donorType: L("Rare and highly valuable", "বিরল এবং অত্যন্ত মূল্যবান", "نادر وذو قيمة عالية"),
      recipientType: L("A− or O−", "A− বা O−", "A− أو O−"),
      note: L("Only about 1% of the population.", "জনসংখ্যার মাত্র প্রায় ১%।", "نحو 1% فقط من السكان."),
    },
    {
      group: "A+", donatesTo: "A+, AB+", receivesFrom: "O−, O+, A−, A+",
      donorType: L("Common", "সাধারণ", "شائع"),
      recipientType: L("A and O groups", "A ও O গ্রুপ", "فصيلتا A وO"),
      note: L("Approximately 28% of Bangladeshis.", "বাংলাদেশিদের প্রায় ২৮%।", "نحو 28% من البنغلاديشيين."),
    },
    {
      group: "B−", donatesTo: "B−, B+, AB−, AB+", receivesFrom: "O−, B−",
      donorType: L("Uncommon, always needed", "অপ্রতুল, সবসময়ই প্রয়োজন", "غير شائع ومطلوب دائمًا"),
      recipientType: L("B− or O−", "B− বা O−", "B− أو O−"),
      note: L("Frequent target of urgent appeals.", "জরুরি আবেদনে প্রায়ই এটিই চাওয়া হয়।", "كثيرًا ما يكون هدف النداءات العاجلة."),
    },
    {
      group: "B+", donatesTo: "B+, AB+", receivesFrom: "O−, O+, B−, B+",
      donorType: L("Very common in South Asia", "দক্ষিণ এশিয়ায় খুবই সাধারণ", "شائع جدًا في جنوب آسيا"),
      recipientType: L("B and O groups", "B ও O গ্রুপ", "فصيلتا B وO"),
      note: L("Approximately 25% of Bangladeshis.", "বাংলাদেশিদের প্রায় ২৫%।", "نحو 25% من البنغلاديشيين."),
    },
    {
      group: "AB−", donatesTo: "AB−, AB+", receivesFrom: "O−, A−, B−, AB−",
      donorType: L("Rarest of all groups (< 1%)", "সব গ্রুপের মধ্যে সবচেয়ে বিরল (< ১%)", "أندر الفصائل جميعًا (< 1%)"),
      recipientType: L("All RhD-negative groups", "সব Rh-নেগেটিভ গ্রুপ", "جميع الفصائل سالبة RhD"),
      note: L("Universal plasma donor as well — see the plasma table.", "সার্বজনীন প্লাজমা দাতাও বটে — প্লাজমার টেবিল দেখুন।", "وهو أيضًا مانح بلازما عام — انظر جدول البلازما."),
    },
    {
      group: "AB+", donatesTo: "AB+", receivesFrom: "O−, O+, A−, A+, B−, B+, AB−, AB+",
      donorType: L("Donates red cells only to AB+", "কেবল AB+-কেই লোহিত রক্তকণিকা দিতে পারে", "يتبرّع بالكريات الحمراء لـ AB+ فقط"),
      recipientType: L("Universal red-cell recipient", "সার্বজনীন লোহিত রক্তকণিকা গ্রহীতা", "مستقبل عام للكريات الحمراء"),
      note: L(
        "Can receive red cells from anyone, but AB+ red cells help almost no one else.",
        "যেকোনো কারও কাছ থেকে লোহিত রক্তকণিকা নিতে পারে, কিন্তু AB+ রক্ত অন্য প্রায় কারও কাজে আসে না।",
        "يستطيع استقبال كريات حمراء من أي شخص، لكن كريات AB+ الحمراء لا تفيد أحدًا غيره تقريبًا."
      ),
    },
  ],
  plasma: [
    {
      group: "AB",
      compatible: L("A, B, AB and O recipients", "A, B, AB ও O গ্রহীতা", "المستقبلون من الفصائل A وB وAB وO"),
      role: L("Universal plasma donor", "সার্বজনীন প্লাজমা দাতা", "مانح بلازما عام"),
      note: L(
        "AB plasma contains no anti-A or anti-B, so it is the emergency plasma of choice. Because AB donors are rare, most blood banks now use pathogen-reduced group-A plasma for emergencies.",
        "AB প্লাজমায় anti-A বা anti-B নেই, তাই জরুরি অবস্থায় এটিই প্রথম পছন্দ। AB দাতা বিরল হওয়ায় এখন বেশিরভাগ ব্লাড ব্যাংক জরুরি ক্ষেত্রে প্যাথোজেন-রিডিউসড A গ্রুপের প্লাজমা ব্যবহার করে।",
        "لا تحتوي بلازما AB على anti-A أو anti-B، لذا فهي بلازما الطوارئ المفضّلة. ولأن متبرعي AB نادرون، تستخدم معظم بنوك الدم اليوم بلازما من الفصيلة A معالجة بمسببات الأمراض في الحالات الطارئة."
      ),
    },
    {
      group: "A",
      compatible: L("A and AB recipients", "A ও AB গ্রহীতা", "المستقبلون من الفصيلتين A وAB"),
      role: L("Commonly used substitute for AB", "AB-এর সাধারণ বিকল্প", "بديل شائع عن AB"),
      note: L("Low-titre anti-B makes it acceptable in most emergency protocols.", "কম-মাত্রার anti-B থাকায় বেশিরভাগ জরুরি প্রোটোকলে এটি গ্রহণযোগ্য।", "انخفاض عيار anti-B يجعله مقبولًا في معظم بروتوكولات الطوارئ."),
    },
    {
      group: "B",
      compatible: L("B and AB recipients", "B ও AB গ্রহীতা", "المستقبلون من الفصيلتين B وAB"),
      role: L("Group-specific use", "গ্রুপ-নির্দিষ্ট ব্যবহার", "استخدام مطابق للفصيلة"),
      note: L("Contains anti-A.", "এতে anti-A আছে।", "يحتوي على anti-A."),
    },
    {
      group: "O",
      compatible: L("O recipients only (group-specific transfusion)", "শুধু O গ্রহীতা (গ্রুপ-নির্দিষ্ট সঞ্চালন)", "مستقبلو الفصيلة O فقط (نقل مطابق للفصيلة)"),
      role: L("Group-specific", "গ্রুপ-নির্দিষ্ট", "مطابق للفصيلة"),
      note: L(
        "Contains both anti-A and anti-B — the mirror image of red-cell compatibility.",
        "এতে anti-A ও anti-B দুটোই থাকে — লোহিত রক্তকণিকার সামঞ্জস্যতার ঠিক উল্টো চিত্র।",
        "يحتوي على anti-A وanti-B معًا — وهو الصورة المعاكسة لتوافق الكريات الحمراء."
      ),
    },
  ],
  platelets: [
    {
      point: L("ABO preference, not absolute", "ABO অগ্রাধিকার, বাধ্যতামূলক নয়", "تفضيل ABO وليس إلزامًا"),
      detail: L(
        "Platelets carry only weak ABO antigens. Group-identical platelets are preferred, but ABO-mismatched platelets are acceptable when they are the only option.",
        "প্লেটলেটে ABO অ্যান্টিজেন খুবই দুর্বল থাকে। একই গ্রুপের প্লেটলেট অগ্রাধিকার পায়, তবে অন্য কোনো বিকল্প না থাকলে ভিন্ন ABO-র প্লেটলেটও গ্রহণযোগ্য।",
        "تحمل الصفائح مستضدات ABO ضعيفة فقط. تُفضَّل الصفائح المطابقة للفصيلة، لكن الصفائح غير المطابقة مقبولة عندما تكون الخيار الوحيد."
      ),
    },
    {
      point: L("Plasma volume matters", "প্লাজমার পরিমাণ গুরুত্বপূর্ণ", "حجم البلازما مهم"),
      detail: L(
        "The incompatible part is the donor plasma. Use platelet concentrates with reduced plasma volume, or wash them, for major mismatches.",
        "অসামঞ্জস্যের মূল কারণ দাতার প্লাজমা। বড় অমিলের ক্ষেত্রে কম প্লাজমাযুক্ত প্লেটলেট কনসেনট্রেট ব্যবহার করুন, অথবা সেগুলো ধুয়ে নিন।",
        "الجزء غير المتوافق هو بلازما المتبرع. في حالات عدم التطابق الكبيرة استخدم مركّزات صفائح بحجم بلازما أقل، أو اغسلها."
      ),
    },
    {
      point: L("RhD still matters", "RhD এখনো গুরুত্বপূর্ণ", "ما يزال RhD مهمًا"),
      detail: L(
        "RhD-negative women of childbearing potential receiving RhD-positive platelets should be given Anti-D, because of contaminating red cells.",
        "প্রজননক্ষম Rh-নেগেটিভ নারীকে Rh-পজিটিভ প্লেটলেট দেওয়া হলে মিশে থাকা লোহিত রক্তকণিকার কারণে অ্যান্টি-ডি দিতে হয়।",
        "يجب إعطاء مضاد D للنساء سالبات RhD في سن الإنجاب عند تلقّيهن صفائح موجبة RhD، بسبب الكريات الحمراء الملوِّثة."
      ),
    },
    {
      point: L("Never cold-stored casually", "হিমায়িত করে রাখা যাবে না", "لا تُحفظ في البرودة أبدًا"),
      detail: L(
        "Platelets are stored at 20–24 °C with continuous agitation for only 5 days, so supply is chronically short — register as a platelet donor on BloodOra if you can.",
        "প্লেটলেট ২০–২৪° সে. তাপমাত্রায় ক্রমাগত নাড়াচাড়া সহ মাত্র ৫ দিন রাখা যায়, তাই সরবরাহ সবসময়ই কম থাকে — সম্ভব হলে BloodOra-তে প্লেটলেট দাতা হিসেবে নিবন্ধন করুন।",
        "تُحفظ الصفائح عند 20–24 درجة مئوية مع رجّ مستمر لمدة 5 أيام فقط، لذا فالإمداد شحيح دائمًا — سجّل كمتبرع صفائح على BloodOra إن استطعت."
      ),
    },
  ],
  components: [
    {
      component: L("Whole blood", "সম্পূর্ণ রক্ত", "الدم الكامل"),
      storage: "2–6 °C",
      shelfLife: L("35 days (CPDA-1)", "৩৫ দিন (CPDA-1)", "35 يومًا (CPDA-1)"),
      used: L(
        "Rarely used today; exchanged for component therapy in acute massive haemorrhage.",
        "আজকাল খুব কমই ব্যবহৃত হয়; তীব্র অধিক রক্তক্ষরণে উপাদান-ভিত্তিক চিকিৎসাই দেওয়া হয়।",
        "نادر الاستخدام اليوم؛ ويُسْتبدل بالعلاج بالمكوّنات في النزف الحاد الشديد."
      ),
    },
    {
      component: L("Packed red cells (PRBC)", "প্যাকড লোহিত রক্তকণিকা (PRBC)", "الكريات الحمراء المركّزة (PRBC)"),
      storage: "2–6 °C",
      shelfLife: L("35–42 days depending on additive", "অ্যাডিটিভভেদে ৩৫–৪২ দিন", "35–42 يومًا حسب المادة الحافظة"),
      used: L(
        "Anaemia, acute blood loss, thalassaemia, sickle cell disease, surgery.",
        "অ্যানিমিয়া, তীব্র রক্তক্ষরণ, থ্যালাসেমিয়া, সিকল সেল রোগ, অস্ত্রোপচার।",
        "فقر الدم، فقدان الدم الحاد، الثلاسيميا، فقر الدم المنجلي، الجراحة."
      ),
    },
    {
      component: L("Fresh frozen plasma (FFP)", "ফ্রেশ ফ্রোজেন প্লাজমা (FFP)", "البلازما الطازجة المجمّدة (FFP)"),
      storage: L("−25 °C or below", "−২৫° সে. বা তার কম", "−25 درجة مئوية أو أقل"),
      shelfLife: L("12 months (24 h after thawing at 1–6 °C)", "১২ মাস (১–৬° সে.-এ গলানোর পর ২৪ ঘণ্টা)", "12 شهرًا (24 ساعة بعد الإذابة عند 1–6 درجات مئوية)"),
      used: L("Coagulopathy, massive transfusion, warfarin reversal, TTP.", "কোয়াগুলোপ্যাথি, অধিক রক্ত সঞ্চালন, ওয়ারফারিন নিষ্ক্রিয়করণ, TTP।", "اعتلال التخثّر، النقل الهائل للدم، عكس تأثير الوارفارين، فرفرية نقص الصفائح الخثارية."),
    },
    {
      component: L("Cryoprecipitate", "ক্রায়োপ্রেসিপিটেট", "الراسب البردي"),
      storage: L("−25 °C or below", "−২৫° সে. বা তার কম", "−25 درجة مئوية أو أقل"),
      shelfLife: L("12 months", "১২ মাস", "12 شهرًا"),
      used: L("Fibrinogen deficiency, von Willebrand disease, haemophilia A, DIC.", "ফাইব্রিনোজেন স্বল্পতা, ভন উইলিব্র্যান্ড রোগ, হিমোফিলিয়া A, DIC।", "نقص الفيبرينوجين، مرض فون ويلبراند، الهيموفيليا A، التخثّر المنتشر داخل الأوعية."),
    },
    {
      component: L("Platelet concentrate", "প্লেটলেট কনসেনট্রেট", "مركّز الصفائح"),
      storage: L("20–24 °C with agitation", "২০–২৪° সে., নাড়াচাড়া সহ", "20–24 درجة مئوية مع رجّ مستمر"),
      shelfLife: L("5 days", "৫ দিন", "5 أيام"),
      used: L("Thrombocytopenia, dengue, chemotherapy, haematological malignancy.", "থ্রম্বোসাইটোপেনিয়া, ডেঙ্গু, কেমোথেরাপি, হিম্যাটোলজিক্যাল ক্যান্সার।", "نقص الصفائح، حمى الضنك، العلاج الكيميائي، الأورام الدموية."),
    },
  ],
  emergencies: [
    {
      rule: L("Unknown group, life-threatening bleed", "অজানা গ্রুপ, জীবননাশী রক্তক্ষরণ", "فصيلة مجهولة مع نزف مهدِّد للحياة"),
      action: L(
        "Give O− red cells. In men and postmenopausal women O+ may be used when O− is exhausted.",
        "O− লোহিত রক্তকণিকা দিন। পুরুষ এবং রজোনিবৃত্ত-পরবর্তী নারীদের ক্ষেত্রে O− ফুরিয়ে গেলে O+ দেওয়া যেতে পারে।",
        "أعطِ كريات حمراء O−. لدى الرجال والنساء بعد سن اليأس يمكن استخدام O+ عند نفاد O−."
      ),
    },
    {
      rule: L("Always cross-match", "সর্বদা ক্রস-ম্যাচ করুন", "أجرِ الاختبار المتصالب دائمًا"),
      action: L(
        "A type-and-crossmatch takes 45 minutes. In an emergency, give group-specific uncrossmatched blood and send the cross-match in parallel.",
        "টাইপ ও ক্রস-ম্যাচে ৪৫ মিনিট লাগে। জরুরি অবস্থায় গ্রুপ-নির্দিষ্ট অক্রসম্যাচড রক্ত দিন এবং ক্রস-ম্যাচ একই সঙ্গে পাঠিয়ে দিন।",
        "يستغرق تحديد الفصيلة والاختبار المتصالب 45 دقيقة. في الطوارئ أعطِ دمًا مطابقًا للفصيلة دون اختبار متصالب وأرسل العينة للفحص بالتوازي."
      ),
    },
    {
      rule: L("The RhD rule for women", "নারীদের ক্ষেত্রে RhD-নিয়ম", "قاعدة RhD للنساء"),
      action: L(
        "Never give RhD-positive red cells to a girl or woman of childbearing potential unless there is no alternative — and give Anti-D if you must.",
        "প্রজননক্ষম বালিকা বা নারীকে অন্য কোনো উপায় না থাকলে কখনোই Rh-পজিটিভ লোহিত রক্তকণিকা দেবেন না — দিতে বাধ্য হলে অ্যান্টি-ডি দিন।",
        "لا تعطِ كريات حمراء موجبة RhD لفتاة أو امرأة في سن الإنجاب إلا إذا انعدم البديل — وأعطِ مضاد D إن اضطررت."
      ),
    },
    {
      rule: L("Massive transfusion", "অধিক রক্ত সঞ্চালন", "النقل الهائل للدم"),
      action: L(
        "Use a 1:1:1 ratio of red cells : plasma : platelets, warm the blood, monitor ionised calcium and potassium.",
        "লোহিত রক্তকণিকা : প্লাজমা : প্লেটলেট ১:১:১ অনুপাতে দিন, রক্ত উষ্ণ রাখুন এবং আয়নাইজড ক্যালসিয়াম ও পটাশিয়াম পর্যবেক্ষণ করুন।",
        "استخدم نسبة 1:1:1 من الكريات الحمراء : البلازما : الصفائح، وسخّن الدم، وراقب الكالسيوم المتأيّن والبوتاسيوم."
      ),
    },
    {
      rule: L("Transfusion reactions", "সঞ্চালন-জনিত প্রতিক্রিয়া", "تفاعلات نقل الدم"),
      action: L(
        "Stop the transfusion immediately, keep IV access with saline, check the patient identity and unit labels, and send the unit plus a fresh sample to the blood bank.",
        "সঙ্গে সঙ্গে সঞ্চালন বন্ধ করুন, স্যালাইন দিয়ে শিরায় প্রবেশপথ রাখুন, রোগীর পরিচয় ও ব্যাগের লেবেল মিলিয়ে দেখুন, এবং ব্যাগসহ নতুন নমুনা ব্লাড ব্যাংকে পাঠান।",
        "أوقف النقل فورًا، وأبقِ الوصول الوريدي بالمحلول الملحي، وتحقّق من هوية المريض وملصقات الوحدة، وأرسل الوحدة مع عيّنة جديدة إلى بنك الدم."
      ),
    },
  ],
  facts: [
    L(
      "One whole-blood donation is separated into red cells, plasma and platelets — it can help up to three different patients.",
      "এক ব্যাগ সম্পূর্ণ রক্ত থেকে লোহিত রক্তকণিকা, প্লাজমা ও প্লেটলেট আলাদা করা হয় — তাতে তিনজন পর্যন্ত রোগী উপকৃত হতে পারেন।",
      "تُفصل وحدة الدم الكامل الواحدة إلى كريات حمراء وبلازما وصفائح — ويمكن أن تساعد ما يصل إلى ثلاثة مرضى مختلفين."
    ),
    L(
      "Red cells survive about 120 days in the body; a healthy donor can donate again after 8 weeks (men) or 12 weeks (women).",
      "শরীরে লোহিত রক্তকণিকা প্রায় ১২০ দিন টিকে থাকে; সুস্থ দাতা ৮ সপ্তাহ (পুরুষ) বা ১২ সপ্তাহ (নারী) পর আবার দান করতে পারেন।",
      "تعيش الكريات الحمراء نحو 120 يومًا في الجسم؛ ويستطيع المتبرع السليم التبرّع مجددًا بعد 8 أسابيع (للرجال) أو 12 أسبوعًا (للنساء)."
    ),
    L(
      "Platelet donors can donate every 2 weeks, up to 24 times a year.",
      "প্লেটলেট দাতারা প্রতি ২ সপ্তাহ পর দান করতে পারেন, বছরে সর্বোচ্চ ২৪ বার।",
      "يمكن لمتبرعي الصفائح التبرّع كل أسبوعين، حتى 24 مرة في السنة."
    ),
    L(
      "A single dengue patient may need 10–20 units of platelets.",
      "একজন ডেঙ্গু রোগীর ১০–২০ ব্যাগ প্লেটলেট লাগতে পারে।",
      "قد يحتاج مريض واحد بحمى الضنك إلى 10–20 وحدة صفائح."
    ),
    L(
      "O− red cells and AB plasma are the two most chronically scarce products in Bangladesh — both depend on a tiny donor pool.",
      "বাংলাদেশে O− লোহিত রক্তকণিকা ও AB প্লাজমা সবচেয়ে দীর্ঘমেয়াদি সংকটে থাকা দুটি উপাদান — দুটোই নির্ভর করে খুব ছোট একটি দাতা-গোষ্ঠীর ওপর।",
      "كريات O− الحمراء وبلازما AB هما أكثر منتجين شحًّا على الدوام في بنغلاديش — وكلاهما يعتمد على قاعدة متبرعين صغيرة جدًا."
    ),
    L(
      "The rarest blood group in the world is Rh-null ('golden blood'), documented in fewer than 50 people worldwide.",
      "পৃথিবীর সবচেয়ে বিরল রক্তের গ্রুপ হলো Rh-null ('গোল্ডেন ব্লাড'), যা বিশ্বজুড়ে ৫০ জনেরও কম মানুষের মধ্যে নথিভুক্ত হয়েছে।",
      "أندر فصيلة دم في العالم هي Rh-null («الدم الذهبي»)، وقد وُثّقت لدى أقل من 50 شخصًا حول العالم."
    ),
  ],
};

// ----------------------------------------------------------------- Resources
// `category` stays the canonical English key: it drives the URL filter and the
// icon/colour maps in views/resources.ejs. Views display it through the
// res_cat_* dictionary keys instead of printing the raw value.
export const resourcesReference = [
  {
    title: L(
      "Who can donate blood? The complete eligibility checklist",
      "কে রক্ত দিতে পারেন? সম্পূর্ণ যোগ্যতার তালিকা",
      "من يمكنه التبرّع بالدم؟ قائمة الأهلية الكاملة"
    ),
    category: KEEP("Donation"),
    readTime: "4",
    summary: L(
      "Age, weight, haemoglobin, intervals and the medical conditions that permanently or temporarily defer a donor.",
      "বয়স, ওজন, হিমোগ্লোবিন, দানের বিরতি এবং যেসব রোগ দাতাকে স্থায়ী বা সাময়িকভাবে আটকায়।",
      "العمر والوزن والهيموغلوبين والفواصل الزمنية، والحالات الطبية التي تؤجّل المتبرّع نهائيًا أو مؤقتًا."
    ),
    content: L(
      "In Bangladesh a voluntary donor must be 18–60 years old, weigh at least 50 kg, and have a haemoglobin of at least 12.5 g/dL. You must not have donated whole blood in the last 8 weeks (men) or 12 weeks (women). Permanent deferral applies to anyone with hepatitis B or C, HIV, HTLV, Chagas disease, variant CJD risk, or a history of cancer treated with chemotherapy. Temporary deferral applies after a tattoo or piercing (12 months), dental extraction (72 hours), minor surgery (6 months), live-virus vaccination (4 weeks), pregnancy (throughout, plus 6 weeks after delivery or miscarriage), a fever or antibiotic course (7 days after finishing), and travel to a malaria-endemic area (12 months). Blood pressure should be 100–180 systolic and 50–100 diastolic, pulse 50–100/min and regular.",
      "বাংলাদেশে একজন স্বেচ্ছা দাতার বয়স হতে হবে ১৮–৬০ বছর, ওজন কমপক্ষে ৫০ কেজি এবং হিমোগ্লোবিন কমপক্ষে ১২.৫ গ্রাম/ডেসিলিটার। গত ৮ সপ্তাহে (পুরুষ) বা ১২ সপ্তাহে (নারী) সম্পূর্ণ রক্ত দান করা চলবে না। হেপাটাইটিস B বা C, HIV, HTLV, চাগাস রোগ, ভ্যারিয়েন্ট CJD-র ঝুঁকি, অথবা কেমোথেরাপি দিয়ে চিকিৎসিত ক্যান্সারের ইতিহাস থাকলে স্থায়ীভাবে দান করা যাবে না। সাময়িক বিরতি প্রযোজ্য: উলকি বা পিয়ার্সিং (১২ মাস), দাঁত তোলা (৭২ ঘণ্টা), ছোট অস্ত্রোপচার (৬ মাস), জীবন্ত ভাইরাসের টিকা (৪ সপ্তাহ), গর্ভাবস্থা (পুরো সময় এবং প্রসব বা গর্ভপাতের পর ৬ সপ্তাহ), জ্বর বা অ্যান্টিবায়োটিক কোর্স (শেষ হওয়ার ৭ দিন পর), এবং ম্যালেরিয়া-প্রবণ এলাকায় ভ্রমণ (১২ মাস)। রক্তচাপ সিস্টোলিক ১০০–১৮০ ও ডায়াস্টোলিক ৫০–১০০ হতে হবে, পালস ৫০–১০০/মিনিট এবং নিয়মিত হতে হবে।",
      "في بنغلاديش يجب أن يكون المتبرّع الطوعي بعمر 18–60 سنة، ووزنه 50 كغ على الأقل، وهيموغلوبينه 12.5 غ/دل على الأقل. ويجب ألّا يكون قد تبرّع بدم كامل خلال آخر 8 أسابيع (للرجال) أو 12 أسبوعًا (للنساء). يستثنى نهائيًا المصابون بالتهاب الكبد B أو C، أو HIV، أو HTLV، أو داء شاغاس، أو خطر الإصابة بـ vCJD، أو من عولجوا من السرطان بالعلاج الكيميائي. ويؤجَّل مؤقتًا بعد الوشم أو الثقب (12 شهرًا)، وقلع الأسنان (72 ساعة)، والجراحة الصغرى (6 أشهر)، ولقاح الفيروسات الحية (4 أسابيع)، والحمل (طواله بالإضافة إلى 6 أسابيع بعد الولادة أو الإجهاض)، والحمى أو كورس المضادات الحيوية (7 أيام بعد انتهائه)، والسفر إلى منطقة متوطنة بالملاريا (12 شهرًا). ويجب أن يكون الضغط 100–180 انقباضيًا و50–100 انبساطيًا، والنبض 50–100/دقيقة ومنتظمًا."
    ),
  },
  {
    title: L(
      "What happens on the day you donate — step by step",
      "দানের দিনে কী ঘটে — ধাপে ধাপে",
      "ماذا يحدث في يوم التبرّع — خطوة بخطوة"
    ),
    category: KEEP("Donation"),
    readTime: "3",
    summary: L(
      "Registration, screening, the 8–10 minute draw, and the 15-minute recovery that protects you.",
      "নিবন্ধন, স্বাস্থ্য-যাচাই, ৮–১০ মিনিটের রক্ত সংগ্রহ এবং আপনার সুরক্ষার জন্য ১৫ মিনিটের বিশ্রাম।",
      "التسجيل، والفحص، وسحب الدم خلال 8–10 دقائق، وفترة التعافي البالغة 15 دقيقة التي تحميك."
    ),
    content: L(
      "Registration takes 5 minutes: identity, contact details and consent. Screening follows — a short medical history, blood pressure, pulse, temperature and a finger-prick haemoglobin. The draw itself takes 8–10 minutes for 450 mL into a citrate anticoagulant bag; you will feel a brief sting and nothing more. Afterwards you rest for 15 minutes with fluids and biscuits. Keep the pressure dressing on for 4–6 hours, drink an extra litre of fluid that day, avoid heavy lifting or strenuous exercise for 24 hours, and eat normally. Total time in the centre: about 30–45 minutes. The donated unit is then tested for HIV, HBsAg, anti-HCV, VDRL, malaria antigen and ABO/RhD grouping before release.",
      "নিবন্ধনে লাগে ৫ মিনিট: পরিচয়, যোগাযোগের তথ্য ও সম্মতি। এরপর স্বাস্থ্য-যাচাই — সংক্ষিপ্ত চিকিৎসা-ইতিহাস, রক্তচাপ, পালস, তাপমাত্রা এবং আঙুল ফুটিয়ে হিমোগ্লোবিন পরীক্ষা। রক্ত সংগ্রহে ৮–১০ মিনিট লাগে, ৪৫০ মিলি রক্ত সিট্রেট অ্যান্টিকোয়াগুল্যান্ট ব্যাগে নেওয়া হয়; সামান্য ফোঁড়ার ব্যথা ছাড়া আর কিছুই অনুভব হবে না। এরপর ১৫ মিনিট পানীয় ও বিস্কুটসহ বিশ্রাম নিন। ৪–৬ ঘণ্টা চাপ-ব্যান্ডেজ লাগানো রাখুন, সেদিন অতিরিক্ত এক লিটার তরল পান করুন, ২৪ ঘণ্টা ভারী জিনিস তোলা বা কঠোর ব্যায়াম এড়িয়ে চলুন এবং স্বাভাবিকভাবে খান। কেন্দ্রে মোট সময়: প্রায় ৩০–৪৫ মিনিট। এরপর দান করা ব্যাগটি ছাড়ার আগে HIV, HBsAg, anti-HCV, VDRL, ম্যালেরিয়া অ্যান্টিজেন ও ABO/RhD গ্রুপিং পরীক্ষা করা হয়।",
      "يستغرق التسجيل 5 دقائق: الهوية وبيانات الاتصال والموافقة. يليه الفحص — تاريخ مرضي موجز، وضغط الدم، والنبض، والحرارة، وهيموغلوبين بوخز الإصبع. أما السحب نفسه فيستغرق 8–10 دقائق لسحب 450 مل في كيس يحوي سيترات مانعة للتخثّر؛ ولن تشعر إلا بوخزة قصيرة. بعدها ترتاح 15 دقيقة مع السوائل والبسكويت. أبقِ ضماد الضغط 4–6 ساعات، واشرب لترًا إضافيًا من السوائل في ذلك اليوم، وتجنّب رفع الأثقال أو التمرين المرهق لمدة 24 ساعة، وكل بشكل طبيعي. إجمالي الوقت في المركز: نحو 30–45 دقيقة. ثم تُفحص الوحدة المتبرَّع بها لـ HIV وHBsAg وanti-HCV وVDRL ومستضد الملاريا وتحديد ABO/RhD قبل صرفها."
    ),
  },
  {
    title: L(
      "Preparing for donation: food, water and the night before",
      "দানের প্রস্তুতি: খাবার, পানি এবং আগের রাত",
      "الاستعداد للتبرّع: الطعام والماء والليلة السابقة"
    ),
    category: KEEP("Donation"),
    readTime: "3",
    summary: L(
      "How to avoid the faint, the bruise and the low-iron deferral.",
      "কীভাবে অজ্ঞান হওয়া, ফোলা দাগ ও কম লোহার কারণে দান আটকে যাওয়া এড়ানো যায়।",
      "كيف تتجنّب الإغماء والكدمات وتأجيل التبرّع بسبب نقص الحديد."
    ),
    content: L(
      "Sleep 6–8 hours the night before. Never donate on an empty stomach — eat a normal meal 2–3 hours beforehand, because donors who eat first are far less likely to feel faint. Drink 500 mL of water in the hour before donation; this alone measurably reduces vasovagal reactions. Avoid fatty food immediately before, as lipaemic plasma can make the unit unusable. Avoid alcohol for 24 hours before and after. Iron-rich foods in the weeks before donation — liver, red meat, lentils, spinach, fortified cereals, plus vitamin C to boost absorption — reduce the chance of a low-haemoglobin deferral. Wear a shirt with sleeves that roll above the elbow.",
      "আগের রাতে ৬–৮ ঘণ্টা ঘুমান। কখনোই খালি পেটে রক্ত দেবেন না — ২–৩ ঘণ্টা আগে স্বাভাবিক খাবার খান, কারণ আগে খেয়ে নেওয়া দাতাদের অজ্ঞান হওয়ার সম্ভাবনা অনেক কম। দানের আগের এক ঘণ্টায় ৫০০ মিলি পানি পান করুন; এতেই ভ্যাসোভ্যাগাল প্রতিক্রিয়া উল্লেখযোগ্যভাবে কমে। একেবারে আগে চর্বিযুক্ত খাবার এড়িয়ে চলুন, কারণ লিপেমিক প্লাজমায় ব্যাগটি অকেজো হয়ে যেতে পারে। আগে ও পরে ২৪ ঘণ্টা অ্যালকোহল এড়িয়ে চলুন। দানের আগের কয়েক সপ্তাহে লোহা-সমৃদ্ধ খাবার — কলিজা, লাল মাংস, ডাল, পালং শাক, ফোর্টিফাইড সিরিয়াল, সঙ্গে শোষণ বাড়াতে ভিটামিন সি — কম হিমোগ্লোবিনের কারণে দান আটকে যাওয়ার সম্ভাবনা কমায়। এমন শার্ট পরুন যার হাতা কনুইয়ের ওপর পর্যন্ত গুটানো যায়।",
      "نم 6–8 ساعات في الليلة السابقة. لا تتبرّع أبدًا على معدة فارغة — تناول وجبة عادية قبل 2–3 ساعات، فالمتبرّعون الذين يأكلون أولًا أقل عرضة للإغماء بكثير. اشرب 500 مل من الماء خلال الساعة السابقة للتبرّع؛ فهذا وحده يقلّل التفاعلات الوعائية المبهمة بشكل ملموس. تجنّب الطعام الدسم مباشرة قبل التبرّع، لأن البلازما الدهنية قد تجعل الوحدة غير صالحة. وتجنّب الكحول 24 ساعة قبل التبرّع وبعده. والأطعمة الغنية بالحديد في الأسابيع السابقة — الكبد واللحوم الحمراء والعدس والسبانخ والحبوب المدعّمة، مع فيتامين C لتحسين الامتصاص — تقلّل احتمال التأجيل بسبب انخفاض الهيموغلوبين. والبس قميصًا يمكن طيّ كمّيه فوق المرفق."
    ),
  },
  {
    title: L(
      "After donating: side effects, recovery and red flags",
      "দানের পরে: পার্শ্বপ্রতিক্রিয়া, সুস্থতা ও সতর্কতার লক্ষণ",
      "بعد التبرّع: الآثار الجانبية والتعافي وعلامات الخطر"
    ),
    category: KEEP("Donation"),
    readTime: "3",
    summary: L(
      "The normal reactions, how to manage them, and the two symptoms that need medical attention.",
      "স্বাভাবিক প্রতিক্রিয়া, সেগুলো সামলানোর উপায়, এবং যে দুটি লক্ষণে চিকিৎসকের কাছে যেতে হয়।",
      "التفاعلات الطبيعية، وكيفية التعامل معها، والأعراض التي تستدعي العناية الطبية."
    ),
    content: L(
      "Most donors feel completely normal. The common reactions are a bruise at the needle site (apply a cold pack for 15 minutes, then warmth), light-headedness for a few minutes, and fatigue for the rest of the day. If you feel faint, lie down and raise your legs, or sit with your head between your knees; apply applied-tension — crossing the legs and tensing the thigh and abdominal muscles — to abort a vasovagal episode. Seek medical attention if the needle site keeps bleeding after 15 minutes of firm pressure, if numbness or shooting pain radiates down the arm (possible nerve irritation), or if you develop fever and spreading redness at the site within a few days.",
      "বেশিরভাগ দাতা সম্পূর্ণ স্বাভাবিক বোধ করেন। সাধারণ প্রতিক্রিয়া হলো ইনজেকশনের স্থানে ফোলা দাগ (১৫ মিনিট বরফ-সেকা, এরপর উষ্ণ সেঁক), কয়েক মিনিট মাথা হালকা লাগা, এবং বাকি দিন ক্লান্তি। অজ্ঞান লাগলে শুয়ে পড়ুন ও পা উঁচু করে রাখুন, অথবা বসে হাঁটুর মাঝখানে মাথা রাখুন; ভ্যাসোভ্যাগাল প্রতিক্রিয়া ঠেকাতে অ্যাপ্লাইড-টেনশন প্রয়োগ করুন — পা আড়াআড়ি করে উরু ও পেটের পেশিতে জোর দিন। ১৫ মিনিট শক্ত করে চাপ দেওয়ার পরও সুইয়ের স্থান থেকে রক্ত পড়তে থাকলে, হাতে অবশ ভাব বা ছুরি ফোটানোর মতো ব্যথা ছড়িয়ে পড়লে (স্নায়ুর প্রদাহ হতে পারে), অথবা কয়েক দিনের মধ্যে সেখানে জ্বর ও লালচে ভাব ছড়িয়ে পড়লে চিকিৎসকের কাছে যান।",
      "يشعر معظم المتبرّعين بأنهم على ما يرام تمامًا. والتفاعلات الشائعة هي كدمة في موضع الإبرة (ضع كمادة باردة 15 دقيقة ثم دفئها)، ودوار خفيف لبضع دقائق، وإرهاق بقية اليوم. إذا شعرت بالإغماء فاستلقِ وارفع ساقيك، أو اجلس ورأسك بين ركبتيك؛ وطبّق شدًّا عضليًا — تقاطع الساقين وشد عضلات الفخذ والبطن — لإيقاف النوبة الوعائية المبهمة. راجع الطبيب إذا استمر النزف من موضع الإبرة بعد 15 دقيقة من الضغط القوي، أو إذا امتدّ خدر أو ألم حادّ بطول الذراع (احتمال تهيّج العصب)، أو إذا ظهرت حمى واحمرار منتشر في الموضع خلال أيام."
    ),
  },
  {
    title: L(
      "Blood groups and inheritance: where your group comes from",
      "রক্তের গ্রুপ ও বংশগতি: আপনার গ্রুপ আসে কোথা থেকে",
      "فصائل الدم والوراثة: من أين تأتي فصيلتك"
    ),
    category: KEEP("Education"),
    readTime: "4",
    summary: L(
      "ABO alleles, the RhD gene, the Punnett square, and why an O+ couple can have an O− child.",
      "ABO অ্যালিল, RhD জিন, পুনেট স্কোয়ার, এবং কেন O+ দম্পতির O− সন্তান হতে পারে।",
      "أليلات ABO، وجين RhD، ومربّع بانيت، ولماذا قد يكون لدى زوجين O+ طفل O−."
    ),
    content: L(
      "ABO blood group is controlled by one gene with three alleles: A and B are codominant, O is recessive. Your genotype determines the antigens on your red cells: AA or AO expresses A, BB or BO expresses B, AB expresses both, and OO expresses neither. RhD is a separate gene where D is dominant over d. This is why two A+ parents can have an O− child: both are AO and Dd, so a quarter of their children inherit O from each parent and d from each parent. Antigen frequencies differ by population — in Bangladesh roughly 33% are O+, 28% A+, 25% B+, 12% AB+, and only about 7% of the population is RhD-negative, which is why RhD-negative donors are always urgently needed.",
      "ABO রক্তের গ্রুপ নির্ধারিত হয় তিনটি অ্যালিলসহ একটি জিন দিয়ে: A ও B সম-প্রকট, O প্রচ্ছন্ন। আপনার জিনোটাইপ ঠিক করে আপনার লোহিত রক্তকণিকায় কোন অ্যান্টিজেন থাকবে: AA বা AO হলে A, BB বা BO হলে B, AB হলে দুটোই, এবং OO হলে কোনোটিই নয়। RhD আলাদা একটি জিন, যেখানে d-এর ওপর D প্রকট। এ কারণেই দুজন A+ পিতামাতার O− সন্তান হতে পারে: দুজনেই AO ও Dd, তাই তাদের এক-চতুর্থাংশ সন্তান উভয় পিতামাতার কাছ থেকে O ও d পায়। অ্যান্টিজেনের প্রাদুর্ভাব জনগোষ্ঠীভেদে ভিন্ন — বাংলাদেশে প্রায় ৩৩% O+, ২৮% A+, ২৫% B+, ১২% AB+, এবং মাত্র প্রায় ৭% মানুষ Rh-নেগেটিভ। এ কারণেই Rh-নেগেটিভ দাতা সবসময়ই জরুরিভাবে প্রয়োজন।",
      "تتحكّم فصيلة ABO جينة واحدة بثلاثة أليلات: A وB سائدان معًا، وO متنحٍّ. ويحدّد التركيب الجيني المستضدات على كرياتك الحمراء: AA أو AO يُعبّر عن A، وBB أو BO يُعبّر عن B، وAB يُعبّر عن كليهما، وOO لا يُعبّر عن أيّهما. أما RhD فجينة مستقلة يكون فيها D سائدًا على d. ولهذا يمكن لأبوين A+ أن ينجبا طفلًا O−: فكلاهما AO وDd، فتَرِث ربع أطفالهما O من كل والد وd من كل والد. وتختلف تكرارات المستضدات بين الشعوب — ففي بنغلاديش نحو 33% هم O+ و28% A+ و25% B+ و12% AB+، ونحو 7% فقط من السكان سالبو RhD، ولهذا فمتبرّعو RhD السالبون مطلوبون بإلحاح دائمًا."
    ),
  },
  {
    title: L(
      "Understanding the blood test report before transfusion",
      "সঞ্চালনের আগের রক্ত পরীক্ষার রিপোর্ট বোঝা",
      "فهم تقرير فحوص الدم قبل النقل"
    ),
    category: KEEP("Education"),
    readTime: "4",
    summary: L(
      "ABO/RhD grouping, antibody screen, cross-match and the direct antiglobulin test explained.",
      "ABO/RhD গ্রুপিং, অ্যান্টিবডি স্ক্রিন, ক্রস-ম্যাচ ও ডিরেক্ট অ্যান্টিগ্লোবিউলিন পরীক্ষার ব্যাখ্যা।",
      "شرح تحديد ABO/RhD، وفحص الأجسام المضادة، والاختبار المتصالب، واختبار الأجسام المضادة المباشر."
    ),
    content: L(
      "Forward grouping mixes your red cells with known anti-A and anti-B sera; reverse grouping mixes your plasma with known A and B red cells. The two must agree — a discrepancy is the most common cause of a delayed blood-bank report. RhD typing uses anti-D reagent; a weak reaction may indicate the weak-D variant, which requires indirect antiglobulin testing. The antibody screen detects unexpected red-cell antibodies (anti-Kell, anti-E, anti-c and so on) that can cause delayed haemolytic reactions. The cross-match is the final safety step: donor red cells are mixed with the recipient's plasma and must show no agglutination. The direct antiglobulin test (Coombs) checks whether antibodies are already coating the patient's own red cells — it is positive in autoimmune haemolytic anaemia and in HDFN.",
      "ফরোয়ার্ড গ্রুপিংয়ে আপনার লোহিত রক্তকণিকার সঙ্গে জানা anti-A ও anti-B সিরাম মেশানো হয়; রিভার্স গ্রুপিংয়ে আপনার প্লাজমার সঙ্গে জানা A ও B রক্তকণিকা মেশানো হয়। দুটো অবশ্যই মিলতে হবে — অমিল হলেই ব্লাড ব্যাংকের রিপোর্ট দেরি হওয়ার সবচেয়ে সাধারণ কারণ। RhD টাইপিংয়ে anti-D রি-এজেন্ট ব্যবহৃত হয়; দুর্বল প্রতিক্রিয়া weak-D ভ্যারিয়েন্ট নির্দেশ করতে পারে, যার জন্য ইনডিরেক্ট অ্যান্টিগ্লোবিউলিন পরীক্ষা লাগে। অ্যান্টিবডি স্ক্রিন অপ্রত্যাশিত লোহিত রক্তকণিকা-অ্যান্টিবডি (anti-Kell, anti-E, anti-c ইত্যাদি) শনাক্ত করে, যা বিলম্বিত হিমোলাইটিক প্রতিক্রিয়া ঘটাতে পারে। ক্রস-ম্যাচ হলো শেষ নিরাপত্তা ধাপ: দাতার লোহিত রক্তকণিকা গ্রহীতার প্লাজমার সঙ্গে মেশানো হয় এবং কোনো অ্যাগ্লুটিনেশন দেখা যাবে না। ডিরেক্ট অ্যান্টিগ্লোবিউলিন পরীক্ষা (Coombs) দেখে রোগীর নিজের লোহিত রক্তকণিকায় আগে থেকেই অ্যান্টিবডি লেগে আছে কি না — অটোইমিউন হিমোলাইটিক অ্যানিমিয়া ও HDFN-তে এটি পজিটিভ হয়।",
      "في التحديد الأمامي تُخلط كرياتك الحمراء مع أمصال anti-A وanti-B معروفة؛ وفي التحديد العكسي يُخلط بلازما مع كريات A وB معروفة. ويجب أن يتطابق الاثنان — فأي تعارض هو السبب الأشيع لتأخّر تقرير بنك الدم. ويستخدم تحديد RhD كاشف anti-D؛ وقد يدلّ التفاعل الضعيف على متحوّر weak-D الذي يتطلّب اختبار الأجسام المضادة غير المباشر. ويكشف فحص الأجسام المضادة عن أجسام مضادة غير متوقّعة ضد الكريات الحمراء (anti-Kell وanti-E وanti-c وغيرها) قد تسبّب تفاعلات انحلال متأخّرة. والاختبار المتصالب هو الخطوة الأخيرة للأمان: تُخلط كريات المتبرّع الحمراء مع بلازما المستقبل ويجب ألّا يظهر أي تكتّل. ويكشف اختبار الأجسام المضادة المباشر (Coombs) ما إذا كانت الأجسام المضادة تغطّي أصلًا كريات المريض نفسه — ويكون إيجابيًا في فقر الدم الانحلالي المناعي الذاتي وفي HDFN."
    ),
  },
  {
    title: L(
      "First aid for severe bleeding while you wait for blood",
      "রক্ত আসার আগ পর্যন্ত তীব্র রক্তক্ষরণে প্রাথমিক চিকিৎসা",
      "الإسعاف الأولي للنزف الشديد أثناء انتظار الدم"
    ),
    category: KEEP("First-Aid"),
    readTime: "5",
    summary: L(
      "Direct pressure, elevation, tourniquets and shock positioning — what actually saves the patient before transfusion.",
      "সরাসরি চাপ, উঁচু করে রাখা, টুর্নিকুয়েট ও শক-অবস্থান — সঞ্চালনের আগে আসলে কী রোগীকে বাঁচায়।",
      "الضغط المباشر والرفع والعاصبة ووضعية الصدمة — ما ينقذ المريض فعلًا قبل النقل."
    ),
    content: L(
      "The single most effective action is firm, continuous direct pressure on the wound with a clean cloth — do not remove a soaked dressing, add another layer on top. Raise the injured limb above heart level if no fracture is suspected. For life-threatening limb bleeding that does not respond to pressure, apply a commercial tourniquet 5–7 cm above the wound, never over a joint, tighten until bleeding stops, and write down the time; do not loosen it. Lay the patient flat with the legs elevated 30 cm, keep them warm with a blanket, and give nothing to drink if surgery may be needed. Watch for shock: pale cold clammy skin, rapid weak pulse, rapid breathing, restlessness and confusion. Call for emergency help and post the request on BloodOra at the same time — the average response for an urgent request is under 30 minutes.",
      "সবচেয়ে কার্যকর পদক্ষেপ হলো পরিষ্কার কাপড় দিয়ে ক্ষতস্থানে শক্ত, অবিরাম সরাসরি চাপ — ভিজে যাওয়া ব্যান্ডেজ খুলবেন না, তার ওপর আরেকটি স্তর দিন। হাড় ভাঙার সন্দেহ না থাকলে আক্রান্ত অঙ্গটি হৃৎপিণ্ডের চেয়ে উঁচুতে রাখুন। হাত-পায়ের জীবননাশী রক্তক্ষরণ চাপে না কমলে ক্ষতের ৫–৭ সেমি ওপরে বাণিজ্যিক টুর্নিকুয়েট লাগান, কখনোই গিঁটের ওপর নয়, রক্ত পড়া বন্ধ না হওয়া পর্যন্ত শক্ত করুন এবং সময় লিখে রাখুন; আলগা করবেন না। রোগীকে চিত করে শুইয়ে পা ৩০ সেমি উঁচুতে রাখুন, কম্বল দিয়ে উষ্ণ রাখুন, এবং অস্ত্রোপচারের সম্ভাবনা থাকলে কিছু পান করতে দেবেন না। শকের লক্ষণ খেয়াল করুন: ফ্যাকাশে, ঠান্ডা, ঘামা ত্বক, দ্রুত ও দুর্বল পালস, দ্রুত শ্বাস, অস্থিরতা ও বিভ্রান্তি। একই সঙ্গে জরুরি সেবায় ফোন করুন এবং BloodOra-তে আবেদন পোস্ট করুন — জরুরি আবেদনে সাধারণত ৩০ মিনিটের কম সময়ে সাড়া মেলে।",
      "أكثر إجراء فعالية هو الضغط المباشر القوي والمستمر على الجرح بقطعة قماش نظيفة — لا تنزع ضمادًا مبلّلًا، بل أضف طبقة أخرى فوقه. ارفع الطرف المصاب فوق مستوى القلب إذا لم يُشتبه بكسر. وفي نزف الأطراف المهدِّد للحياة الذي لا يستجيب للضغط، ضع عاصبة طبية على بعد 5–7 سم فوق الجرح، ولا فوق مفصل أبدًا، واشددها حتى يتوقّف النزف، ودوّن الوقت؛ ولا ترخِها. أرقِد المريض على ظهره مع رفع ساقيه 30 سم، وأبقه دافئًا ببطانية، ولا تعطه شيئًا ليشربه إذا كانت الجراحة محتملة. راقب علامات الصدمة: جلد شاحب بارد رطب، نبض سريع ضعيف، تنفّس سريع، قلق وتشوّش. اتصل بالإسعاف وانشر الطلب على BloodOra في الوقت نفسه — فمتوسّط الاستجابة للطلب العاجل أقل من 30 دقيقة."
    ),
  },
  {
    title: L(
      "Dengue and platelets: what the count really means",
      "ডেঙ্গু ও প্লেটলেট: কাউন্ট আসলে কী বোঝায়",
      "حمى الضنك والصفائح: ماذا يعني العدد فعلًا"
    ),
    category: KEEP("First-Aid"),
    readTime: "4",
    summary: L(
      "When platelet transfusion genuinely helps in dengue, and why the number alone should not trigger it.",
      "ডেঙ্গুতে প্লেটলেট সঞ্চালন কখন সত্যিই কাজে লাগে, এবং কেন শুধু সংখ্যা দেখে তা দেওয়া উচিত নয়।",
      "متى يساعد نقل الصفائح فعلًا في حمى الضنك، ولماذا لا ينبغي للعدد وحده أن يحرّكه."
    ),
    content: L(
      "A falling platelet count is expected in dengue and by itself is not an indication to transfuse. Transfusion is indicated for significant bleeding — gastrointestinal, mucosal or intracranial — regardless of the count, and is considered prophylactically only below 10,000–20,000/µL with additional risk factors. The mainstay of dengue management is careful fluid management: isotonic crystalloid titrated to the haematocrit and urine output, with strict avoidance of over-hydration, which causes pulmonary oedema. Because platelets are stored at room temperature for only 5 days, dengue season creates acute shortages — a single patient may need 10–20 units. Register as a platelet donor on BloodOra before the season peaks.",
      "ডেঙ্গুতে প্লেটলেট কাউন্ট কমা স্বাভাবিক এবং শুধু তার কারণে সঞ্চালনের প্রয়োজন নেই। উল্লেখযোগ্য রক্তক্ষরণ — পরিপাকতন্ত্রে, মিউকোসায় বা মস্তিষ্কে — হলে কাউন্ট যাই হোক সঞ্চালন দিতে হয়; আর অতিরিক্ত ঝুঁকির কারণ থাকলে ১০,০০০–২০,০০০/µL-এর নিচে নামলে প্রতিরোধমূলকভাবে দেওয়ার কথা বিবেচনা করা হয়। ডেঙ্গু ব্যবস্থাপনার মূল ভিত্তি সতর্ক তরল ব্যবস্থাপনা: হেমাটোক্রিট ও প্রস্রাবের পরিমাণ অনুযায়ী আইসোটোনিক ক্রিস্টালয়েড, এবং অতি-তরলায়ন কঠোরভাবে এড়ানো — এতে ফুসফুসে পানি জমে। প্লেটলেট কক্ষ তাপমাত্রায় মাত্র ৫ দিন রাখা যায় বলে ডেঙ্গু মৌসুমে তীব্র সংকট তৈরি হয় — একজন রোগীর ১০–২০ ব্যাগ লাগতে পারে। মৌসুমের চূড়ার আগেই BloodOra-তে প্লেটলেট দাতা হিসেবে নিবন্ধন করুন।",
      "انخفاض عدد الصفائح متوقّع في حمى الضنك ولا يُعدّ بمفرده استطبابًا للنقل. ويُستطبّ النقل عند وجود نزف مهم — معدي معوي أو مخاطي أو داخل الجمجمة — بغضّ النظر عن العدد، ويُفكَّر فيه وقائيًا فقط عند أقل من 10,000–20,000/µL مع عوامل خطر إضافية. وركيزة تدبير حمى الضنك هي الإدارة الدقيقة للسوائل: محاليل بلورية متساوية التوتر تُعاير حسب الهيماتوكريت وناتج البول، مع تجنّب صارم لفرط السوائل الذي يسبّب وذمة الرئة. ولأن الصفائح تُحفظ في حرارة الغرفة 5 أيام فقط، يخلق موسم الضنك نقصًا حادًا — فقد يحتاج مريض واحد إلى 10–20 وحدة. سجّل كمتبرّع صفائح على BloodOra قبل ذروة الموسم."
    ),
  },
  {
    title: L(
      "Nutrition for donors: rebuilding iron after a donation",
      "দাতাদের পুষ্টি: দানের পর লোহা ফিরিয়ে আনা",
      "تغذية المتبرّعين: إعادة بناء الحديد بعد التبرّع"
    ),
    category: KEEP("Health"),
    readTime: "4",
    summary: L(
      "Foods, absorption enhancers and blockers, and when an iron supplement is appropriate.",
      "খাবার, শোষণ বাড়ানো ও আটকানোর উপাদান, এবং কখন আয়রন সাপ্লিমেন্ট দরকার।",
      "الأطعمة، وما يعزّز الامتصاص وما يعيقه، ومتى يكون مكمّل الحديد مناسبًا."
    ),
    content: L(
      "One 450 mL donation removes roughly 200–250 mg of iron, and the body needs 4–8 weeks to replace it from diet alone. Excellent sources are beef liver (6 mg per 100 g), red meat, chicken, fish, lentils (3.3 mg per 100 g), chickpeas, tofu, pumpkin seeds, dark leafy greens and iron-fortified cereals. Absorption improves dramatically with vitamin C — add lemon, guava, amloki or orange to the meal. Absorption is blocked by tea and coffee (tannins), calcium-rich dairy taken at the same meal, and some antacids; keep these at least an hour away from your iron-rich meal. Frequent donors, menstruating women and vegetarians should ask for a low-dose daily or alternate-day iron supplement — alternate-day dosing actually absorbs better than daily dosing because it avoids the hepcidin rebound.",
      "৪৫০ মিলির এক দানে প্রায় ২০০–২৫০ মিলিগ্রাম লোহা চলে যায়, এবং শুধু খাবার থেকে তা পূরণ হতে শরীরের ৪–৮ সপ্তাহ লাগে। চমৎকার উৎস হলো গরুর কলিজা (প্রতি ১০০ গ্রামে ৬ মিলিগ্রাম), লাল মাংস, মুরগি, মাছ, ডাল (প্রতি ১০০ গ্রামে ৩.৩ মিলিগ্রাম), ছোলা, টফু, মিষ্টিকুমড়ার বিচি, গাঢ় সবুজ শাকসবজি ও লোহা-ফোর্টিফাইড সিরিয়াল। ভিটামিন সি-তে শোষণ নাটকীয়ভাবে বাড়ে — খাবারে লেবু, পেয়ারা, আমলকী বা কমলা যোগ করুন। চা ও কফি (ট্যানিন), একই খাবারে নেওয়া ক্যালসিয়াম-সমৃদ্ধ দুগ্ধ এবং কিছু অ্যান্টাসিড শোষণ আটকে দেয়; এগুলো লোহা-সমৃদ্ধ খাবারের অন্তত এক ঘণ্টা দূরে রাখুন। ঘন ঘন দানকারী, ঋতুমতী নারী ও নিরামিষাশীরা কম মাত্রায় প্রতিদিন বা একদিন পরপর আয়রন সাপ্লিমেন্টের বিষয়ে পরামর্শ নিন — একদিন পরপর দিলে হেপসিডিন রিবাউন্ড এড়ানো যায় বলে শোষণ আসলে বেশি হয়।",
      "تُزيل وحدة واحدة بسعة 450 مل نحو 200–250 ملغ من الحديد، ويحتاج الجسم 4–8 أسابيع لتعويضه من الغذاء وحده. ومن أفضل المصادر كبد البقر (6 ملغ لكل 100 غ)، واللحوم الحمراء، والدجاج، والسمك، والعدس (3.3 ملغ لكل 100 غ)، والحمّص، والتوفو، وبذور اليقطين، والخضار الورقية الداكنة، والحبوب المدعّمة بالحديد. ويتحسّن الامتصاص بدرجة كبيرة مع فيتامين C — أضف الليمون أو الجوافة أو الأملا أو البرتقال إلى الوجبة. ويعيق الامتصاصَ الشاي والقهوة (العفص)، ومنتجات الألبان الغنية بالكالسيوم في الوجبة نفسها، وبعض مضادات الحموضة؛ فاجعل هذه بعيدة ساعة على الأقل عن وجبتك الغنية بالحديد. وينبغي للمتبرّعين المتكرّرين والنساء في سن الحيض والنباتيين أن يطلبوا مكمّل حديد بجرعة منخفضة يوميًا أو يومًا بعد يوم — فالجرعة يومًا بعد يوم تُمتصّ فعلًا أفضل من اليومية لأنها تتجنّب ارتداد الهيبسيدين."
    ),
  },
  {
    title: L(
      "Thalassaemia in Bangladesh: carrier screening before marriage",
      "বাংলাদেশে থ্যালাসেমিয়া: বিয়ের আগে বাহক সনাক্তকরণ",
      "الثلاسيميا في بنغلاديش: فحص الحاملين قبل الزواج"
    ),
    category: KEEP("Health"),
    readTime: "5",
    summary: L(
      "Why premarital Hb electrophoresis matters, and the transfusion burden of thalassaemia major.",
      "বিয়ের আগে Hb ইলেক্ট্রোফোরেসিস কেন জরুরি, এবং থ্যালাসেমিয়া মেজরের রক্ত সঞ্চালনের বোঝা।",
      "لماذا يهمّ رحلان الهيموغلوبين قبل الزواج، وعبء نقل الدم في الثلاسيميا الكبرى."
    ),
    content: L(
      "Bangladesh has an estimated 10–12% carrier rate for thalassaemia traits. When two carriers marry, each pregnancy carries a 25% chance of thalassaemia major, a lifelong disease requiring transfusion every 3–4 weeks from infancy plus iron chelation therapy to prevent cardiac and endocrine damage. A single simple test — haemoglobin electrophoresis or HPLC, costing only a few hundred taka — identifies carriers before marriage. Two carriers can still marry and have healthy children with prenatal diagnosis in the first trimester. Because thalassaemia patients consume a large and permanent share of the blood supply, every voluntary donor directly supports them. If you or your partner have a family history of unexplained anaemia or transfusion dependence, get screened — and register as a regular donor on BloodOra.",
      "বাংলাদেশে থ্যালাসেমিয়া ট্রেইটের বাহক হওয়ার হার আনুমানিক ১০–১২%। দুজন বাহকের বিয়ে হলে প্রতিটি গর্ভাবস্থায় থ্যালাসেমিয়া মেজর হওয়ার সম্ভাবনা ২৫% — এটি আজীবন রোগ, যা শৈশব থেকে প্রতি ৩–৪ সপ্তাহে রক্ত সঞ্চালন এবং হৃদপিণ্ড ও এনডোক্রাইন ক্ষতি ঠেকাতে আয়রন কিলেশন থেরাপি দাবি করে। একটি সহজ পরীক্ষা — হিমোগ্লোবিন ইলেক্ট্রোফোরেসিস বা HPLC, খরচ মাত্র কয়েকশ টাকা — বিয়ের আগেই বাহক শনাক্ত করতে পারে। দুজন বাহকও বিয়ে করে প্রথম ত্রৈমাসিকে প্রসবপূর্ব নির্ণয়ের মাধ্যমে সুস্থ সন্তান নিতে পারেন। থ্যালাসেমিয়া রোগীরা রক্তের সরবরাহের একটি বড় ও স্থায়ী অংশ ব্যবহার করেন বলে প্রতিটি স্বেচ্ছা দাতা সরাসরি তাঁদের সহায়তা করেন। আপনার বা আপনার সঙ্গীর পরিবারে অকারণ অ্যানিমিয়া বা রক্ত সঞ্চালন-নির্ভরতার ইতিহাস থাকলে পরীক্ষা করান — এবং BloodOra-তে নিয়মিত দাতা হিসেবে নিবন্ধন করুন।",
      "تُقدَّر نسبة حاملي صفات الثلاسيميا في بنغلاديش بـ 10–12%. وعندما يتزوّج حاملان، يكون لكل حمل احتمال 25% للإصابة بالثلاسيميا الكبرى، وهو مرض مدى الحياة يتطلّب نقل دم كل 3–4 أسابيع منذ الرضاعة، إضافة إلى علاج خلب الحديد لمنع أضرار القلب والغدد الصم. واختبار واحد بسيط — رحلان الهيموغلوبين أو HPLC، بكلفة بضع مئات من التاكا فقط — يحدّد الحاملين قبل الزواج. ويمكن لحاملَين أن يتزوّجا وينجبا أطفالًا أصحّاء مع التشخيص السابق للولادة في الثلث الأول من الحمل. ولأن مرضى الثلاسيميا يستهلكون حصة كبيرة ودائمة من إمدادات الدم، فإن كل متبرّع طوعي يدعمهم مباشرة. إذا كان لديك أو لدى شريكك تاريخ عائلي من فقر دم غير مبرَّر أو اعتماد على نقل الدم، فأجرِ الفحص — وسجّل كمتبرّع منتظم على BloodOra."
    ),
  },
  {
    title: L(
      "Blood safety: how every donated unit is screened",
      "রক্তের নিরাপত্তা: প্রতিটি দান-করা ব্যাগ কীভাবে পরীক্ষা হয়",
      "سلامة الدم: كيف تُفحص كل وحدة متبرَّع بها"
    ),
    category: KEEP("Education"),
    readTime: "3",
    summary: L(
      "The mandatory tests, the window period, and what screening can and cannot guarantee.",
      "বাধ্যতামূলক পরীক্ষাগুলো, উইন্ডো পিরিয়ড, এবং স্ক্রিনিং কী নিশ্চিত করতে পারে আর কী পারে না।",
      "الفحوص الإلزامية، وفترة النافذة، وما الذي تضمنه الفحوص وما لا تضمنه."
    ),
    content: L(
      "Every donated unit in Bangladesh is mandatorily tested for HIV-1 and HIV-2 antibodies/antigen, hepatitis B surface antigen, hepatitis C antibody, syphilis (VDRL/RPR) and malaria antigen, alongside ABO and RhD grouping. Nucleic-acid testing (NAT), where available, shortens the window period dramatically: from about 22 days for HIV antibody testing to roughly 10 days, and from 70 to 20 days for hepatitis C. The residual window period is the reason screening can never be a substitute for honest donor history — always answer the screening questionnaire truthfully. Leucodepletion, pathogen-reduction technology and irradiation are additional layers used for immunocompromised recipients.",
      "বাংলাদেশে প্রতিটি দান-করা ব্যাগ বাধ্যতামূলকভাবে HIV-1 ও HIV-2 অ্যান্টিবডি/অ্যান্টিজেন, হেপাটাইটিস B সারফেস অ্যান্টিজেন, হেপাটাইটিস C অ্যান্টিবডি, সিফিলিস (VDRL/RPR) ও ম্যালেরিয়া অ্যান্টিজেনের জন্য পরীক্ষা করা হয়, সঙ্গে ABO ও RhD গ্রুপিং। নিউক্লিক-অ্যাসিড টেস্টিং (NAT) যেখানে আছে, সেখানে উইন্ডো পিরিয়ড অনেক কমে যায়: HIV অ্যান্টিবডি পরীক্ষার প্রায় ২২ দিন থেকে প্রায় ১০ দিনে, এবং হেপাটাইটিস C-এর ক্ষেত্রে ৭০ থেকে ২০ দিনে। অবশিষ্ট উইন্ডো পিরিয়ডের কারণেই স্ক্রিনিং কখনোই দাতার সৎ তথ্যের বিকল্প হতে পারে না — স্ক্রিনিং প্রশ্নপত্রের উত্তর সবসময় সত্য দিন। শ্বেতকণিকা অপসারণ, প্যাথোজেন-রিডাকশন প্রযুক্তি ও ইরেডিয়েশন হলো অতিরিক্ত স্তর, যা রোগ প্রতিরোধক্ষমতাহীন গ্রহীতাদের জন্য ব্যবহৃত হয়।",
      "تُفحص كل وحدة متبرَّع بها في بنغلاديش إلزاميًا لأجسام/مستضدات HIV-1 وHIV-2، ومستضد سطح التهاب الكبد B، وجسم مضاد لالتهاب الكبد C، والزهري (VDRL/RPR)، ومستضد الملاريا، إلى جانب تحديد ABO وRhD. ويقلّل اختبار الأحماض النووية (NAT)، حيث يتوفّر، فترة النافذة بشكل كبير: من نحو 22 يومًا لاختبار أجسام HIV المضادة إلى نحو 10 أيام، ومن 70 إلى 20 يومًا لالتهاب الكبد C. وفترة النافذة المتبقّية هي السبب في أن الفحص لا يمكن أن يكون بديلًا عن تاريخ صادق من المتبرّع — أجب دائمًا عن استبيان الفحص بصدق. ويُعدّ إزالة الكريات البيضاء، وتقنية تقليل مسببات الأمراض، والتشعيع طبقات إضافية تُستخدم مع المستقبلين ضعيفي المناعة."
    ),
  },
  {
    title: L(
      "Organ and marrow donation: the other ways to save a life",
      "অঙ্গ ও অস্থিমজ্জা দান: জীবন বাঁচানোর অন্য উপায়",
      "التبرّع بالأعضاء والنخاع: طرق أخرى لإنقاذ حياة"
    ),
    category: KEEP("Health"),
    readTime: "4",
    summary: L(
      "Bone marrow, cord blood, kidney and cornea donation — eligibility and how to register.",
      "অস্থিমজ্জা, কর্ড ব্লাড, কিডনি ও কর্নিয়া দান — যোগ্যতা ও নিবন্ধনের নিয়ম।",
      "التبرّع بنخاع العظم ودم الحبل السرّي والكلى والقرنية — الأهلية وكيفية التسجيل."
    ),
    content: L(
      "A living kidney donor can lead a completely normal life with the remaining kidney and is the best source for a transplant recipient. Bone marrow or peripheral blood stem cell donation treats leukaemia, aplastic anaemia and thalassaemia major; a matched unrelated donor is found through HLA typing, and collection is now usually by apheresis rather than a marrow harvest. Umbilical cord blood, collected painlessly after delivery, is a rich source of stem cells and is wasted in almost every birth in Bangladesh. Cornea donation after death can restore sight to two people and requires only the family's consent within 6 hours. Registering as a voluntary blood donor on BloodOra is the fastest way to be reachable for all of these.",
      "জীবিত কিডনি দাতা বাকি কিডনি নিয়ে সম্পূর্ণ স্বাভাবিক জীবনযাপন করতে পারেন এবং প্রত্যারোপণ গ্রহীতার জন্য তিনিই সেরা উৎস। অস্থিমজ্জা বা পেরিফারেল ব্লাড স্টেম সেল দানে লিউকেমিয়া, অ্যাপ্লাস্টিক অ্যানিমিয়া ও থ্যালাসেমিয়া মেজরের চিকিৎসা হয়; HLA টাইপিংয়ের মাধ্যমে মিল আছে এমন অ-আত্মীয় দাতা খোঁজা হয়, এবং এখন সংগ্রহ সাধারণত অ্যাফেরেসিসের মাধ্যমে হয়, মজ্জা কেটে নয়। প্রসবের পর ব্যথা ছাড়াই সংগৃহীত নাড়ির রক্ত স্টেম সেলের সমৃদ্ধ উৎস, অথচ বাংলাদেশে প্রায় প্রতিটি জন্মেই তা নষ্ট হয়। মৃত্যুর পর কর্নিয়া দান দুই মানুষের দৃষ্টি ফিরিয়ে দিতে পারে এবং এর জন্য ৬ ঘণ্টার মধ্যে পরিবারের সম্মতিই যথেষ্ট। BloodOra-তে স্বেচ্ছা রক্তদাতা হিসেবে নিবন্ধন করাই এসবের জন্য সবচেয়ে দ্রুত পৌঁছে যাওয়ার উপায়।",
      "يستطيع متبرّع الكلى الحي أن يعيش حياة طبيعية تمامًا بكليته المتبقّية، وهو أفضل مصدر لمستقبِل الزرع. ويعالج التبرّع بنخاع العظم أو الخلايا الجذعية من الدم المحيطي ابيضاض الدم وفقر الدم اللاتنسّجي والثلاسيميا الكبرى؛ ويُعثر على متبرّع غير قريب مطابق عبر تنميط HLA، ويُجرى الجمع اليوم عادةً بالفصادة بدل استخراج النخاع. ودم الحبل السرّي، الذي يُجمع دون ألم بعد الولادة، مصدر غني بالخلايا الجذعية ويضيع في كل ولادة تقريبًا في بنغلاديش. ويمكن للتبرّع بالقرنية بعد الوفاة أن يعيد البصر لشخصين، ولا يتطلّب إلا موافقة الأسرة خلال 6 ساعات. والتسجيل كمتبرّع دم طوعي على BloodOra هو أسرع وسيلة لتكون متاحًا لكل ذلك."
    ),
  },
];

// ------------------------------------------------------- Site route map (AI)
// Every public route on the site, with what it does. Used to build the AI
// knowledge base and to turn "open the shop" into a real clickable link.
export const siteRoutes = [
  { path: "/", title: "Home", purpose: "Landing page: live activity feed, verified-donor count, urgent cases, recent donors, how-it-works steps and the shop teaser.", keywords: ["home", "landing", "start", "main page", "হোম"] },
  { path: "/donors", title: "Donor Directory", purpose: "Search the verified donor network by blood group, district, upazila and minimum age. Shows donor cards with contact links.", keywords: ["donor", "find donor", "search donor", "blood group search", "দাতা"] },
  { path: "/donors/profile/my", title: "My Profile", purpose: "Logged-in user's own profile: blood group, location, donation availability toggle, verification status and verification request.", keywords: ["my profile", "profile", "my account", "availability"] },
  { path: "/donors/profile/edit", title: "Edit Profile", purpose: "Update name, phone, holding address, date of birth (age is recalculated automatically) and profile photo.", keywords: ["edit profile", "update profile", "change photo", "date of birth"] },
  { path: "/blood-requests", title: "Blood Requests", purpose: "Browse all open blood requests, filter by blood group, district and urgency, and mark a request as fulfilled.", keywords: ["blood request", "requests", "browse requests", "urgent list"] },
  { path: "/request-blood", title: "Request Blood", purpose: "Post a new blood request: patient details, blood group, quantity, hospital, contact, needed-by date and an urgent flag with reason.", keywords: ["request blood", "post request", "need blood", "urgent request", "রক্ত"] },
  { path: "/urgent", title: "Urgent Appeal Form", purpose: "Dedicated rapid appeal form for life-threatening emergencies — routed with the urgent flag set.", keywords: ["urgent", "emergency", "appeal"] },
  { path: "/shop", title: "Medical Shop", purpose: "Browse and filter the medical shop catalogue: medicines, supplements, equipment and healthcare products, with category filter, search, stock and add-to-cart.", keywords: ["shop", "store", "medicine", "buy", "products", "দোকান", "catalogue"] },
  { path: "/shop/cart", title: "Shopping Cart", purpose: "Review cart items, change quantities, remove items and see the subtotal before checkout.", keywords: ["cart", "basket", "cart items"] },
  { path: "/shop/checkout", title: "Checkout", purpose: "Choose payment method (bKash, Nagad, Upay, Rocket, Pathao, Card or Cash on Delivery), enter the transaction ID and the delivery address. Delivery is only available in Kalai Upazila for ৳10.", keywords: ["checkout", "payment", "order", "bkash", "nagad", "delivery", "address"] },
  { path: "/shop/my-orders", title: "My Orders", purpose: "Order history with status (pending, processing, shipped, delivered, cancelled), payment status and totals.", keywords: ["my orders", "order history", "track order", "order status"] },
  { path: "/reviews", title: "Reviews & Testimonials", purpose: "Public review page: star-rated product reviews for shop items plus general BloodOra testimonials, with an average-rating summary and a submission form for logged-in users.", keywords: ["review", "reviews", "rating", "testimonial", "feedback", "stars", "রিভিউ"] },
  { path: "/compatibility", title: "Blood Compatibility", purpose: "Complete ABO/RhD reference: red-cell donor and recipient matrix, plasma compatibility, platelet rules, component storage and shelf life, emergency transfusion rules and blood-group facts.", keywords: ["compatibility", "blood group chart", "donate to", "receive from", "universal donor", "universal recipient", "plasma", "platelet"] },
  { path: "/antid", title: "Anti-D Information", purpose: "Full clinical reference on Anti-D Immunoglobulin (RhIg): what it is, why RhD-negative mothers need it, every indication, the dosing schedule, administration technique, side effects, contraindications, cold-chain storage and FAQs.", keywords: ["anti-d", "antid", "rhd", "immunoglobulin", "rh negative", "pregnancy", "hdfn", "এন্টি-ডি"] },
  { path: "/resources", title: "Educational Resources", purpose: "Article library: donor eligibility, what happens on donation day, preparation, recovery, blood-group genetics, transfusion testing, first aid for bleeding, dengue platelets, donor nutrition, thalassaemia screening, blood safety and organ/marrow donation.", keywords: ["resources", "education", "articles", "learn", "guide", "resources page"] },
  { path: "/donation-guidelines", title: "Donation Guidelines", purpose: "Official eligibility rules, deferral periods, donation intervals and the voluntary-donor code of conduct.", keywords: ["guidelines", "eligibility", "rules", "deferral"] },
  { path: "/faq", title: "FAQ", purpose: "Frequently asked questions about donating, requesting blood, verification, the shop, delivery, payment and accounts.", keywords: ["faq", "questions", "help", "common questions"] },
  { path: "/contact", title: "Contact Us", purpose: "Site email, phone, address, social links and the contact message form.", keywords: ["contact", "support", "reach us", "address", "phone", "email"] },
  { path: "/login", title: "Login", purpose: "Sign in with email and password. Returns a JWT session valid for 7 days.", keywords: ["login", "sign in", "log in", "account access"] },
  { path: "/register", title: "Register", purpose: "Create an account: name, email, phone, password, blood group, division/district/upazila and date of birth. Donors must be 18+.", keywords: ["register", "sign up", "create account", "new account"] },
  { path: "/messages", title: "Messages", purpose: "User messaging centre: inbox, sent items, unread count, send a message to the admin team or to another user, and reply.", keywords: ["messages", "inbox", "message admin", "send message", "reply"] },
  { path: "/messages/send", title: "Send Message", purpose: "Compose a message to the BloodOra admin team or to another registered user by email.", keywords: ["send message", "compose", "write message"] },
  { path: "/admin", title: "Admin Dashboard", purpose: "Admin control centre: live stats (users, verified donors, orders, products, pending verifications, urgent requests), the site notice broadcaster, user management (verify, promote, demote, edit, delete, impersonate) and admin creation.", keywords: ["admin", "dashboard", "control panel", "stats", "users", "notice"] },
  { path: "/admin/settings", title: "Site Settings", purpose: "Manage the site name, tagline, contact details, description, social links and all payment gateway merchant numbers.", keywords: ["settings", "site settings", "social links", "payment gateway", "merchant number"] },
  { path: "/admin/branding", title: "Branding & Identity", purpose: "Upload the site logo and favicon, set the display name, tagline, primary and accent brand colours and the calligraphic heading style. Changes apply across the whole site instantly.", keywords: ["branding", "logo", "favicon", "site name", "colors", "theme", "identity"] },
  { path: "/admin/smtp", title: "SMTP & Email", purpose: "Full mail-server configuration: host, port, TLS/SSL, username, password, from-name and from-address, plus a one-click test email and the outgoing email log.", keywords: ["smtp", "email", "mail server", "send email", "mail log", "nodemailer"] },
  { path: "/admin/ai", title: "AI Assistant", purpose: "Configure the Live AI Help: enable/disable, Groq API key, model selection (default qwen/qwen3.6-27b), temperature, max tokens, the custom system persona, suggested prompts, and a live connection test.", keywords: ["ai", "assistant", "groq", "qwen", "chatbot", "live ai help", "model"] },
  { path: "/admin/content", title: "Content Manager", purpose: "Create, edit, feature and delete Anti-D reference entries and educational resources, with category, summary, body, image and featured flag.", keywords: ["content", "antid entries", "resources editor", "articles", "cms"] },
  { path: "/admin/reviews", title: "Review Moderation", purpose: "Approve, reject, feature, reply to and delete product reviews and testimonials.", keywords: ["reviews moderation", "approve review", "moderate", "reply review"] },
  { path: "/admin/live-chat", title: "Live Chat Inbox", purpose: "Real-time support inbox: every live conversation across the site, streamed updates, reply directly into the visitor's chat widget, and hand the conversation to the AI or back to a human.", keywords: ["live chat", "support inbox", "conversations", "live messaging"] },
  { path: "/shop/admin/products", title: "Product Management", purpose: "Shop administration: list all products including unavailable ones, add a product with image, price, category and stock, edit any field, toggle availability and delete.", keywords: ["products", "manage products", "add product", "stock", "shop admin"] },
  { path: "/shop/admin/orders", title: "Order Management", purpose: "Filter orders by status, open any order, confirm payment, change fulfilment status and generate the printable invoice.", keywords: ["orders", "manage orders", "confirm payment", "invoice", "order status"] },
  { path: "/health", title: "Health Check", purpose: "Proxies the backend health endpoint: database connectivity, service name and timestamp.", keywords: ["health", "status", "uptime"] },
  { path: "/sitemap.xml", title: "Sitemap", purpose: "XML sitemap of the public pages for search engines.", keywords: ["sitemap", "seo"] },
];
