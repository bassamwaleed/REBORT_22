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
  onOpenPublicProfile, hasActiveTracker = false
}) => {
  
  const [stationSearchQuery, setStationSearchQuery] = useState('');
  const [stationCrowdFilter, setStationCrowdFilter] = useState('all'); 
  const [stationLocationFilter, setStationLocationFilter] = useState('all'); 
  const [showCompletedTrips, setShowCompletedTrips] = useState(false); 
  const [isScrolling, setIsScrolling] = useState(false);
  const [quickFilter, setQuickFilter] = useState('all'); 

  const [locationPickerType, setLocationPickerType] = useState(null);
  const [locationPickerSearch, setLocationPickerSearch] = useState('');

  const [areaSlideIndex, setAreaSlideIndex] = useState(0);
  const [showAllAreaTrips, setShowAllAreaTrips] = useState(false);
  const [isAreaCarouselPaused, setIsAreaCarouselPaused] = useState(false);
  const [areaTouchStart, setAreaTouchStart] = useState(null);
  const [areaTouchEnd, setAreaTouchEnd] = useState(null);
  const [shuffleSeed, setShuffleSeed] = useState(() => Math.random());
  const [showBesoModal, setShowBesoModal] = useState(false);

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

  const activeUserAreas = filterFrom ? [filterFrom] : (Array.isArray(userAreas) && userAreas.length > 0 ? userAreas : (userArea ? userArea.split('، ').filter(Boolean) : []));
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
    if (!showCompletedTrips && isLeavingSoon(trip.date, trip.time)) score += 40; 
    return score;
  };

  const smartShuffleList = (list, seed) => {
    if (!Array.isArray(list) || list.length <= 1) return list;
    const copy = [...list];
    let s = Math.floor(seed * 100000) || 12345;
    const nextRand = () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
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
    return [...smartShuffleList(urgentOrTop, shuffleSeed), ...smartShuffleList(others, shuffleSeed + 0.37)];
  }, [currentTripsToDisplay, activeUserAreas.join(','), filterTo, shuffleSeed, showCompletedTrips, hasAreaOrSearchFilter]);

  const similarTrips = useMemo(() => {
    if (!hasAreaOrSearchFilter) {
      const urgent = currentTripsToDisplay.filter(t => !showCompletedTrips && isLeavingSoon(t.date, t.time));
      const regular = currentTripsToDisplay.filter(t => !urgent.some(u => u.id === t.id));
      return [...smartShuffleList(urgent, shuffleSeed), ...smartShuffleList(regular, shuffleSeed + 0.51)];
    }
    const remaining = currentTripsToDisplay.filter(t => {
      if (exactMatchedTrips.some(exact => exact.id === t.id)) return false;
      const fromNearby = activeUserAreas.length > 0 && activeUserAreas.some(a => isNearbyArea(t.from, a) || isAreaMatch(t.to, a));
      const toNearby = filterTo && (isAreaMatch(t.to, filterTo) || isNearbyArea(t.to, filterTo));
      const sameCategoryFallback = currentTripsToDisplay.length > 0;
      return fromNearby || toNearby || sameCategoryFallback;
    });
    const strictlyNearby = remaining.filter(t => activeUserAreas.some(a => isNearbyArea(t.from, a) || isAreaMatch(t.to, a) || (Array.isArray(t.routeAreas) && t.routeAreas.some(r => isNearbyArea(r, a)))));
    const otherGeneral = remaining.filter(t => !strictlyNearby.some(n => n.id === t.id));
    return [...smartShuffleList(strictlyNearby, shuffleSeed + 0.19), ...smartShuffleList(otherGeneral, shuffleSeed + 0.73)];
  }, [currentTripsToDisplay, exactMatchedTrips, activeUserAreas.join(','), filterTo, shuffleSeed, hasAreaOrSearchFilter, showCompletedTrips]);

  useEffect(() => { setAreaSlideIndex(0); }, [homeCategory, filterType, filterFrom, filterTo, showCompletedTrips, quickFilter]);
  useEffect(() => {
    if (!hasAreaOrSearchFilter || showAllAreaTrips || isAreaCarouselPaused || exactMatchedTrips.length <= 1) return;
    const timer = setInterval(() => { setAreaSlideIndex(prev => (prev + 1) % exactMatchedTrips.length); }, 4500);
    return () => clearInterval(timer);
  }, [hasAreaOrSearchFilter, showAllAreaTrips, isAreaCarouselPaused, exactMatchedTrips.length]);

  const nextAreaTrip = () => { if (exactMatchedTrips.length > 1) setAreaSlideIndex(prev => (prev + 1) % exactMatchedTrips.length); };
  const prevAreaTrip = () => { if (exactMatchedTrips.length > 1) setAreaSlideIndex(prev => (prev === 0 ? exactMatchedTrips.length - 1 : prev - 1)); };

  const handleAreaTouchStart = (e) => { setIsAreaCarouselPaused(true); setAreaTouchEnd(null); setAreaTouchStart(e.targetTouches[0].clientX); };
  const handleAreaTouchMove = (e) => { setAreaTouchEnd(e.targetTouches[0].clientX); };
  const handleAreaTouchEnd = () => {
    setTimeout(() => setIsAreaCarouselPaused(false), 2500);
    if (!areaTouchStart || !areaTouchEnd) return;
    const distance = areaTouchStart - areaTouchEnd;
    if (distance > 45) nextAreaTrip();
    if (distance < -45) prevAreaTrip();
  };

  const handleReshuffleTrips = () => { setShuffleSeed(Math.random()); setAreaSlideIndex(0); triggerToast('تم تبديل الكروت 🔀'); };

  const handleSwapLocations = () => {
    if (!filterFrom && !filterTo && activeUserAreas.length === 1) { setFilterFrom(''); setFilterTo(activeUserAreas[0]); return; }
    const temp = filterFrom || (activeUserAreas.length === 1 ? activeUserAreas[0] : '');
    setFilterFrom(filterTo); setFilterTo(temp);
  };

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
    if (stationLocationFilter !== 'all' && s.location !== stationLocationFilter && s.governorate !== stationLocationFilter) return false;
    if (stationSearchQuery.trim() !== '') {
      const q = normalizeArabic(stationSearchQuery);
      const matchName = normalizeArabic(s.name).includes(q);
      const matchLoc = normalizeArabic(s.location).includes(q) || normalizeArabic(s.governorate).includes(q);
      const matchRoutes = Array.isArray(s.routes) && s.routes.some(r => normalizeArabic(r.destination).includes(q) || normalizeArabic(r.destinationDetails).includes(q));
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
    const interval = setInterval(() => { setCurrentSlide((prev) => (prev + 1) % banners.length); }, 4000); 
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
      setShowAddStation(false); setNewStationName(''); setNewStationGov(''); setNewStationLoc(''); setNewStationMapUrl('');
    } catch (err) { triggerToast('حدث خطأ أثناء الإضافة'); } finally { setIsSubmittingStation(false); }
  };

  const handleSetAlert = async () => {
    if (isGuest || !user) return triggerToast('سجل دخولك أولاً لتفعيل التنبيهات');
    const originForAlert = filterFrom || activeUserAreas[0];
    if (!originForAlert || !filterTo) return triggerToast('يرجى تحديد الانطلاق والوجهة أولاً');
    try {
      await addDoc(collection(db, 'trip_alerts'), {
        userId: user.uid, userName: user.displayName || 'مستخدم', from: originForAlert, to: filterTo, category: homeCategory, createdAt: new Date(), active: true 
      });
      triggerToast('تم تفعيل التنبيه بنجاح! 🔔');
    } catch (error) { triggerToast('حدث خطأ أثناء تفعيل التنبيه'); }
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
      SUPPORTED_AREAS.forEach(a => { if (isTripMatchingOriginOrRoute(t, a) || isAreaMatch(t.to, a)) counts[a] = (counts[a] || 0) + 1; });
    });
    return counts;
  }, [availableTripsList]);

  const filteredPickerAreas = SUPPORTED_AREAS.filter(a => !locationPickerSearch.trim() || normalizeArabic(a).includes(normalizeArabic(locationPickerSearch)));

  const bgInput = isDarkMode ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-400 focus:border-indigo-500' : 'bg-white border-slate-200 text-slate-900 focus:border-indigo-500';
  const textPrimary = isDarkMode ? 'text-white' : 'text-slate-900';
  const bgCard = isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200';
  const currentSpotlightTrip = exactMatchedTrips[areaSlideIndex] || exactMatchedTrips[0];

  return (
    <main className="flex-1 w-full max-w-6xl mx-auto px-2 sm:px-4 pt-2 pb-24 relative z-10">
      
      <style>{`
        @keyframes slideCardFromLeft {
          0% { opacity: 0; transform: translateX(-15px) scale(0.98); }
          100% { opacity: 1; transform: translateX(0) scale(1); }
        }
        .animate-card-slide-ltr {
          animation: slideCardFromLeft 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
      `}</style>

      {/* أيقونة المساعد الذكي */}
      <button
        type="button"
        onClick={() => setShowBesoModal(true)}
        className={`fixed ${hasActiveTracker ? 'bottom-[150px]' : 'bottom-[80px]'} left-3 sm:left-8 z-50 flex items-center gap-1.5 px-3 py-2.5 rounded-full bg-gradient-to-r from-indigo-600 via-violet-600 to-indigo-700 text-white shadow-xl shadow-indigo-500/30 border border-white/20 hover:scale-105 active:scale-95 transition-all duration-300 ${
          isScrolling ? 'translate-y-28 opacity-0 pointer-events-none scale-75' : 'translate-y-0 opacity-100 scale-100'
        }`}
      >
        <div className="relative flex items-center justify-center">
          <Bot size={20} className="animate-bounce" />
          <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-emerald-400 rounded-full border border-indigo-900"></span>
        </div>
        <span className="text-[11px] font-black tracking-tight">اسأل بيسو 🤖</span>
      </button>

      {/* نافذة اختيار المنطقة السريعة */}
      {locationPickerType && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-[950] flex justify-center items-end sm:items-center p-0 sm:p-4" onClick={() => setLocationPickerType(null)}>
          <div onClick={e => e.stopPropagation()} className={`${bgCard} w-full sm:max-w-md rounded-t-[2rem] sm:rounded-[2rem] p-4 shadow-2xl border dark:border-slate-700 animate-fade-in-up`}>
            <div className="flex items-center justify-between mb-3">
              <h3 className={`font-black text-sm flex items-center gap-1.5 ${textPrimary}`}>
                <MapPin size={16} className="text-indigo-500" />
                {locationPickerType === 'from' ? 'اختر نقطة الانطلاق (من)' : 'اختر الوجهة (إلى)'}
              </h3>
              <button onClick={() => setLocationPickerType(null)} className="p-1.5 rounded-full bg-slate-100 dark:bg-slate-800"><X size={16} /></button>
            </div>

            <div className={`flex items-center gap-2 px-3 py-2 rounded-xl border mb-2.5 ${bgInput}`}>
              <Search size={14} className="text-slate-400 shrink-0" />
              <input
                type="text" autoFocus placeholder="ابحث عن المنطقة..."
                value={locationPickerSearch} onChange={e => setLocationPickerSearch(e.target.value)}
                className="w-full bg-transparent outline-none text-xs font-bold"
              />
              {locationPickerSearch && <button onClick={() => setLocationPickerSearch('')}><X size={14} className="text-slate-400" /></button>}
            </div>

            <div className="grid grid-cols-2 gap-2 max-h-[42vh] overflow-y-auto p-0.5 [&::-webkit-scrollbar]:hidden">
              <button
                type="button"
                onClick={() => {
                  if (locationPickerType === 'from') setFilterFrom(''); else setFilterTo('');
                  setLocationPickerType(null); setLocationPickerSearch('');
                }}
                className={`col-span-2 p-2 rounded-xl text-xs font-black border transition-all flex items-center justify-center gap-1.5 ${
                  (locationPickerType === 'from' ? !filterFrom : !filterTo) ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                }`}
              >
                {locationPickerType === 'from' ? (activeUserAreas.length > 0 ? `منطقتي الحالية (${activeUserAreas.join('، ')})` : 'كل مناطق الانطلاق 🌍') : 'كل الوجهات المتاحة 🌍'}
              </button>

              {filteredPickerAreas.map(area => {
                const isSelected = locationPickerType === 'from' ? filterFrom === area : filterTo === area;
                return (
                  <button
                    key={area} type="button"
                    onClick={() => {
                      if (locationPickerType === 'from') setFilterFrom(area); else setFilterTo(area);
                      setLocationPickerType(null); setLocationPickerSearch('');
                    }}
                    className={`p-2.5 rounded-xl text-[11px] font-black border transition-all flex items-center justify-center gap-1 active:scale-95 ${
                      isSelected ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm' : 'bg-slate-50 dark:bg-slate-800/80 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:border-indigo-400'
                    }`}
                  >
                    {isSelected && <Check size={12} className="shrink-0" />}
                    <span className="truncate">{area}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* 1. البانر بحجم مدمج ومثالي للموبايل (h-28) */}
      {viewMode === 'list' && (
        <div className="mb-2 animate-fade-in-up">
          {appSettings?.bannerText && (
            <div className="mb-1.5 px-2 border-r-4 border-indigo-500">
              <h2 className={`font-black text-[11px] sm:text-xs ${textPrimary} leading-relaxed`}>{appSettings.bannerText}</h2>
            </div>
          )}

          {banners.length > 0 && (
            <div
              className="relative w-full h-28 sm:h-40 rounded-[1.25rem] overflow-hidden shadow-sm border dark:border-slate-800 bg-slate-100 dark:bg-slate-800 group"
              onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEndHandler}
            >
              {banners.map((imgUrl, idx) => (
                <img key={idx} src={imgUrl} alt={`Banner ${idx}`} className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-500 ease-in-out ${idx === currentSlide ? 'opacity-100 z-10' : 'opacity-0 z-0'}`} />
              ))}
              {banners.length > 1 && (
                <>
                  <button onClick={prevSlide} className="absolute right-1.5 top-1/2 -translate-y-1/2 z-20 bg-black/35 hover:bg-black/55 text-white p-1 rounded-full backdrop-blur-sm transition-all md:opacity-0 group-hover:opacity-100"><ChevronRight size={14} /></button>
                  <button onClick={nextSlide} className="absolute left-1.5 top-1/2 -translate-y-1/2 z-20 bg-black/35 hover:bg-black/55 text-white p-1 rounded-full backdrop-blur-sm transition-all md:opacity-0 group-hover:opacity-100"><ChevronLeft size={14} /></button>
                  <div className="absolute bottom-1.5 left-0 right-0 flex justify-center gap-1 z-20">
                    {banners.map((_, idx) => (
                      <button key={idx} onClick={() => setCurrentSlide(idx)} className={`h-1 rounded-full transition-all duration-300 shadow-sm ${idx === currentSlide ? 'w-4 bg-indigo-600' : 'w-1.5 bg-white/80 hover:bg-white'}`}></button>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      )}

      {/* 2. شريط الأقسام الأربعة بارتفاع رشيق (py-1.5) للموبايل لتقليل الزحمة */}
      <div className="grid grid-cols-4 gap-1 sm:gap-2 mb-2 pointer-events-auto relative z-10">
        <button
          onClick={() => { setViewMode('list'); setHomeCategory('travel'); setFilterTo(''); setShowCompletedTrips(false); }}
          className={`relative flex flex-col items-center justify-center py-1.5 sm:py-2 px-1 rounded-xl border transition-all duration-200 ${
            viewMode === 'list' && homeCategory === 'travel' ? 'bg-indigo-600 text-white border-indigo-600 shadow-md scale-[1.01]' : `${bgCard} text-slate-600 dark:text-slate-300 hover:border-indigo-400`
          }`}
        >
          {availableTravelCount > 0 && (
            <span className={`absolute top-1 left-1 px-1.5 py-0.2 rounded-full text-[8px] font-black ${viewMode === 'list' && homeCategory === 'travel' ? 'bg-white text-indigo-600' : 'bg-rose-500 text-white'}`}>
              {availableTravelCount}
            </span>
          )}
          <Car size={16} className="mb-0.5 shrink-0" />
          <span className="text-[10px] sm:text-[11px] font-black tracking-tight">سفريات</span>
        </button>

        <button
          onClick={() => { setViewMode('list'); setHomeCategory('parcel'); setFilterTo(''); setShowCompletedTrips(false); }}
          className={`relative flex flex-col items-center justify-center py-1.5 sm:py-2 px-1 rounded-xl border transition-all duration-200 ${
            viewMode === 'list' && homeCategory === 'parcel' ? 'bg-indigo-600 text-white border-indigo-600 shadow-md scale-[1.01]' : `${bgCard} text-slate-600 dark:text-slate-300 hover:border-indigo-400`
          }`}
        >
          {availableParcelCount > 0 && (
            <span className={`absolute top-1 left-1 px-1.5 py-0.2 rounded-full text-[8px] font-black ${viewMode === 'list' && homeCategory === 'parcel' ? 'bg-white text-indigo-600' : 'bg-rose-500 text-white'}`}>
              {availableParcelCount}
            </span>
          )}
          <Package size={16} className="mb-0.5 shrink-0" />
          <span className="text-[10px] sm:text-[11px] font-black tracking-tight">توصيل</span>
        </button>

        <button
          onClick={() => { setViewMode('list'); setHomeCategory('stations'); setFilterTo(''); }}
          className={`relative flex flex-col items-center justify-center py-1.5 sm:py-2 px-1 rounded-xl border transition-all duration-200 ${
            viewMode === 'list' && homeCategory === 'stations' ? 'bg-indigo-600 text-white border-indigo-600 shadow-md scale-[1.01]' : `${bgCard} text-slate-600 dark:text-slate-300 hover:border-indigo-400`
          }`}
        >
          <BusFront size={16} className="mb-0.5 shrink-0" />
          <span className="text-[10px] sm:text-[11px] font-black tracking-tight">مواقف مصر</span>
        </button>

        <button
          onClick={() => setViewMode(viewMode === 'list' ? 'map' : 'list')}
          className={`relative flex flex-col items-center justify-center py-1.5 sm:py-2 px-1 rounded-xl border transition-all duration-200 ${
            viewMode === 'map' ? 'bg-emerald-600 text-white border-emerald-600 shadow-md scale-[1.01]' : `${bgCard} text-slate-600 dark:text-slate-300 hover:border-indigo-400`
          }`}
        >
          {viewMode === 'map' ? <List size={16} className="mb-0.5 shrink-0" /> : <MapPinned size={16} className="mb-0.5 shrink-0" />}
          <span className="text-[10px] sm:text-[11px] font-black tracking-tight">{viewMode === 'map' ? 'القائمة' : 'الخريطة'}</span>
        </button>
      </div>

      {viewMode === 'list' && (
        <div className="animate-fade-in-up">
          {/* صندوق الفلاتر مدمج جداً (p-1.5) لتقليل الارتفاع على الشاشة */}
          {(homeCategory === 'travel' || homeCategory === 'parcel') && (
            <div className={`mb-3 p-1.5 rounded-[1.25rem] border shadow-sm space-y-1.5 ${isDarkMode ? 'bg-slate-900/95 border-slate-800' : 'bg-white border-slate-200/80'}`}>

              {/* الصف الأول: سائق/راكب + زر البحث (من ⇄ إلى) */}
              <div className="flex items-center gap-1.5">
                {homeCategory === 'travel' && (
                  <div className={`flex p-0.5 rounded-lg border shrink-0 ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-slate-100 border-slate-200'}`}>
                    <button onClick={() => setFilterType('offer')} className={`px-2 py-1 rounded text-[10px] font-black transition-all ${filterType === 'offer' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-500 dark:text-slate-400'}`}>سائق</button>
                    <button onClick={() => setFilterType('request')} className={`px-2 py-1 rounded text-[10px] font-black transition-all ${filterType === 'request' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-500 dark:text-slate-400'}`}>راكب</button>
                  </div>
                )}

                <button type="button" onClick={() => setLocationPickerType('from')} className={`flex-1 py-1 px-2 rounded-lg border text-[10px] font-bold text-right truncate min-w-0 ${bgInput}`}>
                  <span className="truncate">{filterFrom ? `من: ${filterFrom}` : activeUserAreas.length > 0 ? `من: منطقتك (${activeUserAreas.length})` : 'من: الكل'}</span>
                </button>

                <button type="button" onClick={handleSwapLocations} className={`p-1 rounded-lg border transition-all active:scale-90 shrink-0 ${isDarkMode ? 'bg-slate-800 border-slate-700 text-indigo-400' : 'bg-slate-100 border-slate-200 text-indigo-600'}`} title="عكس الاتجاه">
                  <ArrowLeftRight size={12} />
                </button>

                <button type="button" onClick={() => setLocationPickerType('to')} className={`flex-1 py-1 px-2 rounded-lg border text-[10px] font-bold text-right truncate min-w-0 ${bgInput}`}>
                  <span className="truncate">{filterTo ? `إلى: ${filterTo}` : 'إلى: كل الوجهات'}</span>
                </button>

                {(filterFrom || filterTo) && (
                  <button onClick={() => { setFilterFrom(''); setFilterTo(''); }} className="p-1 bg-rose-100 text-rose-600 dark:bg-rose-900/30 dark:text-rose-400 rounded-lg hover:bg-rose-200 shrink-0" title="إلغاء الفلتر"><X size={12} /></button>
                )}
              </div>

              {/* الصف الثاني: الكبسولات السريعة (متاحة، تنطلق قريباً، إلخ + مكتملة) */}
              <div className="flex items-center gap-1 overflow-x-auto [&::-webkit-scrollbar]:hidden">
                {[
                  { id: 'all', label: `متاحة (${availableTripsList.length})` },
                  { id: 'urgent', label: 'قريباً 🔥' },
                  { id: 'verified', label: 'موثق 🛡️' },
                  { id: 'females', label: 'بنات 🌸' },
                  { id: 'ac', label: 'مكيفة ❄️' }
                ].map(chip => (
                  <button
                    key={chip.id}
                    type="button"
                    onClick={() => { setShowCompletedTrips(false); setQuickFilter(chip.id); }}
                    className={`px-2 py-0.5 rounded text-[9px] font-black border shrink-0 transition-all ${
                      !showCompletedTrips && quickFilter === chip.id
                        ? (chip.id === 'females' ? 'bg-pink-600 text-white border-pink-600' : 'bg-indigo-600 text-white border-indigo-600')
                        : (isDarkMode ? 'bg-slate-800/80 border-slate-700 text-slate-300' : 'bg-slate-50 border-slate-200 text-slate-600')
                    }`}
                  >
                    {chip.label}
                  </button>
                ))}

                <button
                  type="button"
                  onClick={() => setShowCompletedTrips(!showCompletedTrips)}
                  className={`px-2 py-0.5 rounded text-[9px] font-black border shrink-0 transition-all flex items-center gap-0.5 ${
                    showCompletedTrips ? 'bg-emerald-600 text-white border-emerald-600' : (isDarkMode ? 'bg-slate-800/80 border-slate-700 text-emerald-400' : 'bg-emerald-50 border-emerald-200 text-emerald-700')
                  }`}
                >
                  <CheckCircle2 size={10} />
                  <span>مكتملة ({completedTripsList.length})</span>
                </button>
              </div>

            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
             {homeCategory === 'stations' ? (
               <>
                 {/* صندوق البحث الموحد والفلاتر المبسطة للمواقف */}
                 <div className="col-span-1 md:col-span-2 lg:col-span-3 p-2.5 rounded-2xl border shadow-sm space-y-2 bg-white dark:bg-slate-900 dark:border-slate-800">
                   <div className="flex gap-1.5 h-9">
                     <div className={`flex-1 flex items-center gap-1.5 px-2.5 rounded-xl border ${bgInput} h-full`}>
                       <Search size={14} className="text-slate-400 shrink-0" />
                       <input 
                         type="text" 
                         placeholder="ابحث باسم الموقف أو خط السير..." 
                         value={stationSearchQuery}
                         onChange={(e) => setStationSearchQuery(e.target.value)}
                         className="w-full bg-transparent outline-none text-[11px] font-bold h-full"
                       />
                       {stationSearchQuery && <button onClick={() => setStationSearchQuery('')}><X size={13} className="text-slate-400 hover:text-rose-500"/></button>}
                     </div>
                     {!isGuest && (
                       <button onClick={() => setShowAddStation(true)} className="flex items-center justify-center gap-1 px-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors shrink-0 h-full text-[10px] font-black shadow-sm">
                         <Plus size={14}/> <span>أضف موقف</span>
                       </button>
                     )}
                   </div>

                   {/* شريط فلاتر المحافظات والمناطق + حالة الزحام */}
                   <div className="flex items-center justify-between gap-1.5 flex-wrap">
                     <div className="flex items-center gap-1 overflow-x-auto flex-1 [&::-webkit-scrollbar]:hidden">
                       <button
                         type="button"
                         onClick={() => setStationLocationFilter('all')}
                         className={`px-2 py-0.5 rounded text-[9px] font-black border shrink-0 transition-all ${
                           stationLocationFilter === 'all' ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-slate-50 dark:bg-slate-800 text-slate-500 border-slate-200 dark:border-slate-700'
                         }`}
                       >
                         كل المحافظات
                       </button>
                       {availableStationLocations.map(loc => (
                         <button
                           key={loc} type="button" onClick={() => setStationLocationFilter(loc)}
                           className={`px-2 py-0.5 rounded text-[9px] font-black border shrink-0 transition-all ${
                             stationLocationFilter === loc ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'
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
                           key={cf.id} type="button" onClick={() => setStationCrowdFilter(cf.id)}
                           className={`px-1.5 py-0.5 rounded text-[9px] font-black border transition-all ${
                             stationCrowdFilter === cf.id ? 'bg-slate-800 text-white dark:bg-white dark:text-slate-900' : 'bg-slate-50 dark:bg-slate-800 text-slate-500 border-slate-200 dark:border-slate-700'
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
                   <div className={`text-center py-10 px-4 rounded-2xl border-2 border-dashed col-span-1 md:col-span-2 lg:col-span-3 ${isDarkMode ? 'border-slate-800 bg-slate-900/50' : 'border-slate-200 bg-slate-50'}`}>
                     <BusFront size={30} className="mx-auto text-slate-300 mb-2"/>
                     <h3 className="font-bold text-xs text-slate-500 mb-2">لا توجد مواقف مطابقة لبحثك</h3>
                     {!isGuest && (
                       <button onClick={() => setShowAddStation(true)} className="px-3 py-1.5 bg-emerald-600 text-white rounded-xl text-[11px] font-black inline-flex items-center gap-1 shadow-sm">
                         <Plus size={13}/> أضف هذا الموقف
                       </button>
                     )}
                   </div>
                 ) : (
                   visibleStations.map(station => {
                     const approvedRoutes = (station.routes || []).filter(r => isAdmin || r.status !== 'pending');
                     return (
                       <div key={station.id} onClick={() => setSelectedStation(station)} className={`p-3 rounded-[1.25rem] border shadow-sm hover:shadow-md cursor-pointer transition-all flex flex-col justify-between gap-2.5 ${bgCard} hover:border-indigo-500/60`}>
                         <div className="flex justify-between items-start gap-2">
                           <div className="flex items-center gap-2 min-w-0">
                             <div className="w-9 h-9 bg-indigo-600/10 text-indigo-600 dark:text-indigo-400 rounded-xl flex items-center justify-center shrink-0">
                               <BusFront size={18}/>
                             </div>
                             <div className="min-w-0">
                               <h3 className={`font-black text-xs sm:text-sm truncate ${textPrimary}`}>{station.name}</h3>
                               <p className="text-[10px] font-bold text-slate-400 truncate mt-0.5">
                                 📍 {station.governorate && station.governorate !== station.location ? `${station.governorate} - ${station.location}` : station.location}
                               </p>
                             </div>
                           </div>

                           <div className="flex flex-col items-end gap-0.5 shrink-0">
                             {station.crowdStatus === 'crowded' && <span className="text-[8px] bg-rose-500/15 text-rose-500 px-1.5 py-0.2 rounded font-black border border-rose-500/20">🔴 زحمة</span>}
                             {station.crowdStatus === 'empty' && <span className="text-[8px] bg-emerald-500/15 text-emerald-500 px-1.5 py-0.2 rounded font-black border border-emerald-500/20">🟢 رايق</span>}
                             <span className="text-[9px] font-black text-indigo-500 bg-indigo-500/10 px-1.5 py-0.2 rounded mt-0.5">
                               {approvedRoutes.length} خطوط
                             </span>
                           </div>
                         </div>

                         {approvedRoutes.length > 0 ? (
                           <div className="flex flex-wrap gap-1 p-1.5 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
                             {approvedRoutes.slice(0, 4).map((route, i) => (
                               <span key={i} className="inline-flex items-center gap-1 text-[9px] font-bold bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 px-1.5 py-0.5 rounded border border-slate-200/80 dark:border-slate-700">
                                 <span className="truncate max-w-[90px]">{route.destinationDetails || route.destination}</span>
                                 <strong className="text-emerald-500 font-black">{route.fare}ج</strong>
                               </span>
                             ))}
                             {approvedRoutes.length > 4 && <span className="text-[9px] font-black text-indigo-500 px-1">+ المزيد</span>}
                           </div>
                         ) : (
                           <div className="text-[9px] font-bold text-slate-400 bg-slate-50 dark:bg-slate-800/40 p-1.5 rounded-lg text-center border border-dashed dark:border-slate-800">
                             لا توجد خطوط مسجلة — اضغط لإضافة خط
                           </div>
                         )}

                         <div className="flex items-center gap-1.5 pt-0.5">
                           <a href={station.mapUrl || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(station.name + ' ' + station.location)}`} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className="py-1.5 px-2 rounded-lg bg-rose-500/10 text-rose-500 hover:bg-rose-500 hover:text-white text-[10px] font-black flex items-center justify-center gap-1 transition-colors shrink-0">
                             <MapPinned size={12}/> الخريطة
                           </a>
                           <button className="flex-1 py-1.5 px-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-black flex items-center justify-center gap-1 transition-colors shadow-sm">
                             <span>عرض الخطوط</span> <ChevronLeftIcon size={12}/>
                           </button>
                         </div>
                       </div>
                     );
                   })
                 )}
               </>
             ) : (
               <>
                 {/* 1. الكارت المتحرك المدمج جداً للموبايل عبر خاصية compact */}
                 {hasAreaOrSearchFilter && exactMatchedTrips.length > 0 && (
                   <div className="col-span-1 md:col-span-2 lg:col-span-3 mb-0.5">
                     <div className={`p-1.5 rounded-2xl border transition-all max-w-xl mx-auto ${
                       isDarkMode ? 'bg-gradient-to-b from-indigo-950/25 to-slate-900/90 border-indigo-500/30' : 'bg-gradient-to-b from-indigo-50/50 to-white border-indigo-200/80'
                     }`}>
                       <div className="flex items-center justify-between gap-1 mb-1 px-1">
                         <div className="flex items-center gap-1 min-w-0">
                           <span className="w-4 h-4 rounded-full bg-emerald-500/15 text-emerald-500 flex items-center justify-center shrink-0"><Sparkles size={10} /></span>
                           <h3 className="text-[10px] sm:text-xs font-black text-emerald-600 dark:text-emerald-400 truncate">مطابق لمنطقتك ({exactMatchedTrips.length})</h3>
                         </div>

                         <div className="flex items-center gap-1 shrink-0">
                           {!showAllAreaTrips && exactMatchedTrips.length > 1 && (
                             <div className="flex items-center gap-0.5 bg-white/80 dark:bg-slate-800 px-1 py-0.5 rounded border border-slate-200 dark:border-slate-700">
                               <button type="button" onClick={prevAreaTrip} className="p-0.5 hover:text-indigo-500"><ChevronRight size={11} /></button>
                               <span className="text-[9px] font-black text-indigo-500 px-0.5">{areaSlideIndex + 1}/{exactMatchedTrips.length}</span>
                               <button type="button" onClick={nextAreaTrip} className="p-0.5 hover:text-indigo-500"><ChevronLeft size={11} /></button>
                             </div>
                           )}

                           {exactMatchedTrips.length > 1 && (
                             <button type="button" onClick={() => setShowAllAreaTrips(prev => !prev)} className={`px-2 py-0.5 rounded text-[9px] font-black flex items-center gap-0.5 transition-all ${showAllAreaTrips ? 'bg-slate-800 text-white dark:bg-slate-700' : 'bg-indigo-600 text-white'}`}>
                               <Layers size={9} /> <span>{showAllAreaTrips ? 'ضم' : 'الكل'}</span>
                             </button>
                           )}
                         </div>
                       </div>

                       {!showAllAreaTrips ? (
                         <div onMouseEnter={() => setIsAreaCarouselPaused(true)} onMouseLeave={() => setIsAreaCarouselPaused(false)} onTouchStart={handleAreaTouchStart} onTouchMove={handleAreaTouchMove} onTouchEnd={handleAreaTouchEnd} className="relative overflow-hidden">
                           {currentSpotlightTrip && (
                             <div key={currentSpotlightTrip.id + '_' + areaSlideIndex} className="animate-card-slide-ltr">
                               <TripCard compact={true} trip={currentSpotlightTrip} user={user} isAdmin={isAdmin} isDarkMode={isDarkMode} openChatFromTrip={openChatFromTrip} triggerToast={triggerToast} matchBadge={getMatchBadgeForTrip(currentSpotlightTrip)} onOpenPublicProfile={onOpenPublicProfile} />
                             </div>
                           )}
                         </div>
                       ) : (
                         <div className="grid grid-cols-1 md:grid-cols-2 gap-2 pt-1 animate-fade-in-up">
                           {exactMatchedTrips.map(trip => (
                             <TripCard key={trip.id} compact={true} trip={trip} user={user} isAdmin={isAdmin} isDarkMode={isDarkMode} openChatFromTrip={openChatFromTrip} triggerToast={triggerToast} matchBadge={getMatchBadgeForTrip(trip)} onOpenPublicProfile={onOpenPublicProfile} />
                           ))}
                         </div>
                       )}
                     </div>
                   </div>
                 )}

                 {/* 2. تنبيه عدم وجود رحلات مطابقة للبحث */}
                 {hasAreaOrSearchFilter && exactMatchedTrips.length === 0 && currentTripsToDisplay.length > 0 && (
                   <div className="col-span-1 md:col-span-2 lg:col-span-3 flex flex-col sm:flex-row items-center justify-between gap-1.5 px-3 py-2 mb-1 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/50">
                     <span className="text-[11px] font-bold text-amber-700 dark:text-amber-400 flex items-center gap-1 text-center sm:text-right">
                       <Compass size={14} className="shrink-0"/> 
                       نعرض لك الرحلات المجاورة لعدم توفر رحلات لـ "{filterFrom || filterTo || activeUserAreas.join('، ')}"
                     </span>
                     {(filterFrom || activeUserAreas.length > 0) && filterTo && !showCompletedTrips && (
                       <button onClick={handleSetAlert} className="shrink-0 text-[10px] font-black bg-white dark:bg-slate-800 text-amber-600 dark:text-amber-400 px-2 py-1 rounded-lg shadow-sm flex items-center gap-1 border border-amber-200 dark:border-slate-700">
                         <Bell size={11} className="animate-pulse" /> بلّغني عند توفرها
                       </button>
                     )}
                   </div>
                 )}

                 {/* 3. في حال كان النظام بالكامل فارغاً */}
                 {currentTripsToDisplay.length === 0 && (
                    <div className={`text-center py-10 px-4 rounded-[1.5rem] border-2 border-dashed col-span-1 md:col-span-2 lg:col-span-3 ${isDarkMode ? 'border-slate-800 bg-slate-900/50' : 'border-slate-200 bg-slate-50'}`}>
                      <Car size={34} className="mx-auto text-slate-400 mb-2 opacity-50"/>
                      <h3 className="font-bold text-xs text-slate-500">
                        {showCompletedTrips ? 'لا توجد رحلات مكتملة في هذا القسم' : 'لا توجد رحلات مطابقة لهذا الفلتر حالياً'}
                      </h3>
                      {quickFilter !== 'all' && (
                        <button onClick={() => setQuickFilter('all')} className="mt-2.5 px-3 py-1 bg-indigo-600 text-white rounded-lg text-[11px] font-black">
                          إظهار كل الرحلات
                        </button>
                      )}
                    </div>
                 )}

                 {/* 4. عرض الكروت العادية */}
                 {similarTrips.length > 0 && (
                   <>
                     <div className="col-span-1 md:col-span-2 lg:col-span-3 flex items-center justify-between px-1 mt-0.5 pt-1.5 border-t border-slate-200 dark:border-slate-800">
                       <span className="text-[11px] font-black text-indigo-600 dark:text-indigo-400 flex items-center gap-1">
                         <Compass size={13}/> 
                         {hasAreaOrSearchFilter ? `رحلات مجاورة ومقترحات (${similarTrips.length})` : `الرحلات المتاحة (${similarTrips.length})`}
                       </span>
                       <button onClick={handleReshuffleTrips} className="text-[9px] font-black text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/50 px-2 py-0.5 rounded border border-indigo-200 dark:border-indigo-800/60 flex items-center gap-0.5">
                         <Shuffle size={10} /> خلط الكروت
                       </button>
                     </div>

                     {similarTrips.map(trip => {
                       const isNear = activeUserAreas.length > 0 && activeUserAreas.some(a => isNearbyArea(trip.from, a));
                       const isUrgent = !showCompletedTrips && isLeavingSoon(trip.date, trip.time);
                       let badge = null;
                       if (isUrgent) badge = 'تنطلق قريباً 🔥';
                       else if (isNear) badge = 'منطقة قريبة 📍';
                       else if (hasAreaOrSearchFilter) badge = 'مقترح ذكي 💡';

                       return (
                         <TripCard 
                           key={trip.id} trip={trip} user={user} isAdmin={isAdmin} isDarkMode={isDarkMode} 
                           openChatFromTrip={openChatFromTrip} triggerToast={triggerToast} matchBadge={badge} onOpenPublicProfile={onOpenPublicProfile}
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
          <div className={`p-4 rounded-[1.5rem] border shadow-sm ${bgCard}`}>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
              <div>
                <h3 className={`font-black text-sm sm:text-base flex items-center gap-1.5 ${textPrimary}`}>
                  <MapPinned size={18} className="text-emerald-500" /> مستكشف المناطق التفاعلي
                </h3>
                <p className="text-[11px] font-bold text-slate-400 mt-0.5">اضغط على أي منطقة لاستعراض رحلاتها النشطة</p>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
              {SUPPORTED_AREAS.map(area => {
                const count = areaTripCounts[area] || 0;
                const isMyArea = activeUserAreas.includes(area);
                return (
                  <button
                    key={area}
                    onClick={() => { setFilterFrom(area); setViewMode('list'); setHomeCategory('travel'); }}
                    className={`p-2 rounded-xl border text-right transition-all flex flex-col gap-1.5 ${
                      isMyArea ? 'bg-indigo-600/10 border-indigo-500 text-indigo-400' : count > 0 ? (isDarkMode ? 'bg-slate-800/80 border-slate-700' : 'bg-slate-50 border-slate-200') : (isDarkMode ? 'bg-slate-900/40 border-slate-800/80 opacity-60' : 'bg-slate-50/50 border-slate-200/60 opacity-60')
                    }`}
                  >
                    <div className="flex items-center justify-between w-full">
                      <span className={`text-[11px] font-black truncate ${textPrimary}`}>{area}</span>
                      <MapPin size={11} className={count > 0 ? 'text-emerald-500 shrink-0' : 'text-slate-400 shrink-0'} />
                    </div>
                    <div className="flex items-center justify-between w-full">
                      <span className={`text-[9px] font-black px-1.5 py-0.2 rounded ${count > 0 ? 'bg-emerald-500/15 text-emerald-500' : 'bg-slate-500/10 text-slate-400'}`}>
                        {count > 0 ? `${count} رحلة نشطة` : 'لا توجد رحلات'}
                      </span>
                      {isMyArea && <span className="text-[8px] font-black text-indigo-400">منطقتك ⭐</span>}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </main>
  );
};

export default HomeScreen;
