import React, { useState, useEffect, useMemo } from 'react';
import { createRoot } from 'react-dom/client';
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
} from 'firebase/auth';
import { 
  Building2, 
  ChevronLeft, 
  ChevronRight, 
  Trash2,
  MonitorOff,
  UserCircle,
  AlertCircle,
  X,
  CalendarDays
} from 'lucide-react';

// --- Firebase 配置 ---
const firebaseConfig = {
  apiKey: "AIzaSyA0nKyCYK6iAVCTpg3qW2Vkqfao8AQspj8",
  authDomain: "meeting-room-system-1a3e9.firebaseapp.com",
  projectId: "meeting-room-system-1a3e9",
  storageBucket: "meeting-room-system-1a3e9.firebasestorage.app",
  messagingSenderId: "887021351294",
  appId: "1:887021351294:web:54ea8c257f32a2dd34432f",
  measurementId: "G-9T4XVLVZ0Q"
};

const firebaseApp = initializeApp(firebaseConfig);
const auth = getAuth(firebaseApp);
const db = getFirestore(firebaseApp);
const appId = 'meeting-room-system-v-final';

// --- 會議室清單數據 ---
const ROOMS = [
  { id: '301', name: '301 (貴賓室)', hasPC: false },
  { id: '302', name: '302', hasPC: true },
  { id: '303', name: '303 (無電腦)', hasPC: false },
  { id: '304', name: '304', hasPC: true },
  { id: '305', name: '305', hasPC: true },
  { id: '306', name: '306', hasPC: true },
  { id: '401', name: '401', hasPC: true },
  { id: '402', name: '402', hasPC: true },
  { id: '403', name: '403 (教育訓練室)', hasPC: false },
];

const TIME_SLOTS = [];
for (let i = 8; i < 18; i++) {
  TIME_SLOTS.push(`${i.toString().padStart(2, '0')}:00`);
  TIME_SLOTS.push(`${i.toString().padStart(2, '0')}:30`);
}

const formatDate = (date) => {
  if (!date) return "";
  const d = (date instanceof Date) ? date : new Date(date);
  try {
    return d.toISOString().split('T')[0];
  } catch (e) {
    return "";
  }
};

const getMonday = (d) => {
  const date = new Date(d);
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(date.setDate(diff));
};

function MeetingApp() {
  const [user, setUser] = useState(null);
  const [userProfile, setUserProfile] = useState({ name: '', department: '' });
  const [view, setView] = useState('user'); 
  const [selectedRoom, setSelectedRoom] = useState(ROOMS[0]);
  const [baseDate, setBaseDate] = useState(getMonday(new Date()));
  const [bookings, setBookings] = useState([]);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isBookingModalOpen, setIsBookingModalOpen] = useState(false);
  const [activeSlot, setActiveSlot] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);

  useEffect(() => {
    signInAnonymously(auth).catch(() => setErrorMsg("驗證服務連接失敗。"));
    const unsubscribe = onAuthStateChanged(auth, setUser);
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;
    
    const profileRef = doc(db, 'artifacts', appId, 'users', user.uid, 'profile', 'info');
    getDoc(profileRef).then(snap => {
      if (snap.exists()) setUserProfile(snap.data());
      else setIsProfileModalOpen(true);
    }).catch(() => console.warn("目前為離線狀態"));

    const bookingsRef = collection(db, 'artifacts', appId, 'public', 'data', 'bookings');
    const unsubscribe = onSnapshot(bookingsRef, (snapshot) => {
      setBookings(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setErrorMsg(null);
    }, (error) => {
      if (error.code === 'unavailable') setErrorMsg("網路連線不穩定，正在嘗試重新連線...");
    });
    return () => unsubscribe();
  }, [user]);

  const weekDays = useMemo(() => {
    return [0, 1, 2, 3, 4].map(i => {
      const d = new Date(baseDate);
      d.setDate(baseDate.getDate() + i);
      return { date: formatDate(d), label: ['週一', '週二', '週三', '週四', '週五'][i] };
    });
  }, [baseDate]);

  const bookingsMap = useMemo(() => {
    const map = {};
    bookings.forEach(b => map[`${b.date}_${b.timeSlot}_${b.roomId}`] = b);
    return map;
  }, [bookings]);

  const handleBooking = async () => {
    if (!user || !activeSlot || !userProfile.name) return;
    const id = `${selectedRoom.id}_${activeSlot.date}_${activeSlot.time.replace(':','')}`;
    try {
      await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'bookings', id), {
        ...activeSlot,
        roomId: selectedRoom.id,
        roomName: selectedRoom.name,
        name: userProfile.name,
        department: userProfile.department,
        userId: user.uid,
        createdAt: new Date().toISOString()
      });
      setIsBookingModalOpen(false);
    } catch (e) {
      setErrorMsg("預約儲存失敗，請檢查網路。");
    }
  };

  const handleDelete = async (bookingId) => {
    if (window.confirm("確定要取消此預約嗎？")) {
      try {
        await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'bookings', bookingId));
      } catch (e) {
        setErrorMsg("刪除失敗。");
      }
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans flex flex-col text-slate-900">
      <header className="bg-white border-b px-6 py-4 flex justify-between items-center sticky top-0 z-20 shadow-sm">
        <div className="flex items-center gap-2">
          <div className="bg-indigo-600 p-2 rounded-lg text-white">
            <Building2 size={20} />
          </div>
          <h1 className="font-bold text-lg hidden sm:block">企業會議室預約系統</h1>
        </div>
        <div className="flex items-center gap-3">
          {userProfile.name && (
            <div className="hidden md:flex flex-col items-end mr-2">
              <span className="text-xs font-bold text-slate-700">{userProfile.name}</span>
              <span className="text-[10px] text-slate-400">{userProfile.department}</span>
            </div>
          )}
          <button onClick={() => setView(view === 'user' ? 'admin' : 'user')} className={`text-[11px] font-black px-4 py-2 rounded-xl transition-all ${view === 'admin' ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-500'}`}>
            {view === 'admin' ? '管理者模式' : '切換管理'}
          </button>
        </div>
      </header>

      <main className="p-4 md:p-6 grid grid-cols-1 lg:grid-cols-4 gap-6 max-w-7xl mx-auto w-full flex-1">
        {/* 會議室清單 */}
        <aside className="space-y-2 lg:col-span-1">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2 mb-2">Room List / 會議室</p>
          {ROOMS.map(room => (
            <button
              key={room.id}
              onClick={() => setSelectedRoom(room)}
              className={`w-full text-left p-4 rounded-2xl border-2 transition-all ${selectedRoom.id === room.id ? 'bg-indigo-600 border-indigo-600 text-white shadow-xl scale-[1.02]' : 'bg-white border-transparent hover:border-indigo-100 shadow-sm'}`}
            >
              <div className="font-bold text-sm">{room.name}</div>
              {!room.hasPC && <div className={`text-[10px] flex items-center gap-1 mt-1 ${selectedRoom.id === room.id ? 'text-indigo-200' : 'text-amber-500'}`}><MonitorOff size={10}/> 無電腦設備</div>}
            </button>
          ))}
        </aside>

        {/* 預約時間表 */}
        <div className="lg:col-span-3 space-y-4">
          <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm flex flex-col md:flex-row justify-between items-center gap-4">
            <div>
              <h2 className="text-2xl font-black text-slate-800">{selectedRoom.name}</h2>
              <p className="text-xs text-slate-400 font-bold mt-1">會議室預約狀態週視圖</p>
            </div>
            <div className="flex items-center gap-2 bg-slate-50 p-1 rounded-2xl border">
              <button onClick={() => {const d=new Date(baseDate); d.setDate(d.getDate()-7); setBaseDate(d);}} className="p-2 hover:bg-white hover:shadow-sm rounded-xl transition-all"><ChevronLeft size={18}/></button>
              <button onClick={() => setBaseDate(getMonday(new Date()))} className="text-[10px] font-black px-3 text-slate-400 uppercase">本週</button>
              <button onClick={() => {const d=new Date(baseDate); d.setDate(d.getDate()+7); setBaseDate(d);}} className="p-2 hover:bg-white hover:shadow-sm rounded-xl transition-all"><ChevronRight size={18}/></button>
            </div>
          </div>

          <div className="bg-white rounded-[2rem] border border-slate-200 shadow-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-center border-collapse">
                <thead>
                  <tr className="bg-slate-50/50 border-b border-slate-100">
                    <th className="p-4 font-black text-slate-400 w-24">時段</th>
                    {weekDays.map(d => (
                      <th key={d.date} className="p-4 border-l border-slate-100">
                        <div className="font-black text-slate-800">{d.label}</div>
                        <div className="text-[10px] text-slate-400 font-bold">{d.date}</div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {TIME_SLOTS.map(time => (
                    <tr key={time} className="border-b border-slate-50 hover:bg-slate-50/30">
                      <td className="p-3 font-bold text-slate-400 bg-slate-50/10">{time}</td>
                      {weekDays.map(day => {
                        const b = bookingsMap[`${day.date}_${time}_${selectedRoom.id}`];
                        return (
                          <td key={day.date} className="p-1 h-16 border-l border-slate-50">
                            {b ? (
                              <div className={`h-full w-full rounded-2xl p-2 flex flex-col justify-center relative shadow-sm transition-all ${b.userId === user?.uid ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-500'}`}>
                                <span className="font-black truncate text-[10px] leading-tight">{b.name}</span>
                                <span className="text-[9px] opacity-70 truncate">{b.department}</span>
                                {(b.userId === user?.uid || view === 'admin') && (
                                  <button onClick={() => handleDelete(b.id)} className="absolute top-1 right-1 hover:text-rose-400 transition-colors"><Trash2 size={10}/></button>
                                )}
                              </div>
                            ) : (
                              <button onClick={() => {setActiveSlot({date: day.date, time}); setIsBookingModalOpen(true);}} className="w-full h-full border-2 border-dashed border-slate-100 rounded-2xl hover:border-indigo-300 hover:bg-indigo-50/30 text-slate-200 hover:text-indigo-400 transition-all font-black text-[10px]">+</button>
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
        </div>
      </main>

      {/* 設定個人資料 */}
      {isProfileModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white p-8 rounded-[2.5rem] w-full max-w-sm shadow-2xl">
            <div className="text-center mb-6">
              <div className="bg-indigo-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                <UserCircle className="text-indigo-600" size={32} />
              </div>
              <h3 className="text-2xl font-black text-slate-800">歡迎使用預約系統</h3>
              <p className="text-sm text-slate-400 mt-2">請先設定您的資訊以進行預約</p>
            </div>
            <form onSubmit={async (e) => {
              e.preventDefault();
              await setDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'profile', 'info'), userProfile);
              setIsProfileModalOpen(false);
            }} className="space-y-4">
              <input required placeholder="姓名" className="w-full border-2 border-slate-100 p-4 rounded-2xl outline-none focus:border-indigo-500 font-bold transition-all" value={userProfile.name} onChange={e => setUserProfile({...userProfile, name: e.target.value})} />
              <input required placeholder="部門" className="w-full border-2 border-slate-100 p-4 rounded-2xl outline-none focus:border-indigo-500 font-bold transition-all" value={userProfile.department} onChange={e => setUserProfile({...userProfile, department: e.target.value})} />
              <button className="w-full bg-indigo-600 text-white p-4 rounded-2xl font-black shadow-lg hover:bg-indigo-700 active:scale-[0.98] transition-all">儲存並開始使用</button>
            </form>
          </div>
        </div>
      )}

      {/* 預約確認 */}
      {isBookingModalOpen && activeSlot && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white p-8 rounded-[2.5rem] w-full max-w-xs shadow-2xl text-center relative">
            <button onClick={() => setIsBookingModalOpen(false)} className="absolute top-6 right-6 text-slate-300 hover:text-slate-500"><X size={20}/></button>
            <h3 className="font-black text-xl text-slate-800 mb-2">確認預約</h3>
            <div className="bg-slate-50 p-6 rounded-3xl mb-6 border border-slate-100 text-sm">
              <p className="font-black text-indigo-600 text-lg">{selectedRoom.name}</p>
              <div className="flex justify-center gap-2 mt-2 font-bold text-slate-500">
                <span>{activeSlot.date}</span>
                <span>{activeSlot.time}</span>
              </div>
            </div>
            <button onClick={handleBooking} className="w-full bg-indigo-600 text-white p-4 rounded-2xl font-black shadow-lg hover:bg-indigo-700 transition-all">確認預約</button>
          </div>
        </div>
      )}

      {/* 錯誤提示 */}
      {errorMsg && (
        <div className="fixed bottom-6 right-6 bg-rose-500 text-white px-4 py-3 rounded-2xl shadow-xl flex items-center gap-2 animate-bounce z-[100]">
          <AlertCircle size={18} />
          <span className="text-sm font-bold">{errorMsg}</span>
        </div>
      )}
    </div>
  );
}

// 嚴謹掛載：解決 TypeError 並確保不重複掛載
const rootElement = document.getElementById('root');
if (rootElement) {
  const root = createRoot(rootElement);
  root.render(<MeetingApp />);
}