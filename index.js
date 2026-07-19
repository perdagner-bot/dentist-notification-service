import { initializeApp } from 'firebase/app';
import { getFirestore, collection, query, orderBy, getDocs } from 'firebase/firestore';
import { createServer } from 'http';

const firebaseConfig = {
  apiKey: "AIzaSyBYyrKUgdWpz2oMhLZ7YgL5wYO8NlubKNg",
  authDomain: "consultorio-dentallifealfadent.firebaseapp.com",
  projectId: "consultorio-dentallifealfadent",
  storageBucket: "consultorio-dentallifealfadent.firebasestorage.app",
  messagingSenderId: "1094421996731",
  appId: "1:1094421996731:web:e04fbd81ac6f79c22df59e",
  measurementId: "G-04906KKGEM"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const SERVICE_LABELS = {
  consulta: 'Consulta General',
  resinas: 'Resinas estéticas',
  conducto: 'Tratamiento de conducto',
  extracciones: 'Extracciones',
  limpieza: 'Limpieza dental profesional',
  placas: 'Placas dentales',
  odontopediatria: 'Odontopediatría',
  ortodoncia: 'Ortodoncia',
  implantes: 'Implantes dentales',
  rayosx: 'Rayos X',
};

let lastSeenTimestamp = new Date();

async function sendPushNotification(title, body, data = {}) {
  try {
    const tokensSnapshot = await getDocs(collection(db, 'push_tokens'));
    const tokens = tokensSnapshot.docs.map((doc) => doc.data().token);

    if (tokens.length === 0) {
      console.log('No push tokens registered');
      return;
    }

    const messages = tokens.map((token) => ({
      to: token,
      sound: 'default',
      title,
      body,
      data,
      priority: 'high',
    }));

    const res = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(messages.length === 1 ? messages[0] : messages),
    });

    const result = await res.json();
    console.log('Push sent:', JSON.stringify(result).slice(0, 200));
  } catch (err) {
    console.error('Error sending push:', err.message);
  }
}

async function checkNewAppointments() {
  try {
    const q = query(collection(db, 'appointments'), orderBy('created_at', 'desc'));
    const snapshot = await getDocs(q);

    let latestTimestamp = lastSeenTimestamp;

    snapshot.forEach((docSnap) => {
      const appt = { id: docSnap.id, ...docSnap.data() };
      const created = appt.created_at;

      if (!lastSeenTimestamp || (created && created > lastSeenTimestamp)) {
        const serviceName = SERVICE_LABELS[appt.service] || appt.service;
        console.log(`[${new Date().toISOString()}] New appointment: ${appt.name} - ${serviceName}`);

        sendPushNotification(
          'Nueva cita agendada!',
          `${appt.name} - ${serviceName}`,
          { appointmentId: appt.id }
        );
      }

      if (created && (!latestTimestamp || created > latestTimestamp)) {
        latestTimestamp = created;
      }
    });

    if (latestTimestamp) {
      lastSeenTimestamp = latestTimestamp;
    }
  } catch (err) {
    console.error('Error checking appointments:', err.message);
  }
}

// Health check server for Render
const PORT = process.env.PORT || 3000;
const server = createServer((req, res) => {
  if (req.url === '/') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'ok',
      service: 'lifealfadent-notifications',
      uptime: process.uptime(),
      lastCheck: new Date().toISOString(),
    }));
  } else if (req.url === '/health') {
    res.writeHead(200);
    res.end('ok');
  } else {
    res.writeHead(404);
    res.end('Not found');
  }
});

server.listen(PORT, () => {
  console.log(`Health check server running on port ${PORT}`);
});

// Poll for new appointments every 30 seconds
console.log('Starting appointment poller...');
checkNewAppointments();
setInterval(checkNewAppointments, 30 * 1000);

console.log('Notification service is running!');
