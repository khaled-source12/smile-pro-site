// Standalone landing-page comparisons only; form-dialog content stays separate.
const row = (id, ar, en, valuesAr, valuesEn) => ({ id, label: { ar, en }, values: { ar: valuesAr, en: valuesEn } });

export default {
  title: { ar: "مقارنة تقنيات تصحيح النظر", en: "Laser vision correction comparison" },
  feature: { ar: "ما يهمك", en: "What matters to you" },
  mobileHint: { ar: "قارن التقنيات في كل معيار، دون تمرير أفقي", en: "Compare each feature without scrolling sideways" },
  note: {
    ar: "مقارنة إرشادية؛ وقت الليزر لا يشمل الإجراء كاملاً، والعودة للأنشطة لا تعني اكتمال استقرار النظر. تختلف مدة التعافي حسب حالتك، ويحدد الطبيب التقنية المناسبة ومواعيد العودة للأنشطة بعد الفحص والمتابعة.",
    en: "A general guide: laser time is not the full procedure time, and returning to activities does not mean vision has fully stabilized. Recovery varies. Your doctor confirms the appropriate procedure and activity timelines after examination and follow-up."
  },
  procedures: [
    { id: "smile", featured: true, name: { ar: "سمايل برو", en: "SMILE Pro" }, detail: { ar: "SMILE Pro", en: "Lenticule extraction" } },
    { id: "femto", name: { ar: "فيمتو ليزك", en: "Femto LASIK" }, detail: { ar: "Femto LASIK", en: "Flap-based correction" } },
    { id: "prk", name: { ar: "الليزر السطحي", en: "PRK" }, detail: { ar: "PRK", en: "Surface treatment" } }
  ],
  rows: {
    home: [
      row("recovery", "العودة للرؤية اليومية", "Everyday visual recovery", ["24 ساعة / نفس اليوم", "24 ساعة", "5 إلى 7 أيام"], ["24 hours / same day", "24 hours", "5 to 7 days"]),
      row("flap", "طريقة التعامل مع القرنية", "Corneal approach", ["بدون رفرف؛ فتحة دقيقة", "يتم إنشاء رفرف بالقرنية", "بدون رفرف؛ معالجة سطحية"], ["No flap; small incision", "A corneal flap is created", "No flap; surface treatment"]),
      row("dryness", "جفاف العين بعد العملية", "Dry eyes after treatment", ["احتمال أقل مقارنة بالفيمتو ليزك", "قد يحدث جفاف بعد العملية", "قد يحدث جفاف أثناء التعافي"], ["May be less common than with Femto LASIK", "Dry eyes may occur after treatment", "Dry eyes may occur during recovery"]),
      row("laser", "وقت الليزر لكل عين", "Laser time per eye", ["نحو 8 ثوانٍ", "15–30 ثانية", "30–60 ثانية"], ["About 8 seconds", "15–30 seconds", "30–60 seconds"]),
      row("activities", "الرياضة الخفيفة والسباحة", "Light exercise and swimming", ["{aftercare}", "أسبوعان إلى 4 أسابيع", "أسبوع إلى أسبوعين"], ["{aftercare}", "2 to 4 weeks", "1 to 2 weeks"])
    ],
    "smile-pro": [
      row("recovery", "العودة للعمل", "Returning to work", ["خلال 24 ساعة", "2–3 أيام", "4–7 أيام"], ["Within 24 hours", "2–3 days", "4–7 days"]),
      row("flap", "طريقة التعامل مع القرنية", "Corneal approach", ["بدون رفرف؛ فتحة دقيقة", "يتم إنشاء رفرف بالقرنية", "بدون رفرف؛ إزالة الطبقة السطحية"], ["No flap; small incision", "A corneal flap is created", "No flap; surface-layer removal"]),
      row("dryness", "جفاف العين بعد العملية", "Dry eyes after treatment", ["احتمال أقل مقارنة بالفيمتو ليزك", "قد يحدث جفاف بعد العملية", "قد يحدث جفاف أثناء التعافي"], ["May be less common than with Femto LASIK", "Dry eyes may occur after treatment", "Dry eyes may occur during recovery"]),
      row("laser", "وقت الليزر لكل عين", "Laser time per eye", ["نحو 8 ثوانٍ", "15–20 ثانية", "30–40 ثانية"], ["About 8 seconds", "15–20 seconds", "30–40 seconds"])
    ]
  }
};
