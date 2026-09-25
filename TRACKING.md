# دليل التتبع الموحد

هذا الملف هو المرجع التنفيذي لربط الموقع بحاوية Google Tag Manager الجديدة رقم `GTM-NFTVFBKS`. الحاوية القديمة `GTM-PZRLPZN2` محفوظة للرجوع والمراجعة فقط ولا تحملها إصدارات Production الجديدة. كود الموقع يجهز الأحداث والإسناد والمطابقة، بينما إعدادات الحسابات وTags تنفذ من واجهات المنصات وتوثق هنا وفي ملفات `tracking/`.

ملف [`tracking/gtm-workspace-spec.json`](tracking/gtm-workspace-spec.json) هو مواصفة قابلة للمراجعة لما يجب أن تحتويه الحاوية، وليس Container Export قابلًا للاستيراد. وملف [`tracking/gtm-container-baseline-export.json`](tracking/gtm-container-baseline-export.json) هو التصدير الرسمي للحالة القديمة في Default Workspace قبل تنفيذ هذه الخطة: 6 Tags وTrigger واحد، من دون TikTok أو Snapchat أو Clarity أو ChatGPT Ads. لا تستورده باعتباره الإعداد المستهدف؛ احتفظ به للرجوع والمقارنة فقط.

بعد ضبط Workspace الجديد واختباره، نزّل النسخة الرسمية من **Admin → Export Container** واحفظها باسم `tracking/gtm-container-export.json` مع النسخة المنشورة. هذا هو آخر Export رسمي منشور، ولا يعدّل يدويًا.

لا تنشر Workspace الخاص بـGTM مباشرة. اختبره أولًا مع Deploy Preview ثم انشره يدويًا بعد التأكد من عدم تكرار الأحداث.

## 0. سجل المعرفات المعتمد

| النظام | العنصر | المعرف |
|---|---|---|
| Google Tag Manager | Container Public ID | `GTM-NFTVFBKS` |
| Google Tag Manager | Account ID | `6360521865` |
| Google Tag Manager | Container Numeric ID | `264543391` |
| GA4 | Measurement ID | `G-K4989EX8EJ` |
| GA4 | Account ID | `397818498` |
| GA4 | Property ID | `554862114` |
| GA4 | Web Stream ID | `15804380417` |
| Google Ads | Customer ID | `683-517-3815` |
| Google Ads | Conversion ID | `AW-18233409981` (`18233409981`) |
| Google Ads | Confirmed Lead Label | `AzguCIC9vPwcEL2Dr_ZD` |
| Google Ads | Confirmed Lead Conversion Action ID | `7777230464` |
| Google Ads | Click-to-call Label | `Vdu7CKTVg4MdEL2Dr_ZD` |
| Google Ads | Click-to-call Conversion Action ID | `7790979748` |
| Google Ads | Click-to-WhatsApp Label | `grnJCPjW-YIdEL2Dr_ZD` |
| Google Ads | Click-to-WhatsApp Conversion Action ID | `7790816120` |
| Meta | Pixel ID | `1003835282264414` |
| TikTok | Pixel ID | `DAMI1ERC77U5PB5VTVRG` |
| Snapchat | Pixel ID | `d34f007b-056b-48fe-a1a9-9e4d2340907c` |
| OpenAI Ads | Pixel ID | `D75vs25S8kHCy2t9f3RK1c` |
| Microsoft Clarity | Project ID | `x8s5tnix4i` |

المعرفات القديمة التالية للمراجعة والـRollback فقط، وممنوع تحميلها أو إعادة استخدامها في التنفيذ الجديد: GTM `GTM-PZRLPZN2`، GA4 `G-QSJ0G255BE`، Property `541403336`، Stream `15061658163`، وGoogle Ads call label `zbwtCLjs48EcEL2Dr_ZD`. لا توضع API keys أو Access Tokens أو CAPI secrets في GTM أو المستودع.

### حالة التنفيذ الحالية

- تم إنشاء Click-to-call `7790979748` وClick-to-WhatsApp `7790816120` كتحويلين Secondary مستقلين، ونجح تشغيل كل منهما مرة واحدة على حدثه exact-match داخل GTM Preview.
- تم تغيير اسم التحويل `7777230464` إلى `Smile Pro — Confirmed Website Lead`، وضبطه Secondary مؤقتًا، Count One، بلا قيمة مالية، وبلا Account-level goal إلى أن ينجح اختبار Lead حقيقي.
- Manual Enhanced Conversions معدة داخل Tag الـLead فقط: معامل `user_data` يقرأ `UPD - Google Ads - Hashed phone E.164`، والذي يقرأ `CJS - Google Ads user_data - SHA256 E.164` ويقدم `sha256_phone_number` من `user_data.phone_sha256_e164`.
- حقل Transaction ID الأصلي في GTM اسمه الداخلي `orderId` ومربوط بـ`{{DLV - lead_id}}`. المفتاح `transactionId` في ملف import تتجاهله واجهة GTM، ولذلك تمنعه الاختبارات.
- Tag الـLead ما زالت Paused حتى اختبار إرسال حقيقي وفحص payload وعدم التكرار. لم تُنشر الحاوية بعد.
- التحويلات المتداخلة `7645766110`, `7654283640`, `7654151276`, `7751362991` أصبحت Secondary وخارج Account-level Campaign Goals دون حذفها.
- Enhanced Measurement المتداخل واكتشاف بيانات المستخدم التلقائي معطلان. Custom Dimensions هي فقط `page_kind`, `language`, `form_name`, `form_position`, `cta_location`. إنشاء Key Event لـ`generate_lead` ينتظر وصول الحدث الحقيقي أول مرة.
- ربط GA4 Property `554862114` بحساب Ads المستهدف متوقف لأن واجهة GA4 تعرض حسابًا مختلفًا (`845-423-2402`) ولا تعرض `683-517-3815` ضمن الحسابات المتاحة.

## 1. ما ينفذه الموقع

- ينشئ `window.dataLayer` واحدة وإصدار العقد `2.0`.
- يرسل لكل حدث `event_id` و`event_time_ms` و`session_id` وسياق الصفحة.
- ينشئ `lead_id` و`attempt_id` مستقلين لكل نموذج.
- يحفظ first-touch وlast-non-direct لمدة لا تزيد على 90 يومًا.
- يلتقط `gclid`, `wbraid`, `gbraid`, `fbclid`, `ttclid`, `ScCid`, `oppref`, `msclkid` وحقول UTM دون حساسية لحالة حروف اسم المتغير.
- يمرر `session-id` والإسناد إلى Netlify Forms، بما فيه نسختا JSON باسم `first-touch` و`last-non-direct`.
- يربط JavaScript بالنماذج عبر `data-lead-form` بدل `data-netlify`؛ لأن Netlify يزيل علامة الاكتشاف الخاصة به من HTML المنشور بعد معالجة النماذج.
- يطلق كل نموذج، بما فيه نماذج المقالات والحاسبتان، حدث `smile_pro_lead` في صفحة النموذج نفسها فور رد HTTP ناجح من Netlify، ثم ينتظر `eventCallback` من GTM أو مهلة الأمان قبل الانتقال. لا يعتمد المسار الطبيعي على وصول JavaScript الخاص بصفحة الشكر.
- يستخدم pending lead صالحًا لمدة 15 دقيقة ورمز تأكيد عشوائيًا خاصًا بالمحاولة للمسار الاحتياطي فقط. لا تقرأ صفحة الشكر الـLead إلا عند تطابق الرمز، وتدفع الحدث ثم تحوله فورًا إلى `dispatched`؛ لذلك refresh وback والزيارة المباشرة لصفحة الشكر لا تعيد التحويل.
- يلتقط رمز التأكيد وينظفه من شريط العنوان داخل `<head>` قبل بدء GTM، ثم يمرره داخليًا إلى صفحة الشكر؛ فلا يدخل عناوين الصفحات التي تقرؤها المنصات. يحتفظ بالرمز مؤقتًا في الذاكرة أيضًا حتى لا يعتمد تنظيف الرابط على نجاح الكتابة في `sessionStorage`. وعند الرجوع عبر bfcache يبدأ Page View ومحاولة نموذج جديدان بمعرفات جديدة، ويُعاد تفعيل زر الإرسال وحالة بدء النموذج، مع مراقب مشاهدة واحد لكل محاولة.
- يعيد قراءة أحدث إسناد عند الرجوع عبر bfcache وقبل إنشاء طلب النموذج، دون اعتبار معاملات الحملة القديمة في الرابط زيارة إعلانية جديدة. يحدّث حقول Netlify ويحفظ نسخة الإسناد الخاصة بطلب الإرسال نفسه لحدث التحويل؛ فلا تغيّر زيارة حملة أخرى أثناء انتظار الرد إسناد ذلك الطلب.
- يمنع قفل داخلي بدء طلبي إرسال متوازيين أثناء تحميل التحقق الكسول لرقم الهاتف، فلا ينشئ الضغط المتكرر Lead مكررًا.
- إذا فشل `fetch` يرجع إلى إرسال HTML العادي مع رمز التأكيد في عنوان صفحة الشكر؛ لا يدعي نجاح التحويل إلا إذا وصل المتصفح إلى تلك الصفحة بعد إرسال النموذج.
- نجاح Netlify يدفع الحدث في الصفحة الحالية سواء كان `sessionStorage` متاحًا أم لا. ويظل تخزين pending lead مستخدمًا فقط لتأكيد النجاح بعد الإرسال التقليدي الاحتياطي.

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

`dataLayer` ليست حاجزًا أمنيًا؛ أي Custom HTML Tag يستطيع قراءة الصفحة. الاستثناءات الوحيدة المسموحة هي كود Meta Pixel الرسمي (`fbevents.js` مع نداءات الأحداث الصريحة)، وTikTok Pixel Base Code الرسمي لأن قالب أحداث TikTok الرسمي يشترط وجوده، وOpenAI Measurement SDK الرسمي مع نداءات الأحداث الصريحة. لا تستخدم قالب Meta تابعًا لطرف ثالث، ولا تضف أي Custom HTML عام آخر، ويجب أن تُبنى كل Tag من allowlist صريحة.

### الإسناد ومعرفات الجلسة

| المنصة | الموجود في Data Layer | المعرف الذي يديره Pixel | التنفيذ |
|---|---|---|---|
| Google | `gclid`, `wbraid`, `gbraid` | `_gcl_aw` ومعرفات Google | Conversion Linker؛ لا تمرير Cookie يدويًا |
| Meta | `fbclid` | `_fbc`, `_fbp` | Meta Pixel يديرهما تلقائيًا |
| TikTok | `ttclid` | `_ttp` | TikTok Pixel يديره تلقائيًا |
| Snapchat | `sccid` الملتقط من `ScCid` | Cookies الخاصة بـSnap Pixel | Pixel يديرها تلقائيًا |
| OpenAI | `oppref` | `__obref` | OpenAI Pixel يديرها تلقائيًا |
| Microsoft | `msclkid` | Cookies UET | حفظ للإسناد فقط؛ Microsoft Ads خارج النطاق |
| الموقع | `session_id` | `sessionStorage` داخلي | ربط محاولات النماذج فقط، ولا يرسل إلى المنصات |

تبقى Click IDs وUTM في `first_touch`, `last_non_direct` وNetlify submission. لا يرسل كائن `attribution` كاملًا إلى GA4 أوأي منصة، ولا تنسخ Cookies المنصات إلى `dataLayer`. التمرير اليدوي للCookies مؤجل إلى مشروع CAPI منفصل.

## 4. متغيرات GTM

أنشئ Data Layer Variables بإصدار 2 للأسماء المستخدمة فعليًا فقط:

- `event_id`
- `lead_id`
- `page_kind`, `language`, `page_path`, `page.title`
- `content_type`, `cta_location`, `link_url`
- `form_name`, `form_position`, `field_name`, `error_type`
- `step`, `slots_shown`, `faq_index`, `video_id`
- `user_data.phone_sha256_e164`
- `user_data.phone_sha256_digits`

استخدم `{{Page URL}}` المدمج لمعامل GA4 `page_location`، و`page.title` لمعامل `page_title`. لا تنشئ DLV لـ`attempt_id` أو`session_id` أو`service` أو`procedure` أوCookies المنصات؛ فهي لا تدخل أي Tag في هذا التنفيذ.

أنشئ Constant Variable لكل Platform ID وConversion Label من سجل المعرفات أعلاه. لا تضع أي API key؛ معرفات الـPixels عامة، أما أسرار CAPI فلا تدخل Web Container مطلقًا. التصدير المرجعي القديم يحتوي Label باسم `zbwtCLjs48EcEL2Dr_ZD` داخل `Call-Conversion`؛ هذا خاص بتحويل الاتصال القديم وليس Lead النموذج، ويجب ألا يظهر في الـWorkspace الجديد.

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
2. Meta Base يستخدم الـCustom HTML الرسمي ويشغّل `fbq('set', 'autoConfig', false, pixelId)` ثم `init` فقط، دون `PageView` تلقائي ودون قالب طرف ثالث.
3. TikTok Base يستخدم الـCustom HTML الرسمي وينفذ `load` فقط دون `ttq.page()` تلقائي؛ الأحداث تستخدم قالب TikTok الرسمي.
4. Snapchat Base ينفذ `init` فقط دون `PAGE_VIEW` تلقائي.
5. ChatGPT Ads يستخدم Custom HTML محدودًا لتحميل OpenAI Measurement SDK الرسمي وتنفيذ `init` فقط؛ الملف [`tracking/openai-ads-pixel.tpl`](tracking/openai-ads-pixel.tpl) مرجع تاريخي وليس التنفيذ النشط.
6. Clarity Base واحدة فقط.

اضبط **Tag firing options = Once per page** لكل Base Tag. استخدمها كـSetup Tag في Tag Sequencing عند الحاجة؛ خيار Once per page يمنع إعادة `init` مع كل حدث. يجب أن توجد Page View Tag واحدة لكل منصة وتعمل على `site_page_view` فقط.

## 7. خريطة الأحداث

| حدث الموقع | GA4 | Google Ads | Meta | TikTok | Snapchat | ChatGPT Ads |
|---|---|---|---|---|---|---|
| `site_page_view` | `page_view` | — | `PageView` | `PageView` | `PAGE_VIEW` | `page_viewed` |
| `content_view` | `content_view` | — | `ViewContent` | `ViewContent` | `VIEW_CONTENT` | `contents_viewed` |
| `click_call` | `click_call` | Secondary | `Contact` | `Contact` | `CUSTOM_EVENT_1` | — |
| `click_whatsapp` | `click_whatsapp` | Secondary | `Contact` | `Contact` | `CUSTOM_EVENT_2` | — |
| `smile_pro_lead` | `generate_lead` | Primary | `Lead` | `SubmitForm` | `SIGN_UP` | `lead_created` |

كل conversion tag تستعمل `event_id` نفسه:

- Meta: Event ID = `event_id`.
- TikTok: Event ID = `event_id`.
- Snapchat: `client_dedup_id` = `event_id`.
- ChatGPT Ads: options `event_id` = `event_id`.

نفّذ المطابقة داخل Tag التحويل فقط وبالترتيب التالي، باستخدام إعداد **Manual/Advanced Matching** الذي يوفره قالب المنصة المعتمد داخل GTM:

- Google Ads: مرر معامل الحدث `user_data` من متغير User-Provided Data باسم `UPD - Google Ads - Hashed phone E.164`. هذا المتغير يعمل بوضع Code ويقرأ كائنًا يحتوي `sha256_phone_number` من `user_data.phone_sha256_e164`. استخدم الحقل الأصلي `orderId={{DLV - lead_id}}` لمعرف المعاملة، وليس مفتاح import باسم `transactionId` لأن GTM يتجاهله.
- Meta: في Custom HTML الخاص بحدث Lead فقط، أعد `init` بالحقل `ph` من `user_data.phone_sha256_digits` ثم نفّذ `trackSingle` لحدث `Lead` مع `eventID` نفسه. لا توجد مطابقة في Base أو أي حدث آخر.
- TikTok: شغّل Manual Advanced Matching/Identify باستخدام `user_data.phone_sha256_e164` قبل `SubmitForm`، ثم مرر `event_id` نفسه.
- Snapchat: عيّن hashed phone من `user_data.phone_sha256_digits` قبل `SIGN_UP`، واجعل `client_dedup_id` مساويًا لـ`event_id`.
- ChatGPT Ads: قالب المشروع يعيد `init` للهاتف المشفّر ثم يرسل `lead_created` بنفس `event_id`.

لا تجعل Base Tags تقرأ الهاتف؛ لا تكون قيمة المطابقة متاحة أصلًا إلا مع حدث `smile_pro_lead` المؤكد.

لا ترسل قيمة مالية مع الـLead، ولا ترسل `service` أو نتيجة الحاسبة أو التشخيص أو القياس أو حالات العين أو التقنية المرشحة إلى Advertising Tags.

### معاملات الأحداث الإعلانية

| الحدث | المعاملات الإضافية المسموحة |
|---|---|
| `site_page_view` | `event_id` لكل منصة إعلانية |
| `content_view` | `event_id` و`content_type=article` فقط |
| `click_call`, `click_whatsapp` | `event_id` فقط للإعلانات؛ `cta_location` يذهب إلى GA4 فقط |
| `smile_pro_lead` | Google Ads: `transaction_id=lead_id` وE.164 hash؛ Meta: `eventID` وdigits hash؛ TikTok: `event_id` وE.164 hash؛ Snapchat: `client_dedup_id` وdigits hash؛ OpenAI: `event_id`, `type=customer_action`, digits hash |

## 8. GA4 وClarity

كل حدث GA4 يرسل `event_id`, `page_kind`, `language`, `page_location`, `page_title`، ثم allowlist الإضافية التالية فقط:

| Data Layer Event | GA4 Event | المعاملات الإضافية |
|---|---|---|
| `site_page_view` | `page_view` | `page_path` |
| `content_view` | `content_view` | `content_type` |
| `click_call`, `click_whatsapp` | نفس الاسم | `cta_location` |
| `smile_pro_lead` | `generate_lead` | `form_name`, `form_position` |
| `cta_click` | نفس الاسم | `cta_location`, `link_url` |
| `lead_form_view`, `lead_form_start`, `lead_form_submit_attempt`, `lead_phone_valid` | نفس الاسم | `form_name`, `form_position` |
| `lead_form_error` | نفس الاسم | `form_name`, `form_position`, `field_name`, `error_type` |
| `estimator_start`, `estimator_result` | نفس الاسم | لا شيء |
| `estimator_step` | نفس الاسم | `step` |
| `procedure_comparison_open`, `procedure_comparison_choice` | نفس الاسم | `form_position` |
| `fomo_banner_view` | نفس الاسم | `slots_shown` |
| `faq_open` | نفس الاسم | `faq_index` |
| `video_start` | نفس الاسم | `video_id` |

جميع أحداث الصفوف التحليلية فقط ممنوعة من تشغيل Advertising Tags. لا تمرر `service`, `procedure`, نتائج/إجابات الحاسبة، `lead_id`, `attempt_id`, `session_id` أو`user_data` إلى GA4. لا تنشئ Custom Dimensions لهذه المعرفات؛ أنشئ فقط `page_kind`, `language`, `form_name`, `form_position`, `cta_location`. لا تسجل قيمة حقول النماذج أو Custom Event للهاتف في Clarity، وتبقى الحقول masked.

### إعداد GA4 وGoogle Ads

- استخدم GA4 `G-K4989EX8EJ` فقط، وعطّل Enhanced Measurement المتداخل، وعرّف `generate_lead` كـKey Event.
- اربط Property `554862114` بـGoogle Ads `683-517-3815`، لكن لا تستورد `generate_lead` كتحويل Ads ثانٍ.
- استخدم Conversion Action الموجود ID `7777230464`. بعد نجاح Preview، أعد تسميته إلى `Smile Pro — Confirmed Website Lead` واجعله Primary، Count One، بلا قيمة، مع Manual Enhanced Conversions من `phone_sha256_e164`.
- تحويل Click-to-call هو `7790979748`/`Vdu7CKTVg4MdEL2Dr_ZD`، وتحويل WhatsApp هو `7790816120`/`grnJCPjW-YIdEL2Dr_ZD`. كلاهما Secondary، Count One، وبلا قيمة مالية.
- حوّل التحويلات القديمة المتداخلة إلى Secondary وأزلها من Account-level Campaign Goals دون حذفها.
- استخدم Conversion Linker واحدة فقط. لا تمرر `_gcl_aw` أوأي Cookie يدويًا، وعطّل automatic user-data detection.

## 9. ChatGPT Ads

استخدم Custom HTML محدودًا يعرّف queue باسم `oaiq` ويحمل SDK الرسمي من `https://bzrcdn.openai.com/sdk/oaiq.min.js`. لا تستخدم قالب Community أو SDK URL آخر. أنشئ أربع Tags:

1. Initialize only على Initialization – All Pages.
2. Page viewed على `site_page_view`.
3. Contents viewed على `content_view`.
4. Lead created على `smile_pro_lead`، مع `phoneNumberSha256 = user_data.phone_sha256_digits` و`eventId = event_id`.

عملية Lead تعيد `init` مع `user.phone_number_sha256` ثم ترسل `lead_created` بنوع `customer_action`. Pixel ID الحقيقي محفوظ في المواصفة، ولا تفعّل هذه Tags في النسخة المنشورة قبل نجاح GTM Preview واختبارات الخصوصية وعدم التكرار. ملف `tracking/openai-ads-pixel.tpl` محفوظ للمراجعة التاريخية فقط ولا يُستورد في الـWorkspace النشط.

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

1. شغّل `npm run check` و`npm run check:staging`، وبعد حفظ Export الرسمي شغّل `npm run check:gtm-export`.
2. افتح Deploy Preview من خلال GTM Preview.
3. تأكد أن Page View تصل مرة واحدة لكل منصة.
4. أرسل نموذجًا ناجحًا وتأكد أن كل منصة تستقبل Conversion واحدة بنفس `event_id`.
5. نفذ refresh وback على صفحة الشكر وتأكد أنه لا يوجد Conversion جديد.
6. افتح صفحة الشكر مباشرة في نافذة خاصة وتأكد أن `smile_pro_lead` لا يظهر.
7. افحص Network وData Layer وتأكد أن الرقم الخام لا يظهر إلا في POST الخاص بـNetlify Forms.
8. تأكد أن GA4 DebugView وClarity لا يستقبلان hash الهاتف.
9. اختبر حجب SDK لكل منصة؛ يجب أن يستمر إرسال النموذج والانتقال لصفحة الشكر.
10. افحص `gclid/_gcl_aw`, `fbclid/_fbc/_fbp`, `ttclid/_ttp`, `ScCid`, و`oppref/__obref`، مع بقاء Click IDs داخل first-touch وlast-non-direct وNetlify فقط.
11. شغّل `npm run perf:smoke` وقارن تكلفة كل third-party script في Lighthouse وDevTools.

لا تعتمد Workspace أو Production Deploy قبل نجاح هذه القائمة. بعد النشر، راقب Diagnostics والتحويلات 72 ساعة، وأوقف النسخة أو ارجعها عند وجود Lead مكرر أو تسريب بيانات.
