// 1. นำเข้าคำสั่งของ Firebase
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged, createUserWithEmailAndPassword, signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { getFirestore, collection, addDoc, query, where, orderBy, onSnapshot, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

// 2. ใส่ Config ของคุณ
const firebaseConfig = {
  apiKey: "AIzaSyDv1u9Bm5pMIX6nY__xNk3OkLbxrINTUn0",
  authDomain: "cru-actitrack.firebaseapp.com",
  projectId: "cru-actitrack",
  storageBucket: "cru-actitrack.firebasestorage.app",
  messagingSenderId: "370601049848",
  appId: "1:370601049848:web:97c84785c3471bec06c50d",
  measurementId: "G-SVK8TCQZ1Q"
};

// 3. เริ่มต้นระบบ Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const googleProvider = new GoogleAuthProvider();

let currentUser = null;
let unsubscribeSnapshot = null;

// ================= ระบบจัดการหน้าจอ =================
window.switchScreen = (screenId) => {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(screenId).classList.add('active');
  
  // ตั้งค่าวันที่ปัจจุบันอัตโนมัติในหน้าเพิ่มกิจกรรม
  if (screenId === 'screen-add') {
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    document.getElementById('input-datetime').value = now.toISOString().slice(0, 16);
  }
};

// ================= ติดตามสถานะผู้ใช้ =================
onAuthStateChanged(auth, (user) => {
  if (user) {
    currentUser = user;
    document.getElementById('user-email-display').innerText = user.email;
    window.switchScreen('screen-main');
    loadActivities(); // ดึงข้อมูลจากฐานข้อมูล
  } else {
    currentUser = null;
    window.switchScreen('screen-login');
    if (unsubscribeSnapshot) unsubscribeSnapshot(); // หยุดดึงข้อมูล
  }
});

// ================= ระบบ ล็อคอิน/สร้างบัญชี =================
// แบบใช้อีเมล
window.handleEmailAuth = async () => {
  const email = document.getElementById('login-email').value;
  const pass = document.getElementById('login-pass').value;

  if (!email || !pass) return alert("กรุณากรอกอีเมลและรหัสผ่าน");

  try {
    // ลองเข้าสู่ระบบ
    await signInWithEmailAndPassword(auth, email, pass);
  } catch (error) {
    // ถ้ารหัสผิด หรือ ยังไม่มีบัญชี
    if (error.code === 'auth/invalid-credential' || error.code === 'auth/user-not-found' || error.code === 'auth/invalid-login-credentials') {
      const confirmCreate = confirm("ไม่พบบัญชี หรือรหัสผ่านผิด \nต้องการ 'สร้างบัญชีใหม่' ด้วยอีเมลนี้เลยหรือไม่?");
      if (confirmCreate) {
        try {
          await createUserWithEmailAndPassword(auth, email, pass);
          alert("สร้างบัญชีสำเร็จ!");
        } catch (createErr) {
          alert("สร้างบัญชีไม่ได้: " + createErr.message);
        }
      }
    } else {
      alert("เกิดข้อผิดพลาด: " + error.code);
    }
  }
};

// แบบใช้ Google
window.handleGoogleLogin = async () => {
  try {
    await signInWithPopup(auth, googleProvider);
  } catch (error) {
    alert("ล็อคอินด้วย Google ไม่สำเร็จ: " + error.message);
  }
};

// ออกจากระบบ
window.logout = async () => {
  await signOut(auth);
};

// ================= ระบบ บันทึก/ดึงข้อมูล (Firestore) =================
window.saveActivity = async () => {
  if (!currentUser) return alert("กรุณาล็อคอินก่อน");

  const name = document.getElementById('input-name').value;
  const datetime = document.getElementById('input-datetime').value;
  const hours = parseFloat(document.getElementById('input-hours').value);

  if (!name || !datetime || isNaN(hours) || hours <= 0) {
    return alert("กรุณากรอกข้อมูลให้ครบถ้วน");
  }

  // จัดรูปแบบวันที่ให้อ่านง่าย
  const dateObj = new Date(datetime);
  const formattedDate = `${dateObj.getDate()}/${dateObj.getMonth()+1}/${dateObj.getFullYear()} - ${String(dateObj.getHours()).padStart(2, '0')}:${String(dateObj.getMinutes()).padStart(2, '0')} น.`;

  try {
    // ส่งข้อมูลขึ้น Firebase
    await addDoc(collection(db, "activities"), {
      userId: currentUser.uid,
      name: name,
      dateText: formattedDate,
      hours: hours,
      createdAt: serverTimestamp()
    });

    document.getElementById('input-name').value = '';
    document.getElementById('input-hours').value = '';
    window.switchScreen('screen-main');
  } catch (error) {
    alert("บันทึกข้อมูลไม่สำเร็จ: " + error.message);
  }
};

// ดึงข้อมูลมาแสดงแบบ Real-time
function loadActivities() {
  const listEl = document.getElementById('activity-list');
  const totalEl = document.getElementById('display-total-hours');

  // ค้นหาเฉพาะข้อมูลของคนที่ล็อคอินอยู่
  const q = query(
    collection(db, "activities"), 
    where("userId", "==", currentUser.uid),
    orderBy("createdAt", "desc")
  );

  unsubscribeSnapshot = onSnapshot(q, (snapshot) => {
    let activities = [];
    let totalHours = 0;

    snapshot.forEach((doc) => {
      const data = doc.data();
      activities.push(data);
      totalHours += data.hours;
    });

    totalEl.innerText = totalHours % 1 === 0 ? totalHours : totalHours.toFixed(1);

    if (activities.length === 0) {
      listEl.innerHTML = '<p style="text-align:center; color:#999; font-size:12px; margin-top:20px;">ยังไม่มีกิจกรรม กด + เพื่อเพิ่มเลย</p>';
    } else {
      listEl.innerHTML = activities.map(item => `
        <div class="card">
          <div class="card-left">
            <div class="card-icon">🗓️</div>
            <div class="card-info">
              <h4>${item.name}</h4>
              <p>${item.dateText}</p>
            </div>
          </div>
          <div class="card-hours">${item.hours} ชม.</div>
        </div>
      `).join('');
    }
  });
}
