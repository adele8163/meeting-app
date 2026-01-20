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
  query
} from 'firebase/firestore';
import { 
  getAuth, 
  signInAnonymously, 
  onAuthStateChanged 
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
  ShieldCheck, 
  Wifi, 
  WifiOff, 
  Loader2, 
  CheckCircle2,
  Settings
} from 'lucide-react';

/* <!-- Chosen Palette: Professional Indigo & Slate -->
<!-- Application Structure Plan: 
1. 資訊架構：以週視圖排程表為核心，左側提供會議室篩選。
2. 驗證流：啟動時強制執行 signInAnonymously，並監聽 auth 狀態，確保所有資料請求都在 user 物件存在後發起。
3. 預約邏輯：使用格式化 ID (RoomID_Date_Time) 確保資料唯一性，並遵守系統指定的公共路徑規則。
4. 診斷增強：針對「無法儲存」問題，加入了具體的錯誤訊息回饋，當 Firebase 回傳錯誤時，Toast 會顯示具體原因。
-->
<!-- Visualization & Content Choices: 
- 預約看板 -> 目標：對比佔用狀態 -> 方法：Grid 排版 -> 庫：Tailwind CSS。
- 登錄資訊 -> 目標：顯示用戶身分 -> 方法：獨立 Profile Modal。
- 系統診斷 -> 目標：排除連線問題 -> 方法：狀態列 (Auth Status Bar)。
-->
<!-- CONFIRMATION: NO SVG graphics used. NO Mermaid JS used. -->
*/

// --- Firebase 設定 (請務必確認您的 Firebase 控制台已啟用 Anonymous 登入與 Firestore) ---
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
const appId = 'meeting-room-system-final-stable';

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

function MeetingApp() {
  const [user, setUser] = useState(null);
  const [userProfile, setUserProfile] = useState({ name: '', department: '' });
  const [selectedRoom, setSelectedRoom] = useState(ROOMS[0]);
  const [baseDate, setBaseDate] = useState(new Date());
  const [bookings, setBookings] = useState([]);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isBookingModalOpen, setIsBookingModalOpen] = useState(false);
  const [activeSlot, setActiveSlot] = useState(null);
  const [status, setStatus] = useState('connecting'); 
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState(null);

  // 初始化驗證
  useEffect(() => {
    const initSession = async () => {
      try {
        await signInAnonymously(auth);
      } catch (err) {
        console.error("Auth Error:", err);
        setStatus('error');
        showToast(`驗證失敗: ${err.message}`, "error");
      }
    };
    initSession();
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      if (u) setStatus('authorized');
    });
    return () => unsubscribe();
  }, []);

  // 資料監聽
  useEffect(() => {
    if (!user) return;

    const profileRef = doc(db, 'artifacts', appId, 'users', user.uid, 'profile', 'info');
    getDoc(profileRef).then(snap => {
      if (snap.exists()) {
        setUserProfile(snap.data());
      } else {
        setIsProfileModalOpen(true);
      }
    });

    const bookingsRef = collection(db, 'artifacts', appId, 'public', 'data', 'bookings');
    const unsubscribe = onSnapshot(bookingsRef, (snapshot) => {
      setBookings(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (err) => {
      console.error("Firestore Error:", err);
      showToast(`連線異常: ${err.code === 'permission-denied' ? '權限遭拒' : err.message}`, "error");
    });

    return () => unsubscribe();
  }, [user]);

  const showToast = (msg, type = 'info') => {
    setMessage({ text: msg, type });
    setTimeout(() => setMessage(null), 5000); // 增加顯示時間以便閱讀
  };

  const weekDays = useMemo(() => {
    const start = new Date(baseDate);
    const day = start.getDay();
    const diff = start.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(start.setDate(diff));
    
    return [0, 1, 2, 3, 4].map(i => {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      return { 
        date: d.toISOString().split('T')[0], 
        label: ['週一', '週二', '週三', '週四', '週五'][i] 
      };
    });
  }, [baseDate]);

  const bookingsMap = useMemo(() => {
    const map = {};
    bookings.forEach(b => map[`${b.date}_${b.timeSlot}_${b.roomId}`] = b);
    return map;
  }, [bookings]);

  // 儲存個人資料
  const handleSaveProfile = async (e) => {
    e.preventDefault();
    if (!user) {
      showToast("系統未就緒，正在嘗試重新連線...", "error");
      return;
    }
    setIsLoading(true);
    try {
      const profileRef = doc(db, 'artifacts', appId, 'users', user.uid, 'profile', 'info');
      await setDoc(profileRef, userProfile);
      setIsProfileModalOpen(false);
      showToast("個人資料已儲存成功", "success");
    } catch (err) {
      console.error("Save Profile Error:", err);
      showToast(`儲存失敗: ${err.code === 'permission-denied' ? '請確認資料庫規則已設為測試模式' : err.message}`, "error");
    } finally {
      setIsLoading(false);
    }
  };

  // 執行預約動作
  const handleBooking = async () => {
    if (!user || !activeSlot) return;
    if (!userProfile.name) {
      setIsBookingModalOpen(false);
      setIsProfileModalOpen(true);
      showToast("請先設定姓名，否則無法記錄預約者", "error");
      return;
    }

    setIsLoading(true);
    const bookingId = `${selectedRoom.id}_${activeSlot.date}_${activeSlot.time.replace(':','')}`;
    const docRef = doc(db, 'artifacts', appId, 'public', 'data', 'bookings', bookingId);
    
    try {
      await setDoc(docRef, {
        roomId: selectedRoom.id,
        date: activeSlot.date,
        timeSlot: activeSlot.time,
        userId: user.uid,
        userName: userProfile.name,
        userDept: userProfile.department,
        createdAt: new Date().toISOString()
      });
      setIsBookingModalOpen(false);
      setActiveSlot(null);
      showToast("會議室預約成功！", "success");
    } catch (err) {
      console.error("Booking Error:", err);
      showToast(`預約失敗: ${err.code === 'permission-denied' ? '資料庫規則禁止寫入，請檢查 Firebase 設定' : err.message}`, "error");
    } finally {
      setIsLoading(false);
    }
  };

  // 刪除預約
  const deleteBooking = async (id) => {
    if (!window.confirm("確定取消預約？")) return;
    try {
      await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'bookings', id));
      showToast("預約已取消", "info");
    } catch (err) {
      showToast(`刪除失敗: ${err.message}`, "error");
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans flex flex-col">
      {/* 診斷狀態列 */}
      <div className={`px-4 py-1 text-[10px] font-bold text-center flex justify-center gap-4 transition-colors ${status === 'authorized' ? 'bg-emerald-500 text-white' : 'bg-amber-500 text-white'}`}>
        <span className="flex items-center gap-1 uppercase tracking-tighter">
          {status === 'authorized' ? <Wifi size={10}/> : <WifiOff size={10}/>}
          連線狀態: {status === 'authorized' ? '已連接後端' : '連線中...'}
        </span>
        <span className="opacity-75 tracking-tighter hidden sm:inline">用戶ID: {user?.uid || '正在取得驗證...'}</span>
      </div>

      <header className="bg-white border-b px-6 py-4 flex justify-between items-center sticky top-0 z-20 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="bg-indigo-600 p-2 rounded-xl text-white shadow-lg">
            <Building2 size={24} />
          </div>
          <div>
            <h1 className="font-black text-lg">企業會議室預約系統</h1>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Enterprise Scheduling System</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setIsProfileModalOpen(true)} className="flex items-center gap-2 bg-slate-100 px-4 py-2 rounded-xl hover:bg-slate-200 transition-all border border-transparent active:border-indigo-200">
            <UserCircle size={18} />
            <span className="text-xs font-black">{userProfile.name || '設定身分'}</span>
          </button>
        </div>
      </header>

      <main className="p-4 md:p-8 grid grid-cols-1 lg:grid-cols-4 gap-8 max-w-7xl mx-auto w-full flex-1">
        <aside className="space-y-3">
          <div className="px-2 mb-4">
            <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
              <Settings size={12} /> 會議室選擇
            </h3>
          </div>
          {ROOMS.map(room => (
            <button
              key={room.id}
              onClick={() => setSelectedRoom(room)}
              className={`w-full text-left p-4 rounded-2xl border-2 transition-all ${selectedRoom.id === room.id ? 'bg-indigo-600 border-indigo-600 text-white shadow-xl scale-[1.02]' : 'bg-white border-transparent hover:border-indigo-100 shadow-sm'}`}
            >
              <div className="font-black text-sm">{room.name}</div>
              {!room.hasPC && <div className="text-[10px] opacity-70 mt-1 flex items-center gap-1"><MonitorOff size={10}/> 無電腦設備</div>}
            </button>
          ))}
        </aside>

        <div className="lg:col-span-3 space-y-4">
          <div className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm flex flex-col md:flex-row justify-between items-center gap-4">
            <div>
              <h2 className="text-2xl font-black text-slate-800">{selectedRoom.name}</h2>
              <p className="text-xs text-slate-400 font-bold mt-1">會議預約看板 / 每週視圖</p>
            </div>
            <div className="flex items-center gap-2 bg-slate-50 p-2 rounded-2xl border">
              <button onClick={() => {const d=new Date(baseDate); d.setDate(d.getDate()-7); setBaseDate(d);}} className="p-2 hover:bg-white hover:shadow-sm rounded-xl transition-all"><ChevronLeft size={20}/></button>
              <div className="px-4 text-center">
                <div className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">當週起始日期</div>
                <div className="text-xs font-black">{weekDays[0].date}</div>
              </div>
              <button onClick={() => {const d=new Date(baseDate); d.setDate(d.getDate()+7); setBaseDate(d);}} className="p-2 hover:bg-white hover:shadow-sm rounded-xl transition-all"><ChevronRight size={20}/></button>
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
                    <tr key={time} className="border-b border-slate-50 hover:bg-slate-50/30 transition-colors">
                      <td className="p-3 font-bold text-slate-400 bg-slate-50/10">{time}</td>
                      {weekDays.map(day => {
                        const b = bookingsMap[`${day.date}_${time}_${selectedRoom.id}`];
                        return (
                          <td key={day.date} className="p-1 h-16 border-l border-slate-50">
                            {b ? (
                              <div className={`h-full w-full rounded-2xl p-2 flex flex-col justify-center relative shadow-sm transition-all ${b.userId === user?.uid ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-500'}`}>
                                <span className="font-black truncate text-[10px] leading-tight">{b.userName}</span>
                                <span className="text-[9px] opacity-70 truncate">{b.userDept}</span>
                                {b.userId === user?.uid && (
                                  <button onClick={() => deleteBooking(b.id)} className="absolute top-1 right-1 hover:text-rose-400 transition-colors"><Trash2 size={10}/></button>
                                )}
                              </div>
                            ) : (
                              <button 
                                onClick={() => {setActiveSlot({date: day.date, time}); setIsBookingModalOpen(true);}} 
                                className="w-full h-full border-2 border-dashed border-slate-100 rounded-2xl hover:border-indigo-300 hover:bg-indigo-50/30 text-slate-100 hover:text-indigo-400 transition-all font-black text-lg"
                              >+</button>
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

      {/* 設定身分 Modal */}
      {isProfileModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white p-8 rounded-[2.5rem] w-full max-w-sm shadow-2xl">
            <div className="text-center mb-6">
              <div className="bg-indigo-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                <UserCircle className="text-indigo-600" size={32} />
              </div>
              <h3 className="text-2xl font-black text-slate-800 tracking-tighter">設定您的個人資料</h3>
              <p className="text-xs text-slate-400 mt-2 font-bold uppercase tracking-widest">請先輸入姓名以完成驗證</p>
            </div>
            <form onSubmit={handleSaveProfile} className="space-y-4">
              <input required placeholder="您的姓名" className="w-full border-2 border-slate-100 p-4 rounded-2xl outline-none focus:border-indigo-500 font-bold transition-all disabled:opacity-50" value={userProfile.name} onChange={e => setUserProfile({...userProfile, name: e.target.value})} disabled={isLoading} />
              <input required placeholder="所屬部門" className="w-full border-2 border-slate-100 p-4 rounded-2xl outline-none focus:border-indigo-500 font-bold transition-all disabled:opacity-50" value={userProfile.department} onChange={e => setUserProfile({...userProfile, department: e.target.value})} disabled={isLoading} />
              <button 
                type="submit"
                disabled={isLoading}
                className="w-full bg-indigo-600 text-white p-4 rounded-2xl font-black shadow-lg hover:bg-indigo-700 active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isLoading ? <Loader2 className="animate-spin" size={20} /> : <ShieldCheck size={20} />}
                {isLoading ? "儲存資料中..." : "儲存並開始預約"}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* 預約確認 Modal */}
      {isBookingModalOpen && activeSlot && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white p-8 rounded-[2.5rem] w-full max-w-xs shadow-2xl text-center relative">
            <button onClick={() => setIsBookingModalOpen(false)} className="absolute top-6 right-6 text-slate-300 hover:text-slate-500 transition-colors"><X size={20}/></button>
            <h3 className="font-black text-xl text-slate-800 mb-4 tracking-tighter">確認預約會議</h3>
            <div className="bg-slate-50 p-6 rounded-3xl mb-6 border border-slate-100">
              <div className="text-indigo-600 font-black text-lg">{selectedRoom.name}</div>
              <div className="flex flex-col gap-1 mt-2 font-bold text-slate-400 text-xs">
                <span>日期: {activeSlot.date}</span>
                <span className="text-slate-800 text-lg font-black">時段: {activeSlot.time}</span>
              </div>
            </div>
            <button 
              onClick={handleBooking} 
              disabled={isLoading}
              className="w-full bg-indigo-600 text-white p-4 rounded-2xl font-black shadow-lg hover:bg-indigo-700 transition-all active:scale-95 flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isLoading && <Loader2 className="animate-spin" size={20} />}
              {isLoading ? "處理預約中..." : "確認送出"}
            </button>
          </div>
        </div>
      )}

      {/* Toast 提示訊息 (加強錯誤診斷) */}
      {message && (
        <div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-[60] animate-bounce w-full max-w-md px-4">
          <div className={`px-6 py-4 rounded-3xl shadow-2xl flex items-center gap-3 font-black text-white ${message.type === 'error' ? 'bg-rose-500' : 'bg-emerald-500'}`}>
            {message.type === 'error' ? <AlertCircle size={20} /> : <CheckCircle2 size={20} />}
            <div className="text-sm leading-tight">{message.text}</div>
          </div>
        </div>
      )}
    </div>
  );
}

const rootElement = document.getElementById('root');
if (rootElement) {
  const root = createRoot(rootElement);
  root.render(<MeetingApp />);
}