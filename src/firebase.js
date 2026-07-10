import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyBW42qVUrm6HyojoqW605ghrNTOOA3WjXo",
  authDomain: "qr-menu-app-923f9.firebaseapp.com",
  projectId: "qr-menu-app-923f9",
  storageBucket: "qr-menu-app-923f9.firebasestorage.app",
  messagingSenderId: "169775605119",
  appId: "1:169775605119:web:a2717ea7a8880c31ef264a"
};

// Inicializar Firebase
const app = initializeApp(firebaseConfig);

// Exportar los servicios para usarlos en toda la app
export const db = getFirestore(app);
export const auth = getAuth(app);