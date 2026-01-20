import React, { useState, useEffect, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import { 
  getFirestore, 
  collection, 
  doc, 
  setDoc, 
  getDoc,
  deleteDoc,
  onSnapshot,
} from 'firebase/firestore';
import { 
  getAuth, 
  signInAnonymously, 
  onAuthStateChanged,
  signInWithCustomToken
} from 'firebase/auth';
import { 
  Calendar, 
  Clock, 
  Users, 
  Building2, 
  CheckCircle2,
  Trash2,
  ShieldCheck,
  LayoutDashboard,
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  UserCircle,
  Save,
  MonitorOff
} from 'lucide-react';

// --- Firebase 配置 (已套用您的設定) ---
const firebaseConfig = {
  apiKey: "AIzaSyA0nKyCYK6iAVCTpg3qW2Vkqfao8AQspj8",
  authDomain: "meeting-room-system-1a3e9.firebaseapp.com",
  projectId: "meeting-room-system-1a3e9",
  storageBucket: "meeting-room-system-1a3e9.firebasestorage.app",
  messagingSenderId: "887021351294",
  appId: "1:887021351294:web:54ea8c257f32a2dd34432f",
  measurementId: "G-9T4XVLVZ0Q"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = typeof __app_id !== 'undefined' ? __app_id : 'meeting-room-system-v2';

// --- 會議室清單 ---
const ROOMS = [
  { id: '301', name: '301 (貴賓室-無電腦)', hasPC: false },
  { id: '302', name: '302', hasPC: true },
  { id: '303', name: '303 (無電腦)', hasPC: false },
  { id: '304', name: '304', hasPC: true },
  { id: '305', name: '305', hasPC: true },
  { id: '306', name: '306', hasPC: true },
  { id: '401', name: '401', hasPC: true },
  { id: '402', name: '402', hasPC: true },
  { id: '403', name: '403 (教育訓練室-無電腦)', hasPC: false },
];

const START_HOUR = 8;
const END_HOUR = 18;

const generateTimeSlots = () => {
  const slots = [];
  for (let hour = START_HOUR; hour < END_HOUR; hour++) {
    slots.push(`${hour.toString().padStart(2, '0')}:00`);
    slots.push(`${hour.toString().padStart(2, '0')}:30`);
  }
  return slots;
};

const TIME_SLOTS = generateTimeSlots();

// 輔助函數
const getMonday = (d) => {
  const date = new Date(d);
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(date.setDate(diff));
};

const formatDate = (date) => {
  if (!date) return "";
  const d = (date instanceof Date) ? date : new Date(date);
  return d.toISOString().split('T')[0];
};

export default function App() {
  const [user, setUser] = useState(null);
  const [userProfile, setUserProfile] = useState({ name: '', department: '' });
  const [view, setView] = useState('user'); // 'user' 或 'admin'
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  
  const [selectedRoom, setSelectedRoom] = useState(ROOMS[0]);
  const [baseDate, setBaseDate] = useState(getMonday(new Date()));
  const [bookings, setBookings] = useState([]);
  const [isBookingModalOpen, setIsBookingModalOpen] = useState(false);
  const [activeBookingSlot, setActiveBookingSlot] = useState(null);
  const [loading, setLoading] = useState(true);

  // 1. 初始化驗證
  useEffect(() => {
    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
      } catch (error) {
        console.error("驗證錯誤:", error);
      }
    };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, setUser);
    return () => unsubscribe();
  }, []);

  // 2. 獲取個人檔案與預約資料
  useEffect(() => {
    if (!user) return;

    const fetchProfile = async () => {
      try {
        const profileRef = doc(db, 'artifacts', appId, 'users', user.uid, 'profile', 'info');
        const profileSnap = await getDoc(profileRef);
        if (profileSnap.exists()) {
          setUserProfile(profileSnap.data());
        } else {
          setIsProfileModalOpen(true);
        }
      } catch (error) {
        console.error("讀取檔案失敗:", error);
      }
    };
    fetchProfile();

    const bookingsRef = collection(db, 'artifacts', appId, 'public', 'data', 'bookings');
    const unsubscribe = onSnapshot(bookingsRef, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setBookings(data);
      setLoading(false);
    }, (error) => {
      console.error("Firestore 監聽失敗:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  const weekDays = useMemo(() => {
    const days = [];
    for (let i = 0; i < 5; i++) {
      const d = new Date(baseDate);
      d.setDate(baseDate.getDate() + i);
      days.push({
        date: formatDate(d),
        label: ['週一', '週二', '週三', '週四', '週五'][i]
      });
    }
    return days;
  }, [baseDate]);

  const bookingsMap = useMemo(() => {
    const map = {};
    bookings.forEach(b => {
      map[`${b.date}_${b.timeSlot}_${b.roomId}`] = b;
    });
    return map;
  }, [bookings]);

  const saveProfile = async (e) => {
    e.preventDefault();
    if (!user) return;
    try {
      const profileRef = doc(db, 'artifacts', appId, 'users', user.uid, 'profile', 'info');
      await setDoc(profileRef, userProfile);
      setIsProfileModalOpen(false);
    } catch (error) {
      console.error("儲存檔案失敗:", error);
    }
  };

  const handleBooking = async () => {
    if (!user || !activeBookingSlot || !userProfile.name || !userProfile.department) {
      setIsProfileModalOpen(true);
      return;
    }

    const { date, time } = activeBookingSlot;
    const bookingId = `${selectedRoom.id}_${date}_${time.replace(':', '')}`;
    const bookingData = {
      id: bookingId,
      roomId: selectedRoom.id,
      roomName: selectedRoom.name,
      date,
      timeSlot: time,
      department: userProfile.department,
      name: userProfile.name,
      userId: user.uid,
      createdAt: new Date().toISOString()
    };

    try {
      await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'bookings', bookingId), bookingData);
      setIsBookingModalOpen(false);
      setActiveBookingSlot(null);
    } catch (error) {
      console.error("預約失敗:", error);
    }
  };

  const handleCancelBooking = async (bookingId) => {
    if (!window.confirm("確定要取消這項預約嗎？")) return;
    try {
      await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'bookings', bookingId));
    } catch (error) {
      console.error("取消失敗:", error);
    }
  };

  const shiftWeek = (weeks) => {
    const next = new Date(baseDate);
    next.setDate(baseDate.getDate() + (weeks * 7));
    setBaseDate(next);
  };

  const isToday = (dateStr) => dateStr === formatDate(new Date());

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-40 shadow-sm">
        <div className="max-w-[1600px] mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-indigo-600 text-white">
              <Building2 size={24} />
            </div>
            <div>
              <h1 className="text-lg font-bold">企業會議室預約系統</h1>
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-indigo-600 font-bold bg-indigo-50 px-2 py-0.5 rounded-full uppercase">單室週視圖</span>
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsProfileModalOpen(true)}
              className="hidden md:flex items-center gap-2 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50 rounded-xl transition-all"
            >
              <UserCircle size={20} />
              {userProfile.name ? `${userProfile.department} / ${userProfile.name}` : '設定個人資訊'}
            </button>
            <div className="w-[1px] h-6 bg-slate-200 mx-2 hidden md:block"></div>
            <button
              onClick={() => setView(view === 'user' ? 'admin' : 'user')}
              className={`flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-bold transition-all ${
                view === 'admin' 
                ? 'bg-slate-800 text-white' 
                : 'bg-white text-slate-600 border border-slate-200'
              }`}
            >
              {view === 'admin' ? <ArrowLeft size={16} /> : <ShieldCheck size={16} />}
              {view === 'admin' ? '返回' : '管理者模式'}
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-[1600px] mx-auto p-4 md:p-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <aside className="lg:col-span-3 space-y-4">
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
              <h3 className="text-xs font-bold text-slate-400 mb-4 uppercase tracking-widest flex items-center gap-2">
                <LayoutDashboard size={14}/> 選擇查詢會議室
              </h3>
              <div className="space-y-1.5 max-h-[70vh] overflow-y-auto pr-1">
                {ROOMS.map(room => (
                  <button
                    key={room.id}
                    onClick={() => setSelectedRoom(room)}
                    className={`w-full text-left p-4 rounded-xl transition-all border flex items-center justify-between group ${
                      selectedRoom.id === room.id 
                        ? 'bg-indigo-600 border-indigo-600 text-white shadow-lg shadow-indigo-100' 
                        : 'bg-white border-slate-100 hover:border-indigo-200 text-slate-600'
                    }`}
                  >
                    <div>
                      <div className="font-bold text-sm">會議室 {room.name}</div>
                      {!room.hasPC && (
                        <div className={`text-[10px] mt-0.5 flex items-center gap-1 ${selectedRoom.id === room.id ? 'text-indigo-100' : 'text-amber-500'}`}>
                          <MonitorOff size={10} /> 無電腦設備
                        </div>
                      )}
                    </div>
                    {selectedRoom.id === room.id && <ChevronRight size={16} />}
                  </button>
                ))}
              </div>
            </div>
          </aside>

          <section className="lg:col-span-9 space-y-4">
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row justify-between items-center gap-4">
              <div className="flex items-center gap-4">
                <div>
                  <h2 className="text-2xl font-black text-slate-800">{selectedRoom.name}</h2>
                  <p className="text-slate-400 text-xs font-bold">{formatDate(baseDate)} 起一週狀況</p>
                </div>
              </div>
              <div className="flex items-center gap-2 bg-slate-50 p-1.5 rounded-xl border border-slate-100">
                <button onClick={() => shiftWeek(-1)} className="p-2 hover:bg-white hover:shadow-sm rounded-lg transition-all text-slate-600"><ChevronLeft size={20}/></button>
                <button onClick={() => setBaseDate(getMonday(new Date()))} className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-indigo-600 transition-colors uppercase tracking-widest">本週</button>
                <button onClick={() => shiftWeek(1)} className="p-2 hover:bg-white hover:shadow-sm rounded-lg transition-all text-slate-600"><ChevronRight size={20}/></button>
              </div>
            </div>

            <div className="bg-white rounded-3xl border border-slate-200 shadow-xl overflow-hidden relative">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[800px] border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-100">
                      <th className="w-24 p-4 text-xs font-bold text-slate-400 border-r border-slate-100">時段</th>
                      {weekDays.map(day => (
                        <th key={day.date} className={`p-4 border-r border-slate-100 ${isToday(day.date) ? 'bg-indigo-50/50' : ''}`}>
                          <span className={`block text-sm font-black ${isToday(day.date) ? 'text-indigo-600' : 'text-slate-700'}`}>{day.label}</span>
                          <span className="block text-[10px] font-medium text-slate-400">{day.date}</span>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {TIME_SLOTS.map((time) => (
                      <tr key={time} className="group hover:bg-slate-50/50 transition-colors border-b border-slate-50">
                        <td className="p-3 text-center border-r border-slate-100 bg-slate-50/20">
                          <span className="text-xs font-bold text-slate-500">{time}</span>
                        </td>
                        {weekDays.map(day => {
                          const booking = bookingsMap[`${day.date}_${time}_${selectedRoom.id}`];
                          const isMine = booking?.userId === user?.uid;
                          
                          return (
                            <td key={`${day.date}-${time}`} className={`p-1 border-r border-slate-100 h-16 transition-all ${isToday(day.date) ? 'bg-indigo-50/10' : ''}`}>
                              {booking ? (
                                <div className={`h-full w-full rounded-xl p-2 flex flex-col justify-center border transition-all ${
                                  isMine 
                                  ? 'bg-indigo-600 border-indigo-700 text-white shadow-md' 
                                  : 'bg-slate-100 border-slate-200 text-slate-500'
                                }`}>
                                  <div className="flex justify-between items-start">
                                    <span className="text-[11px] font-black truncate leading-tight">{booking.department}</span>
                                    {(isMine || view === 'admin') && (
                                      <button 
                                        onClick={() => handleCancelBooking(booking.id)}
                                        className={`${isMine ? 'text-indigo-200 hover:text-white' : 'text-slate-400 hover:text-rose-500'} transition-colors`}
                                      >
                                        <Trash2 size={12} />
                                      </button>
                                    )}
                                  </div>
                                  <span className={`text-[9px] mt-0.5 font-bold ${isMine ? 'text-indigo-200' : 'text-slate-400'}`}>{booking.name}</span>
                                </div>
                              ) : (
                                <button
                                  disabled={view === 'admin'}
                                  onClick={() => {
                                    setActiveBookingSlot({ date: day.date, time });
                                    setIsBookingModalOpen(true);
                                  }}
                                  className="h-full w-full rounded-xl border border-dashed border-slate-200 hover:border-indigo-400 hover:bg-white hover:shadow-inner transition-all group/btn"
                                >
                                  <span className="text-[10px] font-bold text-slate-300 group-hover/btn:text-indigo-500 opacity-0 group-hover/btn:opacity-100">+ 預約</span>
                                </button>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        </div>
      </main>

      {isProfileModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => userProfile.name && setIsProfileModalOpen(false)}></div>
          <div className="relative bg-white w-full max-w-sm rounded-3xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="bg-indigo-600 px-6 py-8 text-white text-center">
              <div className="mx-auto w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mb-4">
                <UserCircle size={32} />
              </div>
              <h3 className="text-xl font-bold">設定您的個人檔案</h3>
              <p className="text-indigo-100 text-xs mt-2 font-medium">設定後預約將自動帶入資訊，節省時間。</p>
            </div>
            <form onSubmit={saveProfile} className="p-6 space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">所屬部門</label>
                <input 
                  required 
                  type="text" 
                  placeholder="例如：行銷部、研發組"
                  value={userProfile.department}
                  onChange={(e) => setUserProfile({...userProfile, department: e.target.value})}
                  className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none font-bold"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">您的真實姓名</label>
                <input 
                  required 
                  type="text" 
                  placeholder="輸入您的姓名"
                  value={userProfile.name}
                  onChange={(e) => setUserProfile({...userProfile, name: e.target.value})}
                  className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none font-bold"
                />
              </div>
              <button 
                type="submit" 
                className="w-full py-4 bg-indigo-600 text-white font-black rounded-2xl hover:bg-indigo-700 shadow-lg shadow-indigo-100 flex items-center justify-center gap-2"
              >
                <Save size={18}/> 儲存並繼續
              </button>
            </form>
          </div>
        </div>
      )}

      {isBookingModalOpen && activeBookingSlot && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setIsBookingModalOpen(false)}></div>
          <div className="relative bg-white w-full max-w-sm rounded-3xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="bg-indigo-600 p-6 text-white">
              <h3 className="text-xl font-bold">預約確認</h3>
              <div className="mt-4 bg-white/10 p-4 rounded-2xl space-y-2 text-sm font-medium">
                <div className="flex justify-between"><span>會議室：</span><span className="font-black">{selectedRoom.name}</span></div>
                <div className="flex justify-between"><span>日期：</span><span>{activeBookingSlot.date}</span></div>
                <div className="flex justify-between"><span>時間：</span><span>{activeBookingSlot.time}</span></div>
              </div>
            </div>
            <div className="p-6">
              <div className="mb-6">
                <p className="text-xs font-bold text-slate-400 uppercase mb-2">預約人資訊 (自動帶入)</p>
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                  <p className="text-lg font-black text-slate-800">{userProfile.name}</p>
                  <p className="text-xs font-bold text-indigo-600">{userProfile.department}</p>
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <button 
                  onClick={handleBooking}
                  className="w-full py-4 bg-indigo-600 text-white font-black rounded-2xl hover:bg-indigo-700 shadow-lg shadow-indigo-100 flex items-center justify-center gap-2"
                >
                  <CheckCircle2 size={18}/> 確認送出預約
                </button>
                <button 
                  onClick={() => {
                    setIsBookingModalOpen(false);
                    setIsProfileModalOpen(true);
                  }}
                  className="w-full py-3 text-slate-400 text-xs font-bold"
                >
                  不對，我要修改個人資訊
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      
      <footer className="max-w-[1600px] mx-auto px-4 py-12 text-center text-slate-400 text-[10px] uppercase tracking-widest font-bold">
        企業內部會議預約資產管理 | 上班日 08:00 - 18:00
      </footer>
    </div>
  );
