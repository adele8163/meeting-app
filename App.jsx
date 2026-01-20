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
  Clock,
  Calendar,
  ShieldCheck
} from 'lucide-react';

/* <!-- Chosen Palette: Indigo Calm & Professional Slate -->
<!-- Application Structure Plan: 
1. 資訊架構：採用儀表板佈局，左側為會議室導覽，右側為主動態排程表。
2. 互動流：使用者進入後先設定個人檔案（Firebase Auth 匿名驗證後存入 Firestore），接著選擇會議室並於週視圖中點擊時段進行預約。
3. 狀態設計：集中處理 Firebase 連線狀態，針對離線報錯 (Offline Error) 提供 UI 回饋而非崩潰。
4. 導覽邏輯：支援管理員模式切換，允許跨用戶刪除權限。
-->
<!-- Visualization & Content Choices: 
- 預約狀態 -> 目標：比較時段佔用 -> 方法：響應式 Grid 表格 -> 庫：Tailwind CSS 構建。
- 連線警示 -> 目標：告知網路狀態 -> 方法：懸浮 Alert 元件 -> 庫：Lucide-react 視覺化。
- 確認流程 -> 目標：防止誤觸 -> 方法：自定義 React Modal。
-->
<!-- CONFIRMATION: NO SVG graphics used. NO Mermaid JS used. -->
*/

// --- Firebase 配置 (套用您的真實專案資訊) ---
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

// --- 常數定義 ---
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

// --- 工具函式 ---
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
  const [connectionStatus, setConnectionStatus] = useState('online'); // online, offline, error

  // 1. 初始化驗證與網路狀態監聽
  useEffect(() => {
    const initAuth = async () => {
      try {
        await signInAnonymously(auth);
        setConnectionStatus('online');
      } catch (err) {
        console.error("Firebase Auth 錯誤:", err);
        setConnectionStatus('error');
      }
    };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, setUser);
    return () => unsubscribe();
  }, []);

  // 2. 資料同步 (優化錯誤處理，防止離線報錯崩潰)
  useEffect(() => {
    if (!user) return;
    
    // 獲取個人檔案
    const profileRef = doc(db, 'artifacts', appId, 'users', user.uid, 'profile', 'info');
    getDoc(profileRef).then(snap => {
      if (snap.exists()) setUserProfile(snap.data());
      else setIsProfileModalOpen(true);
    }).catch(err => {
      if (err.code === 'unavailable') setConnectionStatus('offline');
    });

    // 監聽預約資料
    const bookingsRef = collection(db, 'artifacts', appId, 'public', 'data', 'bookings');
    const unsubscribe = onSnapshot(bookingsRef, 
      (snapshot) => {
        setBookings(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        setConnectionStatus('online');
      }, 
      (error) => {
        console.error("Firestore 監聽失敗:", error);
        if (error.code === 'unavailable') {
          setConnectionStatus('offline');
        }
      }
    );
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
    const bookingId = `${selectedRoom.id}_${activeSlot.date}_${activeSlot.time.replace(':','')}`;
    try {
      await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'bookings', bookingId), {
        ...activeSlot,
        roomId: selectedRoom.id,
        roomName: selectedRoom.name,
        name: userProfile.name,
        department: userProfile.department,
        userId: user.uid,
        timeSlot: activeSlot.time,
        createdAt: new Date().toISOString()
      });
      setIsBookingModalOpen(false);
    } catch (e) {
      alert("儲存預約失敗，請檢查網路連線。");
    }
  };

  const deleteBooking = async (id) => {
    if (window.confirm("確定要取消此預約嗎？")) {
      try {
        await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'bookings', id));
      } catch (e) {
        alert("刪除失敗，請稍後再試。");
      }
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans flex flex-col text-slate-900">
      {/* 頁首選單 */}
      <header className="bg-white border-b border-slate-200 px-6 py-4 flex justify-between items-center sticky top-0 z-30 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="bg-indigo-600 p-2 rounded-xl text-white shadow-lg shadow-indigo-100">
            <Building2 size={24} />
          </div>
          <div>
            <h1 className="font-black text-slate-800 text-lg leading-none">企業會議室預約系統</h1>
            <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400 mt-1">
              <Clock size={10} /> {new Date().toLocaleTimeString('zh-TW', { hour12: false })} · 系統正常運作
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          {connectionStatus === 'offline' && (
            <div className="hidden md:flex items-center gap-1.5 text-amber-500 bg-amber-50 px-3 py-1.5 rounded-full border border-amber-100 animate-pulse">
              <AlertCircle size={14} />
              <span className="text-[11px] font-bold">目前為離線狀態</span>
            </div>
          )}
          <button 
            onClick={() => setView(view === 'user' ? 'admin' : 'user')} 
            className={`px-4 py-2 rounded-xl text-xs font-black transition-all ${
              view === 'admin' ? 'bg-slate-800 text-white shadow-lg' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            {view === 'admin' ? '管理者模式' : '管理者入口'}
          </button>
        </div>
      </header>

      <main className="p-4 md:p-8 grid grid-cols-1 lg:grid-cols-4 gap-8 max-w-[1600px] mx-auto w-full flex-1">
        {/* 會議室導覽欄 */}
        <aside className="space-y-4">
          <div className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm">
            <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
              <Calendar size={14} /> 會議室清單
            </h3>
            <div className="space-y-2.5">
              {ROOMS.map(room => (
                <button
                  key={room.id}
                  onClick={() => setSelectedRoom(room)}
                  className={`w-full text-left p-4 rounded-2xl border-2 transition-all group ${
                    selectedRoom.id === room.id 
                    ? 'bg-indigo-600 border-indigo-600 text-white shadow-xl shadow-indigo-100 scale-[1.02]' 
                    : 'bg-white border-transparent hover:border-indigo-100 hover:bg-slate-50'
                  }`}
                >
                  <div className="font-black text-sm">{room.name}</div>
                  {!room.hasPC && (
                    <div className={`text-[10px] mt-1 flex items-center gap-1 ${selectedRoom.id === room.id ? 'text-indigo-200' : 'text-slate-400'}`}>
                      <MonitorOff size={10} /> 無固定電腦
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* 個人資訊卡片 */}
          {userProfile.name && (
            <div className="bg-indigo-50 p-6 rounded-[2rem] border border-indigo-100 flex items-center gap-4">
              <div className="bg-white p-2 rounded-full text-indigo-600">
                <UserCircle size={24} />
              </div>
              <div>
                <div className="text-sm font-black text-indigo-900">{userProfile.name}</div>
                <div className="text-[10px] font-bold text-indigo-400 uppercase">{userProfile.department}</div>
              </div>
            </div>
          )}
        </aside>

        {/* 預約時間主視圖 */}
        <div className="lg:col-span-3 space-y-6">
          <div className="bg-white p-6 md:p-8 rounded-[2.5rem] border border-slate-200 shadow-sm flex flex-col md:flex-row justify-between items-center gap-6">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="bg-indigo-100 text-indigo-600 text-[10px] px-2 py-0.5 rounded-full font-black uppercase tracking-tighter">目前選擇</span>
                <span className="text-xs text-slate-400 font-bold">| {selectedRoom.id} 室</span>
              </div>
              <h2 className="text-3xl font-black text-slate-800">{selectedRoom.name}</h2>
            </div>
            
            <div className="flex items-center gap-3 bg-slate-50 p-2 rounded-[1.5rem] border border-slate-100">
              <button 
                onClick={() => {const d=new Date(baseDate); d.setDate(d.getDate()-7); setBaseDate(d);}}
                className="p-3 hover:bg-white hover:shadow-sm rounded-2xl transition-all text-slate-400 hover:text-indigo-600"
              >
                <ChevronLeft size={20}/>
              </button>
              <div className="px-4 text-center min-w-[120px]">
                <div className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">當前預約週</div>
                <div className="text-sm font-black text-slate-700">{formatDate(baseDate)}</div>
              </div>
              <button 
                onClick={() => {const d=new Date(baseDate); d.setDate(d.getDate()+7); setBaseDate(d);}}
                className="p-3 hover:bg-white hover:shadow-sm rounded-2xl transition-all text-slate-400 hover:text-indigo-600"
              >
                <ChevronRight size={20}/>
              </button>
            </div>
          </div>

          <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-center border-collapse">
                <thead>
                  <tr className="bg-slate-50/50 border-b border-slate-100">
                    <th className="p-5 text-[10px] font-black text-slate-400 uppercase tracking-widest w-24">時段</th>
                    {weekDays.map(d => (
                      <th key={d.date} className="p-5 border-l border-slate-100 min-w-[140px]">
                        <div className="font-black text-slate-800 text-sm">{d.label}</div>
                        <div className="text-[10px] text-slate-400 font-bold tracking-tight">{d.date}</div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {TIME_SLOTS.map(time => (
                    <tr key={time} className="border-b border-slate-50 transition-colors hover:bg-slate-50/30">
                      <td className="p-4 text-[10px] font-black text-slate-400 bg-slate-50/10 border-r border-slate-100">{time}</td>
                      {weekDays.map(day => {
                        const b = bookingsMap[`${day.date}_${time}_${selectedRoom.id}`];
                        return (
                          <td key={day.date} className="p-1.5 h-20 border-l border-slate-50">
                            {b ? (
                              <div className={`h-full w-full rounded-2xl p-3 flex flex-col justify-center relative shadow-sm group transition-all ${
                                b.userId === user?.uid 
                                ? 'bg-indigo-600 text-white ring-4 ring-indigo-50' 
                                : 'bg-slate-100 text-slate-600'
                              }`}>
                                <div className="font-black truncate text-xs">{b.name}</div>
                                <div className={`text-[9px] font-bold opacity-70 truncate uppercase ${b.userId === user?.uid ? 'text-indigo-200' : 'text-slate-400'}`}>
                                  {b.department}
                                </div>
                                {(b.userId === user?.uid || view === 'admin') && (
                                  <button 
                                    onClick={() => deleteBooking(b.id)} 
                                    className="absolute -top-1 -right-1 bg-white text-rose-500 p-1.5 rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-all scale-75 hover:scale-100"
                                  >
                                    <Trash2 size={12}/>
                                  </button>
                                )}
                              </div>
                            ) : (
                              <button 
                                onClick={() => {setActiveSlot({date: day.date, time}); setIsBookingModalOpen(true);}} 
                                className="w-full h-full border-2 border-dashed border-slate-100 rounded-2xl hover:border-indigo-400 hover:bg-indigo-50/50 text-slate-100 hover:text-indigo-400 transition-all font-black text-lg"
                              >
                                +
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
        </div>
      </main>

      {/* 彈窗：設定個人資料 */}
      {isProfileModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4 z-[100]">
          <div className="bg-white p-10 rounded-[3rem] w-full max-w-md shadow-2xl">
            <div className="bg-indigo-50 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6">
              <UserCircle className="text-indigo-600" size={40} />
            </div>
            <h3 className="text-3xl font-black text-slate-800 text-center mb-2">歡迎使用系統</h3>
            <p className="text-slate-400 text-center text-sm font-bold mb-8 uppercase tracking-widest">請先設定您的職工資訊</p>
            <form onSubmit={async (e) => {
              e.preventDefault();
              try {
                await setDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'profile', 'info'), userProfile);
                setIsProfileModalOpen(false);
              } catch (err) {
                alert("儲存失敗，請檢查網路。");
              }
            }} className="space-y-5">
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 ml-4 uppercase">姓名 / Full Name</label>
                <input required placeholder="輸入您的真實姓名" className="w-full bg-slate-50 border-2 border-slate-100 p-5 rounded-3xl outline-none focus:border-indigo-600 focus:bg-white font-bold transition-all" value={userProfile.name} onChange={e => setUserProfile({...userProfile, name: e.target.value})} />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 ml-4 uppercase">部門 / Department</label>
                <input required placeholder="輸入您所屬的部門" className="w-full bg-slate-50 border-2 border-slate-100 p-5 rounded-3xl outline-none focus:border-indigo-600 focus:bg-white font-bold transition-all" value={userProfile.department} onChange={e => setUserProfile({...userProfile, department: e.target.value})} />
              </div>
              <button className="w-full bg-indigo-600 text-white p-5 rounded-3xl font-black shadow-xl shadow-indigo-100 hover:bg-indigo-700 active:scale-[0.98] transition-all flex items-center justify-center gap-2">
                <ShieldCheck size={20} /> 儲存並開始預約
              </button>
            </form>
          </div>
        </div>
      )}

      {/* 彈窗：預約確認 */}
      {isBookingModalOpen && activeSlot && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4 z-[100]">
          <div className="bg-white p-10 rounded-[3rem] w-full max-w-sm shadow-2xl text-center relative">
            <button onClick={() => setIsBookingModalOpen(false)} className="absolute top-8 right-8 text-slate-300 hover:text-slate-500 transition-colors">
              <X size={24}/>
            </button>
            <h3 className="font-black text-2xl text-slate-800 mb-6">確認會議預約</h3>
            <div className="bg-slate-50 p-8 rounded-[2.5rem] mb-8 border border-slate-100">
              <div className="text-indigo-600 font-black text-2xl mb-2">{selectedRoom.name}</div>
              <div className="flex flex-col gap-1">
                <span className="text-slate-400 font-bold text-sm tracking-tight">{activeSlot.date}</span>
                <span className="text-slate-800 font-black text-xl">{activeSlot.time}</span>
              </div>
            </div>
            <button 
              onClick={handleBooking} 
              className="w-full bg-indigo-600 text-white p-5 rounded-3xl font-black shadow-xl shadow-indigo-100 hover:bg-indigo-700 active:scale-[0.98] transition-all"
            >
              確定送出預約
            </button>
            <button 
              onClick={() => setIsBookingModalOpen(false)} 
              className="w-full mt-4 text-slate-400 font-bold text-sm"
            >
              再考慮一下
            </button>
          </div>
        </div>
      )}

      {/* 底部全域通知 */}
      {connectionStatus === 'offline' && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-amber-500 text-white px-6 py-4 rounded-3xl shadow-2xl flex items-center gap-3 animate-bounce z-50">
          <AlertCircle size={20} />
          <div className="text-sm font-black text-center leading-tight">偵測到網路不穩定：系統目前處於離線快取模式</div>
        </div>
      )}
    </div>
  );
}

// 嚴謹掛載：解決 TypeError: Cannot read properties of undefined (reading 'S')
const rootElement = document.getElementById('root');
if (rootElement) {
  const root = createRoot(rootElement);
  root.render(<MeetingApp />);
}