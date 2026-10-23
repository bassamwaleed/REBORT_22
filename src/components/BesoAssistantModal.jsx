import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X, Send, Bot, Sparkles, BusFront, Compass, ChevronLeft } from 'lucide-react';
import { normalizeArabic } from '../App';

const BESO_TRAVEL_GUIDES = [
  {
    keywords: ['راس البر', 'رأس البر', 'دمياط'],
    title: 'طرق الذهاب إلى رأس البر / دمياط 🏖️',
    methods: [
      '🚌 الطريقة الأولى (الأسرع - أتوبيس مباشر): اركب سوبر جيت (شرق الدلتا أو جو باص أو الدلتا) من موقف ألماظة أو الترجمان أو عبد المنعم رياض متجه مباشرة إلى رأس البر أو دمياط.',
      '🚐 الطريقة الثانية (ميكروباص): اتجه إلى (موقف السلام النموذجي) أو (موقف عبود)، واركب ميكروباص خط دمياط، ومن موقف دمياط اركب ميكروباص أو سرفيس 10 دقائق إلى قلب رأس البر.',
      '🚆 الطريقة الثالثة (القطار): اركب قطار من محطة مصر (رمسيس) متجه إلى محطة دمياط، ومن أمام المحطة تتوفر سرفيسات وميكروباصات مباشرة لرأس البر على مدار الساعة.'
    ]
  },
  {
    keywords: ['اسكندريه', 'الاسكندريه', 'سموحه', 'ميامي', 'محطه الرمل', 'برج العرب'],
    title: 'طرق الذهاب إلى الإسكندرية 🌊',
    methods: [
      '🚐 الطريقة الأولى (ميكروباص سريع): من (موقف عبود) أو (موقف السلام) أو (موقف المنيب) أو (الحصري بأكتوبر)، تتوفر ميكروباصات مباشرة على الطريق الصحراوي أو الزراعي تنزل موقف محرم بك (الموقف الجديد).',
      '🚆 الطريقة الثانية (القطار): من محطة رمسيس أو الجيزة، اركب قطار (تالجو / VIP / مكيف) إلى محطة سيدي جابر أو محطة مصر بالإسكندرية.',
      '🚌 الطريقة الثالثة (أتوبيسات النقل الجماعي): من ميدان عبد المنعم رياض أو ألماظة أو الجيزة عبر شركات (جو باص، غرب ووسط الدلتا، الاتحاد العربي).'
    ]
  },
  {
    keywords: ['السادات', 'مدينه السادات'],
    title: 'طرق الذهاب إلى مدينة السادات 🏙️',
    methods: [
      '🚐 من القاهرة: اركب من (موقف عبود) أو (موقف السلام) ميكروباصات مدينة السادات المباشرة عبر الطريق الصحراوي.',
      '🚐 من الجيزة وأكتوبر: اركب من (موقف الرماية) أو (ميدان الحصري / ليلة القدر) ميكروباص خط السادات المباشر.',
      '🚐 من المنوفية: تتوفر خطوط مباشرة من موقف شبين الكوم وموقف منوف إلى مدينة السادات.'
    ]
  },
  {
    keywords: ['شبين الكوم', 'شبين', 'المنوفيه', 'منوف', 'قويسنا', 'بركه السبع'],
    title: 'طرق الذهاب إلى شبين الكوم والمنوفية 🌿',
    methods: [
      '🚐 الطريقة الأولى (ميكروباص): من (موقف عبود) أو (موقف السلام) أو (موقف المؤسسة بشبرا الخيمة) تتوفر سيارات مباشرة طوال اليوم إلى شبين الكوم ومنوف.',
      '🚐 من أكتوبر والشيخ زايد: من موقف الحصري أو المحور المركزي تتوفر خطوط مباشرة إلى شبين الكوم.',
      '🚆 الطريقة الثانية (القطار): من محطة رمسيس أو شبرا الخيمة، اركب قطار خط (القاهرة - منوف - طنطا) وينزل محطة شبين الكوم.'
    ]
  },
  {
    keywords: ['بورسعيد', 'بورفؤاد'],
    title: 'طرق الذهاب إلى بورسعيد ⚓',
    methods: [
      '🚐 ميكروباص: من (موقف السلام) أو (موقف عبود) خط بورسعيد المباشر عبر محور 30 يونيو.',
      '🚌 أتوبيس: من عبد المنعم رياض أو الترجمان أو ألماظة (شرق الدلتا / جو باص / سوبر جيت) لبورسعيد.',
      '🚆 قطار: من محطة رمسيس خط الاسماعيلية - بورسعيد.'
    ]
  },
  {
    keywords: ['العين السخنه', 'السخنه', 'السويس', 'الزعفرانه', 'الجلاله'],
    title: 'طرق الذهاب إلى العين السخنة والسويس ☀️',
    methods: [
      '🚐 ميكروباص: من (موقف السلام) أو (موقف ألماظة) أو (المرج الجديدة) اركب خط السويس ومنها للسخنة، أو سيارات السخنة/الجلالة.',
      '🚌 أتوبيس: حجز جو باص أو بلو باص من التحرير أو مدينة نصر (النادي الأهلي/الجبل الأخضر) مباشرة لقرى العين السخنة.'
    ]
  },
  {
    keywords: ['مطروح', 'مرسي مطروح', 'الساحل الشمالي', 'العلمين'],
    title: 'طرق الذهاب إلى العلمين ومرسى مطروح 🏖️',
    methods: [
      '🚌 أتوبيس (غرب الدلتا / جو باص / سوبر جيت): من عبد المنعم رياض أو الترجمان أو الحصري مباشرة إلى العلمين ومطروح.',
      '🚐 ميكروباص: من (موقف مشعل بالهرم) أو (موقف عبود) أو (موقف محرم بك بالإسكندرية) تتوفر ميكروباصات مطروح والساحل.'
    ]
  },
  {
    keywords: ['طنطا', 'المحله', 'كفر الزيات', 'الغربيه'],
    title: 'طرق الذهاب إلى طنطا والغربية 🕌',
    methods: [
      '🚐 ميكروباص: من (موقف عبود) أو (موقف السلام) أو (موقف المؤسسة) خط طنطا أو المحلة الكبرى المباشر.',
      '🚆 قطار: جميع قطارات الوجه البحري من محطة رمسيس وشبرا الخيمة تقف في محطة طنطا.'
    ]
  },
  {
    keywords: ['المنصوره', 'الدقهليه', 'ميت غمر', 'الزقازيق', 'الشرقيه'],
    title: 'طرق الذهاب إلى المنصورة والزقازيق 🌳',
    methods: [
      '🚐 ميكروباص: من (موقف عبود) أو (موقف السلام) أو (موقف المرج) تتوفر خطوط مباشرة على مدار الساعة للمنصورة والزقازيق.',
      '🚆 قطار: من محطة رمسيس خط (القاهرة - الزقازيق - المنصورة).'
    ]
  },
  {
    keywords: ['اكتوبر', '6 اكتوبر', 'الحصري', 'الشيخ زايد', 'حدائق اكتوبر'],
    title: 'طرق الذهاب إلى 6 أكتوبر والشيخ زايد 🛣️',
    methods: [
      '🚐 من وسط البلد ورمسيس: اركب من موقف عبد المنعم رياض أو الإسعاف خط الحصري / أكتوبر أو الشيخ زايد.',
      '🚐 من الجيزة والهرم وفيصل: من ميدان الجيزة أو مشعل أو المريوطية تتوفر سيارات دائمة لأكتوبر وزايد.',
      '🚐 من السلام والمرج ومدينة نصر: من موقف السلام أو العاشر أو رمسيس عبر الدائري والمحور.'
    ]
  }
];

const BesoAssistantModal = ({ stations = [], isDarkMode, onClose, onSelectStation, userAreas = [] }) => {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState([
    {
      id: 'welcome',
      sender: 'beso',
      text: `أهلاً بك يا بطل! أنا "بيسو" 🤖 مساعدك الذكي لمواقف ومواصلات مصر.\n\nأنا مسجل عندي حالياً (${stations.length}) موقف بكل خطوطهم وتعرفتهم الحية، وكمان عارف طرق السفر لكل محافظات مصر!\n\nاكتبلي عايز تروح فين؟ (مثلاً: "عايز أروح رأس البر من القاهرة" أو "مواصلات مدينة السادات") وهقولك أكتر من طريقة تركب بيها فوراً! 🚀`,
      matchedStations: [],
      matchedRoutes: []
    }
  ]);
  const messagesEndRef = useRef(null);

  const quickQuestions = [
    'ازاي أروح رأس البر من القاهرة؟ 🏖️',
    'مواصلات 6 أكتوبر والشيخ زايد 🚐',
    'عايز أروح الإسكندرية 🌊',
    'خطوط مدينة السادات وشبين 🛣️',
    'إيه المواقف اللي حالة الزحمة فيها رايقة؟ 🟢'
  ];

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const generateBesoResponse = (queryText) => {
    const normQuery = normalizeArabic(queryText);

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
        matchedRoutes: []
      };
    }

    const foundRoutes = [];
    const foundStations = [];

    const stopWords = ['عايز', 'اروح', 'ازاي', 'من', 'الي', 'إلى', 'في', 'مواصلات', 'طريق', 'خط', 'خطوط', 'موقف', 'الذهاب', 'ل', 'لو', 'سمحت', 'يا', 'بيسو', 'القاهره', 'الجيزه'];
    const queryTokens = normQuery
      .split(' ')
      .map(t => t.trim())
      .filter(t => t.length >= 3 && !stopWords.includes(t));

    const effectiveTokens = queryTokens.length > 0 ? queryTokens : normQuery.split(' ').filter(t => t.length >= 2);

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

    const matchedGuides = BESO_TRAVEL_GUIDES.filter(g => 
      g.keywords.some(kw => normQuery.includes(normalizeArabic(kw))) ||
      effectiveTokens.some(tok => g.keywords.some(kw => normalizeArabic(kw).includes(tok)))
    );

    let responseParts = [];

    if (foundRoutes.length > 0) {
      responseParts.push(`✅ لقيتلك (${foundRoutes.length}) خط سير مباشر مسجل في مواقف التطبيق:`);
      foundRoutes.slice(0, 5).forEach((item, idx) => {
        const destName = item.route.destinationDetails ? `${item.route.destinationDetails} (${item.route.destination})` : item.route.destination;
        const crowdBadge = item.route.crowdStatus === 'crowded' ? '🔴 زحمة' : item.route.crowdStatus === 'empty' ? '🟢 رايق' : '';
        responseParts.push(
          `${idx + 1}. من **${item.station.name}** (${item.station.location}) ⬅️ خط **${destName}** — الأجرة: **${item.route.fare} ج** ${crowdBadge}`
        );
      });
    }

    if (matchedGuides.length > 0) {
      matchedGuides.forEach(guide => {
        responseParts.push(`\n🧭 **${guide.title}:**`);
        guide.methods.forEach(m => responseParts.push(m));
      });
    }

    if (foundRoutes.length === 0 && foundStations.length > 0) {
      responseParts.push(`🚏 لقيتلك موقف مطابق لبحثك في التطبيق:`);
      foundStations.forEach(st => {
        responseParts.push(`• **${st.name}** في منطقة (${st.location}) ويحتوي على (${st.routes?.length || 0}) خطوط سير.`);
      });
    }

    if (responseParts.length === 0) {
      responseParts.push(
        `🤔 بص يا بطل، المشوار ده لسه ملوش خط مباشر متسجل بنفس الاسم في الداتا الحالية، بس خليني أقولك أفضل 3 طرق توصل بيهم لأي مكان في مصر بسهولة:\n\n` +
        `1️⃣ **موقف عبود أو موقف السلام النموذجي:** دول أكبر موقفين في القاهرة فيهم ميكروباصات وأتوبيسات لكل محافظات الوجه البحري والدلتا والقناة.\n` +
        `2️⃣ **موقف المنيب أو ميدان الجيزة / الحصري:** لو وجهتك ناحية أكتوبر، الفيوم، الصعيد، أو الإسكندرية.\n` +
        `3️⃣ **تقدر تضيف الخط ده بنفسك!** لو عرفت خط السير والأجرة، افتح الموقف واضغط (إضافة خط سير) وأنا هحفظه في ذاكرتي فوراً عشان أفيد كل الناس اللي هتسألني بعدك! 🤖✨`
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
      matchedRoutes: foundRoutes.slice(0, 4)
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
      matchedRoutes: besoReplyData.matchedRoutes
    };

    setMessages(prev => [...prev, userMsg, besoMsg]);
    if (!textToProcess) setInput('');
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
        className={`fixed bottom-[82px] left-3 right-3 sm:left-6 sm:right-auto sm:w-[390px] h-[64dvh] max-h-[500px] min-h-[340px] z-[200] ${bgCard} backdrop-blur-xl rounded-[1.75rem] shadow-[0_12px_45px_rgba(0,0,0,0.45)] flex flex-col overflow-hidden border animate-fade-in-up`}
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
                  <Sparkles size={9}/> AI
                </span>
              </div>
              <p className="text-[10px] text-indigo-100 font-bold">
                خبير مواصلات ومواقف مصر ({stations.length} موقف)
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
            return (
              <div key={msg.id} className={`flex ${isBeso ? 'justify-start' : 'justify-end'}`}>
                <div className={`max-w-[90%] flex flex-col gap-1.5 ${isBeso ? 'items-start' : 'items-end'}`}>
                  <div className={`p-3 rounded-2xl text-xs leading-relaxed whitespace-pre-line shadow-sm ${
                    isBeso 
                      ? (isDarkMode ? 'bg-slate-800 text-slate-100 border border-slate-700 rounded-tr-sm' : 'bg-white text-slate-800 border border-slate-200 rounded-tr-sm')
                      : 'bg-indigo-600 text-white font-bold rounded-tl-sm'
                  }`}>
                    {msg.text}
                  </div>

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
            placeholder="اسأل بيسو: عايز أروح رأس البر..."
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