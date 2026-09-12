# دليل إعداد وتشغيل موقع Smile Pro للمبتدئين

هذا الدليل مكتوب لمن ليست لديه خبرة كبيرة بالبرمجة. اتبع الخطوات بالترتيب، ولا تقلق إذا لم تكن تعرف معنى كل ملف في البداية.

## 1. ما نوع هذا الموقع؟

الموقع مبني باستخدام **Eleventy**. وهو يعمل بالطريقة التالية:

1. نكتب الصفحات والمقالات والبيانات داخل مجلد `src`.
2. يشغّل Eleventy عملية تسمى **Build**.
3. ينشئ Eleventy النسخة النهائية داخل مجلد `dist`.
4. يرفع Netlify محتويات `dist` ويعرضها للزوار كموقع static سريع.

لا توجد قاعدة بيانات ولا خادم يعمل لكل زيارة. الحاسبتان تعملان باستخدام JavaScript داخل متصفح الزائر، لذلك لا تحتاجان إلى Netlify Functions أو API مدفوعة.

## 2. كلمات ستراها كثيرًا

- **Terminal أو PowerShell:** نافذة نكتب فيها أوامر مثل `npm run dev`.
- **Repository:** مجلد المشروع المحفوظ على GitHub.
- **Build:** تحويل الملفات الموجودة داخل `src` إلى موقع نهائي داخل `dist`.
- **Deploy:** رفع نسخة الموقع إلى Netlify.
- **Deploy Preview:** نسخة تجريبية لها رابط مستقل، تُستخدم للاختبار قبل تعديل الموقع الحقيقي.
- **CMS:** لوحة إدارة تسمح بإضافة المقالات وتعديل بيانات العيادة دون تحرير الملفات يدويًا.
- **Front matter:** البيانات الموجودة بين علامتي `---` في بداية ملف المقال.
- **Slug:** الجزء الإنجليزي من رابط المقال، مثل `smile-pro-recovery`.
- **Environment variable:** قيمة سرية تُحفظ داخل Netlify ولا نضعها داخل ملفات المشروع.

## 3. الأشياء المطلوبة قبل البدء

ستحتاج إلى:

1. جهاز متصل بالإنترنت.
2. حساب GitHub لديه صلاحية الوصول إلى repository الموقع.
3. حساب Netlify متصل بحساب GitHub.
4. Git مثبت على الجهاز، أو تطبيق GitHub Desktop.
5. Node.js الإصدار 24.

يمكن تنزيل Node.js من [الموقع الرسمي](https://nodejs.org/en/download). هذا المشروع يحدد الإصدار المطلوب أيضًا في ملف `.nvmrc`.

### التأكد من تثبيت Node وnpm

افتح Terminal على macOS، أو PowerShell على Windows، ثم اكتب:

```sh
node --version
npm --version
```

يجب أن يبدأ إصدار Node بالرقم `v24`، مثل:

```text
v24.18.0
```

إذا ظهرت رسالة مثل `command not found` فهذا يعني أن Node لم يُثبت بطريقة صحيحة، أو أنك تحتاج إلى إغلاق Terminal وفتحه من جديد بعد التثبيت.

## 4. تنزيل المشروع لأول مرة

### الطريقة الأسهل: GitHub Desktop

1. افتح GitHub Desktop.
2. اختر **File → Clone Repository**.
3. اختر repository باسم `khaled-source12/smile-pro-site`.
4. اختر مكانًا واضحًا لحفظ المشروع.
5. اضغط **Clone**.

### باستخدام Terminal

اكتب الأمر التالي في المجلد الذي تريد حفظ المشروع داخله:

```sh
git clone https://github.com/khaled-source12/smile-pro-site.git
cd smile-pro-site
```

إذا كان repository خاصًا، قد يطلب GitHub تسجيل الدخول.

## 5. تثبيت مكتبات المشروع

من داخل مجلد المشروع شغّل:

```sh
npm ci
```

هذا الأمر يقرأ `package-lock.json` ويثبت نفس الإصدارات المختبرة. المكتبة المباشرة الوحيدة في المرحلة الحالية هي Eleventy.

لا تحذف `package-lock.json` ولا تعدله يدويًا.

## 6. تشغيل الموقع على جهازك

شغّل:

```sh
npm run dev
```

بعد لحظات سيظهر رابط قريب من:

```text
http://localhost:8080/
```

افتح الرابط في المتصفح. يظل الأمر يعمل ويراقب الملفات؛ عند حفظ تعديل سيُعاد بناء الصفحة تلقائيًا.

لإيقاف الخادم اضغط داخل Terminal:

```text
Ctrl + C
```

إذا كان المنفذ 8080 مستخدمًا، يمكنك اختيار منفذ آخر:

```sh
npm run dev -- --port=8081
```

ثم افتح `http://localhost:8081/`.

## 7. أوامر المشروع المهمة

### تشغيل نسخة التطوير

```sh
npm run dev
```

استخدمه أثناء تعديل المحتوى أو الشكل.

### إنشاء النسخة النهائية

```sh
npm run build
```

يحذف هذا الأمر نسخة `dist` القديمة أولًا، ثم ينشئ نسخة جديدة حتى لا تبقى صفحات قديمة بعد إلغاء نشر مقال.

### فحص الموقع قبل النشر

```sh
npm run check
```

يقوم هذا الأمر بالبناء ثم يفحص:

- الحقول المطلوبة للمقالات.
- تكرار `slug` أو `translation_key` داخل اللغة نفسها.
- بيانات العيادة ورقم الهاتف وWhatsApp.
- الروابط والصور المحلية.
- نماذج Netlify وحقول الـhoneypot.
- صفحات الشكر المطابقة للغة.
- أخطاء JavaScript الأساسية.
- الملفات المطلوبة وملف sitemap.

لا تنشر إذا فشل هذا الأمر. اقرأ رسالة الخطأ؛ غالبًا ستذكر اسم الملف والحقل الذي يحتاج إلى تصحيح.

## 8. أهم مجلدات وملفات المشروع

```text
smile-pro-site/
├── src/                         مصدر الموقع الذي نعدله
│   ├── _data/site.json          بيانات العيادة والتواصل
│   ├── _includes/               القوالب والأجزاء المشتركة
│   ├── articles/ar/             المقالات العربية
│   ├── articles/en/             المقالات الإنجليزية
│   ├── assets/css/              ملفات التصميم
│   ├── assets/js/               JavaScript المشترك والحاسبات
│   ├── images/                  الصور والفيديو
│   └── admin/                   إعدادات وصفحة Decap CMS
├── scripts/                     فحص وتنظيف ناتج البناء
├── netlify/functions/           تسجيل دخول Decap عن طريق GitHub
├── dist/                        الناتج النهائي؛ لا تعدله يدويًا
├── eleventy.config.js           إعداد Eleventy
├── netlify.toml                 إعداد البناء والتحويلات على Netlify
├── package.json                 الأوامر وإصدار Eleventy
└── package-lock.json            الإصدارات المثبتة بدقة
```

### ملفات لا تعدلها يدويًا

- `dist`: يتغير بالكامل في كل Build.
- `node_modules`: مكتبات مثبتة محليًا.
- `package-lock.json`: لا تعدله يدويًا.
- الملفات داخل `.git`: بيانات Git الداخلية.

إذا عدلت ملفًا داخل `dist` فسيختفي تعديلك في عملية البناء التالية. عدّل الملف المقابل داخل `src` دائمًا.

## 9. تعديل رقم الهاتف أو عنوان العيادة

افتح:

```text
src/_data/site.json
```

البيانات المهمة موجودة بالشكل التالي:

```json
{
  "clinic_number": "7",
  "contact": {
    "phone_e164": "+201113524230",
    "phone_display_en": "+20 111 352 4230",
    "phone_display_ar": "٠١١١ ٣٥٢ ٤٢٣٠",
    "whatsapp": "201113524230"
  }
}
```

معنى الحقول:

- `phone_e164`: الرقم الدولي المستخدم في روابط الاتصال، ويبدأ بعلامة `+`.
- `phone_display_en`: طريقة عرض الرقم في الصفحات الإنجليزية.
- `phone_display_ar`: طريقة عرضه في الصفحات العربية.
- `whatsapp`: الرقم الدولي بدون `+` أو مسافات، ويُستخدم في روابط `wa.me`.

انتبه إلى قواعد JSON:

- اترك علامات الاقتباس حول النصوص.
- ضع فاصلة بعد كل سطر ما عدا آخر سطر في المجموعة.
- لا تضف تعليقًا داخل ملف JSON.

بعد التعديل شغّل:

```sh
npm run check
```

ملاحظة: سكربت الفحص يتأكد من وجود البيانات وصحة صيغة الهاتف وWhatsApp وظهورها في الصفحات، لكنه لا يثبتها على رقم بعينه. لذلك يمكن تحديث البيانات من هذا الملف أو من Decap CMS دون تعديل سكربت الفحص. رقم العيادة يُضاف إلى العنوان تلقائيًا؛ لا تكرره داخل سطور `address`.

## 10. تعديل صفحات الهبوط

الصفحات الأساسية موجودة هنا:

| الصفحة | ملف المصدر |
|---|---|
| الرئيسية الإنجليزية | `src/index.njk` |
| الرئيسية العربية | `src/ar/index.njk` |
| SMILE Pro العربية | `src/smile-pro.njk` |
| SMILE Pro الإنجليزية | `src/en/smile-pro.njk` |
| Femto LASIK الإنجليزية | `src/femto-lasik.njk` |
| الحاسبة الإنجليزية | `src/laser-eye-surgery-cost-egypt/index.njk` |
| الحاسبة العربية | `src/ar/laser-eye-surgery-cost-egypt/index.njk` |

يمكنك تعديل النصوص الموجودة بين وسوم HTML، مثل:

```html
<h2>عنوان القسم</h2>
<p>وصف القسم هنا.</p>
```

لا تغيّر `id` أو `class` إذا لم تكن تعرف أين يُستخدمان؛ JavaScript وCSS قد يعتمدان عليهما.

### تعديل التصميم

التصميم المشترك موجود في:

- `src/assets/css/tokens.css`: الألوان والأحجام الأساسية.
- `src/assets/css/base.css`: القواعد الأساسية.
- `src/assets/css/components.css`: الهيدر والفوتر والعناصر المشتركة.
- `src/assets/css/pages/`: تصميم كل نوع صفحة.

مثال على تغيير لون مشترك داخل `tokens.css`:

```css
:root {
  --brand: #4b1630;
}
```

غيّر قيمة اللون فقط، واترك اسم المتغير كما هو.

## 11. الأجزاء المشتركة

توجد الأجزاء المتكررة داخل `src/_includes`:

- `partials/header.njk`: القائمة الرئيسية.
- `partials/footer.njk`: الفوتر والعنوان والهاتف.
- `partials/forms.njk`: نماذج الحجز والحاسبة.
- `partials/language-switcher.njk`: رابط تغيير اللغة.
- `partials/tracking-head.njk`: أكواد Analytics وPixels.
- `partials/sticky-actions.njk`: أزرار الهاتف وWhatsApp الثابتة.
- `layouts/article.njk`: شكل المقالات.
- `layouts/landing.njk`: تخطيط صفحات الهبوط.

فائدة هذه الملفات أن تعديل الجزء المشترك مرة واحدة ينعكس على جميع الصفحات التي تستخدمه.

## 12. إضافة مقال يدويًا

### مقال عربي

أنشئ ملفًا جديدًا داخل:

```text
src/articles/ar/
```

مثال: `smile-pro-aftercare.md`.

ضع في بدايته:

```md
---
published: true
title: "تعليمات ما بعد عملية سمايل برو"
slug: "smile-pro-aftercare"
translation_key: "smile-pro-aftercare"
date: "2026-09-12"
category: "التعافي"
read_time: "4 دقائق قراءة"
image: "/images/Naggar6.png"
excerpt: "أهم التعليمات خلال الأيام الأولى بعد العملية."
seo_title: "تعليمات ما بعد عملية سمايل برو | Smile Pro Egypt"
seo_description: "دليل مبسط للتعافي والتعليمات بعد عملية سمايل برو."
---

اكتب محتوى المقال هنا.

## عنوان داخل المقال

هذه فقرة عادية.
```

### الترجمة الإنجليزية

أنشئ ملفًا داخل:

```text
src/articles/en/
```

واستخدم نفس قيمة `translation_key`:

```md
---
published: true
title: "SMILE Pro Aftercare Instructions"
slug: "smile-pro-aftercare"
translation_key: "smile-pro-aftercare"
date: "2026-09-12"
category: "Recovery"
read_time: "4 min read"
image: "/images/Naggar6.png"
excerpt: "The most important instructions for the first days after treatment."
seo_title: "SMILE Pro Aftercare Instructions | Smile Pro Egypt"
seo_description: "A simple guide to recovery and aftercare following SMILE Pro."
---

Write the English article here.
```

إذا كانت الترجمة غير موجودة أو `published: false` فلن يظهر رابط hreflang لها.

### قواعد مهمة للمقالات

- استخدم أحرفًا إنجليزية صغيرة وأرقامًا وشرطات فقط في `slug`.
- لا تستخدم نفس `slug` لمقالين داخل اللغة نفسها.
- لا تستخدم نفس `translation_key` لمقالين داخل اللغة نفسها.
- استخدم نفس `translation_key` في النسختين العربية والإنجليزية للمقال نفسه.
- استخدم تاريخًا بصيغة `YYYY-MM-DD`.
- اجعل `published: false` لإخفاء المقال تمامًا.
- يجب أن يبدأ مسار الصورة المحلية بـ`/images/`.

## 13. رفع صورة جديدة

ضع الصورة داخل:

```text
src/images/
```

يفضل:

- اسم إنجليزي واضح بدون مسافات، مثل `smile-pro-machine.jpg`.
- حجم ملف مناسب للويب.
- استخدام JPG أو WebP للصور الفوتوغرافية وPNG عند الحاجة إلى الشفافية.

استخدمها داخل المقال هكذا:

```yaml
image: "/images/smile-pro-machine.jpg"
```

لا تضع الصور داخل `dist/images`؛ هذا المجلد يُعاد إنشاؤه.

## 14. رفع المشروع إلى GitHub

قبل الرفع شغّل:

```sh
npm run check
```

إذا نجح الفحص:

```sh
git status
git add .
git commit -m "Update website content"
git push
```

معنى الأوامر:

- `git status`: يعرض الملفات المتغيرة.
- `git add .`: يجهز التغييرات للحفظ.
- `git commit`: يحفظ نقطة يمكن الرجوع إليها.
- `git push`: يرسلها إلى GitHub.

إذا كنت تستخدم GitHub Desktop، راجع قائمة الملفات، اكتب وصفًا واضحًا، اضغط **Commit** ثم **Push origin**.

## 15. إعداد الموقع على Netlify لأول مرة

1. سجل الدخول إلى [Netlify](https://app.netlify.com/).
2. اختر **Add new site** أو **Import an existing project**.
3. اختر GitHub.
4. اختر repository: `khaled-source12/smile-pro-site`.
5. تأكد من أن الفرع المطلوب هو `main`.
6. Netlify سيقرأ `netlify.toml` تلقائيًا.

الإعدادات الصحيحة هي:

```text
Build command: npm run check
Publish directory: dist
Functions directory: netlify/functions
```

Node 24 محدد في `.nvmrc`، لذلك لا تحتاج عادة إلى إدخاله يدويًا.

اضغط **Deploy** وانتظر حتى تصبح حالة البناء **Published** أو **Ready**.

إذا ظهرت حالة **Failed**، افتح سجل البناء وابحث عن أول سطر مكتوب بجواره `Error`؛ الخطأ الأول عادة هو السبب الحقيقي، وما بعده مجرد نتيجة له.

## 16. إعداد Decap CMS وتسجيل الدخول عبر GitHub

لوحة الإدارة موجودة على:

```text
https://YOUR-SITE.netlify.app/admin/
```

لكن تسجيل الدخول يحتاج إلى GitHub OAuth App.

### الخطوة الأولى: إنشاء GitHub OAuth App

1. افتح GitHub.
2. اذهب إلى **Settings** الخاصة بحسابك.
3. افتح **Developer settings**.
4. اختر **OAuth Apps**.
5. اضغط **New OAuth App**.
6. أدخل اسمًا واضحًا، مثل `Smile Pro CMS`.
7. في **Homepage URL** ضع رابط موقع Netlify، مثل:

```text
https://smile-pro-eg.netlify.app
```

8. في **Authorization callback URL** ضع:

```text
https://smile-pro-eg.netlify.app/.netlify/functions/callback
```

9. أنشئ التطبيق.
10. انسخ `Client ID`.
11. أنشئ `Client Secret` وانسخه فورًا.

لا ترسل `Client Secret` إلى أي شخص ولا تحفظه داخل GitHub أو ملفات المشروع.

### الخطوة الثانية: إضافة القيم السرية إلى Netlify

داخل موقعك على Netlify:

1. افتح **Site configuration**.
2. افتح **Environment variables**.
3. أضف:

```text
OAUTH_CLIENT_ID
```

واجعل قيمته `Client ID` من GitHub.

4. أضف:

```text
OAUTH_CLIENT_SECRET
```

واجعل قيمته `Client Secret` من GitHub.

5. احفظ القيم.
6. نفّذ Deploy جديدًا؛ تغيير environment variables لا يغير نسخة منشورة قديمة تلقائيًا في كل الحالات.

### الخطوة الثالثة: مراجعة إعداد Decap

افتح:

```text
src/admin/config.yml
```

تأكد من القيم التالية:

```yaml
backend:
  name: github
  repo: khaled-source12/smile-pro-site
  branch: main
  base_url: https://smile-pro-eg.netlify.app
  auth_endpoint: /.netlify/functions/auth
```

إذا تغير repository أو موقع Netlify، حدّث `repo` أو `base_url` ثم ارفع التعديل.

### الخطوة الرابعة: اختبار لوحة الإدارة

1. افتح `/admin/` على رابط Netlify.
2. اضغط تسجيل الدخول باستخدام GitHub.
3. اسمح للتطبيق بالوصول إذا طلب GitHub ذلك.
4. عدّل حقلًا بسيطًا أو أنشئ مقالًا تجريبيًا.
5. احفظ أو انشر.
6. تأكد من ظهور commit جديد في GitHub.
7. انتظر انتهاء Build في Netlify.
8. راجع الصفحة الجديدة على Deploy Preview أو الموقع.

لن يعمل تسجيل الدخول إلى CMS بصورة كاملة على `localhost` باستخدام إعداد الإنتاج الحالي؛ اختبره على رابط Netlify.

## 17. تغيير الدومين أو موقع Netlify

عند تغيير الدومين، راجع الأماكن التالية:

1. `src/_data/site.json`:

```json
"url": "https://new-domain.example"
```

هذه القيمة تُستخدم في canonical وhreflang وStructured Data وsitemap.

2. `src/admin/config.yml`:

```yaml
base_url: https://new-site.netlify.app
```

3. إعداد GitHub OAuth App:

```text
Homepage URL
Authorization callback URL
```

4. إعداد الدومين داخل Netlify.

بعد ذلك شغّل `npm run check` وانشر Deploy Preview جديدًا.

## 18. نماذج الحجز على Netlify

النماذج تحتوي على:

- `data-netlify="true"` حتى يتعرف Netlify عليها.
- حقل `form-name` لتمييز النموذج.
- حقل `bot-field` كـhoneypot لتقليل الرسائل المزعجة.
- حقل `language` لمعرفة لغة الصفحة.
- صفحة شكر عربية أو إنجليزية مناسبة.

بعد أول Deploy ناجح:

1. افتح الموقع المنشور.
2. أرسل طلبًا تجريبيًا ببيانات واضحة مثل `TEST`.
3. افتح قسم Forms في Netlify.
4. تأكد من وصول الطلب.
5. اختبر الرئيسية الإنجليزية والعربية والحاسبتين وصفحة Femto LASIK.

لا يكفي اختبار الإرسال على localhost، لأن استقبال النماذج يتم بواسطة Netlify بعد النشر.

## 19. الروابط والتحويلات القديمة

الروابط الأساسية للحاسبة هي:

```text
/laser-eye-surgery-cost-egypt/
/ar/laser-eye-surgery-cost-egypt/
```

ملف `netlify.toml` يحول نسخ `.html` القديمة إليها بتحويل دائم 301.

اختبر الروابط القديمة على Deploy Preview أو Netlify، لأن خادم Eleventy المحلي لا ينفذ قواعد redirects الخاصة بـNetlify.

صفحة 404 حقيقية موجودة، ولا يوجد catch-all يعيد أي رابط خاطئ إلى الصفحة الرئيسية.

## 20. خطوات النشر الآمنة

اتبع هذه القائمة في كل تعديل مهم:

1. اسحب آخر نسخة من GitHub:

```sh
git pull
```

2. شغّل الموقع محليًا:

```sh
npm run dev
```

3. راجع الصفحات العربية والإنجليزية على الهاتف والكمبيوتر.
4. أوقف الخادم بـ`Ctrl + C`.
5. شغّل الفحص:

```sh
npm run check
```

6. احفظ وارفع التغييرات إلى branch منفصل إن أمكن.
7. افتح Deploy Preview في Netlify.
8. اختبر الروابط والصور والحاسبتين والنماذج وتغيير اللغة.
9. ادمج التغيير في `main` بعد نجاح الاختبار.
10. راقب Production Deploy حتى تصبح حالته ناجحة.

## 21. أشهر المشكلات وحلولها

### `npm: command not found`

Node.js غير مثبت أو Terminal لم يتعرف عليه. ثبت Node 24 ثم أعد فتح Terminal.

### إصدار Node ليس 24

إذا كنت تستخدم nvm:

```sh
nvm install 24
nvm use 24
```

ثم أعد تشغيل `npm ci`.

### `Cannot find package` أو ملفات node_modules تالفة

شغّل من داخل المشروع:

```sh
npm ci
```

### المنفذ 8080 مستخدم

```sh
npm run dev -- --port=8081
```

### صفحة أو صورة لا تظهر

تأكد من:

- أن الملف داخل `src` وليس `dist`.
- أن اسم الملف مطابق تمامًا، بما في ذلك الحروف الكبيرة والصغيرة.
- أن رابط الصورة يبدأ بـ`/images/` إذا كانت داخل `src/images`.
- تشغيل `npm run check` وقراءة اسم المرجع المفقود.

### المقال لا يظهر في المدونة

راجع:

- `published: true`.
- وجود الملف في مجلد اللغة الصحيح.
- صحة التاريخ وبقية الحقول المطلوبة.
- عدم تكرار `slug`.
- انتهاء Build في Netlify بنجاح.

### رابط تغيير اللغة لا يظهر

يجب أن توجد ترجمة منشورة لها نفس `translation_key`. إذا لم توجد ترجمة منشورة فلن يظهر الرابط، وهذا مقصود.

### تسجيل دخول CMS لا يعمل

راجع بالترتيب:

1. `base_url` في `src/admin/config.yml`.
2. رابط callback داخل GitHub OAuth App.
3. وجود `OAUTH_CLIENT_ID` و`OAUTH_CLIENT_SECRET` في Netlify.
4. تنفيذ Deploy جديد بعد إضافة المتغيرات.
5. أن حساب GitHub لديه صلاحية الكتابة على repository.
6. أن المتصفح لم يمنع نافذة تسجيل الدخول المنبثقة.

### النموذج لا يظهر في Netlify Forms

تأكد من أن:

- آخر Deploy ناجح.
- النموذج موجود في HTML النهائي داخل `dist`.
- إرسال الطلب التجريبي تم من رابط Netlify، وليس localhost.
- Forms ليست معطلة من إعدادات الموقع.

### فشل Build بسبب مقال

رسالة `npm run check` ستذكر غالبًا:

- اسم حقل مفقود.
- تاريخًا غير صحيح.
- `slug` مكررًا.
- `translation_key` مكررًا.
- رابط صورة أو صفحة غير موجود.

صحح الملف المذكور ثم أعد تشغيل الأمر.

## 22. الرجوع عن تعديل خاطئ

إذا لم تكن قد نفذت commit بعد، لا تستخدم أوامر حذف عامة أو `git reset --hard`.

باستخدام GitHub Desktop يمكنك الضغط بزر الفأرة الأيمن على الملف واختيار **Discard Changes** بعد التأكد أن التعديل غير مطلوب.

إذا نُشر التعديل بالفعل:

1. افتح قائمة Deploys في Netlify.
2. يمكنك مؤقتًا نشر Deploy سابق سليم.
3. صحح المصدر في GitHub أيضًا؛ الرجوع داخل Netlify وحده لا يصلح repository.

يفضل دائمًا عمل commit صغير وواضح قبل كل تغيير كبير حتى يكون الرجوع آمنًا.

## 23. قائمة فحص نهائية للمبتدئ

قبل اعتماد أي نسخة، أجب بنعم عن الآتي:

- هل يعمل `npm run check` بدون أخطاء؟
- هل رقم العيادة والهاتف وWhatsApp صحيحون؟
- هل الصفحة العربية RTL والإنجليزية LTR؟
- هل تعمل القائمة على الهاتف؟
- هل تعمل الحاسبتان وتظهر النتيجة؟
- هل رابط WhatsApp يحتوي على الرقم الصحيح؟
- هل تصل النماذج إلى Netlify Forms؟
- هل صفحة الشكر بنفس لغة النموذج؟
- هل روابط تغيير اللغة صحيحة؟
- هل المقالات المنشورة فقط تظهر في المدونة وsitemap؟
- هل روابط `.html` القديمة للحاسبة تتحول إلى الرابط الجديد؟
- هل `/admin/` يفتح ويمكنه إنشاء commit في GitHub؟
- هل تم الاختبار على Deploy Preview قبل Production؟

إذا كانت الإجابة نعم لكل البنود، فالنسخة جاهزة للنشر.
