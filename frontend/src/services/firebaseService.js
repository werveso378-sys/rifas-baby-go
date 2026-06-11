import { initializeApp } from "firebase/app";
import { 
  getFirestore, 
  collection, 
  doc, 
  onSnapshot, 
  runTransaction,
  writeBatch,
  getDoc,
  setDoc,
  getDocs,
  addDoc,
  updateDoc,
  query,
  where,
  orderBy
} from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyCd6MSdb5GHdiCkyaKSMOmhFDfFFtH5UOs",
  authDomain: "rifababygo.firebaseapp.com",
  projectId: "rifababygo",
  storageBucket: "rifababygo.firebasestorage.app",
  messagingSenderId: "931597096048",
  appId: "1:931597096048:web:a3d45c39e0228f8a1910b5",
  measurementId: "G-ZLWX63Q03B"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

export const listenToNumbers = (raffleId, callback) => {
  const q = collection(db, "raffles", raffleId, "numbers");
  
  return onSnapshot(q, (snapshot) => {
    const numbers = snapshot.docs.map(doc => ({ 
      number: parseInt(doc.id), 
      ...doc.data() 
    }));
    
    // O Firestore só retorna os documentos criados. 
    // Para a rifa, precisamos preencher de 1 a 100 garantindo que os não criados sejam "AVAILABLE"
    const fullGrid = Array.from({ length: 100 }, (_, i) => {
      const num = i + 1;
      const found = numbers.find(n => n.number === num);
      return found || { number: num, status: "AVAILABLE", ownerName: null };
    });
    
    callback(fullGrid);
  });
};

export const reserveNumbers = async (raffleId, selectedNumbers, userInfo) => {
  try {
    const success = await runTransaction(db, async (transaction) => {
      const refs = selectedNumbers.map(n => doc(db, "raffles", raffleId, "numbers", String(n)));
      const docs = await Promise.all(refs.map(ref => transaction.get(ref)));
      
      // Verifica se algum número já foi reservado ou pago por outra pessoa
      for (const d of docs) {
        if (d.exists() && d.data().status !== "AVAILABLE" && d.data().status !== "CANCELED") {
          throw new Error("Number already taken");
        }
      }

      // Se passou na verificação, reserva todos
      const now = new Date();
      const expiresAt = new Date(now.getTime() + 5 * 60000).toISOString(); // +5 min
      
      refs.forEach(ref => {
        transaction.set(ref, {
          status: "RESERVED",
          ownerName: userInfo.name,
          ownerWhatsApp: userInfo.whatsapp,
          reservedAt: now.toISOString(),
          expiresAt: expiresAt
        });
      });

      return true;
    });

    return success;
  } catch (error) {
    console.error("Transaction failed: ", error);
    return false;
  }
};

export const cancelReservation = async (raffleId, selectedNumbers) => {
  try {
    const batch = writeBatch(db);
    selectedNumbers.forEach(n => {
      const ref = doc(db, "raffles", raffleId, "numbers", String(n));
      batch.update(ref, {
        status: "CANCELED",
        isCanceled: true
        // Note: ownerName and ownerWhatsApp are NOT cleared so Admin can still see them
      });
    });
    await batch.commit();
    return true;
  } catch (error) {
    console.error("Cancel failed: ", error);
    return false;
  }
};

export const eraseHistory = async (raffleId, selectedNumbers) => {
  try {
    const batch = writeBatch(db);
    selectedNumbers.forEach(n => {
      const ref = doc(db, "raffles", raffleId, "numbers", String(n));
      batch.update(ref, {
        ownerName: null,
        ownerWhatsApp: null,
        isCanceled: null,
        status: "AVAILABLE"
      });
    });
    await batch.commit();
    return true;
  } catch (error) {
    console.error("Erase history failed: ", error);
    return false;
  }
};

export const updateReservation = async (raffleId, selectedNumbers, newName, newWhatsApp) => {
  try {
    const batch = writeBatch(db);
    selectedNumbers.forEach(n => {
      const ref = doc(db, "raffles", raffleId, "numbers", String(n));
      batch.update(ref, {
        ownerName: newName,
        ownerWhatsApp: newWhatsApp
      });
    });
    await batch.commit();
    return true;
  } catch (error) {
    console.error("Update failed: ", error);
    return false;
  }
};

// ─── Autenticação de Cliente (Meus Números) ─────────────────────────────────

export const getClientPassword = async (whatsapp) => {
  try {
    const cleanedPhone = whatsapp.replace(/\D/g, '');
    const clientRef = doc(db, "clients", cleanedPhone);
    const snap = await getDoc(clientRef);
    if (snap.exists()) {
      return snap.data().password;
    }
    return null;
  } catch (error) {
    console.error("Error getting client password:", error);
    return null;
  }
};

export const setClientPassword = async (whatsapp, name, password) => {
  try {
    const cleanedPhone = whatsapp.replace(/\D/g, '');
    const clientRef = doc(db, "clients", cleanedPhone);
    await setDoc(clientRef, {
      name,
      whatsapp: cleanedPhone,
      password,
      createdAt: new Date().toISOString()
    }, { merge: true });
    return true;
  } catch (error) {
    console.error("Error setting client password:", error);
    return false;
  }
};

export const getClientNumbers = async (raffleId, whatsapp) => {
  try {
    const numbersRef = collection(db, "raffles", raffleId, "numbers");
    // Fetch all, filter locally to avoid index creation for now
    const snapshot = await getDocs(numbersRef);
    const clientNumbers = [];
    const cleanedQueryPhone = whatsapp.replace(/\D/g, '');
    
    snapshot.forEach((doc) => {
      const data = doc.data();
      if (data.status !== 'AVAILABLE' && data.ownerWhatsApp && data.ownerWhatsApp.replace(/\D/g, '') === cleanedQueryPhone) {
        clientNumbers.push({ number: parseInt(doc.id), ...data });
      }
    });
    return clientNumbers;
  } catch (error) {
    console.error("Error fetching client numbers:", error);
    return [];
  }
};

// ─── Gerenciamento de Rifas (Admin) ─────────────────────────────────────────

export const listenToRaffles = (callback) => {
  const q = collection(db, "raffles");
  return onSnapshot(q, (snapshot) => {
    const raffles = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    // Sort by createdAt descending locally
    raffles.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
    callback(raffles);
  });
};

export const createRaffle = async (raffleData) => {
  try {
    const ref = collection(db, "raffles");
    const docRef = await addDoc(ref, {
      ...raffleData,
      status: "ACTIVE", // ACTIVE, PAUSED, FINISHED
      createdAt: new Date().toISOString()
    });
    return docRef.id;
  } catch (error) {
    console.error("Error creating raffle:", error);
    return null;
  }
};

export const updateRaffle = async (raffleId, updates) => {
  try {
    const ref = doc(db, "raffles", raffleId);
    await updateDoc(ref, updates);
    return true;
  } catch (error) {
    console.error("Error updating raffle:", error);
    return false;
  }
};

export const getActiveRaffle = async () => {
  try {
    const q = query(collection(db, "raffles"), where("status", "in", ["ACTIVE", "PAUSED"]));
    const snapshot = await getDocs(q);
    const raffles = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    raffles.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
    return raffles[0] || null;
  } catch (error) {
    console.error("Error getting active raffle:", error);
    return null;
  }
};
