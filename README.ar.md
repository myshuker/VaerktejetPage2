# Cookmedical – Værktøjs status

صفحة ويب بسيطة تتحقق من حالة أي أداة (Værktøj): هل هي **SW Valid** وهل هي **Process Valid**، وتعرض صورتها إن وُجدت.

## طريقة الاستخدام

1. افتح `index.html` في المتصفح. لا يحتاج البرنامج إلى سيرفر أو إنترنت.
2. ابحث بإحدى طريقتين:
   - **Værktøjet nummer:** اكتب رقم الأداة، مثل `EQ00011597` أو `52580` أو `52580-C`، أو رقم Asset مثل `1006378`. تظهر النتيجة أثناء الكتابة، أو عند الضغط على **Søg**.
   - **Værktøj navn:** اكتب جزءاً من الاسم، مثل `balloon` أو `ballonmaskine ø2`. تظهر اقتراحات بأسماء الأدوات. اختر اقتراحاً بالماوس، أو بالأسهم ثم Enter.

## ماذا يعرض البرنامج

| النتيجة | المصدر |
|---|---|
| **Equipment name** | عمود **Description** في `ASSET_DATA` في `asset-data.js` (من værktøj.xlsx). إذا لم يوجد الرقم هناك: الاسم من `SW_TOOL_DATA` |
| **Status** (Active/Obsolete) | `SW_TOOL_DATA` في `data.js` (من D00174522-Rev104.xlsx) |
| `Active` ← "Værktøjet er SW valid" (أخضر) | |
| `Obsolete` ← "Not SW Valid" (أحمر) | |
| **Quality Risk Group** و **Status (værktøj)** | `ASSET_DATA` في `asset-data.js` (من værktøj.xlsx) |
| **Process Valid / Not process Valid** | `PROCESS_TOOL_DATA` في `data.js` (من D00018073-Rev075.xlsx) |
| **Billede** (صورة الأداة) | مجلد `images/tools/` |

البحث بالرقم يستخدم هذه الأعمدة:

- في بيانات SW: `eq` (EQ-Number) و `dnum` (D-number) و `legacy` (Legacy number).
- في værktøj.xlsx: **Alias** و **Asset** و **Category** (رقم EQ).

البحث بالاسم يستخدم عمود **Description** في værktøj.xlsx. يجب أن تكون كل الكلمات المكتوبة موجودة في الاسم، بأي ترتيب.

إذا لم يكن رقم Asset موجوداً في بيانات SW، يستخدم البرنامج رقم Alias ورقم EQ الخاصين بالأداة من værktøj.xlsx. وإذا كان رقم EQ يشمل عدة Assets، تظهر كل القيم المختلفة، مثل "Installed, Retired".

البحث لا يفرّق بين الحروف الكبيرة والصغيرة.

إذا لم يجد البرنامج الرقم تظهر رسالة: "Please check input or Værktøjet ikke på SW Valid list".

## الملفات

```
index.html        هيكل الصفحة
style.css         التصميم (والخط مضمَّن داخله)
script.js         منطق البحث وعرض النتائج والصور
data.js           بيانات D00174522 و D00018073
asset-data.js     بيانات værktøj.xlsx
images/           الشعار والأيقونات
images/tools/     صور الأدوات
```

## صور الأدوات

المتصفح لا يستطيع عرض محتوى مجلد، لذلك يجرّب البرنامج أسماء ملفات محتملة بالترتيب حتى يجد صورة. الامتدادات المدعومة: `png`, `jpg`, `jpeg`, `webp`, `gif`.

ترتيب البحث عن الصورة:

1. **الرقم الكامل** كما كُتب، ثم أرقام الأداة الأخرى من البيانات. مثال: `153916-A.jpg`
2. **الرقم بدون الحرف الأخير**. مثال: `52827-A` ← `52827.jpg`
3. **اسم مستعار** من قائمة `NAME_IMAGE_ALIASES` في `script.js`. مثال: `Balloon Machine` ← `Ballonmaskine.jpg`
4. **اسم المعدّة من بيانات SW** (D00174522) بعدة صيغ. مثال: `Laser welder.jpg`
5. **Description من værktøj.xlsx**: النص كاملاً، ثم كل جزء حول " - "، ثم كل جزء بدون "(...)". مثال: `Laser welder - Lasersvejser` ← `Laser welder` ← الاسم المستعار `Lasersvejser.jpg`. الخطوتان 3 و 4 تُطبَّقان أيضاً على كل اسم من هذه الأسماء.

**لإضافة صورة:** ضع الملف في `images/tools/` باسم رقم الأداة، مثل `52580.jpg`.
وإذا كان اسم الملف مختلفاً عن اسم المعدّة، أضف سطراً إلى `NAME_IMAGE_ALIASES`:

```js
"balloon machine": "Ballonmaskine.jpg",
```

> ملاحظة: إذا وُجد ملفان بالاسم نفسه وامتدادين مختلفين، تظهر صورة `.png` لأن البرنامج يجرّبها قبل `.jpg`.

## تحديث البيانات

1. استبدل محتوى `SW_TOOL_DATA` أو `PROCESS_TOOL_DATA` في `data.js` بالبيانات الجديدة من ملفات Excel.
   لملف værktøj.xlsx: استبدل صفوف `ASSET_DATA` في `asset-data.js`. كل صف بهذا الترتيب: `[Category, Alias, Asset, Description, Status, Quality Risk Group]`.
2. حدّث أسماء الملفات (Rev) في الـ footer داخل `index.html`.
3. **كبّر رقم الإصدار** `?v=24` في `index.html` (مثلاً إلى `?v=25`). بدون ذلك قد تبقى المتصفحات تعرض الملفات القديمة المحفوظة في الكاش.
