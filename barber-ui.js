import { auth, fb } from "./firebase.js";
import { watchDaySlots, cancelSlotById, bookSlot } from "./booking-core.js";

const $ = (s) => document.querySelector(s);

let unsub = null;
let currentBookings = [];

/* ===== helpers ===== */
function setLoginStatus(msg){ const el = $("#loginStatus"); if (el) el.textContent = msg || ""; }
function setAgendaStatus(msg){ const el = $("#agendaStatus"); if (el) el.textContent = msg || ""; }

function fmtBR(dateISO){ return dateISO.split("-").reverse().join("/"); }

function monthLabel(dateISO){
  const d = new Date(dateISO + "T00:00:00");
  return d.toLocaleDateString("pt-BR", { month:"long", year:"numeric" });
}

function addDays(dateISO, delta){
  const d = new Date(dateISO + "T00:00:00");
  d.setDate(d.getDate() + delta);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth()+1).padStart(2,"0");
  const dd = String(d.getDate()).padStart(2,"0");
  return `${yyyy}-${mm}-${dd}`;
}

function escapeHtml(str){
  return String(str ?? "")
    .replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;")
    .replaceAll('"',"&quot;").replaceAll("'","&#039;");
}

function parseTimeToMinutes(t){ const [h,m]=t.split(":").map(Number); return h*60+m; }
function minutesToTime(mins){
  const h = String(Math.floor(mins/60)).padStart(2,"0");
  const m = String(mins%60).padStart(2,"0");
  return `${h}:${m}`;
}
function makeSlots(open, close, step=30){
  const out=[];
  for (let m=parseTimeToMinutes(open); m + step <= parseTimeToMinutes(close); m+=step){
    out.push(minutesToTime(m));
  }
  return out;
}

function intervalSlots(){
  return ["12:00", "12:30", "13:00", "13:30"];
}

/**
 * Horários que aparecem como CARDS (com botão marcar) — inclui intervalo e noite.
 * Para existir 20:00 como início, close precisa ser 20:30.
 */
function visibleSlotsForDay(weekday){
  if (weekday === 0) return { slots: [], closed: true };

  const am = makeSlots("09:00","12:00");           // 09:00..11:30
  const interval = intervalSlots();                // 12:00,12:30,13:00,13:30
  const pm = makeSlots("14:00","20:30");           // 14:00..20:00

  return { slots: [...am, ...interval, ...pm], closed: false };
}

/**
 * Horários do modal "+ Marcar" (manual): aqui deixamos igual aos cards
 * (inclui intervalo e 20:00).
 */
function adminSlotsForDay(weekday){
  if (weekday === 0) return [];
  return visibleSlotsForDay(weekday).slots;
}

/* ===== Modal ===== */
function openModal({ preselectTime = null } = {}){
  const modal = $("#bookModal");
  if (!modal) return;

  const dateISO = $("#day").value;
  const weekday = new Date(dateISO + "T00:00:00").getDay();
  const taken = new Set(currentBookings.map(b => b.time));

  const candidates = adminSlotsForDay(weekday);
  const free = candidates.filter(t => !taken.has(t));

  const sel = $("#m_time");
  sel.innerHTML = "";
  sel.disabled = free.length === 0;

  if (free.length === 0){
    const opt = document.createElement("option");
    opt.value = "";
    opt.textContent = "Nenhum horário livre";
    sel.appendChild(opt);
  } else {
    free.forEach(t=>{
      const opt = document.createElement("option");
      opt.value = t;
      opt.textContent = t;
      sel.appendChild(opt);
    });
    if (preselectTime && free.includes(preselectTime)) sel.value = preselectTime;
  }

  $("#modalStatus").textContent = "";
  $("#m_name").value = "";
  $("#m_phone").value = "";
  $("#m_service").value = "";

  modal.classList.add("is-open");
  modal.setAttribute("aria-hidden","false");
  $("#m_name").focus();
}

function closeModal(){
  const modal = $("#bookModal");
  if (!modal) return;
  modal.classList.remove("is-open");
  modal.setAttribute("aria-hidden","true");
}

function setupModal(){
  const form = $("#adminBookForm");
  if (!form) return;

  document.addEventListener("click", (e)=>{
    const t = e.target;
    if (t && t.getAttribute && t.getAttribute("data-close")==="1") closeModal();
  });
  document.addEventListener("keydown", (e)=>{ if (e.key === "Escape") closeModal(); });

  form.addEventListener("submit", async (e)=>{
    e.preventDefault();
    $("#modalStatus").textContent = "";

    const barberId = $("#barberPick").value;
    const dateISO = $("#day").value;

    const time = $("#m_time").value;
    const name = $("#m_name").value.trim();
    const phone = $("#m_phone").value.trim();
    const service = $("#m_service").value.trim();

    if (!time || !name || !phone || !service){
      $("#modalStatus").textContent = "Preencha todos os campos.";
      return;
    }

    try{
      $("#modalStatus").textContent = "Marcando...";
      await bookSlot({ name, phone, service, barberId, dateISO, time });
      $("#modalStatus").textContent = "Marcado!";
      setTimeout(closeModal, 250);
    }catch(err){
      $("#modalStatus").textContent = err?.message || "Erro ao marcar.";
    }
  });
}

/* ===== Render ===== */
function renderCardSlot({ list, time, booking }){
  const isBooked = !!booking;

  const cls = isBooked ? "card card--booked" : "card card--free";
  const status = isBooked ? "Marcado" : "Livre";
  const meta = isBooked
    ? `<strong>${escapeHtml(booking.name)}</strong><br>${escapeHtml(booking.service)}<br>${escapeHtml(booking.phone)}`
    : `Horário disponível`;

  const actions = isBooked
    ? `<button class="btn btn--danger" type="button" data-cancel="${booking.id}">Desmarcar</button>`
    : `<button class="btn btn--gold" type="button" data-book="${time}">Marcar</button>`;

  const el = document.createElement("div");
  el.className = cls;
  el.innerHTML = `
    <div class="card__bar"></div>
    <div class="card__body">
      <div class="card__top">
        <div class="card__time">${time}</div>
        <div class="card__status">${status}</div>
      </div>
      <div class="card__meta">${meta}</div>
      <div class="card__actions">${actions}</div>
    </div>
  `;
  list.appendChild(el);
}

function renderDay(dateISO, bookings){
  currentBookings = bookings;

  $("#monthLabel").textContent = monthLabel(dateISO);

  const barberLabel = $("#barberPick").selectedOptions[0]?.textContent || "Barbeiro";
  setAgendaStatus(`${fmtBR(dateISO)} — ${barberLabel}`);

  const list = $("#dayList");
  list.innerHTML = "";

  const weekday = new Date(dateISO + "T00:00:00").getDay();
  const { slots, closed } = visibleSlotsForDay(weekday);

  if (closed){
    const el = document.createElement("div");
    el.className = "card card--off";
    el.innerHTML = `
      <div class="card__bar"></div>
      <div class="card__body">
        <div class="card__top">
          <div class="card__time">Fechado</div>
          <div class="card__status">Domingo</div>
        </div>
        <div class="card__meta">Não há atendimento hoje.</div>
      </div>
    `;
    list.appendChild(el);
    return;
  }

  const map = new Map(bookings.map(b => [b.time, b]));

  slots.forEach((t) => {
    renderCardSlot({ list, time: t, booking: map.get(t) });
  });

  // binds cancelar
  list.querySelectorAll("[data-cancel]").forEach(btn=>{
    btn.addEventListener("click", async ()=>{
      const id = btn.getAttribute("data-cancel");
      if (!confirm("Desmarcar este horário?")) return;
      await cancelSlotById(id);
    });
  });

  // binds marcar (abre modal pré-selecionando horário)
  list.querySelectorAll("[data-book]").forEach(btn=>{
    btn.addEventListener("click", ()=>{
      openModal({ preselectTime: btn.getAttribute("data-book") });
    });
  });
}

/* ===== Watch ===== */
function refreshWatch(){
  const barberId = $("#barberPick").value;
  const dateISO = $("#day").value;
  if (!barberId || !dateISO) return;

  if (unsub){ unsub(); unsub = null; }
  unsub = watchDaySlots({ barberId, dateISO }, (list)=> renderDay(dateISO, list));
}

/* ===== Auth ===== */
async function onLogin(e){
  e.preventDefault();
  setLoginStatus("");

  try{
    await fb.signInWithEmailAndPassword(auth, $("#email").value.trim(), $("#password").value);
  }catch{
    setLoginStatus("Falha no login. Verifique email e senha.");
  }
}
async function logout(){ await fb.signOut(auth); }

function setDefaultDay(){
  const day = $("#day");
  const d = new Date();
  day.value = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}

/* ===== Init ===== */
function init(){
  setupModal();
  setDefaultDay();

  $("#loginForm")?.addEventListener("submit", onLogin);
  $("#logoutBtn")?.addEventListener("click", logout);

  $("#prevDay")?.addEventListener("click", ()=>{
    $("#day").value = addDays($("#day").value, -1);
    refreshWatch();
  });
  $("#nextDay")?.addEventListener("click", ()=>{
    $("#day").value = addDays($("#day").value, 1);
    refreshWatch();
  });

  $("#day")?.addEventListener("change", refreshWatch);
  $("#barberPick")?.addEventListener("change", refreshWatch);

  // + Marcar (manual) — também permite intervalo e 20:00
  $("#addBtn")?.addEventListener("click", ()=> openModal({ preselectTime: null }));

  fb.onAuthStateChanged(auth, (user)=>{
    const logged = !!user;

    const logoutBtn = $("#logoutBtn");
    const loginForm = $("#loginForm");
    const agendaUI = $("#agendaUI");
    const whoami = $("#whoami");

    if (logoutBtn) logoutBtn.style.display = logged ? "inline-flex" : "none";
    if (loginForm) loginForm.style.display = logged ? "none" : "block";
    if (agendaUI) agendaUI.style.display = logged ? "block" : "none";
    if (whoami) whoami.textContent = logged ? `Logado: ${user.email}` : "Faça login";

    if (!logged){
      if (unsub){ unsub(); unsub = null; }
      const list = $("#dayList");
      if (list) list.innerHTML = "";
      setAgendaStatus("");
      return;
    }

    refreshWatch();
  });
}

init();