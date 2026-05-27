import { SB_CONFIG } from "./config.js";
import { watchDaySlots, generateSlots, isAllowedDay, bookSlot, waLink, waTextFromBooking } from "./booking-core.js";

const $ = (s) => document.querySelector(s);

let unsub = null;
let takenSet = new Set();

function setYearAndLinks(){
  const y = $("#year");
  if (y) y.textContent = new Date().getFullYear();

  const mapsUrl = "https://www.google.com/maps?q=Avenida%20Daltro%20Filho%20750%20Santana%20do%20Livramento%20RS";
  const como = $("#comoChegar");
  if (como) como.href = mapsUrl;

  const waFloat = $("#waFloat");
  if (waFloat) waFloat.href = waLink("Olá! Quero agendar um horário na SB Barbearia.");
}

function setupNav(){
  const btn = $("#navbtn");
  const nav = $("#nav");
  if(!btn || !nav) return;
  btn.addEventListener("click", ()=>{
    const open = nav.classList.toggle("is-open");
    btn.setAttribute("aria-expanded", String(open));
  });
  nav.querySelectorAll("a").forEach(a => a.addEventListener("click", ()=>{
    nav.classList.remove("is-open");
    btn.setAttribute("aria-expanded", "false");
  }));
}

function setStatus(msg){
  const st = $("#status");
  if(st) st.textContent = msg || "";
}

function renderSlots(slots){
  const availabilityBox = $("#availability");
  const hourSelect = $("#hora");
  availabilityBox.innerHTML = "";
  hourSelect.innerHTML = `<option value="" selected disabled>--:--</option>`;

  slots.forEach((t)=>{
    const isTaken = takenSet.has(t);

    // select option
    const opt = document.createElement("option");
    opt.value = t;
    opt.textContent = isTaken ? `${t} (ocupado)` : t;
    opt.disabled = isTaken;
    hourSelect.appendChild(opt);

    // pills
    const pill = document.createElement("span");
    pill.className = "slot" + (isTaken ? " slot--taken" : "");
    pill.textContent = t;
    if (!isTaken){
      pill.addEventListener("click", ()=>{
        hourSelect.value = t;
        [...availabilityBox.querySelectorAll(".slot")].forEach(x=>x.classList.remove("slot--active"));
        pill.classList.add("slot--active");
      });
    }
    availabilityBox.appendChild(pill);
  });
}

function refreshWatch(){
  const barberId = $("#barbeiro")?.value;
  const dateISO = $("#data")?.value;

  if (unsub){ unsub(); unsub = null; }
  takenSet = new Set();
  setStatus("");

  if (!barberId || !dateISO) return;

  if (!isAllowedDay(dateISO)){
    setStatus("Somente segunda a sábado.");
    renderSlots([]);
    return;
  }

  const slots = generateSlots(dateISO);
  renderSlots(slots);

  unsub = watchDaySlots({ barberId, dateISO }, (bookings)=>{
    takenSet = new Set(bookings.map(b => b.time));
    renderSlots(slots);
  });
}

async function onSubmit(e){
  e.preventDefault();
  setStatus("");

  const name = $("#nome").value.trim();
  const phone = $("#telefone").value.trim();
  const barberId = $("#barbeiro").value;
  const service = $("#servico").value;
  const dateISO = $("#data").value;
  const time = $("#hora").value;

  if (!name || !phone || !barberId || !service || !dateISO || !time){
    setStatus("Preencha todos os campos.");
    return;
  }

  try{
    setStatus("Reservando horário...");
    const booking = await bookSlot({ name, phone, service, barberId, dateISO, time });

    setStatus("Horário reservado. Abrindo WhatsApp para confirmação...");
    const text = waTextFromBooking(booking);
    window.open(waLink(text), "_blank", "noopener,noreferrer");

    // limpa hora (mantém data/barbeiro)
    $("#hora").value = "";
  }catch(err){
    setStatus(err?.message || "Não foi possível reservar esse horário.");
  }
}

function init(){
  setYearAndLinks();
  setupNav();

  $("#barbeiro")?.addEventListener("change", refreshWatch);
  $("#data")?.addEventListener("change", refreshWatch);
  $("#bookingForm")?.addEventListener("submit", onSubmit);

  // data mínima hoje
  const data = $("#data");
  if (data){
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth()+1).padStart(2,"0");
    const dd = String(today.getDate()).padStart(2,"0");
    data.min = `${yyyy}-${mm}-${dd}`;
  }
}

init();