import { initializeApp } from "firebase/app";
import { 
  getFirestore, 
  collection, 
  doc, 
  onSnapshot, 
  runTransaction,
  writeBatch
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
        if (d.exists() && d.data().status !== "AVAILABLE") {
          throw new Error("Number already taken");
        }
      }

      // Se passou na verificação, reserva todos
      refs.forEach(ref => {
        transaction.set(ref, {
          status: "RESERVED",
          ownerName: userInfo.name,
          ownerWhatsApp: userInfo.whatsapp,
          reservedAt: new Date().toISOString()
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
