# دليل التتبع الموحد

هذا الملف هو المرجع التنفيذي لربط الموقع بحاوية Google Tag Manager الجديدة رقم `GTM-NFTVFBKS`. الحاوية القديمة `GTM-PZRLPZN2` محفوظة للرجوع والمراجعة فقط ولا تحملها إصدارات Production الجديدة. كود الموقع يجهز الأحداث والإسناد والمطابقة، لكن إنشاء أو نشر Tags داخل حساب GTM يتم من واجهة الحساب ولا يحدث تلقائيًا عند نشر repository.

ملف [`tracking/gtm-workspace-spec.json`](tracking/gtm-workspace-spec.json) هو مواصفة قابلة للمراجعة لما يجب أن تحتويه الحاوية، وليس Container Export قابلًا للاستيراد. وملف [`tracking/gtm-container-baseline-export.json`](tracking/gtm-container-baseline-export.json) هو التصدير الرسمي للحالة القديمة في Default Workspace قبل تنفيذ هذه الخطة: 6 Tags وTrigger واحد، من دون TikTok أو Snapchat أو Clarity أو ChatGPT Ads. لا تستورده باعتباره الإعداد المستهدف؛ احتفظ به للرجوع والمقارنة فقط.

بعد ضبط Workspace الجديد واختباره، نزّل النسخة الرسمية من **Admin → Export Container** واحفظها باسم `tracking/gtm-container-export.json` قبل نشرها في GTM.

لا تنشر Workspace الخاص بـGTM مباشرة. اختبره أولًا مع Deploy Preview ثم انشره يدويًا بعد التأكد من عدم تكرار الأحداث.

تحديث 18 سبتمبر 2026: أُضيف معرفا TikTok وOpenAI اللذان زوّد بهما المستخدم إلى ملفات المشروع فقط. لا يعني حفظ المعرفات إعداد أو تفعيل Tags داخل الحساب. لا يبدأ إعداد الحاوية أو نشرها قبل طلب صريح من المستخدم.

## 1. ما ينفذه الموقع

- ينشئ `window.dataLayer` واحدة وإصدار العقد `2.0`.
- يرسل لكل حدث `event_id` و`event_time_ms` و`session_id` وسياق الصفحة.
- ينشئ `lead_id` و`attempt_id` مستقلين لكل نموذج.
- يحفظ first-touch وlast-non-direct لمدة لا تزيد على 90 يومًا.
- يلتقط `gclid`, `wbraid`, `gbraid`, `fbclid`, `ttclid`, `ScCid`, `oppref`, `msclkid` وحقول UTM دون حساسية لحالة حروف اسم المتغير.
- يمرر `session-id` والإسناد إلى Netlify Forms، بما فيه نسختا JSON باسم `first-touch` و`last-non-direct`.
- يطلق `smile_pro_lead` فقط بعد رد HTTP ناجح من Netlify.
- يستخدم pending lead صالحًا لمدة 15 دقيقة ورمز تأكيد عشوائيًا خاصًا بالمحاولة. لا تقرأ صفحة الشكر الـLead إلا عند تطابق الرمز، ثم تحوله إلى `dispatched` قبل دفع الحدث؛ لذلك refresh وback والزيارة المباشرة لصفحة الشكر لا تعيد التحويل.
- يلتقط رمز التأكيد وينظفه من شريط العنوان داخل `<head>` قبل بدء GTM، ثم يمرره داخليًا إلى صفحة الشكر؛ فلا يدخل عناوين الصفحات التي تقرؤها المنصات. يحتفظ بالرمز مؤقتًا في الذاكرة أيضًا حتى لا يعتمد تنظيف الرابط على نجاح الكتابة في `sessionStorage`. وعند الرجوع عبر bfcache يبدأ Page View ومحاولة نموذج جديدان بمعرفات جديدة، ويُعاد تفعيل زر الإرسال وحالة بدء النموذج، مع مراقب مشاهدة واحد لكل محاولة.
- يعيد قراءة أحدث إسناد عند الرجوع عبر bfcache وقبل إنشاء طلب النموذج، دون اعتبار معاملات الحملة القديمة في الرابط زيارة إعلانية جديدة. يحدّث حقول Netlify ويحفظ نسخة الإسناد الخاصة بطلب الإرسال نفسه لحدث التحويل؛ فلا تغيّر زيارة حملة أخرى أثناء انتظار الرد إسناد ذلك الطلب.
- يمنع قفل داخلي بدء طلبي إرسال متوازيين أثناء تحميل التحقق الكسول لرقم الهاتف، فلا ينشئ الضغط المتكرر Lead مكررًا.
- إذا فشل `fetch` يرجع إلى إرسال HTML العادي مع رمز التأكيد في عنوان صفحة الشكر؛ لا يدعي نجاح التحويل إلا إذا وصل المتصفح إلى تلك الصفحة بعد إرسال النموذج.
- إذا كان `sessionStorage` محجوبًا بعد نجاح Netlify، يدفع الحدث في الصفحة الحالية وينتظر `eventCallback` من GTM أو مهلة الأمان قبل الانتقال لصفحة الشكر.

## 2. عقد Data Layer

مثال حدث عام:

```js
{
  event: "site_page_view",
  schema_version: "2.0",
  event_id: "evt_...",
  event_time_ms: 1789500000000,
  session_id: "ses_...",
  page: {
    kind: "home",
    language: "ar",
    path: "/ar/",
    title: "..."
  },
  session: { id: "ses_..." },
  attribution: {
    first_touch: { ... },
    last_non_direct: { ... },
    gclid: "..."
  }
}
```

حدث الـLead وحده قد يحتوي على:

```js
{
  event: "smile_pro_lead",
  event_id: "lead_...",
  lead_id: "lead_...",
  attempt_id: "attempt_...",
  form: {
    id: "lead_...",
    name: "consultation",
    position: "hero",
    procedure: "smile-pro"
  },
  user_data: {
    phone_sha256_e164: "64 lowercase hex characters",
    phone_sha256_digits: "64 lowercase hex characters"
  }
}
```

أسماء `page_kind`, `language`, `page_path`, `lead_id`, `form_name`, `form_position` و`service` مستمرة على المستوى الأعلى لمنع كسر متغيرات GTM القديمة. العقد المعتمد للإعدادات الجديدة هو الكائنات المتداخلة.

## 3. الهاتف والخصوصية

مكتبة الهاتف تنتج E.164، ثم Web Crypto يحسب داخل المتصفح:

```text
phone_sha256_e164   = SHA256("+201012345678")
phone_sha256_digits = SHA256("201012345678")
```

استخدم القيم كما يلي:

| المنصة | Data Layer Variable |
|---|---|
| Google Ads | `user_data.phone_sha256_e164` |
| TikTok | `user_data.phone_sha256_e164` |
| Meta | `user_data.phone_sha256_digits` |
| Snapchat | `user_data.phone_sha256_digits` |
| ChatGPT Ads | `user_data.phone_sha256_digits` |
| GA4 وClarity | لا تنشئ لهما متغير هاتف أصلًا |

الرقم الخام موجود في طلب Netlify Form فقط. لا تضف متغير GTM لحقل `phone`، ولا تستخدم DOM Variable أو Automatic Advanced Matching. عطّل Automatic Advanced Matching في Meta وTikTok وSnapchat وOpenAI، واستخدم المطابقة اليدوية بالقيمة المناسبة أعلاه.

حقول الاسم والهاتف تحمل `data-clarity-mask="true"` كتأكيد صريح فوق الإخفاء الافتراضي لحقول الإدخال في Clarity. لا تضف Smart Event أو Custom Tag ينسخ قيم الحقول.

`dataLayer` ليست حاجزًا أمنيًا؛ أي Custom HTML Tag يستطيع قراءة الصفحة. لذلك يجب ألا توجد Custom HTML Tags عامة، ويجب أن تُبنى كل Tag من allowlist صريحة.

## 4. متغيرات GTM

أنشئ Data Layer Variables بإصدار 2 للأسماء الآتية فقط:

- `event_id`
- `lead_id`
- `attempt_id`
- `session_id`
- `page.kind`
- `page.language`
- `page.path`
- `form.name`
- `form.position`
- `user_data.phone_sha256_e164`
- `user_data.phone_sha256_digits`
- `attribution.oppref`

أنشئ Constant Variable لكل Platform ID وConversion Label. لا تضع أي API key؛ معرفات الـPixels عامة، أما أسرار CAPI فلا تدخل Web Container مطلقًا.

المعرفات المحفوظة حاليًا في مواصفة الـWorkspace هي:

- GA4 التجريبي الجديد: `G-K4989EX8EJ`
- Google Ads: `AW-18233409981`، وLead Conversion Label: `AzguCIC9vPwcEL2Dr_ZD`
- Meta: `1003835282264414`
- TikTok: `DAMI1ERC77U5PB5VTVRG` (زوّد به المستخدم)
- Snapchat: `d34f007b-056b-48fe-a1a9-9e4d2340907c`
- OpenAI: `D75vs25S8kHCy2t9f3RK1c` (زوّد به المستخدم)
- Clarity: `x8s5tnix4i`

لم يوجد Conversion Label لإرسال النموذج في الـbaseline commit `96d0d94`؛ الموجود فيه هو Google Ads ID فقط. التصدير المرجعي القديم لـGTM يحتوي Label باسم `zbwtCLjs48EcEL2Dr_ZD` داخل Tag باسم `Call-Conversion` المرتبطة بضغط الاتصال، وليس بتحويل النموذج. نستخدم للـLead الجديد Label مستقلًا هو `AzguCIC9vPwcEL2Dr_ZD`.

معرفا TikTok وOpenAI أصبحا متاحين لإعداد Constant Variables عند طلب إعداد الحاوية. لا تفعّل Tags الخاصة بهما تلقائيًا لمجرد توفر المعرفات.

## 5. Triggers

استخدم Custom Event Trigger بـexact match لكل اسم؛ لا تستخدم Regex شاملًا:

- `site_page_view`
- `content_view`
- `click_call`
- `click_whatsapp`
- `smile_pro_lead`

أنشئ Trigger منفصلًا للأحداث التحليلية فقط عند الحاجة. لا تربط أي Advertising Tag بأحداث الحاسبة أو المقارنة أو FOMO أو FAQ أو الفيديو.

## 6. Base Tags ومنع Page View المكرر

أنشئ Base Tag واحدة لكل منصة على `Initialization – All Pages`:

1. Google Tag واحد يضم وجهتي GA4 وGoogle Ads، مع تعطيل إرسال Page View التلقائي.
2. Meta Base ينفذ `init` فقط دون `PageView` تلقائي.
3. TikTok Base ينفذ `load` فقط دون `ttq.page()` تلقائي.
4. Snapchat Base ينفذ `init` فقط دون `PAGE_VIEW` تلقائي.
5. ChatGPT Ads يستخدم عملية **Initialize only** من القالب الموجود في [`tracking/openai-ads-pixel.tpl`](tracking/openai-ads-pixel.tpl).
6. Clarity Base واحدة فقط.

اضبط **Tag firing options = Once per page** لكل Base Tag. استخدمها كـSetup Tag في Tag Sequencing عند الحاجة؛ خيار Once per page يمنع إعادة `init` مع كل حدث. يجب أن توجد Page View Tag واحدة لكل منصة وتعمل على `site_page_view` فقط.

## 7. خريطة الأحداث

| حدث الموقع | GA4 | Google Ads | Meta | TikTok | Snapchat | ChatGPT Ads |
|---|---|---|---|---|---|---|
| `site_page_view` | `page_view` | — | `PageView` | `PageView` | `PAGE_VIEW` | `page_viewed` |
| `content_view` | `content_view` | — | `ViewContent` | `ViewContent` | `VIEW_CONTENT` | `contents_viewed` |
| `click_call` | `click_call` | Secondary | `Contact` | `Contact` | Custom | — |
| `click_whatsapp` | `click_whatsapp` | Secondary | `Contact` | `Contact` | Custom | — |
| `smile_pro_lead` | `generate_lead` | Primary | `Lead` | `SubmitForm` | `SIGN_UP` | `lead_created` |

كل conversion tag تستعمل `event_id` نفسه:

- Meta: Event ID = `event_id`.
- TikTok: Event ID = `event_id`.
- Snapchat: `client_dedup_id` = `event_id`.
- ChatGPT Ads: options `event_id` = `event_id`.

نفّذ المطابقة داخل Tag التحويل فقط وبالترتيب التالي، باستخدام إعداد **Manual/Advanced Matching** الذي يوفره قالب المنصة المعتمد داخل GTM:

- Google Ads: عيّن حقل الهاتف المشفّر إلى `user_data.phone_sha256_e164` ثم شغّل Conversion Tag.
- Meta: حدّث Advanced Matching بالحقل `ph` من `user_data.phone_sha256_digits` قبل `Lead`، ثم مرر `eventID` نفسه.
- TikTok: شغّل Manual Advanced Matching/Identify باستخدام `user_data.phone_sha256_e164` قبل `SubmitForm`، ثم مرر `event_id` نفسه.
- Snapchat: عيّن hashed phone من `user_data.phone_sha256_digits` قبل `SIGN_UP`، واجعل `client_dedup_id` مساويًا لـ`event_id`.
- ChatGPT Ads: قالب المشروع يعيد `init` للهاتف المشفّر ثم يرسل `lead_created` بنفس `event_id`.

لا تجعل Base Tags تقرأ الهاتف؛ لا تكون قيمة المطابقة متاحة أصلًا إلا مع حدث `smile_pro_lead` المؤكد.

لا ترسل قيمة مالية مع الـLead، ولا ترسل `service` أو نتيجة الحاسبة أو التشخيص أو القياس أو حالات العين أو التقنية المرشحة إلى Advertising Tags.

## 8. GA4 وClarity

يسمح لهما بالأحداث العامة وأحداث تجربة الاستخدام، ومنها:

- `lead_form_view`, `lead_form_start`, `lead_form_error`, `lead_form_submit_attempt`, `lead_phone_valid`
- `estimator_start`, `estimator_step`, `estimator_result`
- `procedure_comparison_open`, `procedure_comparison_choice`
- `fomo_banner_view`, `faq_open`, `video_start`, `cta_click`

استخدم allowlist لكل حدث. احذف `user_data` بالكامل من حقول GA4، ولا تسجل قيمة حقول النماذج في Clarity. لا تستخدم إعدادًا آليًا ينسخ Data Layer بأكملها.

## 9. ChatGPT Ads

استورد `tracking/openai-ads-pixel.tpl` من **Templates → Tag Templates → New → Import**. القالب يملك صلاحيتين فقط:

- تحميل `https://bzrcdn.openai.com/sdk/oaiq.min.js`.
- إنشاء وتنفيذ queue باسم `oaiq`.

أنشئ أربع Tag instances:

1. Initialize only على Initialization – All Pages.
2. Page viewed على `site_page_view`.
3. Contents viewed على `content_view`.
4. Lead created على `smile_pro_lead`، مع `phoneNumberSha256 = user_data.phone_sha256_digits` و`eventId = event_id`.

عملية Lead تعيد `init` مع `user.phone_number_sha256` ثم ترسل `lead_created` بنوع `customer_action`. Pixel ID الحقيقي محفوظ في المواصفة، لكن إعداد هذه Tags وتفعيلها ينتظر طلب المستخدم الصريح واختبار Deploy Preview.

شغّل `debug` فقط في GTM Preview المتصل بـDeploy Preview. لا تشغله في Production. عطّل Automatic Advanced Matching من إعدادات OpenAI لأن المطابقة هنا Manual.

إذا أضيف CSP مستقبلًا فاسمح بـ:

- `script-src`: `https://bzrcdn.openai.com`
- `connect-src`: `https://bzr.openai.com` و`https://bzrcdn.openai.com`
- `img-src`: `https://bzr.openai.com`

المراجع الرسمية: [Measurement Pixel](https://developers.openai.com/ads/measurement-pixel) و[Supported Events](https://developers.openai.com/ads/supported-events).

## 10. CAPI مستقبلًا

لا توجد Netlify Function أو API حاليًا. عند إضافة server-side tracking لاحقًا:

- أرسل نفس اسم الحدث و`event_id` للـMeta وTikTok.
- اجعل Snapchat `client_dedup_id` مساويًا لـ`event_id`.
- في OpenAI استخدم Pixel ID نفسه و`lead_created` و`event_id` نفسه.
- أرسل `oppref` على مستوى الحدث.
- اقرأ cookie `__obref` على الخادم وأرسلها في `events[].user.obref`.
- أرسل الهاتف في `phone_numbers_sha256` باستخدام hash الأرقام فقط.
- خزّن API keys في Netlify environment variables، لا داخل JavaScript أو GTM Web Container.

## 11. فحص قبل النشر

1. شغّل `npm run check`.
2. افتح Deploy Preview من خلال GTM Preview.
3. تأكد أن Page View تصل مرة واحدة لكل منصة.
4. أرسل نموذجًا ناجحًا وتأكد أن كل منصة تستقبل Conversion واحدة بنفس `event_id`.
5. نفذ refresh وback على صفحة الشكر وتأكد أنه لا يوجد Conversion جديد.
6. افتح صفحة الشكر مباشرة في نافذة خاصة وتأكد أن `smile_pro_lead` لا يظهر.
7. افحص Network وData Layer وتأكد أن الرقم الخام لا يظهر إلا في POST الخاص بـNetlify Forms.
8. تأكد أن GA4 DebugView وClarity لا يستقبلان hash الهاتف.
9. اختبر حجب SDK لكل منصة؛ يجب أن يستمر إرسال النموذج والانتقال لصفحة الشكر.
10. شغّل `npm run perf:smoke` وقارن تكلفة كل third-party script في Lighthouse وDevTools.

لا تعتمد Workspace أو Production Deploy قبل نجاح هذه القائمة.
