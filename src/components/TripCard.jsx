import React, { useState, useEffect } from 'react';
import { doc, deleteDoc, getDoc } from 'firebase/firestore';
import {
  Trash2, Share2, ShieldCheck, Star, Clock, Car, Package, CheckCircle2,
  Phone, MessageCircle, Route, Handshake, Users, Flame, Lock
} from 'lucide-react';
import { db, APP_COLLECTION_NAME, USERS_COLLECTION } from '../firebase';
import { formatTripDateTime, getSeatsText } from '../utils/helpers';

/*
  TripCard v2 — نفس الـ props ونفس المنطق (Firestore / الاتصال / واتساب / التفاوض)،
  التغيير في الشكل فقط:
  - أصغر خط 12px (كان 8–10px)
  - المسار كخط زمني رأسي (من ← إلى) بدل سطر واحد مزدحم
  - السعر والموعد أوضح، وزر "تواصل" هو الزر الرئيسي الوحيد
  - أزرار بحجم لمس 44px مع aria-label
  - كارت "بنات فقط" بشريط جانبي وردي بدل تغيير ألوان الكارت كله
  - إيموجي أقل: أيقونات بدلها
*/

const PREFERENCE_LABELS = {
  ac: 'تكييف',
  noSmoking: 'منع التدخين',
  luggage: 'شنط',
  families: 'عائلات'
};

const TripCard = ({
  trip, user, isAdmin, isDarkMode, openChatFromTrip, triggerToast,
  matchBadge, onOpenPublicProfile, compact = false
}) => {
  const isOwner = user?.uid === trip?.userId;
  const isCompleted = trip?.status === 'completed';
  const isFull = trip?.status === 'full';
  const isFemalesOnly = Boolean(trip?.preferences?.femalesOnly);
  const isRequest = trip?.type === 'request';
  const joinedMembers = Array.isArray(trip?.joinedMembers) ? trip.joinedMembers : [];

  const [contactPhone, setContactPhone] = useState(trip?.userPhone || '');
  const [liveVerified, setLiveVerified] = useState(Boolean(trip?.verified));
  const [liveBadge, setLiveBadge] = useState(trip?.userBadge || null);
  const [liveRating, setLiveRating] = useState(Number(trip?.rating || 0));
  const [liveReviewsCount, setLiveReviewsCount] = useState(0);
  const [liveCarModel, setLiveCarModel] = useState(trip?.carModel || '');
  const [liveCarColor, setLiveCarColor] = useState(trip?.carColor || '');

  useEffect(() => {
    setLiveVerified(Boolean(trip?.verified));
    setLiveBadge(trip?.userBadge || null);
  }, [trip?.verified, trip?.userBadge]);

  useEffect(() => {
    if (!trip?.userId) return;
    let isMounted = true;
    getDoc(doc(db, USERS_COLLECTION, trip.userId))
      .then((snap) => {
        if (isMounted && snap.exists()) {
          const uData = snap.data();
          if (!trip?.userPhone && trip?.allowPhoneContact !== false && uData?.phone) {
            setContactPhone(uData.phone);
          }
          if (typeof uData?.isVerified === 'boolean') setLiveVerified(uData.isVerified);
          if (uData?.customBadge !== undefined) setLiveBadge(uData.customBadge);
          if (uData?.rating !== undefined) setLiveRating(Number(uData.rating));
          if (Array.isArray(uData?.reviews)) setLiveReviewsCount(uData.reviews.length);
          else if (uData?.ratingsCount) setLiveReviewsCount(Number(uData.ratingsCount));
          if (!trip?.carModel && uData?.carModel) {
            setLiveCarModel(uData.carModel);
            setLiveCarColor(uData.carColor || '');
          }
        }
      })
      .catch(() => {});
    return () => { isMounted = false; };
  }, [trip?.userPhone, trip?.userId, trip?.allowPhoneContact, trip?.carModel]);

  // مهم: الـ return المبكر بعد كل الـ hooks (قواعد React)
  if (!trip) return null;

  const contactMethod = trip?.contactMethod || (trip?.allowPhoneContact === false ? 'chat' : 'both');
  const hasValidPhone = Boolean(contactPhone && String(contactPhone).trim());
  const canCall = hasValidPhone && (contactMethod === 'both' || contactMethod === 'phone');
  const canWhatsapp = hasValidPhone && (contactMethod === 'both' || contactMethod === 'whatsapp');

  const getWhatsAppUrl = (rawPhone) => {
    const clean = String(rawPhone).replace(/\D/g, '');
    const intlPhone = clean.startsWith('20') ? clean : clean.startsWith('0') ? `2${clean}` : `20${clean}`;
    const msg = `مرحباً ${trip?.userName?.split(' ')[0] || 'كابتن'}، تواصلت معك عبر تطبيق (طريقنا) بخصوص رحلة: ${trip?.from} ➔ ${trip?.to}`;
    return `https://wa.me/${intlPhone}?text=${encodeURIComponent(msg)}`;
  };

  const getRemainingTimeBadge = () => {
    if (!trip?.date || !trip?.time || isCompleted) return null;
    try {
      const tripTime = new Date(`${trip.date}T${trip.time}`).getTime();
      const diffHours = (tripTime - Date.now()) / (1000 * 3600);
      if (diffHours > 0 && diffHours < 1) return { text: `خلال ${Math.max(5, Math.round(diffHours * 60))} دقيقة`, urgent: true };
      if (diffHours >= 1 && diffHours <= 6) return { text: `باقي ${Math.round(diffHours)} ساعة`, urgent: false };
      return null;
    } catch (e) {
      return null;
    }
  };
  const countdown = getRemainingTimeBadge();

  const price = trip.cost || trip.price || trip.fare || null;

  const handleDelete = async (e) => {
    e.stopPropagation();
    try {
      await deleteDoc(doc(db, APP_COLLECTION_NAME, trip.id));
      triggerToast('تم الحذف بنجاح');
    } catch (err) {
      triggerToast('حدث خطأ أثناء الحذف');
    }
  };

  const handleShare = (e) => {
    e.stopPropagation();
    const routeStr = Array.isArray(trip?.routeAreas) && trip.routeAreas.length > 0 ? `\n🛣️ يمر بـ: ${trip.routeAreas.join(' - ')}` : '';
    const carStr = liveCarModel ? `\n🚘 السيارة: ${liveCarModel} ${liveCarColor ? `(${liveCarColor})` : ''}` : '';
    const text = `🚗 رحلة على تطبيق (طريقنا)${isFemalesOnly ? ' (بنات فقط 👩)' : ''}\n📍 من: ${trip.from}\n🏁 إلى: ${trip.to}${routeStr}${carStr}\n⏰ الموعد: ${formatTripDateTime(trip.date, trip.time)}\n💺 التكلفة: ${price ? price + ' ج' : 'غير محدد'}`;
    if (navigator.share) {
      navigator.share({ title: 'طريقنا', text }).catch(() => {});
    } else {
      window.open(`https://wa.me/?text=${encodeURIComponent(text)}`);
    }
  };

  const activePreferences = trip.preferences
    ? Object.keys(trip.preferences).filter((k) => trip.preferences[k] && k !== 'femalesOnly' && PREFERENCE_LABELS[k])
    : [];
  const routeAreas = Array.isArray(trip?.routeAreas) ? trip.routeAreas : [];

  // ---------- الألوان ----------
  const accentText = isFemalesOnly ? 'text-pink-500' : 'text-indigo-500';
  const accentSolid = isFemalesOnly ? 'bg-pink-600 hover:bg-pink-700' : 'bg-indigo-600 hover:bg-indigo-700';
  const stripe = (isCompleted || isFull)
    ? 'border-r-slate-300 dark:border-r-slate-700'
    : isFemalesOnly ? 'border-r-pink-500' : 'border-r-indigo-500';

  const surface = isDarkMode
    ? (isFemalesOnly ? 'bg-pink-950/20 border-slate-800' : 'bg-slate-900 border-slate-800')
    : (isFemalesOnly ? 'bg-pink-50/50 border-slate-200' : 'bg-white border-slate-200');
  const textPrimary = isDarkMode ? 'text-white' : 'text-slate-900';
  const textSecondary = isDarkMode ? 'text-slate-400' : 'text-slate-500';
  const chip = isDarkMode ? 'bg-slate-800 text-slate-200' : 'bg-slate-100 text-slate-700';
  const iconBtn = isDarkMode
    ? 'bg-slate-800 text-slate-300 hover:bg-slate-700 border border-slate-700'
    : 'bg-white text-slate-700 hover:bg-slate-50 border border-slate-200';

  const canOpen = !isOwner && !isCompleted && !isFull;
  const openChat = () => canOpen && openChatFromTrip(trip);
  const pad = compact ? 'p-3 gap-3' : 'p-4 gap-3.5';

  return (
    <article
      role={canOpen ? 'button' : undefined}
      tabIndex={canOpen ? 0 : undefined}
      onClick={openChat}
      onKeyDown={(e) => { if (canOpen && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); openChat(); } }}
      className={`relative flex flex-col ${pad} rounded-2xl border border-r-4 ${stripe} ${surface} shadow-sm transition-shadow hover:shadow-md ${canOpen ? 'cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500' : ''} ${(isCompleted || isFull) ? 'opacity-70' : ''}`}
    >
      {/* ===== 1) الكابتن + السعر ===== */}
      <header className="flex items-start justify-between gap-3">
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); if (onOpenPublicProfile && trip?.userId) onOpenPublicProfile(trip.userId); }}
          aria-label="عرض البروفايل وآراء الأعضاء"
          className="flex items-center gap-2.5 min-w-0 text-right"
        >
          <span className="relative shrink-0">
            {trip?.userPhoto ? (
              <img src={trip.userPhoto} alt="" className="w-10 h-10 rounded-full object-cover" />
            ) : (
              <span className={`w-10 h-10 rounded-full flex items-center justify-center font-black text-sm ${isFemalesOnly ? 'bg-pink-100 text-pink-700' : 'bg-indigo-100 text-indigo-700'}`}>
                {(trip?.userName || 'م').charAt(0)}
              </span>
            )}
            {liveVerified && (
              <span className="absolute -bottom-0.5 -left-0.5 bg-emerald-500 text-white p-0.5 rounded-full ring-2 ring-white dark:ring-slate-900">
                <ShieldCheck size={11} aria-label="حساب موثق" />
              </span>
            )}
          </span>

          <span className="min-w-0">
            <span className="flex items-center gap-1.5">
              <span className={`text-sm font-black truncate max-w-[140px] ${textPrimary}`}>
                {trip?.userName?.split(' ').slice(0, 2).join(' ') || 'مستخدم'}
              </span>
              {liveBadge && (
                <span className="text-xs font-bold px-1.5 rounded bg-amber-400/15 text-amber-600 dark:text-amber-400 shrink-0">
                  {liveBadge}
                </span>
              )}
            </span>
            <span className={`flex items-center gap-1 text-xs font-bold mt-0.5 ${textSecondary}`}>
              <Star size={12} className="fill-amber-400 text-amber-400" />
              {liveRating > 0 ? liveRating.toFixed(1) : 'جديد'}
              {liveReviewsCount > 0 && <span className="font-medium">({liveReviewsCount})</span>}
            </span>
          </span>
        </button>

        <div className="flex flex-col items-end shrink-0">
          {price ? (
            <p className="leading-none text-emerald-600 dark:text-emerald-400">
              <span className="text-xl font-black">{price}</span>
              <span className="text-xs font-bold me-0.5"> ج</span>
            </p>
          ) : (
            <p className={`text-xs font-bold ${textSecondary}`}>السعر غير محدد</p>
          )}
          <p className={`text-xs mt-1 ${textSecondary}`}>
            {trip?.category === 'parcel' ? 'للطرد' : 'للمقعد'}
          </p>
        </div>
      </header>

      {/* ===== 2) المسار كخط زمني ===== */}
      <div className="flex gap-3">
        <div className="flex flex-col items-center py-1.5" aria-hidden="true">
          <span className={`w-3 h-3 rounded-full border-2 ${isFemalesOnly ? 'border-pink-500' : 'border-indigo-500'}`} />
          <span className={`flex-1 w-0.5 my-1 min-h-[20px] ${isDarkMode ? 'bg-slate-700' : 'bg-slate-200'}`} />
          <span className={`w-3 h-3 rounded-full ${isFemalesOnly ? 'bg-pink-500' : 'bg-indigo-500'}`} />
        </div>

        <div className="flex-1 min-w-0 flex flex-col gap-2.5">
          <div className="min-w-0">
            <p className={`text-base font-black leading-snug ${textPrimary}`}>{trip?.from || 'غير محدد'}</p>
            {trip?.fromDetails && <p className={`text-xs truncate ${textSecondary}`}>{trip.fromDetails}</p>}
          </div>
          <div className="min-w-0">
            <p className={`text-base font-black leading-snug ${textPrimary}`}>{trip?.to || 'غير محدد'}</p>
            {trip?.toDetails && <p className={`text-xs truncate ${textSecondary}`}>{trip.toDetails}</p>}
          </div>
        </div>
      </div>

      {/* ===== 3) الموعد + المقاعد + الحالة ===== */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <span className={`inline-flex items-center gap-1.5 text-sm font-bold ${textPrimary}`}>
          <Clock size={15} className={accentText} />
          {formatTripDateTime(trip?.date, trip?.time)}
        </span>

        {countdown && (
          <span className={`inline-flex items-center gap-1 text-xs font-black px-2 py-0.5 rounded-full ${countdown.urgent ? 'bg-rose-500/15 text-rose-600 dark:text-rose-400' : 'bg-amber-500/15 text-amber-700 dark:text-amber-400'}`}>
            {countdown.urgent && <Flame size={12} />} {countdown.text}
          </span>
        )}

        <span className={`inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full ${isFull ? 'bg-rose-500/15 text-rose-600 dark:text-rose-400' : isRequest ? 'bg-amber-500/15 text-amber-700 dark:text-amber-400' : chip}`}>
          {trip?.category === 'parcel' ? <Package size={12} /> : <Car size={12} />}
          {isFull ? 'اكتمل العدد' : getSeatsText(trip?.seats, trip?.category)}
        </span>

        {isFemalesOnly && (
          <span className="text-xs font-black px-2 py-0.5 rounded-full bg-pink-600 text-white">بنات فقط</span>
        )}
        {matchBadge && (
          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${/قريباً/.test(matchBadge) ? 'bg-rose-500/15 text-rose-600 dark:text-rose-400' : 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400'}`}>
            {matchBadge}
          </span>
        )}
      </div>

      {/* ===== 4) تفاصيل إضافية (تظهر فقط لو موجودة) ===== */}
      {(routeAreas.length > 0 || liveCarModel || activePreferences.length > 0) && (
        <div className="flex flex-wrap items-center gap-1.5">
          {routeAreas.map((area, i) => (
            <span key={i} className={`inline-flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-lg ${chip}`}>
              <Route size={12} className="text-indigo-500" /> {area}
            </span>
          ))}
          {liveCarModel && (
            <span className={`inline-flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-lg ${chip}`}>
              <Car size={12} /> {liveCarModel}{liveCarColor ? ` (${liveCarColor})` : ''}
            </span>
          )}
          {activePreferences.map((key) => (
            <span key={key} className={`text-xs font-bold px-2 py-1 rounded-lg ${chip}`}>
              {PREFERENCE_LABELS[key]}
            </span>
          ))}
        </div>
      )}

      {joinedMembers.length > 0 && (
        <p className="flex items-center gap-1.5 text-xs font-bold text-emerald-600 dark:text-emerald-400">
          <Users size={13} className="shrink-0" />
          <span className="truncate">
            انضم: {joinedMembers.map((m) => `${m.name?.split(' ')[0] || 'راكب'}${m.seats > 1 ? ` (${m.seats})` : ''}`).join('، ')}
          </span>
        </p>
      )}

      {trip?.notes && (
        <p className={`text-xs leading-relaxed line-clamp-2 ${textSecondary}`} title={trip.notes}>
          ملاحظة: {trip.notes}
        </p>
      )}

      {/* ===== 5) الأكشن ===== */}
      <footer className="flex flex-col gap-2 pt-3 border-t border-dashed border-slate-200 dark:border-slate-800">
        {isOwner ? (
          <div className="flex items-center justify-between gap-2">
            <p className={`text-xs font-bold ${textSecondary}`}>
              إعلانك{joinedMembers.length > 0 ? ` • ${joinedMembers.length} حجز` : ''}
            </p>
            <div className="flex items-center gap-1.5">
              <button type="button" onClick={handleShare} aria-label="مشاركة الرحلة" className={`w-11 h-11 rounded-xl flex items-center justify-center ${iconBtn}`}>
                <Share2 size={17} />
              </button>
              <button type="button" onClick={handleDelete} aria-label="حذف الرحلة" className="w-11 h-11 rounded-xl flex items-center justify-center bg-rose-500/10 text-rose-600 hover:bg-rose-500 hover:text-white transition-colors">
                <Trash2 size={17} />
              </button>
            </div>
          </div>
        ) : isCompleted ? (
          <div className="flex items-center justify-center gap-1.5 h-11 rounded-xl text-sm font-black bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 size={16} /> رحلة مكتملة
          </div>
        ) : isFull ? (
          <div className="flex items-center justify-center gap-1.5 h-11 rounded-xl text-sm font-black bg-rose-500/10 text-rose-600 dark:text-rose-400">
            <Lock size={15} /> اكتمل العدد
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); openChatFromTrip(trip); }}
              className={`flex-1 h-11 rounded-xl text-sm font-black text-white shadow-sm active:scale-[0.98] transition-transform flex items-center justify-center gap-2 ${accentSolid}`}
            >
              <MessageCircle size={17} /> تواصل
            </button>

            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); openChatFromTrip({ ...trip, openNegotiation: true }); }}
              aria-label="تفاوض على السعر أو المقاعد"
              title="تفاوض"
              className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${iconBtn}`}
            >
              <Handshake size={17} />
            </button>

            {canCall && (
              <a
                href={`tel:${contactPhone}`}
                onClick={(e) => e.stopPropagation()}
                aria-label="اتصال هاتفي"
                className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${iconBtn}`}
              >
                <Phone size={17} />
              </a>
            )}

            {canWhatsapp && (
              <a
                href={getWhatsAppUrl(contactPhone)}
                target="_blank"
                rel="noreferrer"
                onClick={(e) => e.stopPropagation()}
                aria-label="تواصل عبر واتساب"
                className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0 bg-[#25D366] hover:bg-[#20bd5a] text-white"
              >
                <MessageCircle size={17} />
              </a>
            )}

            <button type="button" onClick={handleShare} aria-label="مشاركة الرحلة" className={`w-11 h-11 rounded-xl hidden sm:flex items-center justify-center shrink-0 ${iconBtn}`}>
              <Share2 size={17} />
            </button>
          </div>
        )}

        {/* حذف للأدمن على كروت غيره */}
        {isAdmin && !isOwner && (
          <button type="button" onClick={handleDelete} className="self-end text-xs font-bold text-rose-600 hover:underline">
            حذف (أدمن)
          </button>
        )}
      </footer>
    </article>
  );
};

export default TripCard;
