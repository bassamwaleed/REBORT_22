import React, { useState, useEffect, useMemo } from 'react';
import { 
  Bell, BusFront, MapPinned, List, X, ChevronRight, ChevronLeft, Route, Plus, 
  Loader2, ChevronLeft as ChevronLeftIcon, Search, MapPin, Sparkles, Compass, 
  Car, CheckCircle2, Package, Shuffle, Bot, Layers, ArrowLeftRight
} from 'lucide-react';
import TripCard from '../components/TripCard';
import BesoAssistantModal from '../components/BesoAssistantModal';
import { collection, addDoc } from 'firebase/firestore';
import { db, STATIONS_COLLECTION } from '../firebase';
import { SUPPORTED_AREAS, NEARBY_AREAS_MAP, normalizeArabic } from '../App';
import { EGYPT_CITIES } from '../utils/helpers';

const HomeScreen = ({
  user, isAdmin, isDarkMode, realTrips, stations, isGuest,
  homeCategory, setHomeCategory, viewMode, setViewMode, filterType, setFilterType,
  filterFrom, setFilterFrom, filterTo, setFilterTo, openChatFromTrip,
  setSelectedStation, triggerToast, appSettings, userArea, userAreas = [], onOpenAreaModal,
  onOpenPublicProfile
}) => {
  
  const [stationSearchQuery, setStationSearchQuery] = useState('');
  const [stationCrowdFilter, setStationCrowdFilter] = useState('all'); // 'all' | 'empty' | 'crowded'
  const [stationLocationFilter, setStationLocationFilter] = useState('all'); // فلتر سريع لمحافظات/مناطق المواقف
  const [showCompletedTrips, setShowCompletedTrips] = useState(false); 
  const [isScrolling, setIsScrolling] = useState(false);

  // فلاتر سريعة إضافية لراحة المستخدم
  const [quickFilter, setQuickFilter] = useState('all'); // 'all' | 'urgent' | 'verified' | 'females' | 'ac'

  // حالات العرض الذكي الجديدة
  const [areaSlideIndex, setAreaSlideIndex] = useState(0);
  const [showAllAreaTrips, setShowAllAreaTrips] = useState(false);
  const [isAreaCarouselPaused, setIsAreaCarouselPaused] = useState(false);
  const [areaTouchStart, setAreaTouchStart] = useState(null);
  const [areaTouchEnd, setAreaTouchEnd] = useState(null);
  const [shuffleSeed, setShuffleSeed] = useState(() => Math.random());
  const [showBesoModal, setShowBesoModal] = useState(false);

  // تأثير إخفاء الشريط السفلي والأزرار العائمة أثناء السكرول وإظهارهم عند التوقف
  useEffect(() => {
    let scrollTimeout;
    const handleScroll = () => {
      setIsScrolling(true);
      document.body.classList.add('user-is-scrolling');
      clearTimeout(scrollTimeout);
      scrollTimeout = setTimeout(() => {
        setIsScrolling(false);
        document.body.classList.remove('user-is-scrolling');
      }, 250);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', handleScroll);
      clearTimeout(scrollTimeout);
      document.body.classList.remove('user-is-scrolling');
    };
  }, []);

  const activeUserAreas = filterFrom 
    ? [filterFrom] 
    : (Array.isArray(userAreas) && userAreas.length > 0 ? userAreas : (userArea ? userArea.split('، ').filter(Boolean) : []));

  const hasAreaOrSearchFilter = activeUserAreas.length > 0 || Boolean(filterFrom) || Boolean(filterTo);

  const availableTravelCount = (realTrips || []).filter(t => t.category === 'travel' && t.status !== 'completed' && t.status !== 'cancelled').length;
  const availableParcelCount = (realTrips || []).filter(t => (t.category === 'parcel' || t.type === 'delivery') && t.status !== 'completed' && t.status !== 'cancelled').length;

  const isLeavingSoon = (dateStr, timeStr) => {
    if (!dateStr || !timeStr) return false;
    try {
      const tripTime = new Date(`${dateStr}T${timeStr}`).getTime();
      const now = Date.now();
      const diffHours = (tripTime - now) / (1000 * 60 * 60);
      return diffHours > 0 && diffHours <= 3; 
    } catch(e) { return false; }
  };

  const categoryTrips = (realTrips || []).filter(t => {
    if (!t || t.status === 'cancelled') return false;
    if (homeCategory === 'travel') {
      if (t.category !== 'travel' || (t.type && t.type !== filterType)) return false;
    } else if (homeCategory === 'parcel') {
      if (t.category !== 'parcel' && t.type !== 'delivery') return false;
    } else {
      return false;
    }

    if (quickFilter === 'urgent' && !isLeavingSoon(t.date, t.time)) return false;
    if (quickFilter === 'verified' && !t.verified) return false;
    if (quickFilter === 'females' && !t.preferences?.femalesOnly) return false;
    if (quickFilter === 'ac' && !t.preferences?.ac) return false;

    return true;
  });

  const availableTripsList = categoryTrips.filter(t => t.status !== 'completed');
  const completedTripsList = categoryTrips.filter(t => t.status === 'completed');

  const currentTripsToDisplay = showCompletedTrips ? completedTripsList : availableTripsList;

  const isAreaMatch = (tripArea, targetArea) => {
    if (!targetArea) return true;
    if (!tripArea) return false;
    const normTrip = normalizeArabic(tripArea);
    const normTarget = normalizeArabic(targetArea);
    return normTrip === normTarget || normTrip.includes(normTarget) || normTarget.includes(normTrip);
  };

  const isTripMatchingOriginOrRoute = (trip, targetArea) => {
    if (!targetArea) return true;
    if (isAreaMatch(trip.from, targetArea) || isAreaMatch(trip.fromDetails, targetArea)) return true;
    if (Array.isArray(trip.routeAreas) && trip.routeAreas.some(r => isAreaMatch(r, targetArea))) return true;
    return false;
  };

  const isTripMatchingDestOrRoute = (trip, targetArea) => {
    if (!targetArea) return true;
    if (isAreaMatch(trip.to, targetArea) || isAreaMatch(trip.toDetails, targetArea)) return true;
    if (Array.isArray(trip.routeAreas) && trip.routeAreas.some(r => isAreaMatch(r, targetArea))) return true;
    return false;
  };

  const isNearbyArea = (tripArea, targetArea) => {
    if (!tripArea || !targetArea) return false;
    const nearbyList = NEARBY_AREAS_MAP[targetArea] || [];
    return nearbyList.some(near => isAreaMatch(tripArea, near));
  };

  const getTripRelevanceScore = (trip) => {
    let score = 0;

    if (activeUserAreas.length > 0) {
      if (activeUserAreas.some(a => isAreaMatch(trip.from, a))) score += 100;
      else if (activeUserAreas.some(a => Array.isArray(trip.routeAreas) && trip.routeAreas.some(r => isAreaMatch(r, a)))) score += 85;
      else if (activeUserAreas.some(a => isAreaMatch(trip.fromDetails, a))) score += 75;
      else if (activeUserAreas.some(a => isNearbyArea(trip.from, a))) score += 50;
      else if (activeUserAreas.some(a => isAreaMatch(trip.to, a))) score += 30;
    }

    if (filterTo) {
      if (isAreaMatch(trip.to, filterTo)) score += 90;
      else if (Array.isArray(trip.routeAreas) && trip.routeAreas.some(r => isAreaMatch(r, filterTo))) score += 75;
      else if (isAreaMatch(trip.toDetails, filterTo)) score += 70;
      else if (isNearbyArea(trip.to, filterTo)) score += 45;
    }

    if (!showCompletedTrips && isLeavingSoon(trip.date, trip.time)) {
      score += 40; 
    }

    return score;
  };

  const smartShuffleList = (list, seed) => {
    if (!Array.isArray(list) || list.length <= 1) return list;
    const copy = [...list];
    let s = Math.floor(seed * 100000) || 12345;
    const nextRand = () => {
      s = (s * 16807) % 2147483647;
      return (s - 1) / 2147483646;
    };

    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(nextRand() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  };

  const exactMatchedTrips = useMemo(() => {
    if (!hasAreaOrSearchFilter) return [];

    const matched = currentTripsToDisplay.filter(t => {
      const matchFrom = activeUserAreas.length === 0 || activeUserAreas.some(a => isTripMatchingOriginOrRoute(t, a));
      const matchTo = !filterTo || isTripMatchingDestOrRoute(t, filterTo);
      return matchFrom && matchTo;
    });

    const urgentOrTop = matched.filter(t => getTripRelevanceScore(t) >= 85);
    const others = matched.filter(t => getTripRelevanceScore(t) < 85);

    return [
      ...smartShuffleList(urgentOrTop, shuffleSeed),
      ...smartShuffleList(others, shuffleSeed + 0.37)
    ];
  }, [currentTripsToDisplay, activeUserAreas.join(','), filterTo, shuffleSeed, showCompletedTrips, hasAreaOrSearchFilter]);

  const similarTrips = useMemo(() => {
    if (!hasAreaOrSearchFilter) {
      const urgent = currentTripsToDisplay.filter(t => !showCompletedTrips && isLeavingSoon(t.date, t.time));
      const regular = currentTripsToDisplay.filter(t => !urgent.some(u => u.id === t.id));
      return [
        ...smartShuffleList(urgent, shuffleSeed),
        ...smartShuffleList(regular, shuffleSeed + 0.51)
      ];
    }

    const remaining = currentTripsToDisplay.filter(t => {
      if (exactMatchedTrips.some(exact => exact.id === t.id)) return false;
      const fromNearby = activeUserAreas.length > 0 && activeUserAreas.some(a => isNearbyArea(t.from, a) || isAreaMatch(t.to, a));
      const toNearby = filterTo && (isAreaMatch(t.to, filterTo) || isNearbyArea(t.to, filterTo));
      const sameCategoryFallback = currentTripsToDisplay.length > 0;
      return fromNearby || toNearby || sameCategoryFallback;
    });

    const strictlyNearby = remaining.filter(t => 
      activeUserAreas.some(a => isNearbyArea(t.from, a) || isAreaMatch(t.to, a) || (Array.isArray(t.routeAreas) && t.routeAreas.some(r => isNearbyArea(r, a))))
    );
    const otherGeneral = remaining.filter(t => !strictlyNearby.some(n => n.id === t.id));

    return [
      ...smartShuffleList(strictlyNearby, shuffleSeed + 0.19),
      ...smartShuffleList(otherGeneral, shuffleSeed + 0.73)
    ];
  }, [currentTripsToDisplay, exactMatchedTrips, activeUserAreas.join(','), filterTo, shuffleSeed, hasAreaOrSearchFilter, showCompletedTrips]);

  useEffect(() => {
    setAreaSlideIndex(0);
  }, [homeCategory, filterType, filterFrom, filterTo, showCompletedTrips, quickFilter]);

  useEffect(() => {
    if (!hasAreaOrSearchFilter || showAllAreaTrips || isAreaCarouselPaused || exactMatchedTrips.length <= 1) return;
    const timer = setInterval(() => {
      setAreaSlideIndex(prev => (prev + 1) % exactMatchedTrips.length);
    }, 4500);
    return () => clearInterval(timer);
  }, [hasAreaOrSearchFilter, showAllAreaTrips, isAreaCarouselPaused, exactMatchedTrips.length]);

  const nextAreaTrip = () => {
    if (exactMatchedTrips.length <= 1) return;
    setAreaSlideIndex(prev => (prev + 1) % exactMatchedTrips.length);
  };

  const prevAreaTrip = () => {
    if (exactMatchedTrips.length <= 1) return;
    setAreaSlideIndex(prev => (prev === 0 ? exactMatchedTrips.length - 1 : prev - 1));
  };

  const handleAreaTouchStart = (e) => {
    setIsAreaCarouselPaused(true);
    setAreaTouchEnd(null);
    setAreaTouchStart(e.targetTouches[0].clientX);
  };

  const handleAreaTouchMove = (e) => {
    setAreaTouchEnd(e.targetTouches[0].clientX);
  };

  const handleAreaTouchEnd = () => {
    setTimeout(() => setIsAreaCarouselPaused(false), 2500);
    if (!areaTouchStart || !areaTouchEnd) return;
    const distance = areaTouchStart - areaTouchEnd;
    if (distance > 45) nextAreaTrip();
    if (distance < -45) prevAreaTrip();
  };

  const handleReshuffleTrips = () => {
    setShuffleSeed(Math.random());
    setAreaSlideIndex(0);
    triggerToast('تم تبديل وخلط الرحلات بذكاء 🔀✨');
  };

  const handleSwapLocations = () => {
    if (!filterFrom && !filterTo && activeUserAreas.length === 1) {
      setFilterFrom('');
      setFilterTo(activeUserAreas[0]);
      return;
    }
    const temp = filterFrom || (activeUserAreas.length === 1 ? activeUserAreas[0] : '');
    setFilterFrom(filterTo);
    setFilterTo(temp);
  };

  // استخراج قائمة المحافظات/المناطق المتوفرة في المواقف لعرضها كفلاتر سريعة
  const availableStationLocations = useMemo(() => {
    const locs = new Set();
    (stations || []).forEach(s => {
      const isApprovedOrAdmin = isAdmin ? true : (s.status === 'approved' || !s.status);
      if (isApprovedOrAdmin) {
        if (s.governorate) locs.add(s.governorate);
        if (s.location) locs.add(s.location);
      }
    });
    return Array.from(locs);
  }, [stations, isAdmin]);

  const visibleStations = (stations || []).filter(s => {
    const isApprovedOrAdmin = isAdmin ? true : (s.status === 'approved' || !s.status);
    if (!isApprovedOrAdmin) return false;

    if (stationCrowdFilter !== 'all' && s.crowdStatus !== stationCrowdFilter) return false;

    if (stationLocationFilter !== 'all' && s.location !== stationLocationFilter && s.governorate !== stationLocationFilter) {
      return false;
    }
    
    if (stationSearchQuery.trim() !== '') {
      const q = normalizeArabic(stationSearchQuery);
      const matchName = normalizeArabic(s.name).includes(q);
      const matchLoc = normalizeArabic(s.location).includes(q) || normalizeArabic(s.governorate).includes(q);
      const matchRoutes = Array.isArray(s.routes) && s.routes.some(r => 
        normalizeArabic(r.destination).includes(q) || normalizeArabic(r.destinationDetails).includes(q)
      );
      return matchName || matchLoc || matchRoutes;
    }
    return true;
  });

  const [currentSlide, setCurrentSlide] = useState(0);
  const [touchStart, setTouchStart] = useState(null);
  const [touchEnd, setTouchEnd] = useState(null);
  const banners = Array.isArray(appSettings?.banners) ? appSettings.banners : (appSettings?.banner ? [appSettings.banner] : []);

  const [showAddStation, setShowAddStation] = useState(false);
  const [newStationName, setNewStationName] = useState('');
  const [newStationGov, setNewStationGov] = useState('');
  const [newStationLoc, setNewStationLoc] = useState('');
  const [newStationMapUrl, setNewStationMapUrl] = useState(''); 
  const [isSubmittingStation, setIsSubmittingStation] = useState(false);

  useEffect(() => {
    if (banners.length <= 1) return;
    const interval = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % banners.length);
    }, 4000); 
    return () => clearInterval(interval);
  }, [banners.length]);

  const nextSlide = () => setCurrentSlide((prev) => (prev + 1) % banners.length);
  const prevSlide = () => setCurrentSlide((prev) => (prev === 0 ? banners.length - 1 : prev - 1));

  const onTouchStart = (e) => { setTouchEnd(null); setTouchStart(e.targetTouches[0].clientX); };
  const onTouchMove = (e) => setTouchEnd(e.targetTouches[0].clientX);
  const onTouchEndHandler = () => {
    if (!touchStart || !touchEnd) return;
    const distance = touchStart - touchEnd;
    if (distance > 50) nextSlide(); 
    if (distance < -50) prevSlide(); 
  };

  const handleAddStation = async (e) => {
    e.preventDefault();
    if (isGuest || !user) return triggerToast('يجب تسجيل الدخول أولاً');
    const finalLoc = newStationLoc.trim() || newStationGov.trim();
    if (!newStationName.trim() || !finalLoc) return triggerToast('أدخل اسم الموقف والمحافظة/المنطقة');
    
    setIsSubmittingStation(true);
    try {
      await addDoc(collection(db, STATIONS_COLLECTION), {
        name: newStationName.trim(),
        governorate: newStationGov || null,
        location: finalLoc,
        mapUrl: newStationMapUrl.trim() || null, 
        status: isAdmin ? 'approved' : 'pending',
        addedBy: user.uid,
        routes: [],
        crowdStatus: 'normal', 
        crowdUpdatedAt: null
      });
      triggerToast(isAdmin ? 'تمت إضافة الموقف بنجاح ✅' : 'تم إرسال الموقف للمراجعة ⏳');
      setShowAddStation(false);
      setNewStationName('');
      setNewStationGov('');
      setNewStationLoc('');
      setNewStationMapUrl('');
    } catch (err) { 
      triggerToast('حدث خطأ أثناء الإضافة'); 
    } finally { 
      setIsSubmittingStation(false); 
    }
  };

  const handleSetAlert = async () => {
    if (isGuest || !user) return triggerToast('يجب تسجيل الدخول أولاً لتفعيل التنبيهات');
    const originForAlert = filterFrom || activeUserAreas[0];
    if (!originForAlert || !filterTo) return triggerToast('يرجى تحديد منطقة التحرك والوجهة أولاً');

    try {
      await addDoc(collection(db, 'trip_alerts'), {
        userId: user.uid,
        userName: user.displayName || 'مستخدم',
        from: originForAlert,
        to: filterTo,
        category: homeCategory,
        createdAt: new Date(),
        active: true 
      });
      triggerToast('تم تفعيل التنبيه بنجاح! هنبلغك أول ما رحلة تنزل 🔔');
    } catch (error) {
      triggerToast('حدث خطأ أثناء تفعيل التنبيه');
    }
  };

  const getMatchBadgeForTrip = (trip) => {
    const isRouteMatch = activeUserAreas.length > 0 && !activeUserAreas.some(a => isAreaMatch(trip.from, a)) && Array.isArray(trip.routeAreas) && activeUserAreas.some(a => trip.routeAreas.some(r => isAreaMatch(r, a)));
    const isUrgent = !showCompletedTrips && isLeavingSoon(trip.date, trip.time);
    if (isUrgent) return 'تنطلق قريباً 🔥';
    if (isRouteMatch) return 'يمر بمنطقتك 🛣️';
    if (activeUserAreas.length > 0) return 'مطابق لمنطقتك ⭐';
    return null;
  };

  const areaTripCounts = useMemo(() => {
    const counts = {};
    SUPPORTED_AREAS.forEach(a => { counts[a] = 0; });
    availableTripsList.forEach(t => {
      SUPPORTED_AREAS.forEach(a => {
        if (isTripMatchingOriginOrRoute(t, a) || isAreaMatch(t.to, a)) {
          counts[a] = (counts[a] || 0) + 1;
        }
      });
    });
    return counts;
  }, [availableTripsList]);

  const bgInput = isDarkMode ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-400 focus:border-indigo-500' : 'bg-white border-slate-200 text-slate-900 focus:border-indigo-500';
  const textPrimary = isDarkMode ? 'text-white' : 'text-slate-900';
  const bgCard = isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200';

  const currentSpotlightTrip = exactMatchedTrips[areaSlideIndex] || exactMatchedTrips[0];

  return (
    <main className="flex-1 w-full max-w-6xl mx-auto px-3 sm:px-6 pt-3 pb-28 relative z-10">
      
      <style>{`
        @keyframes slideCardFromLeft {
          0% { opacity: 0; transform: translateX(-24px) scale(0.98); }
          100% { opacity: 1; transform: translateX(0) scale(1); }
        }
        .animate-card-slide-ltr {
          animation: slideCardFromLeft 0.35s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
      `}</style>

      {/* أيقونة المساعد الذكي "بيسو" العائمة */}
      <button
        type="button"
        onClick={() => setShowBesoModal(true)}
        className={`fixed bottom-[90px] left-4 sm:left-8 z-50 flex items-center gap-2 px-3.5 py-3 rounded-full bg-gradient-to-r from-indigo-600 via-violet-600 to-indigo-700 text-white shadow-xl shadow-indigo-500/30 border border-white/20 hover:scale-105 active:scale-95 transition-all duration-300 ${
          isScrolling ? 'translate-y-28 opacity-0 pointer-events-none scale-75' : 'translate-y-0 opacity-100 scale-100'
        }`}
        title="اسأل المساعد الذكي بيسو عن أي مواصلات أو خط سير"
      >
        <div className="relative flex items-center justify-center">
          <Bot size={22} className="animate-bounce" />
          <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-emerald-400 rounded-full border border-indigo-900"></span>
        </div>
        <span className="text-xs font-black tracking-tight">اسأل بيسو 🤖</span>
      </button>

      {/* 1. البانر في الأعلى */}
      {viewMode === 'list' && (
        <div className="mb-3.5 animate-fade-in-up">
          {appSettings?.bannerText && (
            <div className="mb-2 px-2 border-r-4 border-indigo-500">
              <h2 className={`font-black text-sm sm:text-base ${textPrimary} leading-relaxed`}>{appSettings.bannerText}</h2>
            </div>
          )}

          {banners.length > 0 && (
            <div 
              className="relative w-full h-40 sm:h-52 lg:h-60 rounded-[1.5rem] overflow-hidden shadow-md border dark:border-slate-800 bg-slate-100 dark:bg-slate-800 group"
              onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEndHandler}
            >
               {banners.map((imgUrl, idx) => (
                 <img key={idx} src={imgUrl} alt={`Banner ${idx}`} className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-500 ease-in-out ${idx === currentSlide ? 'opacity-100 z-10' : 'opacity-0 z-0'}`} />
               ))}
               {banners.length > 1 && (
                 <>
                   <button onClick={prevSlide} className="absolute right-2.5 top-1/2 -translate-y-1/2 z-20 bg-black/35 hover:bg-black/55 text-white p-1.5 rounded-full backdrop-blur-sm transition-all md:opacity-0 group-hover:opacity-100"><ChevronRight size={18}/></button>
                   <button onClick={nextSlide} className="absolute left-2.5 top-1/2 -translate-y-1/2 z-20 bg-black/35 hover:bg-black/55 text-white p-1.5 rounded-full backdrop-blur-sm transition-all md:opacity-0 group-hover:opacity-100"><ChevronLeft size={18}/></button>
                   <div className="absolute bottom-2.5 left-0 right-0 flex justify-center gap-1.5 z-20">
                     {banners.map((_, idx) => (
                       <button key={idx} onClick={() => setCurrentSlide(idx)} className={`h-1.5 rounded-full transition-all duration-300 shadow-sm ${idx === currentSlide ? 'w-6 bg-indigo-600' : 'w-2 bg-white/80 hover:bg-white'}`}></button>
                     ))}
                   </div>
                 </>
               )}
            </div>
          )}
        </div>
      )}

      {/* 2. شريط الأيقونات المربعة في صف واحد */}
      <div className="grid grid-cols-4 gap-2 sm:gap-3 mb-3.5 pointer-events-auto relative z-10">
        <button
          onClick={() => { setViewMode('list'); setHomeCategory('travel'); setFilterTo(''); setShowCompletedTrips(false); }}
          className={`relative flex flex-col items-center justify-center py-2.5 sm:py-3 px-1 rounded-2xl border transition-all duration-200 ${
            viewMode === 'list' && homeCategory === 'travel'
              ? 'bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-500/20 scale-[1.02]'
              : `${bgCard} text-slate-600 dark:text-slate-300 hover:border-indigo-400`
          }`}
        >
          {availableTravelCount > 0 && (
            <span className={`absolute top-1.5 left-1.5 px-1.5 py-0.2 rounded-full text-[9px] font-black ${
              viewMode === 'list' && homeCategory === 'travel' ? 'bg-white text-indigo-600' : 'bg-rose-500 text-white'
            }`}>
              {availableTravelCount}
            </span>
          )}
          <Car size={19} className="mb-1 shrink-0" />
          <span className="text-[11px] sm:text-xs font-black tracking-tight">سفريات</span>
        </button>

        <button
          onClick={() => { setViewMode('list'); setHomeCategory('parcel'); setFilterTo(''); setShowCompletedTrips(false); }}
          className={`relative flex flex-col items-center justify-center py-2.5 sm:py-3 px-1 rounded-2xl border transition-all duration-200 ${
            viewMode === 'list' && homeCategory === 'parcel'
              ? 'bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-500/20 scale-[1.02]'
              : `${bgCard} text-slate-600 dark:text-slate-300 hover:border-indigo-400`
          }`}
        >
          {availableParcelCount > 0 && (
            <span className={`absolute top-1.5 left-1.5 px-1.5 py-0.2 rounded-full text-[9px] font-black ${
              viewMode === 'list' && homeCategory === 'parcel' ? 'bg-white text-indigo-600' : 'bg-rose-500 text-white'
            }`}>
              {availableParcelCount}
            </span>
          )}
          <Package size={19} className="mb-1 shrink-0" />
          <span className="text-[11px] sm:text-xs font-black tracking-tight">توصيل</span>
        </button>

        <button
          onClick={() => { setViewMode('list'); setHomeCategory('stations'); setFilterTo(''); }}
          className={`relative flex flex-col items-center justify-center py-2.5 sm:py-3 px-1 rounded-2xl border transition-all duration-200 ${
            viewMode === 'list' && homeCategory === 'stations'
              ? 'bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-500/20 scale-[1.02]'
              : `${bgCard} text-slate-600 dark:text-slate-300 hover:border-indigo-400`
          }`}
        >
          <BusFront size={19} className="mb-1 shrink-0" />
          <span className="text-[11px] sm:text-xs font-black tracking-tight">مواقف مصر</span>
        </button>

        <button
          onClick={() => setViewMode(viewMode === 'list' ? 'map' : 'list')}
          className={`relative flex flex-col items-center justify-center py-2.5 sm:py-3 px-1 rounded-2xl border transition-all duration-200 ${
            viewMode === 'map'
              ? 'bg-emerald-600 text-white border-emerald-600 shadow-md shadow-emerald-500/20 scale-[1.02]'
              : `${bgCard} text-slate-600 dark:text-slate-300 hover:border-indigo-400`
          }`}
        >
          {viewMode === 'map' ? <List size={19} className="mb-1 shrink-0" /> : <MapPinned size={19} className="mb-1 shrink-0" />}
          <span className="text-[11px] sm:text-xs font-black tracking-tight">
            {viewMode === 'map' ? 'القائمة' : 'الخريطة'}
          </span>
        </button>
      </div>

      {viewMode === 'list' && (
        <div className="animate-fade-in-up">
          {(homeCategory === 'travel' || homeCategory === 'parcel') && (
            <div className={`mb-4 p-2.5 rounded-2xl border shadow-sm space-y-2 ${isDarkMode ? 'bg-slate-900/90 border-slate-800' : 'bg-white border-slate-200/80'}`}>
              
              {/* الصف الأول من الفلتر */}
              <div className="flex items-center justify-between gap-1.5 overflow-x-auto [&::-webkit-scrollbar]:hidden">
                {homeCategory === 'travel' && (
                  <div className={`flex p-0.5 rounded-xl border shrink-0 ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-slate-100 border-slate-200'}`}>
                    <button 
                      onClick={() => setFilterType('offer')} 
                      className={`px-3 py-1.5 rounded-lg text-[11px] font-black transition-all ${filterType === 'offer' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-500 dark:text-slate-400'}`}
                    >
                      سائق
                    </button>
                    <button 
                      onClick={() => setFilterType('request')} 
                      className={`px-3 py-1.5 rounded-lg text-[11px] font-black transition-all ${filterType === 'request' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-500 dark:text-slate-400'}`}
                    >
                      راكب
                    </button>
                  </div>
                )}

                <div className={`flex flex-1 p-0.5 rounded-xl border ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-slate-100 border-slate-200'}`}>
                  <button 
                    onClick={() => setShowCompletedTrips(false)} 
                    className={`flex-1 py-1.5 px-2 rounded-lg text-[11px] font-black flex items-center justify-center gap-1 transition-all ${!showCompletedTrips ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-slate-500'}`}
                  >
                    <Compass size={13}/> 
                    <span>رحلات متاحة</span>
                    <span className={`px-1.5 py-0.2 rounded-full text-[9px] ${!showCompletedTrips ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/60 dark:text-indigo-300' : 'bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-400'}`}>
                      {availableTripsList.length}
                    </span>
                  </button>
                  <button 
                    onClick={() => setShowCompletedTrips(true)} 
                    className={`flex-1 py-1.5 px-2 rounded-lg text-[11px] font-black flex items-center justify-center gap-1 transition-all ${showCompletedTrips ? 'bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 shadow-sm' : 'text-slate-500'}`}
                  >
                    <CheckCircle2 size={13}/> 
                    <span>رحلات مكتملة</span>
                    <span className={`px-1.5 py-0.2 rounded-full text-[9px] ${showCompletedTrips ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/60 dark:text-emerald-300' : 'bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-400'}`}>
                      {completedTripsList.length}
                    </span>
                  </button>
                </div>
              </div>

              {/* الصف الثاني من الفلتر: من / عكس الاتجاه / إلى / زر الخلط الذكي */}
              <div className="flex gap-1.5 items-center">
                <select value={filterFrom} onChange={(e) => setFilterFrom(e.target.value)} className={`flex-1 py-2 px-2 rounded-xl border text-[11px] sm:text-xs font-bold outline-none min-w-0 ${bgInput}`}>
                  <option value="">{activeUserAreas.length > 0 && !filterFrom ? `من: منطقتك (${activeUserAreas.length})` : 'من: كل المناطق'}</option>
                  {SUPPORTED_AREAS.map(c => <option key={c} value={c}>{c}</option>)}
                </select>

                <button
                  type="button"
                  onClick={handleSwapLocations}
                  className={`p-2 rounded-xl border transition-all active:scale-90 shrink-0 ${
                    isDarkMode ? 'bg-slate-800 border-slate-700 text-indigo-400 hover:bg-slate-700' : 'bg-slate-100 border-slate-200 text-indigo-600 hover:bg-indigo-50'
                  }`}
                  title="عكس نقطة الانطلاق والوصول"
                >
                  <ArrowLeftRight size={13} />
                </button>

                <select value={filterTo} onChange={(e) => setFilterTo(e.target.value)} className={`flex-1 py-2 px-2 rounded-xl border text-[11px] sm:text-xs font-bold outline-none min-w-0 ${bgInput}`}>
                  <option value="">إلى: كل الوجهات</option>
                  {SUPPORTED_AREAS.map(c => <option key={c} value={c}>{c}</option>)}
                </select>

                {(filterFrom || filterTo) && ( 
                  <button onClick={() => {setFilterFrom(''); setFilterTo('');}} className="p-2 bg-rose-100 text-rose-600 dark:bg-rose-900/30 dark:text-rose-400 rounded-xl hover:bg-rose-200 transition-colors flex items-center justify-center shrink-0" title="إلغاء الفلتر">
                    <X size={15}/>
                  </button> 
                )}

                <button
                  onClick={handleReshuffleTrips}
                  className="py-2 px-2.5 bg-indigo-50 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800/70 rounded-xl hover:bg-indigo-100 transition-all active:scale-95 flex items-center gap-1 text-[10px] sm:text-xs font-black shrink-0"
                  title="خلط وتبديل الكروت بذكاء"
                >
                  <Shuffle size={13} />
                  <span className="hidden sm:inline">تبديل</span>
                </button>
              </div>

              {/* الصف الثالث: كبسولات الفلترة الذكية السريعة */}
              <div className="flex items-center gap-1.5 overflow-x-auto pt-0.5 [&::-webkit-scrollbar]:hidden">
                {[
                  { id: 'all', label: 'الكل ✨' },
                  { id: 'urgent', label: 'تنطلق قريباً 🔥' },
                  { id: 'verified', label: 'كابتن موثق 🛡️' },
                  { id: 'females', label: 'بنات فقط 🌸' },
                  { id: 'ac', label: 'مكيفة ❄️' }
                ].map(chip => (
                  <button
                    key={chip.id}
                    type="button"
                    onClick={() => setQuickFilter(chip.id)}
                    className={`px-2.5 py-1 rounded-lg text-[10px] font-black border shrink-0 transition-all active:scale-95 ${
                      quickFilter === chip.id
                        ? (chip.id === 'females' ? 'bg-pink-600 text-white border-pink-600 shadow-sm' : 'bg-indigo-600 text-white border-indigo-600 shadow-sm')
                        : (isDarkMode ? 'bg-slate-800/80 border-slate-700 text-slate-300 hover:border-indigo-500/40' : 'bg-slate-50 border-slate-200 text-slate-600 hover:border-indigo-300')
                    }`}
                  >
                    {chip.label}
                  </button>
                ))}
              </div>

            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
             {homeCategory === 'stations' ? (
               <>
                 {/* بطاقة المساعد الذكي "بيسو" المبسطة في أعلى المواقف */}
                 <div 
                   onClick={() => setShowBesoModal(true)}
                   className="col-span-1 md:col-span-2 lg:col-span-3 p-3 sm:p-4 rounded-2xl bg-gradient-to-r from-indigo-600 via-violet-600 to-indigo-700 text-white shadow-md cursor-pointer hover:shadow-indigo-500/25 transition-all active:scale-[0.99] flex items-center justify-between gap-3 border border-indigo-400/30"
                 >
                   <div className="flex items-center gap-2.5">
                     <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-md flex items-center justify-center border border-white/30 shrink-0">
                       <Bot size={22} className="text-white" />
                     </div>
                     <div>
                       <h3 className="font-black text-xs sm:text-sm">مش عارف تركب منين؟ اسأل "بيسو" 🤖</h3>
                       <p className="text-[10px] sm:text-xs text-indigo-100 font-bold mt-0.5">
                         اكتب مكانك ووجهتك وبيسو هيقولك أقرب موقف وخط السير فوراً!
                       </p>
                     </div>
                   </div>
                   <span className="shrink-0 bg-white text-indigo-700 px-3 py-1.5 rounded-xl text-[11px] font-black shadow-sm flex items-center gap-1">
                     اسأله الآن <ChevronLeftIcon size={13}/>
                   </span>
                 </div>

                 {/* صندوق البحث الموحد والفلاتر المبسطة للمواقف */}
                 <div className="col-span-1 md:col-span-2 lg:col-span-3 p-3 rounded-2xl border shadow-sm space-y-2.5 bg-white dark:bg-slate-900 dark:border-slate-800">
                   <div className="flex gap-2 h-10">
                     <div className={`flex-1 flex items-center gap-2 px-3 rounded-xl border ${bgInput} h-full`}>
                       <Search size={15} className="text-slate-400 shrink-0" />
                       <input 
                         type="text" 
                         placeholder="ابحث باسم الموقف، المحافظة، أو خط السير..." 
                         value={stationSearchQuery}
                         onChange={(e) => setStationSearchQuery(e.target.value)}
                         className="w-full bg-transparent outline-none text-xs font-bold h-full"
                       />
                       {stationSearchQuery && <button onClick={() => setStationSearchQuery('')}><X size={14} className="text-slate-400 hover:text-rose-500"/></button>}
                     </div>
                     {!isGuest && (
                       <button onClick={() => setShowAddStation(true)} className="flex items-center justify-center gap-1 px-3.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors shrink-0 h-full text-xs font-black shadow-sm">
                         <Plus size={16}/>
                         <span>إضافة موقف</span>
                       </button>
                     )}
                   </div>

                   {/* شريط فلاتر المحافظات والمناطق + حالة الزحام */}
                   <div className="flex items-center justify-between gap-2 flex-wrap pt-0.5">
                     <div className="flex items-center gap-1.5 overflow-x-auto flex-1 [&::-webkit-scrollbar]:hidden">
                       <button
                         type="button"
                         onClick={() => setStationLocationFilter('all')}
                         className={`px-2.5 py-1 rounded-lg text-[10px] font-black border shrink-0 transition-all ${
                           stationLocationFilter === 'all'
                             ? 'bg-indigo-600 text-white border-indigo-600'
                             : 'bg-slate-50 dark:bg-slate-800 text-slate-500 border-slate-200 dark:border-slate-700'
                         }`}
                       >
                         كل المحافظات ({stations.length})
                       </button>
                       {availableStationLocations.map(loc => (
                         <button
                           key={loc}
                           type="button"
                           onClick={() => setStationLocationFilter(loc)}
                           className={`px-2.5 py-1 rounded-lg text-[10px] font-black border shrink-0 transition-all ${
                             stationLocationFilter === loc
                               ? 'bg-indigo-600 text-white border-indigo-600'
                               : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                           }`}
                         >
                           📍 {loc}
                         </button>
                       ))}
                     </div>

                     <div className="flex gap-1 shrink-0">
                       {[
                         { id: 'all', label: 'الكل' },
                         { id: 'empty', label: '🟢 رايق' },
                         { id: 'crowded', label: '🔴 زحمة' }
                       ].map(cf => (
                         <button
                           key={cf.id}
                           type="button"
                           onClick={() => setStationCrowdFilter(cf.id)}
                           className={`px-2 py-1 rounded-lg text-[10px] font-black border transition-all ${
                             stationCrowdFilter === cf.id
                               ? 'bg-slate-800 text-white dark:bg-white dark:text-slate-900'
                               : 'bg-slate-50 dark:bg-slate-800 text-slate-500 border-slate-200 dark:border-slate-700'
                           }`}
                         >
                           {cf.label}
                         </button>
                       ))}
                     </div>
                   </div>
                 </div>

                 {/* كروت المواقف بتصميم مبسط وواضح جداً */}
                 {visibleStations.length === 0 ? (
                   <div className={`text-center py-12 px-4 rounded-2xl border-2 border-dashed col-span-1 md:col-span-2 lg:col-span-3 ${isDarkMode ? 'border-slate-800 bg-slate-900/50' : 'border-slate-200 bg-slate-50'}`}>
                     <BusFront size={34} className="mx-auto text-slate-300 mb-2"/>
                     <h3 className="font-bold text-xs sm:text-sm text-slate-500 mb-3">لا توجد مواقف مسجلة تطابق هذا البحث</h3>
                     <div className="flex justify-center gap-2">
                       {!isGuest && (
                         <button onClick={() => setShowAddStation(true)} className="px-3.5 py-2 bg-emerald-600 text-white rounded-xl text-xs font-black inline-flex items-center gap-1 shadow-sm">
                           <Plus size={14}/> أضف هذا الموقف الآن
                         </button>
                       )}
                       <button onClick={() => setShowBesoModal(true)} className="px-3.5 py-2 bg-indigo-600 text-white rounded-xl text-xs font-black inline-flex items-center gap-1 shadow-sm">
                         <Bot size={14}/> اسأل "بيسو"
                       </button>
                     </div>
                   </div>
                 ) : (
                   visibleStations.map(station => {
                     const approvedRoutes = (station.routes || []).filter(r => isAdmin || r.status !== 'pending');
                     return (
                       <div 
                         key={station.id} 
                         onClick={() => setSelectedStation(station)} 
                         className={`p-3.5 rounded-2xl border shadow-sm hover:shadow-md cursor-pointer transition-all flex flex-col justify-between gap-3 ${bgCard} hover:border-indigo-500/60`}
                       >
                         {/* رأس كارت الموقف */}
                         <div className="flex justify-between items-start gap-2">
                           <div className="flex items-center gap-2.5 min-w-0">
                             <div className="w-10 h-10 bg-indigo-600/10 text-indigo-600 dark:text-indigo-400 rounded-xl flex items-center justify-center shrink-0">
                               <BusFront size={20}/>
                             </div>
                             <div className="min-w-0">
                               <h3 className={`font-black text-sm sm:text-base truncate ${textPrimary}`}>
                                 {station.name}
                               </h3>
                               <p className="text-[11px] font-bold text-slate-400 truncate mt-0.5">
                                 📍 {station.governorate && station.governorate !== station.location ? `${station.governorate} - ${station.location}` : station.location}
                               </p>
                             </div>
                           </div>

                           <div className="flex flex-col items-end gap-1 shrink-0">
                             {station.crowdStatus === 'crowded' && <span className="text-[9px] bg-rose-500/15 text-rose-500 px-2 py-0.5 rounded-md font-black border border-rose-500/20">🔴 زحمة</span>}
                             {station.crowdStatus === 'empty' && <span className="text-[9px] bg-emerald-500/15 text-emerald-500 px-2 py-0.5 rounded-md font-black border border-emerald-500/20">🟢 رايق</span>}
                             {station.status === 'pending' && <span className="text-[9px] bg-amber-500/15 text-amber-500 px-2 py-0.5 rounded-md font-black">قيد المراجعة</span>}
                             <span className="text-[10px] font-black text-indigo-500 bg-indigo-500/10 px-2 py-0.5 rounded-md">
                               {approvedRoutes.length} خطوط
                             </span>
                           </div>
                         </div>

                         {/* عرض مبسط لأهم الخطوط والأجرة داخل الموقف بدون أنيميشن معقد */}
                         {approvedRoutes.length > 0 ? (
                           <div className="flex flex-wrap gap-1.5 p-2 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
                             {approvedRoutes.slice(0, 4).map((route, i) => (
                               <span key={i} className="inline-flex items-center gap-1 text-[10px] font-bold bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 px-2 py-1 rounded-lg border border-slate-200/80 dark:border-slate-700">
                                 <span className="truncate max-w-[110px]">{route.destinationDetails || route.destination}</span>
                                 <strong className="text-emerald-500 font-black">{route.fare}ج</strong>
                               </span>
                             ))}
                             {approvedRoutes.length > 4 && (
                               <span className="text-[10px] font-black text-indigo-500 px-1.5 py-1">
                                 +{approvedRoutes.length - 4} خطوط أخرى
                               </span>
                             )}
                           </div>
                         ) : (
                           <div className="text-[10px] font-bold text-slate-400 bg-slate-50 dark:bg-slate-800/40 p-2 rounded-xl text-center border border-dashed dark:border-slate-800">
                             لا توجد خطوط مسجلة بعد — اضغط لإضافة خط سير
                           </div>
                         )}

                         {/* أزرار سريعة أسفل كارت الموقف */}
                         <div className="flex items-center gap-1.5 pt-0.5">
                           <a 
                             href={station.mapUrl || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(station.name + ' ' + station.location)}`} 
                             target="_blank" 
                             rel="noreferrer" 
                             onClick={(e) => e.stopPropagation()} 
                             className="py-2 px-3 rounded-xl bg-rose-500/10 text-rose-500 hover:bg-rose-500 hover:text-white text-[11px] font-black flex items-center justify-center gap-1 transition-colors shrink-0"
                           >
                             <MapPinned size={13}/> الخريطة
                           </a>
                           <button 
                             onClick={(e) => { e.stopPropagation(); setSelectedStation({...station, startInAddMode: true}); }} 
                             className="py-2 px-3 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-indigo-600 hover:text-white text-[11px] font-black flex items-center justify-center gap-1 transition-colors shrink-0"
                           >
                             <Plus size={13}/> أضف خط
                           </button>
                           <button className="flex-1 py-2 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-black flex items-center justify-center gap-1 transition-colors shadow-sm">
                             <span>عرض الخطوط</span>
                             <ChevronLeftIcon size={13}/>
                           </button>
                         </div>
                       </div>
                     );
                   })
                 )}
               </>
             ) : (
               <>
                 {/* 1. الكارت المتحرك المدمج (مُصغّر بحجم رشيق عبر خاصية compact) */}
                 {hasAreaOrSearchFilter && exactMatchedTrips.length > 0 && (
                   <div className="col-span-1 md:col-span-2 lg:col-span-3 mb-0.5">
                     <div className={`p-2 rounded-2xl border transition-all max-w-xl mx-auto ${
                       isDarkMode 
                         ? 'bg-gradient-to-b from-indigo-950/25 to-slate-900/90 border-indigo-500/30 shadow-sm' 
                         : 'bg-gradient-to-b from-indigo-50/50 to-white border-indigo-200/80 shadow-sm'
                     }`}>
                       <div className="flex items-center justify-between gap-1.5 mb-1.5 px-1">
                         <div className="flex items-center gap-1 min-w-0">
                           <span className="w-4 h-4 rounded-full bg-emerald-500/15 text-emerald-500 flex items-center justify-center shrink-0">
                             <Sparkles size={10} />
                           </span>
                           <h3 className="text-[10px] sm:text-xs font-black text-emerald-600 dark:text-emerald-400 truncate">
                             مطابق لمنطقتك ({exactMatchedTrips.length})
                           </h3>
                         </div>

                         <div className="flex items-center gap-1 shrink-0">
                           {!showAllAreaTrips && exactMatchedTrips.length > 1 && (
                             <div className="flex items-center gap-0.5 bg-white/80 dark:bg-slate-800 px-1.5 py-0.5 rounded-lg border border-slate-200 dark:border-slate-700">
                               <button type="button" onClick={prevAreaTrip} className="p-0.5 hover:text-indigo-500"><ChevronRight size={12} /></button>
                               <span className="text-[9px] font-black text-indigo-500 px-0.5">{areaSlideIndex + 1}/{exactMatchedTrips.length}</span>
                               <button type="button" onClick={nextAreaTrip} className="p-0.5 hover:text-indigo-500"><ChevronLeft size={12} /></button>
                             </div>
                           )}

                           {exactMatchedTrips.length > 1 && (
                             <button
                               type="button"
                               onClick={() => setShowAllAreaTrips(prev => !prev)}
                               className={`px-2 py-0.5 rounded-lg text-[9px] font-black flex items-center gap-1 transition-all ${
                                 showAllAreaTrips ? 'bg-slate-800 text-white dark:bg-slate-700' : 'bg-indigo-600 text-white hover:bg-indigo-700'
                               }`}
                             >
                               <Layers size={10} />
                               <span>{showAllAreaTrips ? 'ضم' : 'عرض الكل'}</span>
                             </button>
                           )}
                         </div>
                       </div>

                       {!showAllAreaTrips ? (
                         <div
                           onMouseEnter={() => setIsAreaCarouselPaused(true)}
                           onMouseLeave={() => setIsAreaCarouselPaused(false)}
                           onTouchStart={handleAreaTouchStart}
                           onTouchMove={handleAreaTouchMove}
                           onTouchEnd={handleAreaTouchEnd}
                           className="relative overflow-hidden"
                         >
                           {currentSpotlightTrip && (
                             <div key={currentSpotlightTrip.id + '_' + areaSlideIndex} className="animate-card-slide-ltr">
                               <TripCard 
                                 compact={true}
                                 trip={currentSpotlightTrip} 
                                 user={user} 
                                 isAdmin={isAdmin} 
                                 isDarkMode={isDarkMode} 
                                 openChatFromTrip={openChatFromTrip} 
                                 triggerToast={triggerToast} 
                                 matchBadge={getMatchBadgeForTrip(currentSpotlightTrip)}
                                 onOpenPublicProfile={onOpenPublicProfile}
                               />
                             </div>
                           )}
                         </div>
                       ) : (
                         <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 pt-1 animate-fade-in-up">
                           {exactMatchedTrips.map(trip => (
                             <TripCard 
                               key={trip.id}
                               compact={true}
                               trip={trip} 
                               user={user} 
                               isAdmin={isAdmin} 
                               isDarkMode={isDarkMode} 
                               openChatFromTrip={openChatFromTrip} 
                               triggerToast={triggerToast} 
                               matchBadge={getMatchBadgeForTrip(trip)}
                               onOpenPublicProfile={onOpenPublicProfile}
                             />
                           ))}
                         </div>
                       )}
                     </div>
                   </div>
                 )}

                 {/* 2. تنبيه سلس في حال عدم وجود رحلات مطابقة للبحث */}
                 {hasAreaOrSearchFilter && exactMatchedTrips.length === 0 && currentTripsToDisplay.length > 0 && (
                   <div className="col-span-1 md:col-span-2 lg:col-span-3 flex flex-col sm:flex-row items-center justify-between gap-2.5 px-4 py-3 mb-1 rounded-2xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/50">
                     <span className="text-xs font-bold text-amber-700 dark:text-amber-400 flex items-center gap-1.5 text-center sm:text-right leading-relaxed">
                       <Compass size={16} className="shrink-0"/> 
                       لم نجد رحلات مطابقة لـ "{filterFrom || filterTo || activeUserAreas.join('، ')}" حالياً، نعرض لك الرحلات المتاحة في المناطق المجاورة:
                     </span>
                     {(filterFrom || activeUserAreas.length > 0) && filterTo && !showCompletedTrips && (
                       <button onClick={handleSetAlert} className="shrink-0 text-[11px] font-black bg-white dark:bg-slate-800 text-amber-600 dark:text-amber-400 px-3 py-1.5 rounded-xl shadow-sm flex items-center gap-1 hover:scale-105 transition-transform border border-amber-200 dark:border-slate-700">
                         <Bell size={13} className="animate-pulse" /> بلّغني عند توفرها
                       </button>
                     )}
                   </div>
                 )}

                 {/* 3. في حال كان النظام بالكامل فارغاً */}
                 {currentTripsToDisplay.length === 0 && (
                    <div className={`text-center py-12 px-4 rounded-[2rem] border-2 border-dashed col-span-1 md:col-span-2 lg:col-span-3 ${isDarkMode ? 'border-slate-800 bg-slate-900/50' : 'border-slate-200 bg-slate-50'}`}>
                      <Car size={38} className="mx-auto text-slate-400 mb-2 opacity-50"/>
                      <h3 className="font-bold text-xs sm:text-sm text-slate-500">
                        {showCompletedTrips ? 'لا توجد رحلات مكتملة في هذا القسم' : 'لا توجد رحلات مطابقة لهذا الفلتر حالياً'}
                      </h3>
                      {quickFilter !== 'all' && (
                        <button
                          onClick={() => setQuickFilter('all')}
                          className="mt-3 px-4 py-1.5 bg-indigo-600 text-white rounded-xl text-xs font-black"
                        >
                          إظهار كل الرحلات
                        </button>
                      )}
                    </div>
                 )}

                 {/* 4. عرض الكروت العادية */}
                 {similarTrips.length > 0 && (
                   <>
                     <div className="col-span-1 md:col-span-2 lg:col-span-3 flex items-center justify-between px-1 mt-1 pt-2 border-t border-slate-200 dark:border-slate-800">
                       <span className="text-xs font-black text-indigo-600 dark:text-indigo-400 flex items-center gap-1.5">
                         <Compass size={15}/> 
                         {hasAreaOrSearchFilter 
                           ? `رحلات من المناطق المجاورة ومقترحات ذكية (${similarTrips.length})`
                           : `جميع الرحلات المتاحة (${similarTrips.length})`}
                       </span>
                       <button
                         type="button"
                         onClick={handleReshuffleTrips}
                         className="text-[10px] sm:text-xs font-black text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/50 px-2.5 py-1 rounded-lg border border-indigo-200 dark:border-indigo-800/60 flex items-center gap-1 hover:bg-indigo-100 active:scale-95 transition-all"
                       >
                         <Shuffle size={12} /> خلط الكروت
                       </button>
                     </div>

                     {similarTrips.map(trip => {
                       const isNear = activeUserAreas.length > 0 && activeUserAreas.some(a => isNearbyArea(trip.from, a));
                       const isUrgent = !showCompletedTrips && isLeavingSoon(trip.date, trip.time);
                       let badge = null;
                       if (isUrgent) badge = 'تنطلق قريباً 🔥';
                       else if (isNear) badge = 'منطقة قريبة منك 📍';
                       else if (hasAreaOrSearchFilter) badge = 'مقترح ذكي 💡';

                       return (
                         <TripCard 
                           key={trip.id} 
                           trip={trip} 
                           user={user} 
                           isAdmin={isAdmin} 
                           isDarkMode={isDarkMode} 
                           openChatFromTrip={openChatFromTrip} 
                           triggerToast={triggerToast} 
                           matchBadge={badge}
                           onOpenPublicProfile={onOpenPublicProfile}
                         />
                       );
                     })}
                   </>
                 )}
               </>
             )}
          </div>
        </div>
      )}

      {viewMode === 'map' && (
        <div className="space-y-4 animate-fade-in-up">
          <div className={`p-5 rounded-[2rem] border shadow-sm ${bgCard}`}>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
              <div>
                <h3 className={`font-black text-base sm:text-lg flex items-center gap-2 ${textPrimary}`}>
                  <MapPinned size={22} className="text-emerald-500" /> مستكشف مناطق وخطوط "طريقنا" التفاعلي
                </h3>
                <p className="text-xs font-bold text-slate-400 mt-0.5">
                  اضغط على أي منطقة لاستعراض الرحلات النشطة بها فوراً أو افتح موقع المواقف على Google Maps
                </p>
              </div>
              <button
                onClick={() => setShowBesoModal(true)}
                className="px-3.5 py-2 rounded-xl bg-indigo-600 text-white text-xs font-black flex items-center gap-1.5 self-start sm:self-auto shadow-sm"
              >
                <Bot size={15} /> اسأل بيسو عن طريقك
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5">
              {SUPPORTED_AREAS.map(area => {
                const count = areaTripCounts[area] || 0;
                const isMyArea = activeUserAreas.includes(area);
                return (
                  <button
                    key={area}
                    onClick={() => {
                      setFilterFrom(area);
                      setViewMode('list');
                      setHomeCategory('travel');
                      triggerToast(`تم عرض رحلات منطقة: ${area} 📍`);
                    }}
                    className={`p-3 rounded-2xl border text-right transition-all hover:scale-[1.02] active:scale-95 flex flex-col justify-between gap-2 ${
                      isMyArea
                        ? 'bg-indigo-600/10 border-indigo-500 text-indigo-400'
                        : count > 0
                        ? (isDarkMode ? 'bg-slate-800/80 border-slate-700 hover:border-emerald-500/50' : 'bg-slate-50 border-slate-200 hover:border-emerald-400')
                        : (isDarkMode ? 'bg-slate-900/40 border-slate-800/80 opacity-60' : 'bg-slate-50/50 border-slate-200/60 opacity-60')
                    }`}
                  >
                    <div className="flex items-center justify-between w-full">
                      <span className={`text-xs font-black truncate ${textPrimary}`}>{area}</span>
                      <MapPin size={13} className={count > 0 ? 'text-emerald-500 shrink-0' : 'text-slate-400 shrink-0'} />
                    </div>
                    <div className="flex items-center justify-between w-full">
                      <span className={`text-[10px] font-black px-2 py-0.5 rounded-md ${
                        count > 0 ? 'bg-emerald-500/15 text-emerald-500' : 'bg-slate-500/10 text-slate-400'
                      }`}>
                        {count > 0 ? `${count} رحلة نشطة` : 'لا توجد رحلات'}
                      </span>
                      {isMyArea && <span className="text-[9px] font-black text-indigo-400">منطقتك ⭐</span>}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {visibleStations.length > 0 && (
            <div className={`p-5 rounded-[2rem] border shadow-sm ${bgCard}`}>
              <h4 className={`font-black text-sm mb-3 flex items-center gap-1.5 ${textPrimary}`}>
                <BusFront size={18} className="text-indigo-500" /> مواقع المواقف المباشرة على الخريطة ({visibleStations.length})
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                {visibleStations.map(st => (
                  <a
                    key={st.id}
                    href={st.mapUrl || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(st.name + ' ' + st.location)}`}
                    target="_blank"
                    rel="noreferrer"
                    className={`p-3 rounded-xl border flex items-center justify-between transition-all hover:border-rose-500 ${
                      isDarkMode ? 'bg-slate-800/60 border-slate-700' : 'bg-slate-50 border-slate-200'
                    }`}
                  >
                    <div>
                      <p className={`text-xs font-black ${textPrimary}`}>{st.name}</p>
                      <p className="text-[10px] font-bold text-slate-400">{st.location} • {st.routes?.length || 0} خطوط</p>
                    </div>
                    <span className="px-2.5 py-1.5 rounded-lg bg-rose-500/10 text-rose-500 text-[10px] font-black flex items-center gap-1">
                      <MapPinned size={12} /> فتح الخريطة
                    </span>
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {showBesoModal && (
        <BesoAssistantModal
          stations={stations}
          isDarkMode={isDarkMode}
          onClose={() => setShowBesoModal(false)}
          onSelectStation={(st) => setSelectedStation(st)}
          userAreas={activeUserAreas}
          user={user}
          isAdmin={isAdmin}
        />
      )}

      {/* نافذة إضافة موقف جديد المبسطة والشاملة لكل المحافظات والمناطق */}
      {showAddStation && (
        <div className="fixed inset-0 bg-slate-900/90 backdrop-blur-sm z-[999] flex justify-center items-center p-4 pointer-events-auto">
          <div className={`${bgCard} w-full max-w-sm rounded-[2rem] p-6 shadow-2xl flex flex-col border animate-fade-in-up dark:border-slate-700`}>
             <div className="flex justify-between items-center mb-4">
               <h3 className={`font-black text-base sm:text-lg flex items-center gap-2 ${textPrimary}`}>
                 <BusFront size={20} className="text-indigo-500" /> إضافة موقف جديد
               </h3>
               <button onClick={() => setShowAddStation(false)} className="p-1.5 bg-slate-100 dark:bg-slate-800 rounded-full hover:bg-rose-100 hover:text-rose-500 transition-colors"><X size={18}/></button>
             </div>
             <form onSubmit={handleAddStation} className="space-y-3.5">
                <div>
                  <label className="text-[11px] font-black text-slate-500 block mb-1 px-1">اسم الموقف *</label>
                  <input 
                    type="text" 
                    required 
                    placeholder="مثال: موقف عبود / موقف الحصري / موقف شبين" 
                    value={newStationName} 
                    onChange={e => setNewStationName(e.target.value)} 
                    className={`w-full p-3 rounded-xl border text-xs font-bold outline-none ${bgInput}`}
                  />
                </div>
                
                <div>
                  <label className="text-[11px] font-black text-slate-500 block mb-1 px-1">المحافظة أو المنطقة التابع لها الموقف *</label>
                  <select 
                    required 
                    value={newStationLoc} 
                    onChange={e => {
                      const val = e.target.value;
                      setNewStationLoc(val);
                      if (EGYPT_CITIES.includes(val)) setNewStationGov(val);
                    }} 
                    className={`w-full p-3 rounded-xl border text-xs font-bold outline-none ${bgInput}`}
                  >
                    <option value="" disabled>اختر المحافظة أو المنطقة...</option>
                    <optgroup label="🏛️ محافظات مصر (27 محافظة)">
                      {EGYPT_CITIES.map(c => <option key={`st_gov_${c}`} value={c}>محافظة {c}</option>)}
                    </optgroup>
                    <optgroup label="📍 المدن والمناطق الحيوية">
                      {SUPPORTED_AREAS.map(c => <option key={`st_area_${c}`} value={c}>{c}</option>)}
                    </optgroup>
                  </select>
                </div>

                <div>
                  <label className="text-[11px] font-black text-slate-500 block mb-1 px-1">رابط جوجل ماب للموقف (اختياري)</label>
                  <input 
                    type="url" 
                    placeholder="https://maps.google.com/..." 
                    value={newStationMapUrl} 
                    onChange={e => setNewStationMapUrl(e.target.value)} 
                    className={`w-full p-3 rounded-xl border text-xs font-bold outline-none ${bgInput}`} 
                    dir="ltr"
                  />
                </div>

                <button type="submit" disabled={isSubmittingStation} className="w-full bg-indigo-600 text-white py-3.5 rounded-xl font-black text-xs sm:text-sm flex justify-center items-center gap-2 mt-2 hover:bg-indigo-700 active:scale-95 transition-transform shadow-md">
                  {isSubmittingStation ? <Loader2 size={18} className="animate-spin"/> : 'حفظ الموقف الآن ✅'}
                </button>
             </form>
          </div>
        </div>
      )}

    </main>
  );
};

export default HomeScreen;