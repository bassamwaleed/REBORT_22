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

export const EGYPT_CITIES = Object.keys(CITY_COORDS);

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

export const formatTripDateTime = (dateStr, timeStr) => {
  if (!dateStr || !timeStr || typeof timeStr !== 'string') return "موعد غير محدد";
  
  try {
    const tripDate = new Date(dateStr);
    if (isNaN(tripDate.getTime())) return "موعد غير محدد";
    
    const today = new Date();
    const tomorrow = new Date(); 
    tomorrow.setDate(tomorrow.getDate() + 1);
    
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

// ==========================================
// Custom Hook: Geolocation to Egyptian City + Detailed Address
// ==========================================
export const useEgyptianLocation = () => {
  const [isLocating, setIsLocating] = useState(false);
  const [locationError, setLocationError] = useState('');

  const mapApiStateToEgyptCities = (apiStateName) => {
    if (!apiStateName) return null;
    const cleanName = apiStateName.replace('محافظة', '').trim();
    
    if (cleanName.includes('القاهرة')) return 'القاهرة';
    if (cleanName.includes('الجيزة')) return 'الجيزة';
    if (cleanName.includes('الاسكندرية') || cleanName.includes('الإسكندرية')) return 'الإسكندرية';
    if (cleanName.includes('الشرقية')) return 'الشرقية';
    if (cleanName.includes('الغربية')) return 'الغربية';
    if (cleanName.includes('الدقهلية')) return 'الدقهلية';
    if (cleanName.includes('القليوبية')) return 'القليوبية';
    if (cleanName.includes('البحيرة')) return 'البحيرة';
    if (cleanName.includes('المنوفية')) return 'المنوفية';
    if (cleanName.includes('كفر الشيخ')) return 'كفر الشيخ';
    if (cleanName.includes('دمياط')) return 'دمياط';
    if (cleanName.includes('بورسعيد')) return 'بورسعيد';
    if (cleanName.includes('الإسماعيلية')) return 'الإسماعيلية';
    if (cleanName.includes('السويس')) return 'السويس';
    if (cleanName.includes('مطروح')) return 'مطروح';
    if (cleanName.includes('البحر الأحمر')) return 'البحر الأحمر';
    if (cleanName.includes('الفيوم')) return 'الفيوم';
    if (cleanName.includes('بني سويف')) return 'بني سويف';
    if (cleanName.includes('المنيا')) return 'المنيا';
    if (cleanName.includes('أسيوط')) return 'أسيوط';
    if (cleanName.includes('سوهاج')) return 'سوهاج';
    if (cleanName.includes('قنا')) return 'قنا';
    if (cleanName.includes('الأقصر')) return 'الأقصر';
    if (cleanName.includes('أسوان')) return 'أسوان';
    
    return EGYPT_CITIES.find(city => cleanName.includes(city) || city.includes(cleanName)) || null;
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
          // استدعاء واجهة برمجة التطبيقات للحصول على العنوان بالتفصيل بالعربي
          const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&accept-language=ar`);
          const data = await response.json();
          
          if (data && data.address) {
            // استخراج المحافظة
            const stateName = data.address.state || data.address.region || data.address.city; 
            const matchedCity = mapApiStateToEgyptCities(stateName);

            // استخراج التفاصيل الدقيقة (الشارع، الحي، أو المنطقة)
            let detailedAddress = '';
            
            // نأخذ أهم التفاصيل المتاحة ونجمعها
            const parts = [];
            if (data.address.road) parts.push(data.address.road);
            if (data.address.suburb) parts.push(data.address.suburb);
            if (data.address.neighbourhood) parts.push(data.address.neighbourhood);
            if (data.address.town && !parts.includes(data.address.town)) parts.push(data.address.town);
            
            // لو مفيش تفاصيل دقيقة، ناخد الاسم العام المعروض (مع حذف المحافظة والبلد عشان ميبقاش طويل جداً)
            if (parts.length > 0) {
              detailedAddress = parts.join('، ');
            } else if (data.display_name) {
              const nameArray = data.display_name.split('،');
              detailedAddress = nameArray.slice(0, 2).join('،').trim(); // أول جزئين فقط
            }

            if (matchedCity) {
              // بنبعت كائن فيه المحافظة والتفاصيل الدقيقة مع بعض
              onSuccess({ city: matchedCity, details: detailedAddress });
            } else {
              setLocationError('لم نتمكن من مطابقة محافظتك بدقة.');
            }
          } else {
             setLocationError('لم نتمكن من قراءة العنوان.');
          }
        } catch (err) {
          setLocationError('حدث خطأ في جلب بيانات الخريطة.');
        } finally {
          setIsLocating(false);
        }
      },
      (error) => {
        setIsLocating(false);
        if (error.code === 1) setLocationError('يرجى إعطاء صلاحية الموقع (Location).');
        else setLocationError('تعذر تحديد موقعك الحالي.');
      },
      { timeout: 10000, enableHighAccuracy: true } // خليناها true هنا عشان نجيب الشارع بدقة
    );
  };

  return { getMyCity, isLocating, locationError, setLocationError };
};
