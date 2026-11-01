import React, { useState, useEffect } from 'react';
import { doc, deleteDoc, getDoc } from 'firebase/firestore';
import { Trash2, Share2, ShieldCheck, Star, Clock, Car, Package, CheckCircle2, Phone, MessageCircle, Route } from 'lucide-react';
import { db, APP_COLLECTION_NAME, USERS_COLLECTION } from '../firebase';
import { formatTripDateTime, getSeatsText } from '../utils/helpers';

const TripCard = ({ trip, user, isAdmin, isDarkMode, openChatFromTrip, triggerToast, matchBadge, onOpenPublicProfile }) => {
  if (!trip) return null;

  const isOwner = user?.uid === trip.userId;
  const isCompleted = trip?.status === 'completed';
  const isFull = trip?.status === 'full';
  const isFemalesOnly = Boolean(trip?.preferences?.femalesOnly);
  const isRequest = trip?.type === 'request';

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
          if (typeof uData?.isVerified === 'boolean') {
            setLiveVerified(uData.isVerified);
          }
          if (uData?.customBadge !== undefined) {
            setLiveBadge(uData.customBadge);
          }
          if (uData?.rating !== undefined) {
            setLiveRating(Number(uData.rating));
          }
          if (Array.isArray(uData?.reviews)) {
            setLiveReviewsCount(uData.reviews.length);
          } else if (uData?.ratingsCount) {
            setLiveReviewsCount(Number(uData.ratingsCount));
          }
          if (!trip?.carModel && uData?.carModel) {
            setLiveCarModel(uData.carModel);
            setLiveCarColor(uData.carColor || '');
          }
        }
      })
      .catch(() => {});
    return () => { isMounted = false; };
  }, [trip?.userPhone, trip?.userId, trip?.allowPhoneContact, trip?.carModel]);

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
      if (diffHours > 0 && diffHours < 1) {
        return `خلال ${Math.max(5, Math.round(diffHours * 60))} د 🔥`;
      }
      if (diffHours >= 1 && diffHours <= 6) {
        return `باقي ${Math.round(diffHours)} س ⏱️`;
      }
      return null;
    } catch (e) {
      return null;
    }
  };
  const timeCountdown = getRemainingTimeBadge();

  let bgCard = isDarkMode ? 'bg-slate-900/95 border-slate-800' : 'bg-white border-slate-200/90';
  let textPrimary = isDarkMode ? 'text-white' : 'text-slate-900';
  let textSecondary = isDarkMode ? 'text-slate-400' : 'text-slate-500';

  if (isFemalesOnly) {
    bgCard = isDarkMode ? 'bg-pink-950/40 border-pink-800/70' : 'bg-pink-50/80 border-pink-300';
    textPrimary = isDarkMode ? 'text-pink-100' : 'text-pink-950';
    textSecondary = isDarkMode ? 'text-pink-300' : 'text-pink-700';
  }

  const price = trip.cost || trip.price || trip.fare || 'غير محدد';

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
    const text = `🚗 رحلة على تطبيق (طريقنا)${isFemalesOnly ? ' (بنات فقط 👩)' : ''}\n📍 من: ${trip.from}\n🏁 إلى: ${trip.to}${routeStr}${carStr}\n⏰ الموعد: ${formatTripDateTime(trip.date, trip.time)}\n💺 التكلفة: ${price !== 'غير محدد' ? price + ' ج' : price}`;
    if (navigator.share) {
      navigator.share({ title: 'طريقنا', text: text }).catch(() => {});
    } else {
      window.open(`https://wa.me/?text=${encodeURIComponent(text)}`);
    }
  };

  const preferencesLabels = {
    ac: 'تكييف ❄️',
    noSmoking: 'منع التدخين 🚭',
    luggage: 'شنط 🧳',
    families: 'عائلات 👨‍👩‍👧‍👦'
  };

  const activePreferences = trip.preferences ? Object.keys(trip.preferences).filter(key => trip.preferences[key] && key !== 'femalesOnly') : [];

  return (
    <div
      onClick={() => !isOwner && !isCompleted && !isFull && openChatFromTrip(trip)}
      className={`rounded-[1.35rem] border shadow-sm hover:shadow-md transition-all flex flex-col justify-between overflow-hidden relative cursor-pointer ${bgCard} group ${(isCompleted || isFull) ? 'opacity-70 grayscale-[30%]' : ''} ${isFemalesOnly ? 'hover:border-pink-500' : 'hover:border-indigo-500/60'}`}
    >
      {/* شريط علوي رشيق (Top Ribbon) لشارات التطابق أو السيدات أو العد التنازلي لتفريغ زحمة الهيدر */}
      {(matchBadge || isFemalesOnly || timeCountdown) && (
        <div className={`px-3 py-1 flex items-center justify-between gap-2 text-[10px] font-black border-b ${
          isFemalesOnly
            ? 'bg-pink-500/15 border-pink-500/20 text-pink-600 dark:text-pink-300'
            : matchBadge?.includes('قريباً')
            ? 'bg-rose-500/10 border-rose-500/20 text-rose-500'
            : 'bg-indigo-500/10 border-indigo-500/15 text-indigo-600 dark:text-indigo-400'
        }`}>
          <div className="flex items-center gap-1.5 truncate">
            {isFemalesOnly && <span className="bg-pink-500 text-white px-1.5 py-0.2 rounded">بنات فقط 🌸</span>}
            {matchBadge && <span>{matchBadge}</span>}
          </div>
          {timeCountdown && (
            <span className="text-amber-500 dark:text-amber-400 shrink-0">{timeCountdown}</span>
          )}
        </div>
      )}

      <div className="p-3.5 flex flex-col justify-between gap-2.5 flex-1">
        {/* 1. هيدر الكارت: بيانات المستخدم يمين + السعر والمقاعد يسار */}
        <div className="flex items-start justify-between gap-2 relative z-10">
          <div
            onClick={(e) => {
              e.stopPropagation();
              if (onOpenPublicProfile && trip?.userId) onOpenPublicProfile(trip.userId);
            }}
            className="flex items-center gap-2.5 min-w-0 cursor-pointer hover:opacity-90 transition-opacity"
            title="اضغط لعرض البروفايل وآراء العملاء"
          >
            <div className="relative shrink-0">
              {trip?.userPhoto ? (
                <img src={trip.userPhoto} className={`w-10 h-10 rounded-xl object-cover border ${isFemalesOnly ? 'border-pink-300 dark:border-pink-700' : 'border-slate-200 dark:border-slate-700'}`} alt="المستخدم" />
              ) : (
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-sm ${isFemalesOnly ? 'bg-pink-200/70 text-pink-700 dark:bg-pink-900/60 dark:text-pink-300' : 'bg-indigo-500/10 text-indigo-500 dark:bg-slate-800 dark:text-indigo-400'}`}>
                  {(trip?.userName || 'م').charAt(0)}
                </div>
              )}
              {liveVerified && (
                <span className="absolute -bottom-1 -right-1 bg-emerald-500 text-white p-0.5 rounded-full shadow-sm" title="حساب موثق وأمان">
                  <ShieldCheck size={10} />
                </span>
              )}
            </div>

            <div className="flex flex-col min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className={`text-xs sm:text-sm font-black truncate max-w-[140px] hover:underline ${textPrimary}`}>
                  {trip?.userName?.split(' ').slice(0, 2).join(' ') || 'مستخدم'}
                </span>
                {liveBadge && (
                  <span className="text-[9px] font-black px-1.5 py-0.2 rounded-md bg-amber-400/15 text-amber-500 border border-amber-400/30 shrink-0">
                    {liveBadge}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="inline-flex items-center gap-0.5 text-[10px] font-black text-amber-500 bg-amber-500/10 px-1.5 py-0.2 rounded-md">
                  <Star size={10} className="fill-amber-400 text-amber-400" />
                  {liveRating > 0 ? liveRating.toFixed(1) : 'جديد'}
                </span>
                <span className={`text-[10px] font-bold hover:text-indigo-400 whitespace-nowrap ${textSecondary}`}>
                  ({liveReviewsCount} رأي)
                </span>
              </div>
            </div>
          </div>

          <div className="flex flex-col items-end gap-1 shrink-0">
            <div className="flex items-center gap-1">
              <span className="font-black text-xs sm:text-sm text-emerald-500 bg-emerald-500/10 border border-emerald-500/25 px-2.5 py-1 rounded-xl leading-none">
                {price !== 'غير محدد' ? `${price} ج` : price}
              </span>

              <button
                onClick={handleShare}
                className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-400 hover:text-indigo-500 transition-colors"
                title="مشاركة الرحلة"
              >
                <Share2 size={13} />
              </button>

              {(isAdmin || isOwner) && (
                <button
                  onClick={handleDelete}
                  className="p-1.5 rounded-lg bg-rose-500/10 text-rose-500 hover:bg-rose-500 hover:text-white transition-colors"
                  title="حذف الرحلة"
                >
                  <Trash2 size={13} />
                </button>
              )}
            </div>

            <span className={`text-[9px] font-black px-2 py-0.5 rounded-md border flex items-center gap-1 ${
              isFull
                ? 'bg-rose-500/10 border-rose-500/30 text-rose-500'
                : isRequest
                ? 'bg-amber-500/10 border-amber-500/30 text-amber-500'
                : 'bg-indigo-500/10 border-indigo-500/25 text-indigo-400'
            }`}>
              {trip?.category === 'parcel' ? <Package size={10} /> : <Car size={10} />}
              <span>{isFull ? 'مكتمل العدد' : getSeatsText(trip?.seats, trip?.category)}</span>
            </span>
          </div>
        </div>

        {/* 2. صندوق المسار بتصميم الـ Timeline الرأسي المريح للموبايل */}
        <div className={`p-3 rounded-xl border flex flex-col gap-2 relative z-10 ${
          isFemalesOnly
            ? (isDarkMode ? 'bg-pink-900/20 border-pink-800/50' : 'bg-pink-100/50 border-pink-200')
            : (isDarkMode ? 'bg-slate-800/60 border-slate-700/80' : 'bg-slate-50/90 border-slate-200/70')
        }`}>
          <div className="relative flex flex-col gap-2.5 pr-4">
            {/* خط المسار الرأسي */}
            <div className="absolute right-1.5 top-2 bottom-2 w-0.5 border-r-2 border-dashed border-indigo-400/50"></div>

            {/* نقطة الانطلاق */}
            <div className="relative flex items-baseline justify-between gap-2">
              <span className="absolute -right-[15px] top-1 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-emerald-500/20"></span>
              <div className="min-w-0 flex-1">
                <span className={`text-xs sm:text-sm font-black ${textPrimary}`}>{trip?.from || 'غير محدد'}</span>
                {trip?.fromDetails && (
                  <span className={`text-[10px] font-bold mr-1.5 ${textSecondary}`}>({trip.fromDetails})</span>
                )}
              </div>
            </div>

            {/* نقطة الوصول */}
            <div className="relative flex items-baseline justify-between gap-2">
              <span className={`absolute -right-[15px] top-1 w-2.5 h-2.5 rounded-full ${isFemalesOnly ? 'bg-pink-500 ring-pink-500/20' : 'bg-indigo-500 ring-indigo-500/20'} ring-2`}></span>
              <div className="min-w-0 flex-1">
                <span className={`text-xs sm:text-sm font-black ${textPrimary}`}>{trip?.to || 'غير محدد'}</span>
                {trip?.toDetails && (
                  <span className={`text-[10px] font-bold mr-1.5 ${textSecondary}`}>({trip.toDetails})</span>
                )}
              </div>
            </div>
          </div>

          {/* خط السير والسيارة والتفضيلات */}
          {((Array.isArray(trip?.routeAreas) && trip.routeAreas.length > 0) || liveCarModel || activePreferences.length > 0) && (
            <div className="flex flex-wrap items-center gap-1 pt-1.5 border-t border-dashed border-slate-200 dark:border-slate-700/80">
              {Array.isArray(trip?.routeAreas) && trip.routeAreas.map((area, idx) => (
                <span key={idx} className={`text-[9px] font-black px-1.5 py-0.5 rounded-md flex items-center gap-0.5 ${isDarkMode ? 'bg-slate-700/90 text-slate-200' : 'bg-white text-slate-700 border border-slate-200'}`}>
                  <Route size={9} className="text-indigo-400" /> {area}
                </span>
              ))}

              {liveCarModel && (
                <span className={`text-[9px] font-black px-2 py-0.5 rounded-md flex items-center gap-1 ${isDarkMode ? 'bg-indigo-950/70 text-indigo-300 border border-indigo-800/50' : 'bg-indigo-50 text-indigo-700 border border-indigo-100'}`}>
                  <Car size={10} /> {liveCarModel} {liveCarColor ? `(${liveCarColor})` : ''}
                </span>
              )}

              {activePreferences.map(key => (
                <span key={key} className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md ${isDarkMode ? 'bg-slate-700/50 text-slate-300' : 'bg-slate-200/70 text-slate-700'}`}>
                  {preferencesLabels[key]}
                </span>
              ))}
            </div>
          )}

          {trip?.notes && (
            <p className={`text-[10px] font-bold truncate pt-0.5 ${textSecondary}`} title={trip.notes}>
              💬 ملاحظة: {trip.notes}
            </p>
          )}
        </div>

        {/* 3. الفوتر المدمج: الوقت + أزرار التواصل الذكية للموبايل */}
        <div className="flex flex-col gap-2 pt-0.5 relative z-20 pointer-events-auto">
          <div className="flex items-center justify-between text-[11px] font-bold px-0.5">
            <span className={`flex items-center gap-1 ${textSecondary}`}>
              <Clock size={12} className={isFemalesOnly ? 'text-pink-500' : 'text-indigo-400'} />
              {formatTripDateTime(trip?.date, trip?.time)}
            </span>
            {liveVerified && (
              <span className="text-[9px] font-black text-emerald-500 flex items-center gap-0.5">
                <ShieldCheck size={11} /> كابتن موثق
              </span>
            )}
          </div>

          {!isOwner ? (
            isCompleted ? (
              <div className="w-full bg-emerald-500/10 text-emerald-500 py-2 rounded-xl text-[11px] font-black flex items-center justify-center gap-1 border border-emerald-500/20">
                <CheckCircle2 size={13} /> رحلة مكتملة ✅
              </div>
            ) : isFull ? (
              <div className="w-full bg-rose-500/10 text-rose-500 py-2 rounded-xl text-[11px] font-black flex items-center justify-center gap-1 border border-rose-500/20">
                الرحلة مكتملة العدد 🔒
              </div>
            ) : (
              <div className="flex items-center gap-1.5 w-full">
                {/* الزر الرئيسي العريض للشات والحجز */}
                <button
                  onClick={(e) => { e.stopPropagation(); openChatFromTrip(trip); }}
                  className={`flex-1 text-white py-2.5 px-3 rounded-xl text-xs font-black shadow-sm active:scale-95 transition-all flex justify-center items-center gap-1.5 ${
                    isFemalesOnly ? 'bg-pink-600 hover:bg-pink-700' : 'bg-indigo-600 hover:bg-indigo-700'
                  }`}
                >
                  <span>تواصل واحجز مقعدك 💬</span>
                </button>

                {/* أيقونات سريعة مدمجة للواتساب والاتصال لتوفير المساحة على الموبايل */}
                {canWhatsapp && (
                  <a
                    href={getWhatsAppUrl(contactPhone)}
                    target="_blank"
                    rel="noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="w-10 h-10 flex justify-center items-center bg-[#25D366] hover:bg-[#20bd5a] text-white rounded-xl shadow-sm transition-all shrink-0 active:scale-95"
                    title="تواصل عبر واتساب"
                  >
                    <MessageCircle size={16} />
                  </a>
                )}

                {canCall && (
                  <a
                    href={`tel:${contactPhone}`}
                    onClick={(e) => e.stopPropagation()}
                    className={`w-10 h-10 flex justify-center items-center rounded-xl transition-all shrink-0 active:scale-95 ${
                      isDarkMode ? 'bg-slate-800 text-emerald-400 hover:bg-slate-700 border border-slate-700' : 'bg-slate-100 text-emerald-600 hover:bg-slate-200 border border-slate-200'
                    }`}
                    title="اتصال هاتفي"
                  >
                    <Phone size={16} />
                  </a>
                )}
              </div>
            )
          ) : (
            <div className={`w-full py-1.5 rounded-xl text-center text-[10px] font-black border border-dashed ${isDarkMode ? 'border-slate-800 text-slate-400' : 'border-slate-200 text-slate-500'}`}>
              إعلانك الشخصي ✨
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TripCard;