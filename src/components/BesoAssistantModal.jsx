import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { collection, addDoc, onSnapshot, serverTimestamp } from 'firebase/firestore';
import { X, Send, Bot, Sparkles, BusFront, Compass, ChevronLeft, Edit3, CheckCircle2, PlusCircle, HelpCircle, ShieldCheck, Info } from 'lucide-react';
import { db, ADMIN_EMAIL } from '../firebase';
import { normalizeArabic } from '../App';

// ============================================================================
// 1. موسوعة الحوار الذكي وفهم هدف ومميزات تطبيق "طريقنا"
// ============================================================================
const BESO_CONVERSATIONAL_INTENTS = [
  {
    id: 'greeting',
    keywords: ['اهلا', 'سلام عليكم', 'السلام عليكم', 'صباح الخير', 'مساء الخير', 'ازيك', 'عامل ايه', 'اخبارك', 'مرحبا', 'هاي', 'الو', 'يا بيسو'],
    reply: `أهلاً بيك يا بطل في "طريقنا"! 👋🤖\nأنا "بيسو"، صاحبك ومساعدك الذكي لكل مواصلات وطرق مصر.\n\nتقدر تسألني عن:\n1️⃣ **ازاي أروح أي مكان أو محافظة في مصر** (ميكروباص، مترو، قطار، أتوبيس).\n2️⃣ **إيه هو تطبيق طريقنا وازاي تستفيد منه** في توفير مصاريف مشوارك أو إرسال طرد.\n3️⃣ **حالة الزحمة والأجرة** في المواقف!\n\nقولي، ناوي تتحرك على فين النهاردة؟ 🚀`
  },
  {
    id: 'app_purpose',
    keywords: ['هدف التطبيق', 'فكره التطبيق', 'فكره البرنامج', 'يعني ايه طريقنا', 'ابلكيشن ايه ده', 'بتعملوا ايه', 'لازمته ايه', 'وظيفه التطبيق', 'شرح التطبيق', 'عن التطبيق', 'افهم التطبيق'],
    reply: `سؤال ممتاز! خليني أشرحلك الهدف من تطبيق **"طريقنا"** باختصار وبساطة: 🎯🚗\n\nفكرة "طريقنا" قائمة على **التعاون وتوفير المصاريف والوقت** من خلال 3 خدمات رئيسية:\n\n1️⃣ **مشاركة الطريق (Carpooling):** لو معاك عربية ومسافر أو رايح شغلك وفيه كراسي فاضية، بتنزل رحلتك وتاخد معاك ناس في نفس طريقك يقسموا معاك ثمن البنزين.. ولو أنت راكب، بتلاقي عربية ملاكي مريحة ومباشرة من منطقتك بسعر أوفر من التاكسي!\n\n2️⃣ **توصيل الأمانات والطرود 📦:** لو عايز تبعت أمانة أو طرد سريع لمحافظة تانية، بتبعته مع مسافر رايح نفس المكان النهاردة يوصل في ساعات وبأقل تكلفة.\n\n3️⃣ **دليل مواقف مصر الذكي 🚏:** بنجمع كل مواقف الميكروباصات بخطوطها وتعريفتها الحقيقية وحالة الزحمة لحظة بلحظة (رايق 🟢 أو زحمة 🔴) عشان محدش يحتار أو يتوه!`
  },
  {
    id: 'how_to_use',
    keywords: ['استخدمه ازاي', 'انزل رحله ازاي', 'احجز ازاي', 'اركب ازاي', 'طريقه الاستخدام', 'اتواصل ازاي'],
    reply: `طريقة استخدام **"طريقنا"** سهلة جداً في 3 خطوات: ✨\n\n🔹 **لو بتدور على مشوار أو توصيلة:**\nمن الصفحة الرئيسية اختار منطقتك ووجهتك، هيظهرلك الكباتن المسافرين في طريقك.. اضغط (تواصل 💬 أو واتساب أو اتصال) ونسق مع الكابتن مباشرة.\n\n🔹 **لو معاك عربية أو عايز تطلب عربية مخصوص:**\nاضغط على زرار **( + )** اللي تحت على اليمين، وحدد (سائق أو راكب)، واكتب خط سيرك والميعاد وعدد المقاعد والتكلفة واضغط نشر!\n\n🔹 **لو مش لاقي رحلة في ميعادك:**\nحدد منطقتك والوجهة واضغط **(بلّغني عند توفرها 🔔)** وأول ما كابتن ينزل رحلة على خطك هيجيلك إشعار فوري!`
  },
  {
    id: 'safety_verification',
    keywords: ['امان', 'الامان', 'توثيق', 'موثق', 'بنات بس', 'سيدات', 'مضمون', 'ثقه', 'تقييم'],
    reply: `الأمان هو رقم 1 في **"طريقنا"** 🛡️✅:\n\n• **توثيق رسمي:** الكباتن والأعضاء بيوثقوا حساباتهم بالبطاقة الشخصية ورخصة القيادة، وبيظهر جنب اسمهم شارة (موثق وأمان ✅).\n• **صفحة آراء وتقييمات شفافة:** تقدر تضغط على صورة أي عضو تشوف تقييمه بالنجوم وتقرأ تعليقات وآراء الناس اللي ركبوا معاه قبلك.\n• **رحلات سيدات (بنات فقط 🌸):** متاح للكابتن أو الراكبة تخصيص الرحلة للبنات فقط وتظهر ببطاقة وردية مميزة.\n• **تتبع ومشاركة المشوار:** أثناء الرحلة بيظهرلك شريط تتبع حي تقدر تشاركه مع أهلك على واتساب للاطمئنان عليك!`
  },
  {
    id: 'bonus_system',
    keywords: ['بونص', 'مكافات', 'جوائز', 'شارات', 'كابتن ذهبي', 'سفير طريقنا', 'نقاط'],
    reply: `نظام البونص والشارات في **"طريقنا"** 🏆🎁:\n\nكل ما تكمل رحلات أكتر على التطبيق، رصيدك بيزيد وبتفتح شارات تميز ترفع ثقة العملاء فيك:\n🌱 **3 رحلات:** شارة (كابتن مبادر)\n⭐ **10 رحلات:** شارة (كابتن نشيط)\n🏆 **25 رحلة:** شارة (كابتن خبير)\n💎 **50 رحلة:** شارة (كابتن ذهبي)\n👑 **100 رحلة:** شارة (سفير طريقنا)\n\nأول ما تكمل العدد، ادخل (حسابي ⬅️ جوائز وبونص طريقنا) واضغط **(مطالبة الإدارة 🎁)** وهتتفعل الشارة على اسمك فوراً!`
  },
  {
    id: 'thanks',
    keywords: ['شكرا', 'تسلم', 'ربنا يخليك', 'ممتاز', 'شاطر', 'جدع', 'الله ينور', 'عاش'],
    reply: `حبيبي يا بطل، العفو على إيه! 🤍🤖 أنا موجود هنا دايماً في خدمتك عشان أوصلك لأي مكان في مصر بأسهل وأوفر طريقة.\n\nلو احتجت أي خط سير تاني أو لو عندك معلومة مواصلات جديدة تحب تضيفها لذاكرتي، قولي فوراً! 🚗✨`
  }
];

// ============================================================================
// 2. موسوعة مواصلات مصر الشاملة (محافظات، مدن جديدة، مترو، قطارات، ومواقف)
// ============================================================================
const BESO_MEGA_TRANSIT_DB = [
  {
    id: 'ras_elbar_damietta',
    keywords: ['راس البر', 'رأس البر', 'دمياط', 'دمياط الجديده', 'عزبه البرج', 'فارسكور'],
    title: 'طرق المواصلات إلى رأس البر ودمياط 🏖️',
    methods: [
      '🚌 **أتوبيس مباشر (الأسرع والأريح):** اركب (سوبر جيت / شرق الدلتا / جو باص / الدلتا للنقل) من موقف ألماظة أو الترجمان أو عبد المنعم رياض متجه مباشرة إلى رأس البر أو دمياط أو دمياط الجديدة.',
      '🚐 **ميكروباص مباشر:** من (موقف السلام النموذجي) أو (موقف عبود)، اركب ميكروباص خط دمياط، ومن موقف دمياط تتوفر سرفيسات وميكروباصات كل دقيقة إلى قلب رأس البر (10 دقائق) أو دمياط الجديدة.',
      '🚆 **القطار:** من محطة مصر (رمسيس) أو بنها أو طنطا أو المنصورة، اركب قطار خط دمياط، ومن أمام المحطة اركب سرفيس مباشر لرأس البر.'
    ]
  },
  {
    id: 'alexandria',
    keywords: ['اسكندريه', 'الاسكندريه', 'سموحه', 'ميامي', 'محطه الرمل', 'برج العرب', 'سيدي جابر', 'محرم بك', 'المعموره', 'المنتزه', 'العجمي'],
    title: 'طرق المواصلات إلى الإسكندرية 🌊',
    methods: [
      '🚐 **ميكروباص سريع (صحراوي/زراعي):** من (موقف عبود) أو (موقف السلام) أو (موقف المنيب) أو (ميدان الحصري بأكتوبر)، تتوفر ميكروباصات على مدار 24 ساعة تنزل موقف محرم بك (الموقف الجديد) بمدخل الإسكندرية، ومنه سرفيس لأي منطقة (سموحة، محطة الرمل، ميامي، المنتزه).',
      '🚆 **القطار (رمسيس / الجيزة):** قطارات (تالجو، VIP، مكيف، وروسي) تتحرك كل ساعة إلى محطتي سيدي جابر ومحطة مصر بالإسكندرية.',
      '🚌 **أتوبيسات النقل الجماعي:** من عبد المنعم رياض أو ألماظة أو الجيزة أو الحصري عبر (جو باص، غرب ووسط الدلتا، سوبر جيت).'
    ]
  },
  {
    id: 'sadat_city',
    keywords: ['السادات', 'مدينه السادات'],
    title: 'طرق المواصلات إلى مدينة السادات 🏙️',
    methods: [
      '🚐 **من القاهرة:** اركب من (موقف عبود) أو (موقف السلام النموذجي) ميكروباصات مدينة السادات المباشرة عبر طريق إسكندرية الصحراوي.',
      '🚐 **من الجيزة والهرم وأكتوبر:** اركب من (موقف الرماية) أو (ميدان الحصري / ليلة القدر بأكتوبر) ميكروباص خط السادات المباشر.',
      '🚐 **من المنوفية والبحيرة:** خطوط مباشرة من موقف شبين الكوم، موقف منوف، وموقف بدر/كوم حمادة إلى موقف السادات.'
    ]
  },
  {
    id: 'menoufia_shebin',
    keywords: ['شبين الكوم', 'شبين', 'المنوفيه', 'منوف', 'قويسنا', 'بركه السبع', 'اشمون', 'الباجور', 'تلا', 'الشهداء', 'سرس الليان'],
    title: 'طرق المواصلات إلى شبين الكوم ومدن المنوفية 🌿',
    methods: [
      '🚐 **ميكروباص من القاهرة:** من (موقف عبود) أو (موقف السلام) أو (موقف المؤسسة بشبرا الخيمة) تتوفر سيارات مباشرة طوال اليوم إلى شبين الكوم، منوف، قويسنا، أشمون، والباجور.',
      '🚐 **من 6 أكتوبر والشيخ زايد:** من موقف الحصري أو المحور المركزي تتوفر خطوط مباشرة إلى شبين الكوم ومنوف.',
      '🚆 **القطار:** من محطة رمسيس أو شبرا الخيمة، اركب قطار خط (القاهرة - القناطر - منوف - شبين الكوم - طنطا) أو قطار خط الإسكندرية والنزول في (قويسنا أو بركة السبع) ومنها سرفيس لشبين.'
    ]
  },
  {
    id: 'october_zayed',
    keywords: ['اكتوبر', '6 اكتوبر', 'الحصري', 'الشيخ زايد', 'حدائق اكتوبر', 'مول العرب', 'مول مصر', 'المنطقه الصناعيه اكتوبر', 'ليله القدر', 'الحي السادس'],
    title: 'طرق المواصلات إلى 6 أكتوبر، الشيخ زايد، وحدائق أكتوبر 🛣️',
    methods: [
      '🚐 **من وسط البلد ورمسيس:** من موقف عبد المنعم رياض أو الإسعاف أو رمسيس، اركب ميكروباص أو أتوبيس مباشر إلى (الحصري / الحي السادس / الشيخ زايد / مول العرب).',
      '🚐 **من الجيزة ومترو جامعة القاهرة:** من ميدان الجيزة أو أمام جامعة القاهرة أو موقف المنيب، تتوفر ميكروباصات مباشرة على مدار الساعة إلى الحصري، الشيخ زايد، وحدائق أكتوبر.',
      '🚐 **من الهرم وفيصل:** من مشعل أو المريوطية أو الطالبية، اركب ميكروباصات أكتوبر أو حدائق أكتوبر أو زايد مباشرة.',
      '🚐 **من مدينة نصر والسلام والمرج:** من موقف السلام أو العاشر أو الحي العاشر عبر الدائري والمحور مباشرة إلى الحصري وأكتوبر.'
    ]
  },
  {
    id: 'hadayek_ahram_haram_faisal',
    keywords: ['حدائق الاهرام', 'هضبه الاهرام', 'الهرم', 'فيصل', 'الرمايه', 'المريوطيه', 'مشعل', 'الطالبيه', 'العشرين', 'المساحه'],
    title: 'طرق المواصلات إلى الهرم، فيصل، وحدائق الأهرام  pyramids',
    methods: [
      '🚇 **بالمترو + ميكروباص (الأسرع من الزحمة):** اركب المترو (الخط الثاني) وانزل **محطة مترو الجيزة** أو **فيصل**، ومن تحت المحطة اركب ميكروباص لشارع الهرم أو فيصل أو الرماية أو بوابات حدائق الأهرام (خفرع، خوفو، منقرع، أحمس).',
      '🚐 **من وسط البلد ورمسيس وعبود:** ميكروباصات وميني باصات مباشرة من عبد المنعم رياض ورمسيس وعبود إلى الرماية ومشعل وبوابات حدائق الأهرام.',
      '🚐 **من أكتوبر والشيخ زايد:** ميكروباصات موقف الحصري متجهة إلى الرماية، حدائق الأهرام، الهرم، وفيصل.'
    ]
  },
  {
    id: 'smart_village',
    keywords: ['القريه الذكيه', 'القرية الذكية', 'ابو رواش', 'داندي مول'],
    title: 'طرق المواصلات إلى القرية الذكية 🏢',
    methods: [
      '🚐 **من رمسيس ووسط البلد وإمبابة:** اركب ميكروباصات خط (الشيخ زايد / الصحراوي / السادات) من عبد المنعم رياض أو الكيت كات وأخبر السائق بالنزول أمام القرية الذكية أو داندي مول.',
      '🚐 **من الجيزة والهرم والمريوطية:** من موقف المريوطية أو مشعل أو الرماية اركب خط الشيخ زايد عبر طريق مصر إسكندرية الصحراوي وانزل أمام القرية الذكية.',
      '🚐 **من أكتوبر والحصري:** اركب ميكروباص خط الشيخ زايد / محور روض الفرج / إمبابة الذي يمر أمام القرية الذكية.'
    ]
  },
  {
    id: 'new_cairo_tagamoa_nasr_city',
    keywords: ['التجمع', 'التجمع الخامس', 'القاهره الجديده', 'الرحاب', 'مدينتي', 'مدينه نصر', 'مصر الجديده', 'الجامعه الامريكيه', 'شارع التسعين', 'الحي العاشر', 'رمسيس', 'روكسي', 'عباس العقاد', 'مكرم عبيد'],
    title: 'طرق المواصلات إلى التجمع الخامس، القاهرة الجديدة، ومدينة نصر 🏙️',
    methods: [
      '🚇 **بالمترو (الخط الثالث المطور):** اركب المترو للخط الثالث وانزل محطة (الاستاد أو كلية البنات أو عدلي منصور)، ومنها تتوفر أتوبيسات وميكروباصات مباشرة إلى التجمع الخامس (شارع التسعين، الجامعة الأمريكية)، الرحاب، ومدينتي.',
      '🚐 **ميكروباص مباشر:** من (رمسيس) أو (عبد المنعم رياض) أو (موقف السلام / العاشر) أو (ميدان الجيزة / المنيب عبر الدائري) تتوفر خطوط مباشرة للحي العاشر، عباس العقاد، والتجمع الأول والخامس.',
      '🚌 **أتوبيسات المواصلات الذكية (مواصلات مصر / Green Bus):** تتحرك من عبد المنعم رياض، رمسيس، سراي القبة، وروكسي مباشرة إلى قلب التجمع الخامس، الرحاب، ومدينتي.'
    ]
  },
  {
    id: 'new_capital_shorouk_badr_obour',
    keywords: ['العاصمه الاداريه', 'العاصمة الإدارية', 'الشروق', 'مدينه بدر', 'بدر', 'العبور', 'العاشر من رمضان', 'عدلي منصور', 'القطار الكهربائي'],
    title: 'طرق المواصلات إلى العاصمة الإدارية، العبور، الشروق، بدر، والعاشر 🚆',
    methods: [
      '🚈 **القطار الكهربائي الخفيف (LRT - الأسرع والأحدث):** اركب المترو للخط الثالث حتى محطة **عدلي منصور التبادلية**، ومنها اركب القطار الكهربائي LRT مباشرة إلى (العبور، المستقبل، الشروق، هليوبوليس الجديدة، بدر، العاشر، والحي الحكومي بالعاصمة الإدارية).',
      '🚐 **ميكروباص مباشر:** من موقف العاشر (السلام) أو موقف ألف مسكن أو رمسيس تتوفر ميكروباصات على مدار الساعة لمدن العبور، الشروق، بدر، والعاشر من رمضان.'
    ]
  },
  {
    id: 'dokki_mohandessin_downtown_maadi_helwan',
    keywords: ['الدقي', 'المهندسين', 'وسط البلد', 'التحرير', 'المعادي', 'حلوان', 'الزمالك', 'العجوزه', 'جامعة القاهره', 'بين السرايات', 'زهراء المعادي', 'شبرا'],
    title: 'طرق المواصلات إلى الدقي، المهندسين، وسط البلد، المعادي، وحلوان 🚇',
    methods: [
      '🚇 **مترو الأنفاق (أسرع وسيلة داخل القاهرة الكبرى):**\n• **الخط الأول (المرج - حلوان):** يمر بـ (رمسيس، الإسعاف، التحرير، سعد زغلول، المعادي، حدائق المعادي، دار السلام، طرة، وحلوان).\n• **الخط الثاني (شبرا - المنيب):** يمر بـ (رمسيس، العتبة، التحرير، الأوبرا، الدقي، البحوث، جامعة القاهرة، فيصل، الجيزة، والمنيب).\n• **الخط الثالث:** يمر بـ (العتبة، الزمالك، الكيت كات، جامعة الدول العربية بالمهندسين، وإمبابة).',
      '🚐 **ميكروباصات على مدار الساعة:** من ميدان الجيزة، رمسيس، عبد المنعم رياض، عبود، المنيب، وأكتوبر تتوفر خطوط مباشرة لجامعة الدول (المهندسين)، الدقي، التحرير، والمعادي (صقر قريش / الأوتوستراد).'
    ]
  },
  {
    id: 'mansoura_dakahlia',
    keywords: ['المنصوره', 'الدقهليه', 'ميت غمر', 'السنبلاوين', 'طلخا', 'بلقاس', 'اجا', 'دكرنس', 'شربين', 'جمصه'],
    title: 'طرق المواصلات إلى المنصورة والدقهلية 🌳',
    methods: [
      '🚐 **ميكروباص:** من (موقف عبود) أو (موقف السلام النموذجي) أو (موقف المرج) تتوفر ميكروباصات مباشرة للمنصورة، ميت غمر، والسنبلاوين على مدار الساعة.',
      '🚌 **أتوبيس:** شركات (شرق الدلتا / الدلتا للنقل / سوبر جيت) من ألماظة والترجمان وعبود إلى المنصورة وجمصة.',
      '🚆 **القطار:** من محطة مصر (رمسيس) خط (القاهرة - بنها - الزقازيق - المنصورة) أو خط (القاهرة - طنطا - المحلة - المنصورة).'
    ]
  },
  {
    id: 'tanta_gharbia_kafr_elsheikh',
    keywords: ['طنطا', 'المحله', 'المحله الكبري', 'كفر الزيات', 'زفتي', 'الغربيه', 'كفر الشيخ', 'دسوق', 'بلطيم'],
    title: 'طرق المواصلات إلى طنطا، المحلة الكبرى، وكفر الشيخ 🕌',
    methods: [
      '🚐 **ميكروباص:** من (موقف عبود) أو (موقف السلام) أو (موقف المؤسسة) خطوط مباشرة إلى طنطا، المحلة الكبرى، كفر الشيخ، ودسوق.',
      '🚆 **القطار:** جميع قطارات الوجه البحري (خط الإسكندرية وخط المنصورة/دمياط) من رمسيس وشبرا الخيمة تقف في محطة طنطا، ومنها قطارات للمحلة وكفر الشيخ.'
    ]
  },
  {
    id: 'zagazig_sharkia_banha',
    keywords: ['الزقازيق', 'الشرقيه', 'منيا القمح', 'بلبيس', 'فاقوس', 'ابو حماد', 'ديرب نجم', 'بنها', 'القليوبيه', 'طوخ', 'قليوب'],
    title: 'طرق المواصلات إلى بنها، الزقازيق، ومدن الشرقية 🌾',
    methods: [
      '🚐 **ميكروباص:** من (موقف عبود) أو (موقف السلام / العاشر) أو (موقف المرج الجديدة) أو (موقف المؤسسة بشبرا) تتوفر سيارات مباشرة كل دقيقة إلى بنها، الزقازيق، بلبيس، منيا القمح، وفاقوس.',
      '🚆 **القطار:** من محطة رمسيس أو شبرا الخيمة تتوفر قطارات مستمرة طوال اليوم إلى بنها والزقازيق.'
    ]
  },
  {
    id: 'canal_cities_sinai',
    keywords: ['بورسعيد', 'بورفؤاد', 'الاسماعيليه', 'السويس', 'العين السخنه', 'السخنه', 'الزعفرانه', 'الجلاله', 'فايد', 'القنطره', 'شرم الشيخ', 'دهب', 'راس سدر', 'الطور', 'سانت كاترين', 'العريش', 'نويبع', 'طابا'],
    title: 'طرق المواصلات إلى مدن القناة، العين السخنة، وسيناء (شرم/دهب) ⚓🏖️',
    methods: [
      '🚐 **لبورسعيد والإسماعيلية والسويس:** ميكروباصات مباشرة من (موقف السلام النموذجي) و(موقف عبود) و(موقف المرج) على مدار الساعة، بالإضافة لقطارات محطة رمسيس.',
      '☀️ **للعين السخنة والجلالة:** ميكروباصات السويس من موقف السلام أو ألماظة، أو أتوبيسات (جو باص / بلو باص / سوبر جيت) من التحرير ومدينة نصر.',
      '🤿 **لشرم الشيخ، دهب، رأس سدر، والعريش:** أتوبيسات (شرق الدلتا، جو باص، بلو باص، سوبر جيت، والاتحاد العربي) من عبد المنعم رياض، الترجمان، ألماظة، ونادي السكة بمدينة نصر.'
    ]
  },
  {
    id: 'north_coast_matrouh_beheira',
    keywords: ['مطروح', 'مرسي مطروح', 'الساحل الشمالي', 'العلمين', 'مارينا', 'سيدي عبد الرحمن', 'سيوه', 'البحيره', 'دمنهور', 'كفر الدوار', 'ايتاي البارود', 'رشيد', 'وادي النطرون'],
    title: 'طرق المواصلات إلى الساحل الشمالي، مطروح، والبحيرة 🌊',
    methods: [
      '🚌 **للعلمين والساحل ومرسى مطروح وسيوة:** أتوبيسات (غرب ووسط الدلتا، سوبر جيت، جو باص) من عبد المنعم رياض، الترجمان، ألماظة، والحصري، أو ميكروباصات من موقف مشعل بالهرم وموقف عبود وموقف محرم بك بالإسكندرية.',
      '🚐 **لدمنهور وكفر الدوار والبحيرة:** ميكروباصات مباشرة من (موقف عبود) أو قطارات خط الإسكندرية من محطة رمسيس.'
    ]
  },
  {
    id: 'upper_egypt_red_sea',
    keywords: ['الصعيد', 'الفيوم', 'بني سويف', 'المنيا', 'ملوي', 'اسيوط', 'سوهاج', 'قنا', 'نجع حمادي', 'الاقصر', 'اسوان', 'الغردقه', 'الجونه', 'سفاجا', 'مرسي علم', 'البحر الاحمر', 'الوادي الجديد'],
    title: 'طرق المواصلات إلى محافظات الصعيد والبحر الأحمر (الغردقة) ☀️🌴',
    methods: [
      '🚐 **لمحافظات الصعيد (الفيوم، بني سويف، المنيا، أسيوط، سوهاج، قنا، الأقصر، أسوان):**\n• **ميكروباص:** من **(موقف المنيب)** بالجيزة أو **(موقف عبود)** أو **(موقف الفيوم بمشعل/الرماية)** تتوفر سيارات مباشرة على مدار 24 ساعة عبر طريق الصعيد الصحراوي الغربي أو الشرقي.\n• **القطار:** قطارات الصعيد من محطة رمسيس ومحطة صعيد مصر (بشتيل الجديدة) ومحطة الجيزة.\n• **أتوبيس:** (سوبر جيت، الوجه القبلي، جو باص) من الترجمان، عبد المنعم رياض، والمنيب.',
      '🏖️ **للغردقة، الجونة، ومرسى علم:** أتوبيسات (جو باص، بلو باص، سوبر جيت، الوجه القبلي) من عبد المنعم رياض، الترجمان، ألماظة، والجيزة، أو ميكروباصات البحر الأحمر من موقف السلام والمنيب.'
    ]
  }
];

const BesoAssistantModal = ({ stations = [], isDarkMode, onClose, onSelectStation, userAreas = [], user, isAdmin }) => {
  const [input, setInput] = useState('');
  const [customGuides, setCustomGuides] = useState([]);
  
  // حالات تعديل/إضافة معلومة مواصلات بواسطة المستخدم
  const [correctingMsgId, setCorrectingMsgId] = useState(null);
  const [correctionPlace, setCorrectionPlace] = useState('');
  const [correctionText, setCorrectionText] = useState('');
  const [isSubmittingCorrection, setIsSubmittingCorrection] = useState(false);
  const [correctionSuccessMsg, setCorrectionSuccessMsg] = useState('');

  const [messages, setMessages] = useState([
    {
      id: 'welcome',
      sender: 'beso',
      queryContext: 'ترحيب عام',
      text: `أهلاً بيك يا بطل! أنا "بيسو" 🤖 مساعدك الذكي لمواقف ومواصلات مصر ولتطبيق "طريقنا".\n\nأنا مسجل عندي (${stations.length}) موقف حي بالتعريفة، وموسوعة كاملة لطرق ومواصلات كل محافظات ومدن مصر!\n\n🔹 اسألني: **"ازاي أروح أي مكان؟"** أو **"إيه هدف تطبيق طريقنا؟"**\n🔹 ولو أي مواصلة اتغيرت، تقدر تضغط **(✏️ تعديل المعلومة)** تحت ردي وتصلحها! 🚀`,
      matchedStations: [],
      matchedRoutes: []
    }
  ]);
  const messagesEndRef = useRef(null);

  const quickQuestions = [
    'إيه هو هدف تطبيق طريقنا؟ 💡',
    'ازاي أروح رأس البر من القاهرة؟ 🏖️',
    'مواصلات 6 أكتوبر والشيخ زايد 🚐',
    'مواصلات التجمع والعاصمة الإدارية 🚈',
    'إيه المواقف اللي حالة الزحمة فيها رايقة؟ 🟢',
    'ازاي أوثق حسابي وأحصل على البونص؟ 🏆'
  ];

  // الاستماع للتعديلات والمواصلات التي أضافها المستخدمون أو اعتمدها الأدمن من Firebase
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'beso_knowledge_updates'), (snap) => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setCustomGuides(list);
    }, () => {});
    return () => unsub();
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, correctingMsgId]);

  const generateBesoResponse = (queryText) => {
    const normQuery = normalizeArabic(queryText);

    // 1. فحص هل السؤال حواري أو عن هدف التطبيق أو طريقة استخدامه؟
    const matchedIntent = BESO_CONVERSATIONAL_INTENTS.find(intent =>
      intent.keywords.some(kw => normQuery.includes(normalizeArabic(kw)))
    );

    // لو السؤال حواري صريح ومش بيسأل عن مواصلات مكان معين
    const hasTransitWord = ['اروح', 'مواصلات', 'طريق', 'خط', 'موقف', 'اجره', 'تعريفه', 'ركوب', 'باص', 'ميكروباص', 'قطار', 'مترو'].some(w => normQuery.includes(w));
    if (matchedIntent && (!hasTransitWord || matchedIntent.id === 'app_purpose' || matchedIntent.id === 'how_to_use' || matchedIntent.id === 'safety_verification' || matchedIntent.id === 'bonus_system')) {
      return {
        text: matchedIntent.reply,
        matchedStations: [],
        matchedRoutes: [],
        queryContext: queryText
      };
    }

    // 2. لو بيسأل عن حالة الزحمة أو المواقف الرايقة
    if (normQuery.includes('رايق') || normQuery.includes('زحم') || normQuery.includes('فاضي')) {
      const emptyStations = stations.filter(s => s.crowdStatus === 'empty');
      const crowdedStations = stations.filter(s => s.crowdStatus === 'crowded');
      let reply = '📊 تقرير بيسو المباشر لحالة المواقف الآن:\n\n';
      if (emptyStations.length > 0) {
        reply += `🟢 مواقف رايقة حالياً: (${emptyStations.map(s => s.name).join('، ')})\n`;
      }
      if (crowdedStations.length > 0) {
        reply += `🔴 مواقف مزدحمة حالياً: (${crowdedStations.map(s => s.name).join('، ')})\n`;
      }
      if (emptyStations.length === 0 && crowdedStations.length === 0) {
        reply += 'كل المواقف المسجلة حالياً حالتها طبيعية ومعتدلة! 👍';
      }
      return {
        text: reply,
        matchedStations: emptyStations.length > 0 ? emptyStations : stations.slice(0, 3),
        matchedRoutes: [],
        queryContext: queryText
      };
    }

    // 3. تنظيف الكلمات لاستخراج اسم المكان
    const stopWords = ['عايز', 'اروح', 'ازاي', 'من', 'الي', 'إلى', 'في', 'مواصلات', 'طريق', 'خط', 'خطوط', 'موقف', 'الذهاب', 'ل', 'لو', 'سمحت', 'يا', 'بيسو', 'القاهره', 'الجيزه', 'اركب', 'ايه'];
    const queryTokens = normQuery
      .split(' ')
      .map(t => t.trim())
      .filter(t => t.length >= 3 && !stopWords.includes(t));

    const effectiveTokens = queryTokens.length > 0 ? queryTokens : normQuery.split(' ').filter(t => t.length >= 2);

    let responseParts = [];

    // 4. البحث أولاً في التعديلات والمعلومات المحدثة من المستخدمين والأدمن (beso_knowledge_updates)
    const approvedOrMyUpdates = customGuides.filter(cg => {
      const isApproved = cg.status === 'approved' || (user && cg.submittedBy === user.uid);
      if (!isApproved) return false;
      const normPlace = normalizeArabic(cg.placeKeywords || '');
      const normInfo = normalizeArabic(cg.correctedInfo || '');
      return (normPlace && normQuery.includes(normPlace)) ||
        effectiveTokens.some(tok => normPlace.includes(tok) || normInfo.includes(tok));
    });

    if (approvedOrMyUpdates.length > 0) {
      responseParts.push(`📌 **معلومات محدثة من مجتمع وإدارة "طريقنا":**`);
      approvedOrMyUpdates.slice(0, 3).forEach(upd => {
        const statusTag = upd.status === 'approved' ? '✅ (معتمدة)' : '⏳ (تعديلك قيد المراجعة)';
        responseParts.push(`• **${upd.placeKeywords}:** ${upd.correctedInfo} ${statusTag}`);
      });
    }

    // 5. البحث في قاعدة بيانات المواقف الحية (stations & routes)
    const foundRoutes = [];
    const foundStations = [];

    stations.forEach((st) => {
      const normStName = normalizeArabic(st.name);
      const normStLoc = normalizeArabic(st.location);

      const stationMatches = effectiveTokens.some(tok => normStName.includes(tok) || normStLoc.includes(tok));
      if (stationMatches && !foundStations.some(s => s.id === st.id)) {
        foundStations.push(st);
      }

      if (Array.isArray(st.routes)) {
        st.routes.forEach((r) => {
          if (r.status === 'pending') return;
          const normDest = normalizeArabic(r.destination);
          const normDetails = normalizeArabic(r.destinationDetails);

          const routeMatches = effectiveTokens.some(tok => 
            (normDest && (normDest.includes(tok) || tok.includes(normDest))) ||
            (normDetails && (normDetails.includes(tok) || tok.includes(normDetails)))
          );

          if (routeMatches) {
            foundRoutes.push({
              station: st,
              route: r
            });
          }
        });
      }
    });

    if (foundRoutes.length > 0) {
      responseParts.push(`✅ **خطوط مباشرة مسجلة في مواقف التطبيق (${foundRoutes.length}):**`);
      foundRoutes.slice(0, 5).forEach((item, idx) => {
        const destName = item.route.destinationDetails ? `${item.route.destinationDetails} (${item.route.destination})` : item.route.destination;
        const crowdBadge = item.route.crowdStatus === 'crowded' ? '🔴 زحمة' : item.route.crowdStatus === 'empty' ? '🟢 رايق' : '';
        responseParts.push(
          `${idx + 1}. من **${item.station.name}** (${item.station.location}) ⬅️ خط **${destName}** — الأجرة: **${item.route.fare} ج** ${crowdBadge}`
        );
      });
    }

    // 6. البحث في موسوعة مواصلات مصر الشاملة (BESO_MEGA_TRANSIT_DB)
    const matchedGuides = BESO_MEGA_TRANSIT_DB.filter(g => 
      g.keywords.some(kw => normQuery.includes(normalizeArabic(kw))) ||
      effectiveTokens.some(tok => g.keywords.some(kw => normalizeArabic(kw).includes(tok)))
    );

    if (matchedGuides.length > 0) {
      matchedGuides.forEach(guide => {
        responseParts.push(`\n🧭 **${guide.title}:**`);
        guide.methods.forEach(m => responseParts.push(m));
      });
    }

    if (foundRoutes.length === 0 && foundStations.length > 0) {
      responseParts.push(`🚏 **مواقف مطابقة لبحثك في التطبيق:**`);
      foundStations.forEach(st => {
        responseParts.push(`• **${st.name}** في منطقة (${st.location}) ويحتوي على (${st.routes?.length || 0}) خطوط سير.`);
      });
    }

    // لو كان فيه تحية مع السؤال نرد عليها بلطف في البداية
    if (matchedIntent && responseParts.length > 0) {
      responseParts.unshift(`أهلاً بيك يا بطل! بخصوص سؤالك، اتفضل التفاصيل: 👇`);
    }

    // 7. لو مفيش تطابق مباشر في الداتا، يرد بذكاء ويدعو المستخدم لإضافة المعلومة
    if (responseParts.length === 0) {
      responseParts.push(
        `🤔 بص يا بطل، المشوار ده ("${queryText}") ملوش خط تفصيلي بنفس الاسم عندي حالياً، بس خليني أقولك أسرع حلول توصلك:\n\n` +
        `1️⃣ **من القاهرة الكبرى:**\n• لو رايح **وجه بحري أو الدلتا أو القناة**: اركب من **(موقف عبود)** أو **(موقف السلام النموذجي)**.\n• لو رايح **أكتوبر أو الصعيد أو الفيوم أو الإسكندرية**: اركب من **(موقف المنيب)** أو **(ميدان الجيزة)** أو **(عبد المنعم رياض)**.\n• لو مشوار داخلي في القاهرة والجيزة: استخدم **مترو الأنفاق (الخط 1 و 2 و 3)** هينجزك من أي زحمة!\n\n` +
        `2️⃣ **شوف رحلات الأعضاء في "طريقنا":** جرب تبحث في الصفحة الرئيسية، ممكن تلاقي كابتن بعربيته الملاكي مسافر نفس خطك دلوقتي!\n\n` +
        `💡 **عندك معلومة عن مواصلات المكان ده؟** اضغط على زرار **(✏️ تعديل أو إضافة مواصلة)** اللي تحت رسالتي دي واكتبها عشان أحفظها عندي وأفيد بيها غيرك!`
      );
    }

    const uniqueSuggestedStations = [...foundStations];
    foundRoutes.forEach(fr => {
      if (!uniqueSuggestedStations.some(s => s.id === fr.station.id)) {
        uniqueSuggestedStations.push(fr.station);
      }
    });

    return {
      text: responseParts.join('\n'),
      matchedStations: uniqueSuggestedStations.slice(0, 4),
      matchedRoutes: foundRoutes.slice(0, 4),
      queryContext: queryText
    };
  };

  const handleSend = (textToProcess) => {
    const cleanText = (textToProcess || input).trim();
    if (!cleanText) return;

    const userMsg = {
      id: Date.now() + '_u',
      sender: 'user',
      text: cleanText
    };

    const besoReplyData = generateBesoResponse(cleanText);
    const besoMsg = {
      id: Date.now() + '_b',
      sender: 'beso',
      text: besoReplyData.text,
      matchedStations: besoReplyData.matchedStations,
      matchedRoutes: besoReplyData.matchedRoutes,
      queryContext: besoReplyData.queryContext
    };

    setMessages(prev => [...prev, userMsg, besoMsg]);
    if (!textToProcess) setInput('');
  };

  // حفظ تعديل المستخدم أو تصحيحه للمواصلة وإرساله للأدمن (أو اعتماده فوراً لو أدمن)
  const handleSubmitCorrection = async (e, msgObj) => {
    e.preventDefault();
    if (!correctionPlace.trim() || !correctionText.trim()) return;

    setIsSubmittingCorrection(true);
    try {
      const userIsAdmin = Boolean(isAdmin || (user?.email && user.email.toLowerCase() === ADMIN_EMAIL));
      const statusToSave = userIsAdmin ? 'approved' : 'pending';

      await addDoc(collection(db, 'beso_knowledge_updates'), {
        placeKeywords: correctionPlace.trim(),
        correctedInfo: correctionText.trim(),
        originalQuestion: msgObj?.queryContext || '',
        originalBesoReply: msgObj?.text || '',
        status: statusToSave,
        submittedBy: user?.uid || 'guest',
        submittedByName: user?.displayName || 'مستخدم طريقنا',
        createdAt: serverTimestamp(),
        timestamp: Date.now()
      });

      // إرسال إشعار للأدمن في مجموعة الإشعارات/التقارير لكي يراجعه في لوحة التحكم
      await addDoc(collection(db, 'notifications'), {
        userId: 'admin_review',
        type: 'beso_correction',
        title: `🤖 اقتراح تعديل مواصلات لبيسو (${correctionPlace.trim()})`,
        body: `اقترح ${user?.displayName || 'أحد المستخدمين'} المعلومة التالية: "${correctionText.trim()}"`,
        read: false,
        createdAt: serverTimestamp()
      });

      setCorrectionSuccessMsg(
        userIsAdmin 
          ? 'تم حفظ وتحديث المعلومة في ذاكرة بيسو فوراً بنجاح! ✅🤖' 
          : 'شكراً لك! تم حفظ تعديلك وإرساله للإدارة للمراجعة، وتمت إضافته لذاكرتك الآن! 🎉⏳'
      );

      setTimeout(() => {
        setCorrectingMsgId(null);
        setCorrectionPlace('');
        setCorrectionText('');
        setCorrectionSuccessMsg('');
      }, 2200);
    } catch (err) {
      console.error('Error saving correction:', err);
    } finally {
      setIsSubmittingCorrection(false);
    }
  };

  const bgCard = isDarkMode ? 'bg-slate-900/95 border-slate-700/80' : 'bg-white/95 border-slate-200';
  const bgInput = isDarkMode ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-400' : 'bg-slate-100 border-slate-200 text-slate-900';

  const modalContent = (
    <>
      {/* طبقة شفافة خفيفة لإغلاق النافذة عند الضغط خارجها مع الحفاظ على رؤية الموقع وشريط التنقل */}
      <div 
        className="fixed inset-0 bottom-[72px] bg-black/25 backdrop-blur-[1px] z-[190]" 
        onClick={onClose}
      />

      {/* نافذة عائمة مرفوعة فوق شريط التنقل السفلي مباشرة (bottom-[82px]) */}
      <div 
        dir="rtl"
        onClick={(e) => e.stopPropagation()} 
        className={`fixed bottom-[82px] left-3 right-3 sm:left-6 sm:right-auto sm:w-[410px] h-[66dvh] max-h-[530px] min-h-[350px] z-[200] ${bgCard} backdrop-blur-xl rounded-[1.75rem] shadow-[0_12px_45px_rgba(0,0,0,0.45)] flex flex-col overflow-hidden border animate-fade-in-up`}
      >
        {/* هيدر نافذة بيسو المدمج */}
        <div className="px-4 py-3 bg-gradient-to-r from-indigo-600 via-violet-600 to-indigo-700 text-white flex items-center justify-between shadow-sm shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-white/20 backdrop-blur-md flex items-center justify-center border border-white/30 relative shrink-0">
              <Bot size={20} className="text-white" />
              <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-400 rounded-full border-2 border-indigo-700"></span>
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h3 className="font-black text-sm">المساعد الذكي "بيسو"</h3>
                <span className="text-[9px] font-black bg-amber-400 text-slate-950 px-1.5 py-0.2 rounded-full flex items-center gap-0.5">
                  <Sparkles size={9}/> موسوعة المواصلات
                </span>
              </div>
              <p className="text-[10px] text-indigo-100 font-bold">
                اسأل عن أي مشوار أو عدّل أي معلومة لتطوير الدليل ({stations.length} موقف)
              </p>
            </div>
          </div>

          <button onClick={onClose} className="p-1.5 bg-white/15 hover:bg-rose-500 rounded-full transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* منطقة المحادثة */}
        <div className={`flex-1 min-h-0 overflow-y-auto p-3.5 space-y-3 [&::-webkit-scrollbar]:hidden ${isDarkMode ? 'bg-slate-950/50' : 'bg-slate-50/70'}`}>
          {messages.map((msg) => {
            const isBeso = msg.sender === 'beso';
            const isEditingThis = correctingMsgId === msg.id;

            return (
              <div key={msg.id} className={`flex ${isBeso ? 'justify-start' : 'justify-end'}`}>
                <div className={`max-w-[92%] flex flex-col gap-1.5 ${isBeso ? 'items-start' : 'items-end'}`}>
                  <div className={`p-3 rounded-2xl text-xs leading-relaxed whitespace-pre-line shadow-sm ${
                    isBeso 
                      ? (isDarkMode ? 'bg-slate-800 text-slate-100 border border-slate-700 rounded-tr-sm' : 'bg-white text-slate-800 border border-slate-200 rounded-tr-sm')
                      : 'bg-indigo-600 text-white font-bold rounded-tl-sm'
                  }`}>
                    {msg.text}
                  </div>

                  {/* زر تعديل المعلومة أو إضافة مواصلة أدق تحت كل رد من ردود بيسو */}
                  {isBeso && (
                    <div className="w-full flex items-center justify-between px-1">
                      <button
                        type="button"
                        onClick={() => {
                          if (isEditingThis) {
                            setCorrectingMsgId(null);
                          } else {
                            setCorrectingMsgId(msg.id);
                            setCorrectionPlace(msg.queryContext && msg.queryContext !== 'ترحيب عام' ? msg.queryContext : '');
                            setCorrectionText('');
                            setCorrectionSuccessMsg('');
                          }
                        }}
                        className={`text-[10px] font-black flex items-center gap-1 px-2 py-1 rounded-lg border transition-all ${
                          isEditingThis
                            ? 'bg-amber-500 text-slate-950 border-amber-400'
                            : (isDarkMode ? 'bg-slate-800/80 border-slate-700 text-amber-400 hover:bg-slate-800' : 'bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-100')
                        }`}
                      >
                        <Edit3 size={11} />
                        <span>{isEditingThis ? 'إغلاق التعديل' : 'معلومة غير دقيقة؟ عدّلها أو أضف مواصلة'}</span>
                      </button>
                    </div>
                  )}

                  {/* نموذج تصحيح المعلومة وإرسالها للأدمن / قاعدة معرفة بيسو */}
                  {isBeso && isEditingThis && (
                    <form 
                      onSubmit={(e) => handleSubmitCorrection(e, msg)}
                      className={`w-full p-3 rounded-2xl border-2 border-amber-500/40 space-y-2 animate-fade-in-up ${
                        isDarkMode ? 'bg-slate-900 text-white' : 'bg-amber-50/60 text-slate-900'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-black text-amber-500 flex items-center gap-1">
                          <PlusCircle size={13}/> تصحيح أو إضافة خط مواصلات لبيسو:
                        </span>
                      </div>

                      {correctionSuccessMsg ? (
                        <div className="p-2.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-500 text-[11px] font-black flex items-center gap-1.5">
                          <CheckCircle2 size={15} className="shrink-0" />
                          <span>{correctionSuccessMsg}</span>
                        </div>
                      ) : (
                        <>
                          <input
                            type="text"
                            required
                            value={correctionPlace}
                            onChange={(e) => setCorrectionPlace(e.target.value)}
                            placeholder="اسم المكان أو الخط (مثال: مواصلات رأس البر / خط السادات)"
                            className={`w-full px-3 py-2 rounded-xl border text-[11px] font-bold outline-none ${bgInput}`}
                          />
                          <textarea
                            rows={2}
                            required
                            value={correctionText}
                            onChange={(e) => setCorrectionText(e.target.value)}
                            placeholder="اكتب المواصلة الصح أو الأجرة الجديدة بالتفصيل..."
                            className={`w-full px-3 py-2 rounded-xl border text-[11px] font-bold outline-none resize-none ${bgInput}`}
                          />
                          <div className="flex gap-1.5">
                            <button
                              type="submit"
                              disabled={isSubmittingCorrection}
                              className="flex-1 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 rounded-xl text-[11px] font-black shadow-sm transition-transform active:scale-95"
                            >
                              {isSubmittingCorrection ? 'جاري الحفظ...' : (isAdmin ? 'اعتماد وتحديث فوري ✅' : 'إرسال التعديل للمراجعة 🚀')}
                            </button>
                            <button
                              type="button"
                              onClick={() => setCorrectingMsgId(null)}
                              className="px-3 py-2 rounded-xl bg-slate-200 dark:bg-slate-800 text-[11px] font-bold"
                            >
                              إلغاء
                            </button>
                          </div>
                        </>
                      )}
                    </form>
                  )}

                  {/* عرض كروت المواقف المقترحة للضغط المباشر */}
                  {isBeso && msg.matchedStations && msg.matchedStations.length > 0 && (
                    <div className="w-full space-y-1.5 mt-0.5">
                      <span className="text-[10px] font-black text-indigo-400 px-1 flex items-center gap-1">
                        <Compass size={11}/> اضغط على الموقف لفتح خطوطه:
                      </span>
                      <div className="grid grid-cols-1 gap-1.5">
                        {msg.matchedStations.map((st) => (
                          <button
                            key={st.id}
                            onClick={() => {
                              onClose();
                              onSelectStation(st);
                            }}
                            className={`w-full p-2 rounded-xl border text-right flex items-center justify-between transition-all hover:border-indigo-500 active:scale-98 ${
                              isDarkMode ? 'bg-slate-900 border-slate-700 text-white' : 'bg-indigo-50/70 border-indigo-200 text-slate-900'
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              <div className="p-1.5 rounded-lg bg-indigo-600 text-white shrink-0">
                                <BusFront size={13}/>
                              </div>
                              <div>
                                <h4 className="text-[11px] font-black">{st.name}</h4>
                                <p className="text-[9px] text-slate-400 font-bold">{st.location} • {st.routes?.length || 0} خطوط</p>
                              </div>
                            </div>
                            <span className="text-[10px] font-black text-indigo-500 flex items-center gap-0.5">
                              عرض <ChevronLeft size={12}/>
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>

        {/* اقتراحات سريعة */}
        <div className={`px-2.5 py-1.5 border-t shrink-0 flex gap-1.5 overflow-x-auto [&::-webkit-scrollbar]:hidden ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
          {quickQuestions.map((q, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => handleSend(q)}
              className={`shrink-0 text-[10px] font-black px-2.5 py-1 rounded-full border transition-all active:scale-95 ${
                isDarkMode 
                  ? 'bg-slate-800 border-slate-700 text-indigo-300 hover:bg-indigo-600 hover:text-white' 
                  : 'bg-indigo-50 border-indigo-200/80 text-indigo-700 hover:bg-indigo-600 hover:text-white'
              }`}
            >
              {q}
            </button>
          ))}
        </div>

        {/* حقل كتابة السؤال وزر الإرسال مدمج ومرفوع بوضوح */}
        <form 
          onSubmit={(e) => { e.preventDefault(); handleSend(); }} 
          className={`p-2.5 shrink-0 flex items-center gap-2 border-t ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="اسأل بيسو عن أي مكان أو عن فكرة التطبيق..."
            className={`flex-1 px-3.5 py-2.5 rounded-xl border text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500 ${bgInput}`}
          />
          <button
            type="submit"
            disabled={!input.trim()}
            className="w-10 h-10 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white flex items-center justify-center shadow-md transition-transform active:scale-95 shrink-0"
          >
            <Send size={16} className="rtl:rotate-180" />
          </button>
        </form>
      </div>
    </>
  );

  return typeof document !== 'undefined' ? createPortal(modalContent, document.body) : modalContent;
};

export default BesoAssistantModal;
