import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { collection, addDoc, onSnapshot, serverTimestamp } from 'firebase/firestore';
import { X, Send, Bot, Sparkles, BusFront, Compass, ChevronLeft, Edit3, CheckCircle2, PlusCircle } from 'lucide-react';
import { db, ADMIN_EMAIL } from '../firebase';
import { normalizeArabic } from '../App';

// ============================================================================
// 1. موسوعة الحوار الذكي (متعددة الردود لعدم التكرار)
// ============================================================================
const BESO_CONVERSATIONAL_INTENTS = [
  {
    id: 'greeting',
    keywords: ['اهلا', 'سلام عليكم', 'السلام عليكم', 'صباح الخير', 'مساء الخير', 'ازيك', 'عامل ايه', 'اخبارك', 'مرحبا', 'هاي', 'الو', 'يا بيسو'],
    replies: [
      `أهلاً بيك يا بطل في "طريقنا"! 👋🤖\nأنا "بيسو"، قولي اقدر اساعدك تروح فين النهاردة؟`,
      `وعليكم السلام ورحمة الله! يا مرحب بيك في مجتمع "طريقنا" 🚀.. تؤمر بإيه؟`,
      `يا هلا بيك! أنا بيسو مساعدك الشخصي للمواصلات.. اكتبلي وجهتك وأنا أظبطلك أسرع طريق 🚗`
    ]
  },
  {
    id: 'app_purpose',
    keywords: ['هدف التطبيق', 'فكره التطبيق', 'فكرة التطبيق', 'يعني ايه طريقنا', 'ابلكيشن ايه ده', 'بيعمل ايه', 'لازمته ايه', 'فكرته ايه', 'شرح التطبيق', 'عن التطبيق', 'الموقع ده بيعمل'],
    replies: [
      `سؤال ممتاز! 🎯 فكرة "طريقنا" ببساطة هي (المشاركة وتوفير الفلوس والوقت):\n\n1️⃣ **مشاركة المشاوير:** لو معاك عربية مسافر بيها، بتاخد معاك ناس في نفس طريقك ويقسموا معاك البنزين، ولو أنت راكب بتلاقي توصيلة مريحة ومباشرة.\n2️⃣ **توصيل الطرود 📦:** ابعت أماناتك مع مسافرين نفس الخط في نفس اليوم.\n3️⃣ **مواقف مصر 🚏:** دليل ذكي لكل مواقف الميكروباصات وتعريفتها وحالة الزحمة فيها!`,
      `"طريقنا" هو مجتمع مصري بيجمع المسافرين وأصحاب العربيات عشان يوفروا مصاريف الطريق 🚗💡.\nمش بس كده، بنوفرلك دليل كامل لمواقف مصر وتوصيل سريع للأمانات والطرود مع ناس موثوقة في نفس طريقك.`
    ]
  },
  {
    id: 'how_to_use',
    keywords: ['استخدمه ازاي', 'انزل رحله ازاي', 'احجز ازاي', 'اركب ازاي', 'طريقه الاستخدام', 'اتواصل ازاي', 'اعمل ايه'],
    replies: [
      `الموضوع أبسط مما تتخيل! ✨\n\n🔹 **لو عايز تركب:** اختار منطقتك والمكان اللي رايحه من الصفحة الرئيسية، هتلاقي رحلات الكباتن، اضغط (تواصل) وكلمه واتساب أو فون.\n🔹 **لو معاك عربية:** اضغط على علامة ( + ) واكتب خط سيرك وميعادك وتكلفتك واضغط نشر!`,
    ]
  },
  {
    id: 'thanks',
    keywords: ['شكرا', 'تسلم', 'ربنا يخليك', 'ممتاز', 'شاطر', 'جدع', 'الله ينور', 'عاش'],
    replies: [
      `حبيبي يا بطل، العفو! 🤍🤖 أنا موجود هنا دايماً في خدمتك.`,
      `أقل واجب يا صاحبي! لو احتجت تسأل عن أي مواصلة تانية أنا موجود 🚀`,
      `الله يخليك! دايماً في الخدمة.. توصل بالسلامة يارب ✨`
    ]
  }
];

// ============================================================================
// 2. موسوعة مواصلات مصر الشاملة (محافظات ومدن)
// ============================================================================
const BESO_MEGA_TRANSIT_DB = [
  {
    keywords: ['راس البر', 'رأس البر', 'دمياط', 'دمياط الجديده', 'فارسكور'],
    title: 'طرق المواصلات إلى رأس البر ودمياط 🏖️',
    methods: [
      '🚌 **أتوبيس مباشر:** سوبر جيت أو جو باص من موقف ألماظة أو الترجمان أو عبد المنعم رياض مباشرة لرأس البر.',
      '🚐 **ميكروباص:** من (موقف السلام) أو (موقف عبود) خط دمياط، ومن الموقف سرفيس 10 دقايق لرأس البر.'
    ]
  },
  {
    keywords: ['اسكندريه', 'الاسكندريه', 'سموحه', 'محطه الرمل', 'برج العرب', 'سيدي جابر', 'محرم بك'],
    title: 'طرق المواصلات إلى الإسكندرية 🌊',
    methods: [
      '🚐 **ميكروباص سريع:** من (عبود، السلام، المنيب، أو الحصري بأكتوبر) طوال 24 ساعة بينزل موقف محرم بك.',
      '🚆 **القطار:** من رمسيس أو الجيزة (تالجو/VIP) لمحطة سيدي جابر أو محطة مصر.'
    ]
  },
  {
    keywords: ['السادات', 'مدينه السادات'],
    title: 'طرق المواصلات إلى مدينة السادات 🏙️',
    methods: [
      '🚐 من القاهرة: (موقف عبود) أو (موقف السلام) مباشر صحراوي.',
      '🚐 من أكتوبر والجيزة: (موقف الرماية) أو (الحصري).'
    ]
  },
  {
    keywords: ['شبين الكوم', 'شبين', 'المنوفيه', 'منوف', 'قويسنا', 'بركه السبع', 'اشمون', 'الباجور'],
    title: 'طرق المواصلات إلى شبين الكوم والمنوفية 🌿',
    methods: [
      '🚐 **ميكروباص:** من (عبود) أو (السلام) أو (المؤسسة بشبرا) سيارات مباشرة طوال اليوم.',
      '🚆 **القطار:** من رمسيس خط (منوف - شبين) أو تنزل محطة قويسنا وتركب سرفيس.'
    ]
  },
  {
    keywords: ['اكتوبر', '6 اكتوبر', 'الحصري', 'الشيخ زايد', 'حدائق اكتوبر', 'الرمايه', 'الهرم', 'فيصل'],
    title: 'طرق المواصلات إلى أكتوبر وزايد والهرم 🛣️',
    methods: [
      '🚐 من وسط البلد: ميكروباص من عبد المنعم رياض أو الإسعاف لأكتوبر وزايد.',
      '🚐 من الجيزة: ميكروباصات من ميدان الجيزة أو المنيب أو جامعة القاهرة.',
      '🚇 **المترو (للهرم وفيصل):** الخط الثاني لمحطة الجيزة أو فيصل ومن تحت المحطة ميكروباص.'
    ]
  },
  {
    keywords: ['التجمع', 'التجمع الخامس', 'القاهره الجديده', 'الرحاب', 'مدينتي', 'مدينه نصر'],
    title: 'طرق المواصلات إلى التجمع ومدينة نصر 🏙️',
    methods: [
      '🚇 **المترو:** الخط الثالث لمحطة (الاستاد / كلية البنات / عدلي منصور) ومنها ميكروباصات التجمع.',
      '🚐 **ميكروباص:** من رمسيس، عبد المنعم رياض، أو موقف العاشر للحي العاشر والتجمع.'
    ]
  },
  {
    keywords: ['العاصمه الاداريه', 'الشروق', 'بدر', 'العبور', 'العاشر من رمضان'],
    title: 'طرق المواصلات للعاصمة الإدارية والشروق والعبور 🚆',
    methods: [
      '🚈 **القطار الكهربائي LRT:** من محطة مترو (عدلي منصور) مباشرة لكل المدن دي لحد العاصمة الإدارية.',
      '🚐 **ميكروباص:** من موقف العاشر (السلام) ميكروباصات مباشرة.'
    ]
  },
  {
    keywords: ['طنطا', 'المحله', 'كفر الزيات', 'الغربيه', 'المنصوره', 'الدقهليه', 'ميت غمر', 'الزقازيق', 'بنها'],
    title: 'طرق المواصلات إلى الدلتا (طنطا، المنصورة، الزقازيق) 🌳',
    methods: [
      '🚐 **ميكروباص:** من (موقف عبود) أو (موقف السلام) أو (المرج) خطوط مباشرة.',
      '🚆 **القطار:** من محطة رمسيس وشبرا الخيمة لجميع محافظات الوجه البحري.'
    ]
  },
  {
    keywords: ['بورسعيد', 'الاسماعيليه', 'السويس', 'السخنه', 'شرم الشيخ', 'مطروح', 'الساحل'],
    title: 'مواصلات المدن الساحلية والقناة ⚓',
    methods: [
      '🚐 **ميكروباص:** من (السلام) أو (عبود) للإسماعيلية وبورسعيد والسويس.',
      '🚌 **أتوبيس:** (جو باص / شرق الدلتا / سوبر جيت) من التحرير أو ألماظة أو الترجمان لشرم الشيخ والسخنة ومطروح والساحل.'
    ]
  },
  {
    keywords: ['الفيوم', 'بني سويف', 'المنيا', 'ملوي', 'اسيوط', 'سوهاج', 'قنا', 'الاقصر', 'اسوان', 'الصعيد'],
    title: 'طرق المواصلات لمحافظات الصعيد ☀️',
    methods: [
      '🚐 **ميكروباص:** من (موقف المنيب) أو (عبود) سيارات مباشرة على مدار 24 ساعة.',
      '🚆 **القطار:** من محطة رمسيس أو محطة صعيد مصر (بشتيل).'
    ]
  }
];

// كلمات التوقف لاستخراج اسم المكان بدقة
const STOP_WORDS = ['عايز', 'اروح', 'ازاي', 'من', 'الي', 'إلى', 'في', 'مواصلات', 'طريق', 'خط', 'خطوط', 'موقف', 'الذهاب', 'ل', 'لو', 'سمحت', 'يا', 'بيسو', 'القاهره', 'الجيزه', 'اركب', 'ايه', 'ده', 'بكام', 'فين', 'ممكن', 'تطبيق', 'برنامج', 'فكره', 'هدف'];

const BesoAssistantModal = ({ stations = [], isDarkMode, onClose, onSelectStation, userAreas = [], user, isAdmin }) => {
  const [input, setInput] = useState('');
  const [customGuides, setCustomGuides] = useState([]);
  
  // حالات تصحيح المواصلة
  const [correctingMsgId, setCorrectingMsgId] = useState(null);
  const [correctionPlace, setCorrectionPlace] = useState('');
  const [correctionText, setCorrectionText] = useState('');
  const [isSubmittingCorrection, setIsSubmittingCorrection] = useState(false);
  const [correctionSuccessMsg, setCorrectionSuccessMsg] = useState('');
  
  // ذاكرة المحادثة (عشان لو سأله "فين في المنيا؟" يفهم إن الرد الجاي تابع للمنيا)
  const [conversationContext, setConversationContext] = useState({ expectingDetailsFor: null });

  const [messages, setMessages] = useState([
    {
      id: 'welcome',
      sender: 'beso',
      text: `أهلاً بيك يا بطل! أنا "بيسو" 🤖 مساعدك الذكي لمواقف ومواصلات مصر ولتطبيق "طريقنا".\n\nأنا مسجل عندي (${stations.length}) موقف حي، وموسوعة لطرق مصر!\n\n🔹 اسألني: **"ازاي أروح المنيب؟"** أو **"إيه فكرة التطبيق ده؟"**\n🔹 ولو في مواصلة اتغيرت، اضغط **(✏️ تعديل المعلومة)** عشان نحدثها مع بعض! 🚀`,
    }
  ]);
  const messagesEndRef = useRef(null);

  const quickQuestions = [
    'إيه فكرة التطبيق ده؟ 💡',
    'ازاي أروح رأس البر؟ 🏖️',
    'مواصلات 6 أكتوبر والشيخ زايد 🚐',
    'إيه المواقف اللي رايقة دلوقتي؟ 🟢',
    'عايز أروح المنيا الصعيد 🚄'
  ];

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

  // منع سكرول الخلفية
  useEffect(() => {
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = originalOverflow; };
  }, []);

  // دالة الذكاء الاصطناعي المحلي
  const generateBesoResponse = (queryText) => {
    const normQuery = normalizeArabic(queryText);
    
    // 1. فحص ذاكرة الحوار (لو بيسو كان سأله "فين بالظبط في كذا؟")
    if (conversationContext.expectingDetailsFor) {
      const place = conversationContext.expectingDetailsFor;
      setConversationContext({ expectingDetailsFor: null });
      return {
        text: `تمام، عشان تروح (${queryText}) في ${place}:\nأفضل طريقة إنك تركب من (موقف المنيب أو عبود) عربيات ${place} الرئيسية، ومن الموقف هناك تركب مواصلة داخلية لـ ${queryText}.. \n\nلو عندك تفاصيل أدق للطريق ده، اضغط (تعديل المعلومة) وضيفها عشان تفيد غيرك! ✨`,
        queryContext: `${place} - ${queryText}`
      };
    }

    // 2. فحص النوايا الحوارية (الأسئلة العامة، الشكر، إلخ) باستخدام تطابق مرن
    const matchedIntent = BESO_CONVERSATIONAL_INTENTS.find(intent => {
      return intent.keywords.some(kw => {
        const normKw = normalizeArabic(kw);
        // نتحقق إن الكلمة موجودة، مع دعم التعبيرات الشائعة
        return normQuery.includes(normKw) || normQuery.replace(/\s/g, '').includes(normKw.replace(/\s/g, ''));
      });
    });

    const isAskingAboutTransit = ['اروح', 'مواصلات', 'طريق', 'خط', 'موقف', 'سافر'].some(w => normQuery.includes(w));

    // لو لقى نية حوارية واضحة ومش بيسأل عن مواصلة مكان محدد
    if (matchedIntent && (!isAskingAboutTransit || matchedIntent.id === 'app_purpose')) {
      const randomReply = matchedIntent.replies[Math.floor(Math.random() * matchedIntent.replies.length)];
      return { text: randomReply, queryContext: queryText };
    }

    // 3. لو بيسأل عن المواقف الرايقة والزحمة
    if (normQuery.includes('رايق') || normQuery.includes('زحم') || normQuery.includes('فاضي')) {
      const emptyStations = stations.filter(s => s.crowdStatus === 'empty');
      const crowdedStations = stations.filter(s => s.crowdStatus === 'crowded');
      let reply = '📊 تقرير بيسو المباشر لحالة المواقف الآن:\n\n';
      if (emptyStations.length > 0) reply += `🟢 مواقف رايقة: (${emptyStations.map(s => s.name).join('، ')})\n`;
      if (crowdedStations.length > 0) reply += `🔴 مواقف زحمة: (${crowdedStations.map(s => s.name).join('، ')})\n`;
      if (emptyStations.length === 0 && crowdedStations.length === 0) reply += 'كل المواقف المسجلة حالتها طبيعية! 👍';
      return { text: reply, matchedStations: emptyStations.length > 0 ? emptyStations : stations.slice(0, 3) };
    }

    // 4. استخراج اسم المكان (الكلمات غير المعروفة)
    const effectiveTokens = normQuery.split(' ').map(t => t.trim()).filter(t => t.length > 2 && !STOP_WORDS.includes(t));
    let responseParts = [];

    // 5. البحث في تصحيحات المستخدمين (beso_knowledge_updates)
    const approvedOrMyUpdates = customGuides.filter(cg => {
      if (cg.status !== 'approved' && (!user || cg.submittedBy !== user.uid)) return false;
      const normPlace = normalizeArabic(cg.placeKeywords || '');
      return normPlace && (normQuery.includes(normPlace) || effectiveTokens.some(tok => normPlace.includes(tok)));
    });

    if (approvedOrMyUpdates.length > 0) {
      responseParts.push(`📌 **معلومات محدثة من مجتمع "طريقنا":**`);
      approvedOrMyUpdates.slice(0, 3).forEach(upd => {
        responseParts.push(`• **${upd.placeKeywords}:** ${upd.correctedInfo} ${upd.status === 'approved' ? '✅' : '⏳'}`);
      });
    }

    // 6. البحث في الداتا الحية (المواقف والخطوط)
    const foundRoutes = [];
    const foundStations = [];
    stations.forEach((st) => {
      const stName = normalizeArabic(st.name);
      if (effectiveTokens.some(tok => stName.includes(tok))) {
        if (!foundStations.some(s => s.id === st.id)) foundStations.push(st);
      }
      if (Array.isArray(st.routes)) {
        st.routes.forEach((r) => {
          if (r.status === 'pending') return;
          const dest = normalizeArabic(r.destination);
          const details = normalizeArabic(r.destinationDetails);
          if (effectiveTokens.some(tok => dest.includes(tok) || details.includes(tok))) {
            foundRoutes.push({ station: st, route: r });
          }
        });
      }
    });

    if (foundRoutes.length > 0) {
      responseParts.push(`✅ **خطوط مباشرة مسجلة في التطبيق:**`);
      foundRoutes.slice(0, 5).forEach((item, idx) => {
        const destName = item.route.destinationDetails ? `${item.route.destinationDetails} (${item.route.destination})` : item.route.destination;
        responseParts.push(`${idx + 1}. من **${item.station.name}** ⬅️ لـ **${destName}** — الأجرة: ${item.route.fare}ج`);
      });
    }

    // 7. البحث في موسوعة بيسو الشاملة
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

    // 8. الرد الذكي الديناميكي (إذا لم يجد المكان أو وجده بشكل عام جداً)
    if (responseParts.length === 0) {
      const extractedPlace = effectiveTokens.length > 0 ? effectiveTokens.join(' ') : 'المكان ده';
      
      // هنا بيسو بيسأل المستخدم بتفصيل كأنه إنسان!
      setConversationContext({ expectingDetailsFor: extractedPlace });
      
      responseParts.push(
        `🤔 بص يا سيدي، أنا دورت في كل المواقف عندي على خط مباشر لـ **(${extractedPlace})** ومردش عليا حاجة صريحة.\n\n` +
        `أنت طالع منين ورايح فين بالظبط هناك؟ (يعني رايح مركز إيه أو قرية إيه؟) اكتبلي التفصيل وهحاول ألاقي لك أقرب مسار ليه 🗺️👇`
      );
    }

    const uniqueSuggestedStations = [...foundStations];
    foundRoutes.forEach(fr => {
      if (!uniqueSuggestedStations.some(s => s.id === fr.station.id)) uniqueSuggestedStations.push(fr.station);
    });

    return {
      text: responseParts.join('\n'),
      matchedStations: uniqueSuggestedStations.slice(0, 4),
      queryContext: effectiveTokens.length > 0 ? effectiveTokens.join(' ') : queryText
    };
  };

  const handleSend = (textToProcess) => {
    const cleanText = (textToProcess || input).trim();
    if (!cleanText) return;

    const userMsg = { id: Date.now() + '_u', sender: 'user', text: cleanText };
    setMessages(prev => [...prev, userMsg]);
    setInput('');

    // تأخير بسيط لإعطاء إحساس بالتفكير
    setTimeout(() => {
      const besoReplyData = generateBesoResponse(cleanText);
      const besoMsg = {
        id: Date.now() + '_b',
        sender: 'beso',
        text: besoReplyData.text,
        matchedStations: besoReplyData.matchedStations,
        queryContext: besoReplyData.queryContext
      };
      setMessages(prev => [...prev, besoMsg]);
    }, 400);
  };

  // حفظ تعديل المواصلة
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
        status: statusToSave,
        submittedBy: user?.uid || 'guest',
        submittedByName: user?.displayName || 'مستخدم طريقنا',
        createdAt: serverTimestamp()
      });

      setCorrectionSuccessMsg(userIsAdmin ? 'تم اعتماد وتحديث المعلومة فوراً! ✅' : 'شكراً! تم الإرسال للإدارة للمراجعة ⏳');
      setTimeout(() => {
        setCorrectingMsgId(null); setCorrectionPlace(''); setCorrectionText(''); setCorrectionSuccessMsg('');
      }, 2000);
    } catch (err) { } finally { setIsSubmittingCorrection(false); }
  };

  const bgCard = isDarkMode ? 'bg-slate-900/95 border-slate-700/80' : 'bg-white/95 border-slate-200';
  const bgInput = isDarkMode ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-400' : 'bg-slate-100 border-slate-200 text-slate-900';

  const modalContent = (
    <>
      <div className="fixed inset-0 bottom-[72px] bg-black/25 backdrop-blur-[1px] z-[190]" onClick={onClose} />

      <div 
        dir="rtl"
        onClick={(e) => e.stopPropagation()} 
        className={`fixed bottom-[82px] left-3 right-3 sm:left-6 sm:right-auto sm:w-[410px] h-[66dvh] max-h-[550px] min-h-[350px] z-[200] ${bgCard} backdrop-blur-xl rounded-[1.75rem] shadow-[0_12px_45px_rgba(0,0,0,0.45)] flex flex-col overflow-hidden border animate-fade-in-up`}
      >
        <div className="px-4 py-3 bg-gradient-to-r from-indigo-600 via-violet-600 to-indigo-700 text-white flex items-center justify-between shadow-sm shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-white/20 backdrop-blur-md flex items-center justify-center border border-white/30 relative shrink-0">
              <Bot size={20} className="text-white" />
              <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-400 rounded-full border-2 border-indigo-700"></span>
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h3 className="font-black text-sm">المساعد الذكي "بيسو"</h3>
                <span className="text-[9px] font-black bg-amber-400 text-slate-950 px-1.5 py-0.2 rounded-full flex items-center gap-0.5"><Sparkles size={9}/> AI</span>
              </div>
              <p className="text-[10px] text-indigo-100 font-bold">خبير مواصلات ومواقف مصر</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 bg-white/15 hover:bg-rose-500 rounded-full transition-colors"><X size={18} /></button>
        </div>

        <div className={`flex-1 min-h-0 overflow-y-auto p-3.5 space-y-3 [&::-webkit-scrollbar]:hidden ${isDarkMode ? 'bg-slate-950/50' : 'bg-slate-50/70'}`}>
          {messages.map((msg) => {
            const isBeso = msg.sender === 'beso';
            const isEditingThis = correctingMsgId === msg.id;

            return (
              <div key={msg.id} className={`flex ${isBeso ? 'justify-start' : 'justify-end'}`}>
                <div className={`max-w-[92%] flex flex-col gap-1.5 ${isBeso ? 'items-start' : 'items-end'}`}>
                  <div className={`p-3 rounded-2xl text-[13px] leading-relaxed whitespace-pre-line shadow-sm ${
                    isBeso ? (isDarkMode ? 'bg-slate-800 text-slate-100 border border-slate-700 rounded-tr-sm' : 'bg-white text-slate-800 border border-slate-200 rounded-tr-sm') : 'bg-indigo-600 text-white font-bold rounded-tl-sm'
                  }`}>
                    {msg.text}
                  </div>

                  {isBeso && (
                    <button
                      onClick={() => {
                        if (isEditingThis) setCorrectingMsgId(null);
                        else {
                          setCorrectingMsgId(msg.id);
                          setCorrectionPlace(msg.queryContext || '');
                          setCorrectionText('');
                        }
                      }}
                      className={`text-[10px] font-black flex items-center gap-1 px-2 py-1.5 rounded-lg border transition-all ${
                        isEditingThis ? 'bg-amber-500 text-slate-950 border-amber-400' : (isDarkMode ? 'bg-slate-800/80 border-slate-700 text-amber-400' : 'bg-amber-50 border-amber-200 text-amber-700')
                      }`}
                    >
                      <Edit3 size={11} /> {isEditingThis ? 'إغلاق التعديل' : '✏️ تعديل معلومة أو إضافة خط جديد'}
                    </button>
                  )}

                  {isBeso && isEditingThis && (
                    <form onSubmit={(e) => handleSubmitCorrection(e, msg)} className={`w-full p-3 rounded-2xl border-2 border-amber-500/40 space-y-2 animate-fade-in-up ${isDarkMode ? 'bg-slate-900 text-white' : 'bg-amber-50 text-slate-900'}`}>
                      <span className="text-[11px] font-black text-amber-500 flex items-center gap-1"><PlusCircle size={13}/> تصحيح أو إضافة لبيسو:</span>
                      {correctionSuccessMsg ? (
                        <div className="p-2.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-500 text-[11px] font-black">{correctionSuccessMsg}</div>
                      ) : (
                        <>
                          <input type="text" required value={correctionPlace} onChange={(e) => setCorrectionPlace(e.target.value)} placeholder="المكان (مثال: المنيا / ملوي)" className={`w-full px-3 py-2 rounded-xl border text-[11px] font-bold outline-none ${bgInput}`}/>
                          <textarea rows={2} required value={correctionText} onChange={(e) => setCorrectionText(e.target.value)} placeholder="اكتب المواصلة الصح بالتفصيل..." className={`w-full px-3 py-2 rounded-xl border text-[11px] font-bold outline-none resize-none ${bgInput}`}/>
                          <div className="flex gap-1.5">
                            <button type="submit" disabled={isSubmittingCorrection} className="flex-1 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 rounded-xl text-[11px] font-black">{isSubmittingCorrection ? 'جاري الحفظ...' : 'إرسال'}</button>
                            <button type="button" onClick={() => setCorrectingMsgId(null)} className="px-3 py-2 rounded-xl bg-slate-200 dark:bg-slate-800 text-[11px] font-bold">إلغاء</button>
                          </div>
                        </>
                      )}
                    </form>
                  )}

                  {isBeso && msg.matchedStations && msg.matchedStations.length > 0 && (
                    <div className="w-full space-y-1.5 mt-0.5">
                      <span className="text-[10px] font-black text-indigo-400 px-1 flex items-center gap-1"><Compass size={11}/> افتح الموقف لخطوطه:</span>
                      {msg.matchedStations.map((st) => (
                        <button key={st.id} onClick={() => { onClose(); onSelectStation(st); }} className={`w-full p-2 rounded-xl border flex items-center justify-between hover:border-indigo-500 ${isDarkMode ? 'bg-slate-900 border-slate-700 text-white' : 'bg-indigo-50/70 border-indigo-200 text-slate-900'}`}>
                          <div className="flex items-center gap-2">
                            <div className="p-1.5 rounded-lg bg-indigo-600 text-white"><BusFront size={13}/></div>
                            <div className="text-right">
                              <h4 className="text-[11px] font-black">{st.name}</h4>
                              <p className="text-[9px] text-slate-400 font-bold">{st.location}</p>
                            </div>
                          </div>
                          <ChevronLeft size={12} className="text-indigo-500"/>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>

        <div className={`px-2.5 py-1.5 border-t shrink-0 flex gap-1.5 overflow-x-auto [&::-webkit-scrollbar]:hidden ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
          {quickQuestions.map((q, idx) => (
            <button key={idx} onClick={() => handleSend(q)} className={`shrink-0 text-[10px] font-black px-2.5 py-1 rounded-full border ${isDarkMode ? 'bg-slate-800 border-slate-700 text-indigo-300 hover:bg-indigo-600 hover:text-white' : 'bg-indigo-50 border-indigo-200 text-indigo-700 hover:bg-indigo-600 hover:text-white'}`}>
              {q}
            </button>
          ))}
        </div>

        <form onSubmit={(e) => { e.preventDefault(); handleSend(); }} className={`p-2.5 shrink-0 flex items-center gap-2 border-t ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}>
          <input type="text" value={input} onChange={(e) => setInput(e.target.value)} placeholder="اسأل بيسو عن أي مواصلة..." className={`flex-1 px-3.5 py-2.5 rounded-xl border text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500 ${bgInput}`}/>
          <button type="submit" disabled={!input.trim()} className="w-10 h-10 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white flex items-center justify-center shadow-md active:scale-95 shrink-0">
            <Send size={16} className="rtl:rotate-180" />
          </button>
        </form>
      </div>
    </>
  );

  return typeof document !== 'undefined' ? createPortal(modalContent, document.body) : modalContent;
};

export default BesoAssistantModal;
