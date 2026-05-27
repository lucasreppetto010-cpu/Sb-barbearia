export const SB_CONFIG = {
  whatsappE164: "5555997298329",
  barbers: [
    { id: "b1", name: "Denner" },
    { id: "b2", name: "Lucas Reppetto" },
    { id: "b3", name: "Lucas Prates" }
  ],
  slotMinutes: 30,
  allowedWeekdays: [1,2,3,4,5,6],
  hoursByWeekday: {
  // Seg(1) a Sex(5): 09-12 e 14-19
  1: { ranges: [{ open:"09:00", close:"12:00" }, { open:"14:00", close:"19:30" }] },
  2: { ranges: [{ open:"09:00", close:"12:00" }, { open:"14:00", close:"19:30" }] },
  3: { ranges: [{ open:"09:00", close:"12:00" }, { open:"14:00", close:"19:30" }] },
  4: { ranges: [{ open:"09:00", close:"12:00" }, { open:"14:00", close:"19:30" }] },
  5: { ranges: [{ open:"09:00", close:"12:00" }, { open:"14:00", close:"19:30" }] },

  // Sábado(6): 09-12 e 14-20
  6: { ranges: [{ open:"09:00", close:"12:00" }, { open:"14:00", close:"20:00" }] }
},
  firebase: {
    apiKey: "AIzaSyAyzDc1oCv3eZBmqy48JoDRQSCAWdy1VBE",
    authDomain: "sbbarbearia-010.firebaseapp.com",
    projectId: "sbbarbearia-010",
    storageBucket: "sbbarbearia-010.firebasestorage.app",
    messagingSenderId: "579367260569",
    appId: "1:579367260569:web:65ccf46b327cc25d4e4308"
  }
};
