import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { collection, addDoc, onSnapshot, serverTimestamp } from 'firebase/firestore';
import { X, Send, Bot, Sparkles, BusFront, Compass, ChevronLeft, Edit3, CheckCircle2, PlusCircle } from 'lucide-react';
import { db, ADMIN_EMAIL } from '../firebase';
import { normalizeArabic } from '../App';

// ============================================================================
// 1. موسوعة الحوار الذكي (للرد على التحيات والأسئلة العامة)
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
    keywords: ['هدف التطبيق', 'فكره التطبيق', 'فكرة التطبيق', 'يعني ايه طريقنا', 'ابلكيشن ايه ده', 'بيعمل ايه', 'لازمته ايه', 'فكرته ايه', 'شرح التطبيق', 'عن التطبيق', 'البرنامج ده'],
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
    keywords: ['شكرا', 'تسلم', 'ربنا يخليك', 'ممتاز', 'شاطر', 'جدع', 'الله ينور', 'عاش', 'حبيبي'],
    replies: [
      `حبيبي يا بطل، العفو! 🤍🤖 أنا موجود هنا دايماً في خدمتك.`,
      `أقل واجب يا صاحبي! لو احتجت تسأل عن أي مواصلة تانية أنا موجود 🚀`,
      `الله يخليك! دايماً في الخدمة.. توصل بالسلامة يارب ✨`
    ]
  }
];

// ============================================================================
// 2. موسوعة مواصلات مصر الشاملة (دليل إرشادي للطرق الكبرى)
// ============================================================================
const BESO_MEGA_TRANSIT_DB = [
  {
    keywords: ['راس البر', 'رأس البر', 'دمياط'],
    title: 'طرق الذهاب إلى رأس البر ودمياط 🏖️',
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
    keywords: ['بورسعيد', 'الاسماعيليه', 'السويس', 'السخنه', 'شرم الشيخ', 'مطروح', 'الساحل'],
    title: 'مواصلات المدن الساحلية والقناة ⚓',
    methods: [
      '🚐 **ميكروباص:** من (موقف السلام) أو (عبود) للإسماعيلية وبورسعيد والسويس.',
      '🚌 **أتوبيس:** (جو باص / شرق الدلتا / سوبر جيت) من التحرير أو ألماظة أو الترجمان لشرم الشيخ والسخنة ومطروح والساحل.'
    ]
  },
  {
    keywords: ['الفيوم', 'بني سويف', 'المنيا', 'ملوي', 'اسيوط', 'سوهاج', 'قنا', 'الاقصر', 'اسوان', 'الصعيد'],
    title: 'طرق المواصلات لمحافظات الصعيد ☀️',
    methods: [
      '🚐 **ميكروباص:** من (موقف المنيب) أو (عبود) سيارات مباشرة على مدار 24 ساعة للصعيد.',
      '🚆 **القطار:** من محطة رمسيس أو محطة صعيد مصر (بشتيل) قطارات مستمرة طوال اليوم.'
    ]
  }
];

const BesoAssistantModal = ({ stations = [], isDarkMode, onClose, onSelectStation, userAreas = [], user, isAdmin }) => {
  const [input, setInput] = useState('');
  const [customGuides, setCustomGuides] = useState([]);
  
  // حالات تصحيح المواصلة
  const [correctingMsgId, setCorrectingMsgId] = useState(null);
  const [correctionPlace, setCorrectionPlace] = useState('');
  const [correctionText, setCorrectionText] = useState('');
  const [isSubmittingCorrection, setIsSubmittingCorrection] = useState(false);
  const [correctionSuccessMsg, setCorrectionSuccessMsg] = useState('');
  
  // ذاكرة المحادثة (الذكاء الاصطناعي لحفظ الانطلاق والوصول)
  const [conversationContext, setConversationContext] = useState({ expectingOriginFor: null, expectingDestFor: null });

  const [messages, setMessages] = useState([
    {
      id: 'welcome',
      sender: 'beso',
      text: `أهلاً بيك يا بطل! أنا "بيسو" 🤖 مساعدك الذكي لمواقف ومواصلات مصر ولتطبيق "طريقنا".\n\nأنا مسجل عندي (${stations.length}) موقف حي، وموسوعة لطرق مصر!\n\n🔹 جرب تسألني: **"انا في رمسيس ورايح أكتوبر"** أو **"ازاي أروح المنيا؟"**\n🔹 ولو في مواصلة اتغيرت، اضغط **(✏️ تعديل المعلومة)** عشان نحدثها مع بعض! 🚀`,
    }
  ]);
  const messagesEndRef = useRef(null);

  const quickQuestions = [
    'ازاي أروح رأس البر من القاهرة؟ 🏖️',
    'أنا في رمسيس ورايح أكتوبر 🚐',
    'عايز أروح المنيا 🚄',
    'إيه فكرة التطبيق ده؟ 💡'
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

  useEffect(() => {
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = originalOverflow; };
  }, []);

  // محلل الجمل العربية (Arabic NLP Parser) لاستخراج (من) و (إلى) بكافة اللهجات
  const parseTransitQuery = (text) => {
    const cleanText = text.replace(/[؟?.,]/g, ' ').replace(/\s+/g, ' ');
    let origin = null;
    let dest = null;

    // نمط 1: عايز اروح [وجهة] من [انطلاق] (مثال: عايز اروح اكتوبر من رمسيس)
    const p1 = /(?:رايح|اروح|اسافر|عايز اروح|ازاي اروح|مواصلات|اركب ايه ل)\s+([أ-يa-zA-Z0-9\s]+?)\s+(?:من|وانا في|مكاني في)\s+([أ-يa-zA-Z0-9\s]+)/;
    const m1 = cleanText.match(p1);
    if (m1) return { dest: m1[1].trim(), origin: m1[2].trim() };

    // نمط 2: من [انطلاق] لـ [وجهة] (مثال: من التجمع لاكتوبر / انا في المعادي ورايح زايد)
    const p2 = /(?:من|انا في|متواجد في)\s+([أ-يa-zA-Z0-9\s]+?)\s+(?:الى|إلى|ل|لـ|عايز اروح|رايح|لحد)\s+([أ-يa-zA-Z0-9\s]+)/;
    const m2 = cleanText.match(p2);
    if (m2) return { origin: m2[1].trim(), dest: m2[2].trim() };

    // نمط 3: عايز اروح [وجهة] (بدون انطلاق)
    const p3 = /(?:عايز اروح|ازاي اروح|رايح|سافر|مواصلات|لـ|الى|إلى)\s+([أ-يa-zA-Z0-9\s]+)/;
    const m3 = cleanText.match(p3);
    if (m3) return { origin: null, dest: m3[1].trim() };

    // نمط 4: انا في [انطلاق] (بدون وجهة)
    const p4 = /(?:انا في|مكاني|من)\s+([أ-يa-zA-Z0-9\s]+)/;
    const m4 = cleanText.match(p4);
    if (m4) return { origin: m4[1].trim(), dest: null };

    return { origin: null, dest: null };
  };

  // العقل الذكي لتوليد الردود
  const generateBesoResponse = (queryText) => {
    const normQuery = normalizeArabic(queryText);

    // 1. فحص النوايا الحوارية العامة (الأسئلة، الشكر، الشرح)
    const matchedIntent = BESO_CONVERSATIONAL_INTENTS.find(intent => {
      return intent.keywords.some(kw => {
        const normKw = normalizeArabic(kw);
        return normQuery.includes(normKw) || normQuery.replace(/\s/g, '').includes(normKw.replace(/\s/g, ''));
      });
    });

    const isTransitQuery = ['اروح', 'مواصلات', 'طريق', 'خط', 'موقف', 'من', 'الى', 'رايح', 'انا في'].some(w => normQuery.includes(w));
    if (matchedIntent && (!isTransitQuery || matchedIntent.id === 'app_purpose')) {
      const randomReply = matchedIntent.replies[Math.floor(Math.random() * matchedIntent.replies.length)];
      return { text: randomReply, queryContext: queryText };
    }

    // 2. تحليل الجملة لاستخراج الانطلاق والوصول
    const parsed = parseTransitQuery(normQuery);
    let o = parsed.origin;
    let d = parsed.dest;

    // 3. استخدام الذاكرة لربط الجمل ببعضها
    if (conversationContext.expectingOriginFor) {
      d = conversationContext.expectingOriginFor;
      o = o || normQuery; // لو كتب "رمسيس" بس
      setConversationContext({ expectingOriginFor: null, expectingDestFor: null });
    } else if (conversationContext.expectingDestFor) {
      o = conversationContext.expectingDestFor;
      d = d || normQuery;
      setConversationContext({ expectingOriginFor: null, expectingDestFor: null });
    } else if (d && !o) {
      setConversationContext({ expectingOriginFor: d, expectingDestFor: null });
      return {
        text: `تمام، عشان أقدر أظبطلك أسرع وأوفر طريق لـ **(${d})** 📍\nقولي أنت هتركب منين بالظبط؟ (مثلاً: أنا في رمسيس، أو من المعادي)`,
        queryContext: queryText
      };
    } else if (o && !d) {
      setConversationContext({ expectingDestFor: o, expectingOriginFor: null });
      return {
        text: `أنت دلوقتي في **(${o})**.. تمام جداً 👍\nرايح فين بقى عشان أقولك تركب إيه من هناك؟`,
        queryContext: queryText
      };
    }

    // 4. لو معانا الانطلاق والوصول (o, d) هنجيب الطريق
    if (o && d) {
      let responseParts = [];
      const foundRoutes = [];
      const matchedStations = [];

      // البحث في المواقف الحية (stations)
      stations.forEach(st => {
        const stName = normalizeArabic(st.name);
        const stLoc = normalizeArabic(st.location);
        const normO = normalizeArabic(o);
        const normD = normalizeArabic(d);

        // هل الموقف قريب من نقطة الانطلاق؟
        if (stName.includes(normO) || normO.includes(stName) || stLoc.includes(normO) || normO.includes(stLoc) || o === 'القاهره' || o === 'الجيزه') {
          if (!matchedStations.some(s => s.id === st.id)) matchedStations.push(st);
          
          // هل الموقف ده فيه خط للوجهة؟
          (st.routes || []).forEach(r => {
            if (r.status === 'pending') return;
            const dest = normalizeArabic(r.destination);
            const details = normalizeArabic(r.destinationDetails);
            if (dest.includes(normD) || normD.includes(dest) || (details && (details.includes(normD) || normD.includes(details)))) {
              foundRoutes.push({ station: st, route: r });
            }
          });
        }
      });

      if (foundRoutes.length > 0) {
        responseParts.push(`🎯 **لقيتلك خط مباشر من (${o}) لـ (${d}) متسجل في التطبيق:**`);
        foundRoutes.slice(0, 4).forEach((item, idx) => {
          const destName = item.route.destinationDetails ? `${item.route.destinationDetails} (${item.route.destination})` : item.route.destination;
          responseParts.push(`${idx + 1}. تروح **${item.station.name}** (${item.station.location}) ⬅️ وتركب خط **${destName}** — الأجرة: ${item.route.fare}ج`);
        });
      } else {
        // لو ملقاش خط مباشر، يبحث في الإرشادات أو التحديثات
        const approvedUpdates = customGuides.filter(cg => cg.status === 'approved' && normalizeArabic(cg.placeKeywords).includes(normalizeArabic(d)));
        if (approvedUpdates.length > 0) {
          responseParts.push(`📌 **معلومة من مجتمع طريقنا لـ (${d}):**\n${approvedUpdates[0].correctedInfo}`);
        } else {
          // الرد الذكي الديناميكي للمناطق الغير مسجلة
          responseParts.push(
            `🤔 بص يا سيدي، دورت في كل مواقف **(${o})** على خط مباشر لـ **(${d})** ومردش عليا حاجة في داتا التطبيق لحد اللحظة دي.\n\n` +
            `بس عموماً عشان تروح **(${d})**، أنصحك تنزل أقرب موقف مركزي كبير (زي رمسيس، عبود، أو المنيب لو أنت في القاهرة/الجيزة) ومن هناك هتلاقي عربيات ليها بسهولة 🗺️.\n\n` +
            `💡 **عرفت المواصلة دي؟** اضغط على (✏️ تعديل المعلومة) تحت رسالتي وضيفها عشان أحفظها وأقولها لأي حد يسألني بعدك وتكسب ثوابه! ✨`
          );
        }
      }

      return {
        text: responseParts.join('\n\n'),
        matchedStations: matchedStations.slice(0, 3),
        queryContext: `${o} - ${d}`
      };
    }

    // 5. بحث عام لو معرفناش نفصل (من) و (إلى)
    return {
      text: `أنا معاك يا بطل، بس مش قادر أحدد بالظبط أنت طالع منين ورايح فين 😅\nممكن تكتبهالي كده: **"أنا في [مكانك] ورايح [وجهتك]"** عشان أقدر أرد عليك بأدق طريق! 🚀`,
      queryContext: queryText
    };
  };

  const handleSend = (textToProcess) => {
    const cleanText = (textToProcess || input).trim();
    if (!cleanText) return;

    const userMsg = { id: Date.now() + '_u', sender: 'user', text: cleanText };
    setMessages(prev => [...prev, userMsg]);
    setInput('');

    // تأخير بسيط لمحاكاة تفكير الذكاء الاصطناعي
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
    }, 500);
  };

  // حفظ تعديل المواصلة (يرسل للأدمن أو يُعتمد فوراً)
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
              <p className="text-[10px] text-indigo-100 font-bold">خبير مواصلات يفهمك 🧠</p>
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
                          <input type="text" required value={correctionPlace} onChange={(e) => setCorrectionPlace(e.target.value)} placeholder="اسم الخط أو المكان (مثال: من رمسيس للمنيا)" className={`w-full px-3 py-2 rounded-xl border text-[11px] font-bold outline-none ${bgInput}`}/>
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
          <input type="text" value={input} onChange={(e) => setInput(e.target.value)} placeholder="مثال: من رمسيس لزايد..." className={`flex-1 px-3.5 py-2.5 rounded-xl border text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500 ${bgInput}`}/>
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
