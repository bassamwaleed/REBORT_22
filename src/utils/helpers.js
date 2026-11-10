import { useState } from 'react';

export const CITY_COORDS = {
  "القاهرة": [30.0444, 31.2357], "الجيزة": [30.0131, 31.2089], "الإسكندرية": [31.2001, 29.9187],
  "القليوبية": [30.4067, 31.1849], "المنوفية": [30.5972, 30.9876], "الغربية": [30.8754, 31.0335],
  "الدقهلية": [31.0364, 31.3807], "كفر الشيخ": [31.1107, 30.9388], "البحيرة": [31.0298, 30.4700],
  "الشرقية": [30.5877, 31.5020], "الإسماعيلية": [30.5965, 32.2715], "بورسعيد": [31.2565, 32.2841],
  "السويس": [29.9668, 32.5498], "دمياط": [31.4165, 31.8133], "شمال سيناء": [30.6128, 33.6054],
  "جنوب سيناء": [28.6406, 33.9729], "البحر الأحمر": [26.2361, 34.0152], "مطروح": [31.3525, 27.2453],
  "الفيوم": [29.3084, 30.8428], "بني سويف": [29.0661, 31.0994], "المنيا": [28.0871, 30.7618],
  "أسيوط": [27.1810, 31.1837], "سوهاج": [26.5591, 31.6957], "قنا": [26.1551, 32.7160],
  "الأقصر": [25.6872, 32.6396], "أسوان": [24.0889, 32.8998], "الوادي الجديد": [24.5456, 30.5526]
};

// إحداثيات دقيقة للمدن والمناطق الحيوية لدعم نظام الخرائط GIS
export const SUPPORTED_AREAS_COORDS = {
  'حدائق أكتوبر': [29.9092, 31.0086],
  'حدائق الأهرام': [29.9753, 31.1066],
  'مدينة 6 أكتوبر': [29.9723, 30.9401],
  'الشيخ زايد': [30.0444, 30.9762],
  'فيصل': [30.0016, 31.1687],
  'الهرم': [29.9922, 31.1539],
  'القرية الذكية': [30.0712, 31.0169],
  'الدقي': [30.0385, 31.2127],
  'المهندسين': [30.0566, 31.2016],
  'وسط البلد': [30.0478, 31.2385],
  'المعادي': [29.9602, 31.2569],
  'حلوان': [29.8414, 31.3342],
  'مدينة نصر': [30.0561, 31.3301],
  'مصر الجديدة': [30.0911, 31.3259],
  'القاهرة الجديدة': [30.0074, 31.4913],
  'مدينة السادات': [30.3653, 30.5289],
  'شبين الكوم': [30.5526, 31.0090]
};

export const ALL_PLACES_COORDS = {
  ...CITY_COORDS,
  ...SUPPORTED_AREAS_COORDS
};

export const EGYPT_CITIES = Object.keys(CITY_COORDS);

// حساب المسافة بالكيلومتر بين نقطتين جغرافيتين (Haversine Formula)
export const getDistanceKm = (lat1, lon1, lat2, lon2) => {
  if (!lat1 || !lon1 || !lat2 || !lon2) return Infinity;
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

// استخراج إحداثيات أي مكان أو موقف (سواء مسجلة صراحة أو من رابط جوجل ماب أو من اسم المنطقة)
export const getPlaceCoords = (itemOrName, fallbackSeed = 0) => {
  if (!itemOrName) return [30.0444, 31.2357];

  // 1. إذا كان كائن موقف أو رحلة ويحمل إحداثيات مباشرة
  if (typeof itemOrName === 'object') {
    if (itemOrName.lat && itemOrName.lng) {
      return [Number(itemOrName.lat), Number(itemOrName.lng)];
    }
    // محاولة استخراج الإحداثيات من رابط Google Maps إن وجد
    if (itemOrName.mapUrl && typeof itemOrName.mapUrl === 'string') {
      const match = itemOrName.mapUrl.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/) || itemOrName.mapUrl.match(/q=(-?\d+\.\d+),(-?\d+\.\d+)/);
      if (match) return [ parseFloat(match[1]), parseFloat(match[2]) ];
    }
    const locName = itemOrName.location || itemOrName.governorate || itemOrName.from || itemOrName.name || '';
    const base = getPlaceCoords(locName);
    // إزاحة طفيفة جداً للمواقف التي في نفس المنطقة حتى لا تتطابق الدبابيس فوق بعضها
    if (fallbackSeed) {
      const offsetLat = ((fallbackSeed % 7) - 3) * 0.0025;
      const offsetLng = (((fallbackSeed * 3) % 7) - 3) * 0.0025;
      return [base[0] + offsetLat, base[1] + offsetLng];
    }
    return base;
  }

  // 2. إذا كان نصاً (اسم محافظة أو منطقة)
  const cleanStr = String(itemOrName).trim();
  if (ALL_PLACES_COORDS[cleanStr]) return ALL_PLACES_COORDS[cleanStr];

  for (const [key, coords] of Object.entries(ALL_PLACES_COORDS)) {
    if (cleanStr.includes(key) || key.includes(cleanStr)) {
      return coords;
    }
  }

  return [30.0444, 31.2357];
};

// فحص ذكي: هل منطقة الراكب تقع جغرافياً على خط سير الرحلة بين الانطلاق والوصول؟
export const isPointNearRoute = (pointCoords, startCoords, endCoords, maxDetourKm = 8) => {
  if (!pointCoords || !startCoords || !endCoords) return false;
  const directDist = getDistanceKm(startCoords[0], startCoords[1], endCoords[0], endCoords[1]);
  if (directDist <= 0 || directDist === Infinity) return false;
  const distViaPoint =
    getDistanceKm(startCoords[0], startCoords[1], pointCoords[0], pointCoords[1]) +
    getDistanceKm(pointCoords[0], pointCoords[1], endCoords[0], endCoords[1]);
  return (distViaPoint - directDist) <= maxDetourKm;
};

export const safeMillis = (timestamp) => {
  if (!timestamp) return 0;
  if (typeof timestamp?.toMillis === 'function') return timestamp.toMillis();
  if (timestamp?.seconds) return timestamp.seconds * 1000;
  return new Date(timestamp).getTime() || 0;
};

export const timeToMinutes = (timeStr) => {
  if (!timeStr || typeof timeStr !== 'string') return 0;
  const parts = timeStr.split(':');
  if(parts.length !== 2) return 0;
  return (parseInt(parts[0], 10) * 60) + parseInt(parts[1], 10);
};

export const isTripExpired = (dateStr, timeStr) => {
  if (!dateStr || !timeStr) return false;
  try {
    const tripDateTime = new Date(`${dateStr}T${timeStr}`);
    if (isNaN(tripDateTime.getTime())) return false;
    const now = new Date();
    const diffHours = (now.getTime() - tripDateTime.getTime()) / (1000 * 60 * 60);
    return diffHours > 3; 
  } catch(e) { return false; }
};

export const formatTripDateTime = (dateStr, timeStr) => {
  if (!dateStr || !timeStr || typeof timeStr !== 'string') return "موعد غير محدد";
  
  try {
    const tripDate = new Date(dateStr);
    if (isNaN(tripDate.getTime())) return "موعد غير محدد";
    
    const today = new Date();
    const tomorrow = new Date(); 
    tomorrow.setDate(today.getDate() + 1);
    
    let dayText = "";
    if (tripDate.toDateString() === today.toDateString()) {
      dayText = "اليوم";
    } else if (tripDate.toDateString() === tomorrow.toDateString()) {
      dayText = "غداً";
    } else {
      dayText = tripDate.toLocaleDateString('ar-EG', { month: 'short', day: 'numeric' });
    }

    const timeParts = timeStr.split(':');
    if (timeParts.length !== 2) return "موعد غير محدد";

    let hours = parseInt(timeParts[0], 10);
    let minutes = parseInt(timeParts[1], 10);

    if (isNaN(hours) || isNaN(minutes)) return "موعد غير محدد";

    let ampm = hours >= 12 ? "م" : "ص";
    hours = hours % 12;
    hours = hours ? hours : 12;

    const minStr = minutes < 10 ? '0' + minutes : minutes;

    return `${dayText}، ${hours}:${minStr} ${ampm}`;
  } catch(e) { 
    return "موعد غير محدد"; 
  }
};

export const getSeatsText = (seats, category) => {
  const count = parseInt(seats) || 0;
  if (category === 'parcel' || category === 'delivery') {
    if(count === 1) return "طرد واحد";
    if(count === 2) return "طردان";
    return `${count} طرود`;
  }
  if (count === 1) return "مقعد واحد متبقي";
  if (count === 2) return "مقعدان متبقيان";
  return `${count} مقاعد متبقية`;
};

export const resizeAndConvertToBase64 = (file, maxWidth = 800, maxHeight = 800, quality = 0.8) => {
  return new Promise((resolve, reject) => {
    try {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new window.Image();
        img.src = event.target.result;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width; let height = img.height;
          if (width > height) { if (width > maxWidth) { height = Math.round((height * maxWidth) / width); width = maxWidth; } } 
          else { if (height > maxHeight) { width = Math.round((width * maxHeight) / height); height = maxHeight; } }
          canvas.width = width; canvas.height = height;
          const ctx = canvas.getContext('2d'); ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg', quality));
        };
        img.onerror = reject;
      };
      reader.onerror = reject;
    } catch (err) { reject(err); }
  });
};

export const useEgyptianLocation = () => {
  const [isLocating, setIsLocating] = useState(false);
  const [locationError, setLocationError] = useState('');

  const findNearestSupportedArea = (lat, lon, rawText = '') => {
    for (const areaName of Object.keys(SUPPORTED_AREAS_COORDS)) {
      if (rawText.includes(areaName)) return areaName;
    }
    let closestArea = null;
    let minDistance = Infinity;
    for (const [areaName, [aLat, aLon]] of Object.entries(SUPPORTED_AREAS_COORDS)) {
      const dist = getDistanceKm(lat, lon, aLat, aLon);
      if (dist < minDistance) {
        minDistance = dist;
        closestArea = areaName;
      }
    }
    return closestArea;
  };

  const getMyCity = async (onSuccess) => {
    if (!navigator.geolocation) {
      setLocationError('متصفحك لا يدعم تحديد الموقع');
      return;
    }

    setIsLocating(true);
    setLocationError('');

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        try {
          const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&accept-language=ar`);
          const data = await response.json();
          
          let detailedAddress = '';
          let fullDisplay = data?.display_name || '';

          if (data && data.address) {
            const parts = [];
            if (data.address.road) parts.push(data.address.road);
            if (data.address.suburb) parts.push(data.address.suburb);
            if (data.address.neighbourhood) parts.push(data.address.neighbourhood);
            if (data.address.city || data.address.town) parts.push(data.address.city || data.address.town);
            
            if (parts.length > 0) {
              detailedAddress = parts.join('، ');
            } else if (fullDisplay) {
              detailedAddress = fullDisplay.split('،').slice(0, 2).join('،').trim(); 
            }
          }

          const matchedSupportedArea = findNearestSupportedArea(latitude, longitude, fullDisplay);

          if (matchedSupportedArea) {
            onSuccess({ city: matchedSupportedArea, details: detailedAddress, lat: latitude, lng: longitude });
          } else {
            setLocationError('لم نتمكن من مطابقة محافظتك بدقة.');
          }
        } catch (err) {
          const fallbackArea = findNearestSupportedArea(latitude, longitude);
          if (fallbackArea) {
            onSuccess({ city: fallbackArea, details: '', lat: latitude, lng: longitude });
          } else {
            setLocationError('حدث خطأ في جلب بيانات الخريطة.');
          }
        } finally {
          setIsLocating(false);
        }
      },
      (error) => {
        setIsLocating(false);
        if (error.code === 1) setLocationError('يرجى إعطاء صلاحية الموقع (Location).');
        else setLocationError('تعذر تحديد موقعك الحالي.');
      },
      { timeout: 10000, enableHighAccuracy: true } 
    );
  };

  return { getMyCity, isLocating, locationError, setLocationError };
};