# مراجعة Google Ads وGoogle Analytics قبل إعداد GTM

تاريخ المراجعة: 18 سبتمبر 2026. المعلومات أدناه قُرئت من واجهات الحسابين المسجّل دخولهما في Chrome، باستثناء الـLabel القديم المشار إليه صراحةً كتصدير محلي.

## حدود هذه الخطوة

- مراجعة تحضيرية فقط: لم يُنشأ Event أو Conversion، ولم تُحذف أو تُعدّل التحويلات أو إعدادات القياس القديمة.
- لم يبدأ إعداد GTM Web Container، ولم يُنشر أي Container.
- فُتحت إعدادات للقراءة وأُغلقت دون Save. تغيير فلتر عرض قائمة التحويلات إلى `All` أظهر تحويلات كانت Removed بالفعل قبل المراجعة؛ لم نحذفها نحن.
- لا يحتوي هذا التقرير على بيانات العملاء أو أرقام هواتفهم أو مفاتيح API أو بيانات الدفع.
- وجود أحداث أو تحويلات Active لا يثبت أن التنفيذ الجديد أرسلها بشكل صحيح؛ ذلك يحتاج اختبار Preview لاحقًا.

## المعرفات المؤكدة

| العنصر | القيمة | مصدر التحقق |
|---|---|---|
| اسم حساب Ads | Smile-Pro | واجهة Google Ads |
| Google Ads Customer ID | `683-517-3815` | واجهة Google Ads |
| Google Ads Conversion ID | `AW-18233409981` | تفاصيل Google Tag داخل Ads؛ مطابق للمشروع |
| اسم حساب Analytics وProperty | Smile-Pro | واجهة Analytics |
| Analytics Account ID | `397818498` | مسار صفحة الحساب |
| GA4 Property ID | `541403336` | Property details ومسار الصفحة |
| Web stream | `smile-pro` | Data streams |
| Stream URL | `https://smileproegypt.com` | Web stream details |
| Stream ID | `15061658163` | Web stream details |
| Measurement ID | `G-QSJ0G255BE` | Web stream details |

حساب Ads أعلاه مرتبط بالـProperty الصحيح. الربط مؤرخ في 12 يونيو 2026، و`Personalized advertising` معطّل في هذا الربط. تُرك كما هو، ولا يُعد هذا وحده دليلًا على تعطل قياس التحويلات.

## Analytics: الوضع الحالي

### إعدادات عامة

- المنطقة الزمنية: Egypt، وتعرض الواجهة `(GMT+03:00) Egypt Time` وقت المراجعة.
- العملة: `EGP`.
- جمع البيانات نشط خلال آخر 48 ساعة بحسب واجهة الـStream.
- الاحتفاظ ببيانات الأحداث: شهران؛ بيانات المستخدم: 14 شهرًا؛ Reset on new user activity مفعّل.
- فلتر `Internal Traffic`: نوع `Exclude` لكن حالته `Testing`؛ ليس استبعادًا نشطًا من البيانات حاليًا.
- عدد Custom dimensions: صفر. لم تُنشأ أي تعريفات جديدة.
- Attribution model: `Data-driven`، قنوات `Paid and organic channels`.
- نافذة Acquisition key events: 30 يومًا؛ Other key events: 90 يومًا؛ Engaged-view: 3 أيام.
- Data redaction للبريد مفعّل، وتنقيح URL query parameter keys غير مفعّل.

### Enhanced measurement

مفعّل، وكل الخيارات التالية مفعّلة حاليًا: Page views، Scrolls، Outbound clicks، Site search، Form interactions، Video engagement، File downloads. كذلك `Page changes based on browser history events` محدّد.

عند إعداد GTM لاحقًا، يلزم حسم من يرسل `page_view` حتى لا يجتمع الإرسال التلقائي مع إرسال `site_page_view` اليدوي. إعدادات Form interactions الحالية تُنتج `form_start` و`form_submit`، وهي ليست إثباتًا لقبول Netlify للـLead. لا نعتمدها كهدف المزايدة الأساسي. لم نعطّل أي خيار في هذه الخطوة.

### Key events الموجودة

| الحدث | الحالة الظاهرة |
|---|---|
| `generate_lead` | Key event موجود، والـStream نشط |
| `Lead_Submit` | Key event موجود، والـStream نشط |
| `ads_conversion_Submit_lead_form_Page_l_1` | Key event موجود، والـStream نشط |
| `purchase` | حدث افتراضي؛ No stream data detected |

`generate_lead` يُعدّ `Once per event`، وليس Once per session. لا توجد له قيمة مالية افتراضية في Analytics. لذلك لا نحتاج إنشاء GA4 Lead event جديد؛ يمكن أن يرسل GTM لاحقًا الحدث الموجود بعد نجاح النموذج فقط.

ظهرت ضمن Recent events لآخر 28 يومًا هذه الأسماء:

```text
ads_conversion_Submit_lead_form_Page_l_1
call_click
click
estimator_step
first_visit
form_start
form_submit
generate_lead
Lead_Submit
page_view
scroll
session_start
Submit_Form
user_engagement
```

هذه قائمة الأحداث التي وصلت سابقًا، وليست قائمة الأحداث الجديدة التي تم تفعيلها في هذه المراجعة.

### قواعد Custom events القديمة الظاهرة

| الاسم | شروطه الظاهرة |
|---|---|
| `ads_conversion_Submit_lead_form_Page_l_1` | `event_name = page_view` و`page_path` يبدأ بـ`/thank-you.html`، دون حساسية لحالة الأحرف |
| `Lead_Submit` | `event_name = page_view` و`page_location` يحتوي `thank-you.html`، دون حساسية لحالة الأحرف |
| `Submit_Form` — صف أول | `event_name = page_view` و`page_location` يحتوي `thankyou`، دون حساسية لحالة الأحرف |
| `Submit_Form` — صف ثانٍ | `event_name = page_view` و`page_location` يحتوي `thank-you.html`، دون حساسية لحالة الأحرف |

القواعد مرتبطة بعرض صفحة، لا بنجاح طلب النموذج. كذلك مسارا الشكر الحاليان `/thank-you/` و`/ar/thank-you/` لا يطابقان شروط `.html` المذكورة. هذه نقطة اختلاف بين القديم والجديد، وليست إذنًا لتغيير القواعد أو حذفها.

## Google Ads: الوضع الحالي

- المنطقة الزمنية المعروضة: `(GMT+03:00) Eastern European Time`.
- `Auto-tagging` مفعّل: `Tag the URL that people click through from my ad` محدّد.
- `Enhanced conversions` مفعّل، وطريقة إدارته الحالية `Google Tag`.
- شروط بيانات العملاء مقبولة بالفعل بحسب الواجهة: `You've read and accepted these terms`.
- داخل تفاصيل Google Tag، `Allow user-provided data capabilities` و`Automatically detect user-provided data` مفعّلان. الاكتشاف التلقائي للبريد والهاتف والاسم والعنوان كلّه محدّد، و`Specify CSS selectors or JavaScript variables` غير محدّد.
- هذه الإعدادات تحتاج مراجعة لاحقة عند تنفيذ Manual Matching للهاتف فقط. لم تُغيّر هنا، ولا نفترض أن الحقول المكتشفة وصلت فعلًا إلى أي وجهة دون اختبار.
- يظهر تحذير حساب: `New form of payment required — Your current payment methods can't be charged.` يحتاج صاحب الحساب معالجة وسيلة الدفع قبل تشغيل الإعلانات؛ لم نفتح إعداد الدفع أو ننفذ أي إجراء مالي.

### قائمة Conversion actions

عرض `All enabled` يحتوي 11 إجراءً. عرض `All` يحتوي 13، منها اثنان Removed مسبقًا. العمود الأخير أدناه هو `Included in account-level goals`، ولا يضمن بمفرده أن كل حملة تستخدم الهدف نفسه.

| الاسم كما يظهر | المصدر | الحالة | Optimization | Count | Click window | Account goals |
|---|---|---|---|---|---|---|
| `Lead form - Submit` | Google hosted | No recent conversions | Secondary | One | يوم واحد | No |
| `Smile-Pro (web) generate_lead` | Website (GA4) | Active | Primary | One | 90 يومًا | No |
| `Submit lead form (Page load smileproegypt.com/thank-you.html)` | Website (GA4) | Active | Primary | Every | 30 يومًا | No |
| `manual_event_SUBMIT_LEAD_FORM` | Website (GA4) | Removed مسبقًا | Primary | Every | 90 يومًا | Yes |
| `Smile-Pro (web) Lead_Submit` | Website (GA4) | Active | Primary | One | 90 يومًا | Yes |
| `Sign-up (smileproegypt.com/)` | Website | Active | Primary | One | 90 يومًا | Yes |
| `Click to call` | Call from Ads | Active | Primary | One | 30 يومًا | Yes |
| `Clicks to call` | Google hosted | Active | Primary | Every | 30 يومًا | No |
| `Local actions - Directions` | Google hosted | Active | Primary | Every | 30 يومًا | No |
| `Local actions - Other engagements` | Google hosted | Active | Primary | Every | 30 يومًا | No |
| `Local actions - Website visits` | Google hosted | Active | Primary | Every | 30 يومًا | No |
| `Smile-Pro (web) qualify_lead` | Website (GA4) | Removed مسبقًا | Primary | Every | 90 يومًا | Yes |
| `Conversation started` | Google hosted | No recent conversions | Primary | One | 30 يومًا | No |

توجد عدة تحويلات Primary مرتبطة بالـLead أو الشكر والاتصال. هذا يخلق احتمال احتساب عدة أهداف للمستخدم نفسه عند جمع تنفيذات قديمة وجديدة. لم نثبت التكرار على مستوى Lead فردي، ولم نغير Primary/Secondary أو أهداف الحملات. يلزم اعتماد هدف المزايدة الأساسي ومراجعة إعداد كل حملة لاحقًا قبل الإطلاق.

### التحويل المباشر الحالي: Sign-up

- الاسم: `Sign-up (smileproegypt.com/)`.
- Conversion action ID من صفحة التفاصيل: `7751362991`؛ **ليس Conversion Label**.
- النوع: Website، ولكن الـEvent هو `Page load: smileproegypt.com/thank-you.html`.
- Data source يصف زيارة صفحة يبدأ عنوانها بـ`smileproegypt.com/thank-you.html`.
- القيمة الحالية: `EGP 1`.
- Count: One؛ Click-through: 90 يومًا؛ Engaged-view: 3 أيام؛ View-through: يوم واحد.
- Attribution: Data-driven، Google paid channels.
- Enhanced conversions: `Setup issues detected. Managed through Google Tag`.
- لم تظهر له تعليمات Tag Setup يدوية أو Conversion Label في التفاصيل التي فُحصت؛ إعداد التحويل المعروض قائم على URL.

وفق [توثيق Google لتحويلات URL](https://support.google.com/google-ads/answer/12676738?hl=en)، هذا النوع ليس إعداد Conversion tag يدويًا بواسطة GTM. أما [Google Ads Conversion Tracking في GTM](https://support.google.com/tagmanager/answer/6105160?hl=en) فيحتاج Conversion ID وConversion Label خاصين بالإجراء.

## النتيجة بخصوص Conversion Label

> تحديث لاحق في 18 سبتمبر: بعد هذه المراجعة أُنشئ تحويل اختبار مستقل باسم `Smile Pro - Confirmed lead - New system TEST`، وأصبح Label المؤكد له `AzguCIC9vPwcEL2Dr_ZD`. الفقرات التالية تسجل الحالة وقت التدقيق قبل إنشاء هذا التحويل.

لم نعثر على Label يدوي مناسب لتحويل نجاح النموذج ضمن الإجراءات التي فُحصت. الموجود قابل لإعادة الاستخدام بطريقتين مختلفتين يجب عدم الخلط بينهما:

1. `Smile-Pro (web) generate_lead`: تحويل مستورد من Analytics، موجود بالفعل؛ لا يحتاج Label لإرسال GA4 `generate_lead` ثم استيراده.
2. `Sign-up (smileproegypt.com/)`: تحويل مباشر قائم على URL الشكر القديم، وليس الإرسال اليدوي بعد نجاح Netlify الذي تطلبه الخطة.

التصدير المحلي القديم `tracking/gtm-container-baseline-export.json` يحتوي Label `zbwtCLjs48EcEL2Dr_ZD` داخل Tag اسمه `Call-Conversion` ويعمل على ضغط الاتصال. هذا **دليل من التصدير المرجعي القديم فقط**؛ لا يُستخدم بدل Label النموذج، ولم يُتحقق في هذه الخطوة من تطابقه مع Conversion action حيّ بعينه.

لم نضع قيمة تخمينية في `google_ads_lead_label`، وتظل قيمته `required-in-gtm` في `tracking/gtm-workspace-spec.json`.

## القرارات المطلوبة قبل التنفيذ اللاحق

### إنشاء يحتاج موافقة أولًا

لإكمال Google Ads Conversion tag المباشر والمطابقة اليدوية كما في الخطة، يُقترح إنشاء Website conversion يدوي جديد:

- اسم واضح مثل `Smile Pro — Confirmed website lead`.
- Goal: Submit lead form.
- Count: One.
- لا تُستخدم قيمة باقة SMILE Pro كقيمة Lead.
- Secondary مبدئيًا إلى أن ينجح الاختبار ويُعتمد هدف المزايدة؛ لا يُضاف Primary جديد فوق القديم أثناء التحضير.
- سيُفعّل لاحقًا على `smile_pro_lead` بعد نجاح Netlify فقط، مع `lead_id` كـTransaction ID للحد من التكرار، وphone hash المناسب للمطابقة اليدوية.
- حفظ Conversion ID/Label الحقيقيين بعد إنشائه، مع إبقاء كل الإجراءات القديمة دون حذف.

**لم يُنشأ هذا التحويل. يجب طلب موافقة المستخدم على إنشائه قبل أي إجراء في الحساب.** البديل دون إنشاء جديد هو الاكتفاء باستيراد GA4 `generate_lead` الموجود، لكنه ليس مسار Google Ads Conversion tag المباشر المحدد في الخطة.

### تغييرات أخرى لم تُنفذ

- منع التداخل بين GA4 page views التلقائية والإرسال اليدوي عند بدء إعداد GTM.
- الانتقال من اكتشاف بيانات العملاء تلقائيًا إلى المطابقة اليدوية المعتمدة، بعد موافقة مناسبة على تغييرات الحساب.
- اعتماد Primary/Secondary وأهداف الحملات بحيث يكون النموذج المؤكد هدف المزايدة الأساسي الوحيد حسب الخطة، دون حذف القديم.
- اعتماد أي Custom dimensions أو Key events إضافية قبل إنشائها؛ Lead event الأساسي موجود بالفعل.

### الاختبارات المؤجلة حتى يُسمح بإعداد GTM

- GTM Preview وGA4 DebugView وTag Assistant؛ تحويل واحد لكل نجاح، ولا تحويل لفتح الشكر مباشرة أو فشل Netlify أو refresh/back.
- عدم إرسال الهاتف الخام أو hash إلى GA4؛ فحص الوجهات والحقول فعليًا، لا الاكتفاء بوجود dataLayer.
- Enhanced conversions diagnostics بعد الإعداد؛ حالة Setup issues الحالية لم تُصلح أثناء المراجعة.
- اختبار الإسناد عبر gclid/wbraid/gbraid، واستمرار attribution وlead_id؛ Auto-tagging الحالي مفعّل لكنه لا يغني عن الاختبار.
- قياس الأداء مع المنصات الفعلية مفعّلة، دون تغيير سياسة التشغيل الفوري.

لا توجد في هذه الخطوة موافقة على إعداد GTM أو نشره أو تشغيل أحداث اختبار حقيقية أو push/deploy للمشروع.
