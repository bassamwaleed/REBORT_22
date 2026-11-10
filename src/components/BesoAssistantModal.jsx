import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { collection, addDoc, onSnapshot, serverTimestamp } from 'firebase/firestore';
import { X, Send, Bot, Sparkles, BusFront, Compass, ChevronLeft, Edit3, PlusCircle } from 'lucide-react';
import { db, ADMIN_EMAIL } from '../firebase';
import { normalizeArabic } from '../App';
import { getPlaceCoords, getDistanceKm } from '../utils/helpers';

// الردود الحوارية الأساسية فقط (بدون أي داتا مواصلات ثابتة أو قديمة)
const BESO_CONVERSATIONAL_INTENTS = [
  {
    id: 'greeting',
    keywords: ['اهلا', 'سلام عليكم', 'السلام عليكم', 'صباح الخير', 'مساء الخير', 'ازيك', 'عامل ايه', 'اخبارك', 'مرحبا', 'هاي', 'الو', 'يا بيسو'],
    replies: [
      `أهلاً بيك يا بطل في "طريقنا"! 👋🤖\nأنا "بيسو"، قولي مكانك فين ورايح فين وهطلعلك خط السير أو نقطة التبديل من داتا الخريطة الحية فوراً!`,
      `وعليكم السلام ورحمة الله! يا مرحب بيك في "طريقنا" 🚀.. اكتبلي (من كذا لـ كذا) وهجبلك المواصلة بالتفصيل.`
    ]
  },
  {
    id: 'app_purpose',
    keywords: ['هدف التطبيق', 'فكره التطبيق', 'فكرة التطبيق', 'يعني ايه طريقنا', 'ابلكيشن ايه ده', 'بيعمل ايه', 'لازمته ايه', 'فكرته ايه', 'شرح التطبيق', 'عن التطبيق'],
    replies: [
      `فكرة "طريقنا" ببساطة 🎯:\n1️⃣ **مشاركة المشاوير:** كباتن وركاب في نفس الطريق بيوفروا مصاريف المشوار.\n2️⃣ **توصيل الأمانات 📦:** شحن سريع مع مسافرين في نفس اليوم.\n3️⃣ **خريطة المواقف والنقاط التبادلية 🚏:** دليل حي للمواقف ونقاط التبديل (الترانزيت) والتعريفة لحظة بلحظة!`
    ]
  },
  {
    id: 'thanks',
    keywords: ['شكرا', 'تسلم', 'ربنا يخليك', 'ممتاز', 'شاطر', 'جدع', 'الله ينور', 'عاش', 'حبيبي'],
    replies: [
      `حبيبي يا بطل، العفو! 🤍🤖 توصل بالسلامة دايماً.`,
      `أقل واجب يا صاحبي! أنا متحدث لحظياً بأي خط جديد بينزل على الخريطة 🚀`
    ]
  }
];

const STOP_WORDS = ['من', 'الي', 'الى', 'ل', 'لحد', 'عند', 'في', 'انا', 'عايز', 'اروح', 'رايح', 'مواصلات', 'طريق', 'خط', 'موقف', 'ازاي', 'اركب', 'ايه'];

const BesoAssistantModal = ({ stations = [], isDarkMode, onClose, onSelectStation, userAreas = [], user, isAdmin }) => {
  const [input, setInput] = useState('');
  const [customGuides, setCustomGuides] = useState([]);

  const [correctingMsgId, setCorrectingMsgId] = useState(null);
  const [correctionPlace, setCorrectionPlace] = useState('');
  const [correctionText, setCorrectionText] = useState('');
  const [isSubmittingCorrection, setIsSubmittingCorrection] = useState(false);
  const [correctionSuccessMsg, setCorrectionSuccessMsg] = useState('');

  const [conversationContext, setConversationContext] = useState({ expectingOriginFor: null, expectingDestFor: null });

  const approvedStations = (stations || []).filter(s => isAdmin || s.status !== 'pending');

  const [messages, setMessages] = useState([
    {
      id: 'welcome',
      sender: 'beso',
      text: `أهلاً بيك يا بطل! أنا "بيسو" 🤖 محرك البحث الجغرافي الذكي لـ "طريقنا".\n\nأنا مربوط لحظياً بـ (${approvedStations.length}) موقف ونقطة تبادلية في النظام!\n\n🔹 اسألني مثلاً: **"من الصحراوي لأكتوبر"** أو **"أنا في الدقي ورايح الحصري"**\n🔹 لو المواصلة محتاجة تبديل في الطريق (زي محور 26 يوليو أو المريوطية)، هركبلك الخطين على بعض وأقولك تنزل فين وتركب منين بالظبط! 🚀`
    }
  ]);
  const messagesEndRef = useRef(null);

  const quickQuestions = [
    'أقرب موقف أو نقطة تبادلية ليا؟ 📍',
    'إيه النقاط التبادلية المتسجلة؟ 🔄',
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

  // مقارنة ذكية ومرنة للأسماء العربية (تفهم الكلمات الجزئية مثل "أكتوبر" == "مدينة 6 أكتوبر" أو "محور" == "تقاطع محور 26 يوليو")
  const isSmartPlaceMatch = (textA, textB) => {
    const a = normalizeArabic(textA);
    const b = normalizeArabic(textB);
    if (!a || !b) return false;
    if (a.includes(b) || b.includes(a)) return true;

    const tokensA = a.split(' ').filter(w => w.length > 2 && !STOP_WORDS.includes(w));
    const tokensB = b.split(' ').filter(w => w.length > 2 && !STOP_WORDS.includes(w));
    if (tokensA.length === 0 || tokensB.length === 0) return false;

    return tokensA.some(tA => tokensB.some(tB => tA.includes(tB) || tB.includes(tA)));
  };

  // هل النقطة/الموقف يطابق المكان المطلوب نصياً أو جغرافياً؟
  const doesNodeMatchPlace = (station, placeText, maxDistKm = 4.5) => {
    if (!station || !placeText) return false;
    if (
      isSmartPlaceMatch(station.name, placeText) ||
      isSmartPlaceMatch(station.location, placeText) ||
      isSmartPlaceMatch(station.governorate, placeText) ||
      isSmartPlaceMatch(station.transferHint, placeText)
    ) {
      return true;
    }
    const placeCoords = getPlaceCoords(placeText);
    const stCoords = getPlaceCoords(station);
    const dist = getDistanceKm(placeCoords[0], placeCoords[1], stCoords[0], stCoords[1]);
    return dist <= maxDistKm;
  };

  // هل خط السير يودي للوجهة المطلوبة؟
  const doesRouteReachPlace = (route, placeText) => {
    if (!route || !placeText) return false;
    if (
      isSmartPlaceMatch(route.destination, placeText) ||
      isSmartPlaceMatch(route.destinationDetails, placeText) ||
      isSmartPlaceMatch(route.boardingHint, placeText)
    ) {
      return true;
    }
    return false;
  };

  // محلل الجمل لاستخراج (من) و (إلى) بدقة عالية
  const parseTransitQuery = (text) => {
    const cleanText = text.replace(/[؟?.,،]/g, ' ').replace(/\s+/g, ' ').trim();

    const p1 = /(?:رايح|اروح|اسافر|عايز اروح|ازاي اروح|مواصلات|اركب ايه ل|طريق)\s+(.+?)\s+(?:من|وانا في|مكاني في)\s+(.+)/;
    const m1 = cleanText.match(p1);
    if (m1) return { dest: m1[1].trim(), origin: m1[2].trim() };

    const p2 = /(?:من|انا في|متواجد في|مكاني)\s+(.+?)\s+(?:الى|إلى|لـ|ل|عايز اروح|رايح|لحد|اتجاه)\s+(.+)/;
    const m2 = cleanText.match(p2);
    if (m2) return { origin: m2[1].trim(), dest: m2[2].trim() };

    const p3 = /(?:عايز اروح|ازاي اروح|رايح|سافر|مواصلات ل|اروح)\s+(.+)/;
    const m3 = cleanText.match(p3);
    if (m3) return { origin: null, dest: m3[1].trim() };

    const p4 = /(?:انا في|مكاني في|اقرب موقف ل|اقرب نقطه ل|موقف في)\s+(.+)/;
    const m4 = cleanText.match(p4);
    if (m4) return { origin: m4[1].trim(), dest: null };

    return { origin: null, dest: null };
  };

  // ============================================================================
  // العقل الجغرافي والشبكي الجديد لـ "بيسو" (100% من داتا الأدمن الحية)
  // ============================================================================
  const generateBesoResponse = (queryText) => {
    const normQuery = normalizeArabic(queryText);

    // 1. لو المستخدم سأل عن النقاط التبادلية المتسجلة
    if (normQuery.includes('النقاط التبادليه') || normQuery.includes('نقط التبديل')) {
      const hubs = approvedStations.filter(s => s.nodeType === 'hub' || s.transferHint);
      if (hubs.length === 0) {
        return {
          text: `حالياً مفيش نقاط متصنفة كـ "نقطة تبادلية 🔄" في لوحة التحكم.\nتقدر كأدمن تفتح (خريطة GIS) أو تضغط على أي موقف وتغير نوعه لـ (نقطة تبادلية 🔄) وتكتب فيه إرشاد التبديل وهيظهرلي هنا فوراً!`,
          queryContext: queryText
        };
      }
      const hubsText = hubs.map((h, i) => `${i + 1}. **${h.name}** (${h.location})${h.transferHint ? `\n   💡 التحويلة: ${h.transferHint}` : ''}`).join('\n');
      return {
        text: `🔄 **النقاط التبادلية والتقاطعات المسجلة حالياً في النظام (${hubs.length}):**\n\n${hubsText}`,
        matchedStations: hubs.slice(0, 4),
        queryContext: queryText
      };
    }

    // 2. فحص التوجيهات المباشرة المعتمدة من الأدمن في (beso_knowledge_updates)
    const directCustomGuides = customGuides.filter(cg => {
      if (cg.status !== 'approved') return false;
      const kwParts = String(cg.placeKeywords || '').split(/[-،,]/).map(s => s.trim()).filter(Boolean);
      return kwParts.length > 0 && kwParts.every(part => isSmartPlaceMatch(queryText, part));
    });

    if (directCustomGuides.length > 0 && !normQuery.includes('فكره التطبيق')) {
      const topGuide = directCustomGuides[0];
      return {
        text: `📌 **إرشاد مباشر معتمد لـ (${topGuide.placeKeywords}):**\n\n${topGuide.correctedInfo}`,
        queryContext: queryText
      };
    }

    // 3. فحص التحيات والأسئلة العامة
    const matchedIntent = BESO_CONVERSATIONAL_INTENTS.find(intent =>
      intent.keywords.some(kw => normQuery.includes(normalizeArabic(kw)))
    );
    const isTransitWords = ['اروح', 'مواصلات', 'طريق', 'خط', 'موقف', 'من', 'الى', 'رايح', 'انا في', 'اقرب'].some(w => normQuery.includes(w));
    if (matchedIntent && (!isTransitWords || matchedIntent.id === 'app_purpose')) {
      const reply = matchedIntent.replies[Math.floor(Math.random() * matchedIntent.replies.length)];
      return { text: reply, queryContext: queryText };
    }

    // 4. استخراج (الانطلاق o) و (الوصول d)
    const parsed = parseTransitQuery(normQuery);
    let o = parsed.origin;
    let d = parsed.dest;

    if (conversationContext.expectingOriginFor) {
      d = conversationContext.expectingOriginFor;
      o = o || queryText.trim();
      setConversationContext({ expectingOriginFor: null, expectingDestFor: null });
    } else if (conversationContext.expectingDestFor) {
      o = conversationContext.expectingDestFor;
      d = d || queryText.trim();
      setConversationContext({ expectingOriginFor: null, expectingDestFor: null });
    } else if (d && !o) {
      if (userAreas && userAreas.length > 0) {
        o = userAreas[0];
      } else {
        setConversationContext({ expectingOriginFor: d, expectingDestFor: null });
        return {
          text: `تمام، عشان أطلعلك خط السير أو نقطة التبديل لـ **(${d})** بدقة 📍\nقولي أنت هتركب منين دلوقتي؟ (مثال: من الصحراوي، أو من الدقي)`,
          queryContext: queryText
        };
      }
    } else if (o && !d) {
      const originCoords = getPlaceCoords(o);
      const nearbyNodes = approvedStations
        .map((st, idx) => {
          const stCoords = getPlaceCoords(st, idx + 1);
          const dist = getDistanceKm(originCoords[0], originCoords[1], stCoords[0], stCoords[1]);
          const textMatch = doesNodeMatchPlace(st, o, 3);
          return { ...st, distanceKm: textMatch ? Math.min(dist, 0.8) : dist, textMatch };
        })
        .filter(st => st.textMatch || st.distanceKm <= 12)
        .sort((a, b) => a.distanceKm - b.distanceKm)
        .slice(0, 4);

      setConversationContext({ expectingDestFor: o, expectingOriginFor: null });
      const listStr = nearbyNodes.length > 0
        ? `\n\n📍 **المواقف والنقاط القريبة من (${o}):**\n` + nearbyNodes.map(s => `• **${s.name}** (${s.nodeType === 'hub' ? 'نقطة تبادلية 🔄' : 'موقف 🚏'})`).join('\n')
        : '';

      return {
        text: `أنت في **(${o})** 👍${listStr}\n\nقولي بقى رايح فين عشان أربطلك الخطوط؟`,
        matchedStations: nearbyNodes,
        queryContext: queryText
      };
    }

    // 5. لو المستخدم كتب اسم مكان واحد فقط بدون (من/إلى)، نبحث في كل المواقف والخطوط اللي بتروح المكان ده أو تطلع منه
    if (!o && !d) {
      const matchingNodes = approvedStations.filter(st =>
        doesNodeMatchPlace(st, queryText, 2) ||
        (st.routes || []).some(r => (isAdmin || r.status !== 'pending') && doesRouteReachPlace(r, queryText))
      );

      if (matchingNodes.length > 0) {
        const lines = [];
        matchingNodes.slice(0, 4).forEach(st => {
          const matchingRoutes = (st.routes || []).filter(r => (isAdmin || r.status !== 'pending') && doesRouteReachPlace(r, queryText));
          if (matchingRoutes.length > 0) {
            matchingRoutes.forEach(r => {
              lines.push(`• من **${st.name}** (${st.location}) ⬅️ اركب خط **${r.destinationDetails || r.destination}** (${r.fare} ج)${r.boardingHint ? `\n  📍 تركب من: ${r.boardingHint}` : ''}${st.transferHint ? `\n  💡 ملاحظة المكان: ${st.transferHint}` : ''}`);
            });
          } else {
            lines.push(`• **${st.name}** (${st.location}) — متسجل فيه ${(st.routes || []).length} خطوط سير${st.transferHint ? `\n  💡 إرشاد التبديل: ${st.transferHint}` : ''}`);
          }
        });

        return {
          text: `🔍 **نتائج البحث في داتا المواقف والنقاط التبادلية عن (${queryText}):**\n\n${lines.join('\n\n')}`,
          matchedStations: matchingNodes.slice(0, 4),
          queryContext: queryText
        };
      }
    }

    // ============================================================================
    // 6. محرك المسارات الذكي (مباشر + ترانزيت عبر النقاط التبادلية Multi-Leg)
    // ============================================================================
    if (o && d) {
      const originNodes = approvedStations.filter(st => doesNodeMatchPlace(st, o, 6));
      const directRoutes = [];
      const transferRoutes = [];
      const hubDirectRoutes = [];

      // أ) البحث عن خط مباشر (Direct Route: Origin -> Destination)
      originNodes.forEach(st => {
        (st.routes || []).forEach(r => {
          if (!isAdmin && r.status === 'pending') return;
          if (doesRouteReachPlace(r, d)) {
            directRoutes.push({ station: st, route: r });
          }
        });
      });

      // ب) البحث عن مسار بمرحلتين عبر نقطة تبادلية (Two-Leg Transfer: Origin -> Hub -> Destination)
      // يفحص إذا كان موقف الانطلاق يودي لنقطة تانية (أو نقطة تبادلية)، والنقطة دي فيها خط بيودي للوجهة (d)
      originNodes.forEach(stA => {
        (stA.routes || []).forEach(r1 => {
          if (!isAdmin && r1.status === 'pending') return;
          const leg1Target = r1.destinationDetails || r1.destination;

          // إيجاد النقطة التبادلية أو الموقف الوسيط (stB) الذي يطابق وجهة الخط الأول
          approvedStations.forEach(stB => {
            if (stB.id === stA.id) return;
            const isHubMatch =
              isSmartPlaceMatch(stB.name, leg1Target) ||
              isSmartPlaceMatch(stB.location, leg1Target) ||
              (r1.destinationDetails && isSmartPlaceMatch(stB.name, r1.destinationDetails));

            if (isHubMatch) {
              (stB.routes || []).forEach(r2 => {
                if (!isAdmin && r2.status === 'pending') return;
                if (doesRouteReachPlace(r2, d)) {
                  transferRoutes.push({
                    fromStation: stA,
                    leg1Route: r1,
                    hubStation: stB,
                    leg2Route: r2
                  });
                }
              });
            }
          });
        });
      });

      // ج) حالة إضافية مهمة جداً (مثال الصحراوي -> محور 26 يوليو -> الحصري):
      // إذا كان المستخدم لم يسجل "موقف الصحراوي" كموقف مستقل، لكنه سجل "تقاطع محور 26 يوليو" كنقطة تبادلية تقع في/قرب الصحراوي أو مذكور في إرشادها كلمة "الصحراوي"، وطالع منها خط لـ "الحصري/أكتوبر"!
      approvedStations.forEach(hubNode => {
        const hubMatchesOriginContext =
          isSmartPlaceMatch(hubNode.transferHint, o) ||
          isSmartPlaceMatch(hubNode.name, o) ||
          isSmartPlaceMatch(hubNode.location, o);

        (hubNode.routes || []).forEach(r => {
          if (!isAdmin && r.status === 'pending') return;
          const routeBoardingMatchesOrigin = isSmartPlaceMatch(r.boardingHint, o);
          if ((hubMatchesOriginContext || routeBoardingMatchesOrigin) && doesRouteReachPlace(r, d)) {
            if (!directRoutes.some(dr => dr.station.id === hubNode.id && dr.route === r)) {
              hubDirectRoutes.push({ hub: hubNode, route: r });
            }
          }
        });
      });

      // د) البحث الجغرافي عن أقرب نقطة تبادلية في الطريق بين (o) و (d) بها خط يذهب إلى (d)
      if (directRoutes.length === 0 && transferRoutes.length === 0 && hubDirectRoutes.length === 0) {
        const oCoords = getPlaceCoords(o);
        approvedStations.forEach(stB => {
          (stB.routes || []).forEach(r2 => {
            if (!isAdmin && r2.status === 'pending') return;
            if (doesRouteReachPlace(r2, d)) {
              const stBCoords = getPlaceCoords(stB);
              const distFromO = getDistanceKm(oCoords[0], oCoords[1], stBCoords[0], stBCoords[1]);
              if (distFromO <= 18) {
                hubDirectRoutes.push({ hub: stB, route: r2, distKm: distFromO });
              }
            }
          });
        });
      }

      // ================== صياغة الرد الذكي للمستخدم ==================
      const replyBlocks = [];
      const relatedStations = [];

      // 1. عرض الخط المباشر إن وجد
      if (directRoutes.length > 0) {
        replyBlocks.push(`🎯 **خط مباشر من (${o}) إلى (${d}):**`);
        directRoutes.slice(0, 3).forEach((item, idx) => {
          if (!relatedStations.some(s => s.id === item.station.id)) relatedStations.push(item.station);
          const rTitle = item.route.destinationDetails ? `${item.route.destinationDetails} (${item.route.destination})` : item.route.destination;
          const transferNote = item.station.transferHint ? `\n   💡 **إرشاد المكان:** ${item.station.transferHint}` : '';
          const boardingNote = item.route.boardingHint ? `\n   📍 **تركب منين:** ${item.route.boardingHint}` : '';
          replyBlocks.push(
            `${idx + 1}️⃣ من **${item.station.name}** (${item.station.location}) ⬅️ اركب خط **${rTitle}** — الأجرة: **${item.route.fare} ج**${transferNote}${boardingNote}`
          );
        });
      }

      // 2. عرض خط التبديل على مرحلتين (Multi-Leg Transfer) إن وجد
      if (transferRoutes.length > 0) {
        replyBlocks.push(`🔄 **خط سير بالتبديل في نقطة تبادلية (مرحلتين):**`);
        transferRoutes.slice(0, 2).forEach((tr) => {
          if (!relatedStations.some(s => s.id === tr.fromStation.id)) relatedStations.push(tr.fromStation);
          if (!relatedStations.some(s => s.id === tr.hubStation.id)) relatedStations.push(tr.hubStation);

          const leg1Name = tr.leg1Route.destinationDetails || tr.leg1Route.destination;
          const leg2Name = tr.leg2Route.destinationDetails ? `${tr.leg2Route.destinationDetails} (${tr.leg2Route.destination})` : tr.leg2Route.destination;
          const totalFare = (Number(tr.leg1Route.fare) || 0) + (Number(tr.leg2Route.fare) || 0);

          const hubInstruction = tr.hubStation.transferHint
            ? `\n🚶‍♂️ **التحويلة في (${tr.hubStation.name}):** ${tr.hubStation.transferHint}`
            : `\n🚶‍♂️ **التحويلة:** انزل في **(${tr.hubStation.name})** وبدّل للخط التاني.`;

          const leg2Boarding = tr.leg2Route.boardingHint
            ? ` *(اركب من: ${tr.leg2Route.boardingHint})*`
            : '';

          replyBlocks.push(
            `1️⃣ **المرحلة الأولى:** من **${tr.fromStation.name}** اركب خط **(${leg1Name})** — الأجرة: ${tr.leg1Route.fare} ج.` +
            `${hubInstruction}\n` +
            `2️⃣ **المرحلة الثانية:** من **${tr.hubStation.name}** اركب خط **(${leg2Name})**${leg2Boarding} — الأجرة: ${tr.leg2Route.fare} ج.\n` +
            `💰 **إجمالي الأجرة التقريبية:** ${totalFare} ج.`
          );
        });
      }

      // 3. عرض النقاط التبادلية التي تربط الطريق مباشرة (مثل تقاطع محور 26 يوليو)
      if (directRoutes.length === 0 && transferRoutes.length === 0 && hubDirectRoutes.length > 0) {
        replyBlocks.push(`🔄 **أقرب نقطة تبادلية توصلّك من (${o}) إلى (${d}):**`);
        hubDirectRoutes.slice(0, 3).forEach((item) => {
          if (!relatedStations.some(s => s.id === item.hub.id)) relatedStations.push(item.hub);
          const rTitle = item.route.destinationDetails ? `${item.route.destinationDetails} (${item.route.destination})` : item.route.destination;
          const hubHint = item.hub.transferHint ? `\n🚶‍♂️ **إزاي تبدل وتركب:** ${item.hub.transferHint}` : '';
          const boardHint = item.route.boardingHint ? `\n📍 **مكان الركوب بالظبط:** ${item.route.boardingHint}` : '';

          replyBlocks.push(
            `• انزل عند **${item.hub.name}** (${item.hub.location})${hubHint}${boardHint}\n` +
            `🚐 ومن هناك اركب خط **${rTitle}** — الأجرة: **${item.route.fare} ج**.`
          );
        });
      }

      // 4. إذا لم يجد أي خط مسجل في داتا الأدمن لهذه الوجهة بعد
      if (replyBlocks.length === 0) {
        replyBlocks.push(
          `🤔 دورت في المواقف والنقاط التبادلية المسجلة حالياً على خط بيربط **(${o})** بـ **(${d})** وملقتش النقطة دي متسجلة لسه.\n\n` +
          `💡 **بما إنك بتبني الداتا:** تقدر تفتح (مواقف مصر) أو (خريطة GIS في لوحة الأدمن) وتضيف النقطة التبادلية أو الخط ده، أو تضغط **(✏️ تعديل المعلومة)** تحت رسالتي وتكتبه وهيشتغل معايا فوراً في نفس اللحظة! 🚀`
        );
      }

      return {
        text: replyBlocks.join('\n\n'),
        matchedStations: relatedStations.slice(0, 4),
        queryContext: `من ${o} إلى ${d}`
      };
    }

    return {
      text: `قولي يا بطل أنت فين ورايح فين؟ مثلاً: **"من الصحراوي لأكتوبر"** أو **"من الدقي للحصري"** وهطلعلك خط السير ونقط التبديل من داتا التطبيق فوراً! 🚀`,
      queryContext: queryText
    };
  };

  const handleSend = (textToProcess) => {
    const cleanText = (textToProcess || input).trim();
    if (!cleanText) return;

    const userMsg = { id: Date.now() + '_u', sender: 'user', text: cleanText };
    setMessages(prev => [...prev, userMsg]);
    setInput('');

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
    }, 350);
  };

  const handleSubmitCorrection = async (e) => {
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

      setCorrectionSuccessMsg(userIsAdmin ? 'تم الحفظ والاعتماد فوراً في ذاكرة بيسو! ✅' : 'شكراً! تم الإرسال للإدارة للمراجعة ⏳');
      setTimeout(() => {
        setCorrectingMsgId(null); setCorrectionPlace(''); setCorrectionText(''); setCorrectionSuccessMsg('');
      }, 1800);
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
        className={`fixed bottom-[82px] left-3 right-3 sm:left-6 sm:right-auto sm:w-[410px] h-[66dvh] max-h-[550px] min-h-[350px] z-[200] ${bgCard} backdrop-blur-xl rounded-3xl shadow-[0_12px_45px_rgba(0,0,0,0.45)] flex flex-col overflow-hidden border animate-fade-in-up`}
      >
        <div className="px-4 py-3 bg-indigo-600 text-white flex items-center justify-between shadow-sm shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-white/20 backdrop-blur-md flex items-center justify-center border border-white/30 relative shrink-0">
              <Bot size={20} className="text-white" />
              <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-400 rounded-full border-2 border-indigo-700"></span>
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h3 className="font-black text-sm">المساعد الذكي "بيسو"</h3>
                <span className="text-xs font-black bg-amber-400 text-slate-950 px-1.5 py-0.5 rounded-full flex items-center gap-0.5"><Sparkles size={9}/> Live GIS</span>
              </div>
              <p className="text-xs text-indigo-100 font-bold">يربط المواقف والنقاط التبادلية لحظياً 🧠</p>
            </div>
          </div>
          <button aria-label="إغلاق" onClick={onClose} className="p-2.5 bg-white/15 hover:bg-rose-500 rounded-full transition-colors"><X size={18} /></button>
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
                      className={`text-xs font-black flex items-center gap-1 px-2 py-1.5 rounded-lg border transition-all ${
                        isEditingThis ? 'bg-amber-500 text-slate-950 border-amber-400' : (isDarkMode ? 'bg-slate-800/80 border-slate-700 text-amber-400' : 'bg-amber-50 border-amber-200 text-amber-700')
                      }`}
                    >
                      <Edit3 size={11} /> {isEditingThis ? 'إغلاق التعديل' : '✏️ إضافة أو تعديل إرشاد مباشر لبيسو'}
                    </button>
                  )}

                  {isBeso && isEditingThis && (
                    <form onSubmit={(e) => handleSubmitCorrection(e, msg)} className={`w-full p-3 rounded-2xl border-2 border-amber-500/40 space-y-2 animate-fade-in-up ${isDarkMode ? 'bg-slate-900 text-white' : 'bg-amber-50 text-slate-900'}`}>
                      <span className="text-xs font-black text-amber-500 flex items-center gap-1"><PlusCircle size={13}/> تعليم بيسو خط أو تحويلة جديدة:</span>
                      {correctionSuccessMsg ? (
                        <div className="p-2.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-500 text-xs font-black">{correctionSuccessMsg}</div>
                      ) : (
                        <>
                          <input type="text" required value={correctionPlace} onChange={(e) => setCorrectionPlace(e.target.value)} placeholder="الكلمات المفتاحية (مثال: الصحراوي - أكتوبر)" className={`w-full px-3 py-2 rounded-xl border text-xs font-bold outline-none ${bgInput}`}/>
                          <textarea rows={2} required value={correctionText} onChange={(e) => setCorrectionText(e.target.value)} placeholder="اكتب التحويلة بالتفصيل (مثال: انزل تحت محور 26 يوليو واطلع اركب من فوق للحصري)..." className={`w-full px-3 py-2 rounded-xl border text-xs font-bold outline-none resize-none ${bgInput}`}/>
                          <div className="flex gap-1.5">
                            <button type="submit" disabled={isSubmittingCorrection} className="flex-1 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 rounded-xl text-xs font-black">{isSubmittingCorrection ? 'جاري الحفظ...' : 'حفظ في ذاكرة بيسو'}</button>
                            <button type="button" onClick={() => setCorrectingMsgId(null)} className="px-3 py-2 rounded-xl bg-slate-200 dark:bg-slate-800 text-xs font-bold">إلغاء</button>
                          </div>
                        </>
                      )}
                    </form>
                  )}

                  {isBeso && msg.matchedStations && msg.matchedStations.length > 0 && (
                    <div className="w-full space-y-1.5 mt-0.5">
                      <span className="text-xs font-black text-indigo-400 px-1 flex items-center gap-1"><Compass size={11}/> النقاط المرتبطة بالمسار (اضغط لفتح التفاصيل):</span>
                      {msg.matchedStations.map((st) => (
                        <button key={st.id} onClick={() => { onClose(); onSelectStation(st); }} className={`w-full p-2 rounded-xl border flex items-center justify-between hover:border-indigo-500 ${isDarkMode ? 'bg-slate-900 border-slate-700 text-white' : 'bg-indigo-50/70 border-indigo-200 text-slate-900'}`}>
                          <div className="flex items-center gap-2">
                            <div className={`p-1.5 rounded-lg text-white ${st.nodeType === 'hub' ? 'bg-amber-600' : 'bg-indigo-600'}`}><BusFront size={13}/></div>
                            <div className="text-right">
                              <h4 className="text-xs font-black">{st.name}</h4>
                              <p className="text-xs text-slate-400 font-bold">
                                {st.nodeType === 'hub' ? 'نقطة تبادلية 🔄' : 'موقف 🚏'} • {st.location}
                              </p>
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
            <button key={idx} onClick={() => handleSend(q)} className={`shrink-0 text-xs font-black px-2.5 py-1 rounded-full border ${isDarkMode ? 'bg-slate-800 border-slate-700 text-indigo-300 hover:bg-indigo-600 hover:text-white' : 'bg-indigo-50 border-indigo-200 text-indigo-700 hover:bg-indigo-600 hover:text-white'}`}>
              {q}
            </button>
          ))}
        </div>

        <form onSubmit={(e) => { e.preventDefault(); handleSend(); }} className={`p-2.5 shrink-0 flex items-center gap-2 border-t ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}>
          <input type="text" value={input} onChange={(e) => setInput(e.target.value)} placeholder="مثال: من الصحراوي لأكتوبر..." className={`flex-1 px-3.5 py-2.5 rounded-xl border text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500 ${bgInput}`}/>
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