import { SB_CONFIG } from "./config.js";
import { db, fb } from "./firebase.js";

function parseTimeToMinutes(t){
  const [h,m]=t.split(":").map(Number);
  return h*60+m;
}
function minutesToTime(mins){
  const h=String(Math.floor(mins/60)).padStart(2,"0");
  const m=String(mins%60).padStart(2,"0");
  return `${h}:${m}`;
}
export function weekdayOf(dateISO){
  return new Date(dateISO + "T00:00:00").getDay();
}
export function isAllowedDay(dateISO){
  return SB_CONFIG.allowedWeekdays.includes(weekdayOf(dateISO));
}
export function hoursFor(dateISO){
  return SB_CONFIG.hoursByWeekday[weekdayOf(dateISO)] || null;
}

export function generateSlots(dateISO){
  const dayCfg = hoursFor(dateISO);
  if(!dayCfg) return [];

  const step = SB_CONFIG.slotMinutes;
  const ranges = dayCfg.ranges || []; // [{open, close}, ...]

  const out = [];

  for (const r of ranges){
    const start = parseTimeToMinutes(r.open);
    const end = parseTimeToMinutes(r.close);

    for (let m = start; m + step <= end; m += step){
      out.push(minutesToTime(m));
    }
  }

  return out;
}

// ID único do slot (barbeiro+data+hora) -> impede dupla reserva
export function slotDocId({barberId,dateISO,time}){
  return `${barberId}_${dateISO}_${time.replace(":","")}`;
}

// Coleção: slots (um doc por slot reservado)
// doc: { barberId, dateISO, time, name, phone, service, status, createdAt }
export async function bookSlot({ name, phone, service, barberId, dateISO, time }){
  if(!isAllowedDay(dateISO)) throw new Error("Agendamentos apenas de segunda a sábado.");
  const slots = generateSlots(dateISO);
  if(!slots.includes(time)) throw new Error("Horário inválido.");

  const id = slotDocId({ barberId, dateISO, time });
  const ref = fb.doc(db, "slots", id);

  // Transação garante "tempo real" sem duplicar reservas
  await fb.runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (snap.exists()) throw new Error("Esse horário já está ocupado.");

    tx.set(ref, {
      barberId,
      dateISO,
      time,
      name,
      phone,
      service,
      status: "booked",
      createdAt: fb.serverTimestamp()
    });
  });

  return { id, barberId, dateISO, time, name, phone, service };
}

export async function cancelSlotById(id){
  const ref = fb.doc(db, "slots", id);
  await fb.deleteDoc(ref);
}

// stream de slots de um barbeiro e dia
export function watchDaySlots({ barberId, dateISO }, cb){
  const q = fb.query(
    fb.collection(db, "slots"),
    fb.where("barberId", "==", barberId),
    fb.where("dateISO", "==", dateISO),
    fb.orderBy("time", "asc")
  );
  return fb.onSnapshot(q, (snap) => {
    const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    cb(list);
  });
}

export function barberName(barberId){
  return SB_CONFIG.barbers.find(b=>b.id===barberId)?.name || barberId;
}

export function waLink(text){
  return `https://wa.me/${SB_CONFIG.whatsappE164}?text=${encodeURIComponent(text)}`;
}

export function waTextFromBooking(b){
  const d = b.dateISO.split("-").reverse().join("/");
  return [
    "Olá! Gostaria de confirmar meu agendamento na SB Barbearia:",
    "",
    `Nome: ${b.name}`,
    `Telefone: ${b.phone}`,
    `Barbeiro: ${barberName(b.barberId)}`,
    `Serviço: ${b.service}`,
    `Data: ${d}`,
    `Hora: ${b.time}`
  ].join("\n");
}