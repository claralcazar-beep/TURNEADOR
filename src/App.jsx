import { useState, useMemo, useEffect, useRef } from "react";
import { supabase } from "./supabase.js";

/* ================= FESTIVOS COLOMBIA ================= */
function easterDate(y) {
  const a = y % 19, b = Math.floor(y / 100), c = y % 100;
  const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(y, month - 1, day);
}
const addDays = (dt, n) => { const d = new Date(dt); d.setDate(d.getDate() + n); return d; };
const nextMonday = (dt) => addDays(dt, (8 - dt.getDay()) % 7);
const keyOf = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const mkKey = (y, m, day) => `${y}-${String(m + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

function festivosColombia(y) {
  const map = {};
  const put = (d, n) => { map[keyOf(d)] = n; };
  put(new Date(y, 0, 1), "Año Nuevo");
  put(new Date(y, 4, 1), "Día del Trabajo");
  put(new Date(y, 6, 20), "Independencia");
  put(new Date(y, 7, 7), "Batalla de Boyacá");
  put(new Date(y, 11, 8), "Inmaculada Concepción");
  put(new Date(y, 11, 25), "Navidad");
  put(nextMonday(new Date(y, 0, 6)), "Reyes Magos");
  put(nextMonday(new Date(y, 2, 19)), "San José");
  put(nextMonday(new Date(y, 5, 29)), "San Pedro y San Pablo");
  put(nextMonday(new Date(y, 7, 15)), "Asunción de la Virgen");
  put(nextMonday(new Date(y, 9, 12)), "Día de la Raza");
  put(nextMonday(new Date(y, 10, 1)), "Todos los Santos");
  put(nextMonday(new Date(y, 10, 11)), "Indep. de Cartagena");
  const pascua = easterDate(y);
  put(addDays(pascua, -3), "Jueves Santo");
  put(addDays(pascua, -2), "Viernes Santo");
  put(nextMonday(addDays(pascua, 39)), "Ascensión del Señor");
  put(nextMonday(addDays(pascua, 60)), "Corpus Christi");
  put(nextMonday(addDays(pascua, 68)), "Sagrado Corazón");
  return map;
}

/* ================= CONSTANTES ================= */
const MESES = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
const DIAS = ["Lun","Mar","Mié","Jue","Vie","Sáb","Dom"];
const PALETA = ["#B3261E","#0E7C6B","#C2418F","#5B4FC7","#B26A00","#2563A8","#6B7D1F","#7C2D8C"];
const SEMANA = [
  { d: 1, l: "Lu" }, { d: 2, l: "Ma" }, { d: 3, l: "Mi" }, { d: 4, l: "Ju" },
  { d: 5, l: "Vi" }, { d: 6, l: "Sá" }, { d: 0, l: "Do" },
];

const apellido = (n) => (n || "").trim().split(" ").pop();
const finDeSemanaKey = (dateObj) =>
  dateObj.getDay() === 0 ? keyOf(addDays(dateObj, -1)) : keyOf(dateObj);
const mapEsp = (r) => ({
  id: r.id,
  nombre: r.nombre || "",
  nombreExcel: r.nombre_excel || "",
  color: r.color || "#B3261E",
  excelFill: r.excel_fill || "",
  turnos: r.turnos ?? 5,
  finde: r.finde ?? 1,
  diasVedados: Array.isArray(r.dias_vedados) ? r.dias_vedados : [],
});
const espARow = (e, i) => ({
  id: e.id,
  nombre: e.nombre,
  nombre_excel: e.nombreExcel || "",
  color: e.color,
  excel_fill: e.excelFill || "",
  turnos: e.turnos,
  finde: e.finde,
  dias_vedados: e.diasVedados || [],
  orden: i + 1,
});

const slugify = (t) => (t || "")
  .toLowerCase()
  .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
  .replace(/[^a-z0-9]+/g, "-")
  .replace(/^-+|-+$/g, "")
  .slice(0, 40) || "grupo";

/* ================= APP ================= */
export default function App() {
  const hoy = new Date();
  const [anio, setAnio] = useState(hoy.getFullYear());
  const [mes, setMes] = useState(hoy.getMonth());
  const [grupos, setGrupos] = useState([]);
  const [grupo, setGrupo] = useState(null); // grupo (especialidad) activo
  const [especialistas, setEspecialistas] = useState([]);
  const [asig, setAsig] = useState({});     // "YYYY-MM-DD" -> id
  const [noDisp, setNoDisp] = useState({}); // "YYYY-MM-DD" -> { id: true }
  const [modo, setModo] = useState("asignar");
  const [selId, setSelId] = useState(null);
  const [cargado, setCargado] = useState(false);
  const [conectado, setConectado] = useState(null); // null=probando
  const [sync, setSync] = useState("ok"); // ok | guardando | error
  const [verCompartir, setVerCompartir] = useState(false);
  const [msgCopiado, setMsgCopiado] = useState("");
  const [salvInput, setSalvInput] = useState({});
  const [rango, setRango] = useState({ d: "", h: "" });
  const listoParaGuardar = useRef(false);

  const festivos = useMemo(() => festivosColombia(anio), [anio]);
  const nDias = new Date(anio, mes + 1, 0).getDate();
  const primerDia = (new Date(anio, mes, 1).getDay() + 6) % 7; // 0 = lunes
  const prefMes = `${anio}-${String(mes + 1).padStart(2, "0")}`;
  const espSel = especialistas.find((e) => e.id === selId);

  /* ---------- carga inicial desde Supabase ---------- */
  const cargarTodo = async () => {
    try {
      const g = await supabase.from("ct_grupos").select("*").order("id");
      if (g.error) throw g.error;
      const lista = g.data || [];
      setGrupos(lista);
      const slugUrl = new URLSearchParams(window.location.search).get("g");
      const activo = lista.find((x) => x.slug === slugUrl) || lista[0] || null;
      setGrupo(activo);
      if (!activo) { setConectado(true); setCargado(true); return; }
      const [e, t, s] = await Promise.all([
        supabase.from("ct_especialistas").select("*").eq("grupo_id", activo.id).order("orden"),
        supabase.from("ct_turnos").select("*").eq("grupo_id", activo.id),
        supabase.from("ct_salvedades").select("*").eq("grupo_id", activo.id),
      ]);
      if (e.error || t.error || s.error) throw (e.error || t.error || s.error);
      const esps = (e.data || []).map(mapEsp);
      setEspecialistas(esps);
      if (esps.length) setSelId(esps[esps.length - 1].id);
      const a = {};
      (t.data || []).forEach((r) => { a[r.fecha] = r.especialista_id; });
      setAsig(a);
      const nd = {};
      (s.data || []).forEach((r) => {
        nd[r.fecha] = { ...(nd[r.fecha] || {}), [r.especialista_id]: true };
      });
      setNoDisp(nd);
      setConectado(true);
      setTimeout(() => { listoParaGuardar.current = true; }, 400);
    } catch (err) {
      console.error("Error cargando de Supabase:", err);
      setConectado(false);
    }
    setCargado(true);
  };
  useEffect(() => { cargarTodo(); }, []);

  /* ---------- grupos (especialidades) ---------- */
  const cambiarGrupo = (slug) => {
    window.location.search = `?g=${slug}`;
  };
  const crearGrupo = async () => {
    const nombre = window.prompt("Nombre de la nueva especialidad (ej: Ortopedia, Anestesiología):");
    if (!nombre || !nombre.trim()) return;
    const slug = slugify(nombre);
    setSync("guardando");
    const { data, error } = await supabase.from("ct_grupos")
      .insert({ nombre: nombre.trim(), slug }).select().single();
    marcar(error);
    if (data) cambiarGrupo(data.slug);
    else if (error) window.alert("No se pudo crear: puede que ya exista una especialidad con ese nombre.");
  };

  const marcar = (error) => {
    if (error) { console.error(error); setSync("error"); }
    else setSync("ok");
  };

  /* ---------- guardar especialistas (con debounce) ---------- */
  useEffect(() => {
    if (!listoParaGuardar.current || conectado === false || !especialistas.length || !grupo) return;
    setSync("guardando");
    const t = setTimeout(async () => {
      const { error } = await supabase.from("ct_especialistas")
        .upsert(especialistas.map((e, i) => ({ ...espARow(e, i), grupo_id: grupo.id })));
      marcar(error);
    }, 800);
    return () => clearTimeout(t);
  }, [especialistas]);

  /* ---------- salvedades y vedados ---------- */
  const vedado = (e, dateObj) => (e.diasVedados || []).includes(dateObj.getDay());
  const indisponible = (e, k, dateObj) => !!(noDisp[k] || {})[e.id] || vedado(e, dateObj);
  const toggleVedado = (id, d) => {
    setEspecialistas((p) => p.map((e) => {
      if (e.id !== id) return e;
      const v = e.diasVedados || [];
      return { ...e, diasVedados: v.includes(d) ? v.filter((x) => x !== d) : [...v, d] };
    }));
  };
  const toggleNoDisp = async (id, day) => {
    const k = mkKey(anio, mes, day);
    const activo = !!(noDisp[k] || {})[id];
    setNoDisp((p) => {
      const dia = { ...(p[k] || {}) };
      if (activo) delete dia[id]; else dia[id] = true;
      const n = { ...p };
      if (Object.keys(dia).length) n[k] = dia; else delete n[k];
      return n;
    });
    setSync("guardando");
    const { error } = activo
      ? await supabase.from("ct_salvedades").delete().eq("grupo_id", grupo.id).eq("fecha", k).eq("especialista_id", id)
      : await supabase.from("ct_salvedades").upsert({ grupo_id: grupo.id, fecha: k, especialista_id: id }, { onConflict: "grupo_id,fecha,especialista_id" });
    marcar(error);
  };
  const bloqueadosMes = (id) => {
    const arr = [];
    for (let d = 1; d <= nDias; d++) if ((noDisp[mkKey(anio, mes, d)] || {})[id]) arr.push(d);
    return arr;
  };
  const agregarSalvedad = async (id) => {
    const txt = (salvInput[id] || "").trim();
    const m = txt.match(/^(\d{1,2})\s*(?:-|al|a)\s*(\d{1,2})$/i);
    if (m) {
      await bloquearRango(id, parseInt(m[1], 10), parseInt(m[2], 10));
    } else {
      const d = parseInt(txt, 10);
      if (!d || d < 1 || d > nDias) return;
      toggleNoDisp(id, d);
    }
    setSalvInput((p) => ({ ...p, [id]: "" }));
  };

  /* ---------- aplicar a un rango de días ---------- */
  const diasDeRango = (d1, d2) => {
    let a = Math.max(1, Math.min(d1, d2)), b = Math.min(nDias, Math.max(d1, d2));
    const keys = [];
    for (let d = a; d <= b; d++) keys.push(mkKey(anio, mes, d));
    return keys;
  };
  const bloquearRango = async (id, d1, d2) => {
    const keys = diasDeRango(d1, d2);
    if (!keys.length) return;
    setNoDisp((p) => {
      const n = { ...p };
      keys.forEach((k) => { n[k] = { ...(n[k] || {}), [id]: true }; });
      return n;
    });
    setSync("guardando");
    const rows = keys.map((fecha) => ({ grupo_id: grupo.id, fecha, especialista_id: id }));
    const { error } = await supabase.from("ct_salvedades").upsert(rows, { onConflict: "grupo_id,fecha,especialista_id" });
    marcar(error);
  };
  const aplicarRango = async () => {
    const d1 = parseInt(rango.d, 10), d2 = parseInt(rango.h, 10);
    if (!d1 || !d2) return;
    const keys = diasDeRango(d1, d2);
    if (!keys.length) return;
    if (modo === "borrar") {
      setAsig((p) => { const n = { ...p }; keys.forEach((k) => delete n[k]); return n; });
      setSync("guardando");
      const { error } = await supabase.from("ct_turnos").delete().eq("grupo_id", grupo.id)
        .gte("fecha", keys[0]).lte("fecha", keys[keys.length - 1]);
      marcar(error);
    } else if (!espSel) {
      return;
    } else if (modo === "asignar") {
      setAsig((p) => { const n = { ...p }; keys.forEach((k) => { n[k] = selId; }); return n; });
      setSync("guardando");
      const rows = keys.map((fecha) => ({ grupo_id: grupo.id, fecha, especialista_id: selId }));
      const { error } = await supabase.from("ct_turnos").upsert(rows, { onConflict: "grupo_id,fecha" });
      marcar(error);
    } else {
      await bloquearRango(selId, d1, d2);
    }
    setRango({ d: "", h: "" });
  };

  /* ---------- acciones sobre días ---------- */
  const clickDia = async (day) => {
    const k = mkKey(anio, mes, day);
    if (modo === "borrar") {
      if (!asig[k]) return;
      setAsig((p) => { const n = { ...p }; delete n[k]; return n; });
      setSync("guardando");
      const { error } = await supabase.from("ct_turnos").delete().eq("grupo_id", grupo.id).eq("fecha", k);
      marcar(error);
      return;
    }
    if (!espSel) return;
    if (modo === "asignar") {
      const quitar = asig[k] === selId;
      setAsig((p) => {
        if (quitar) { const n = { ...p }; delete n[k]; return n; }
        return { ...p, [k]: selId };
      });
      setSync("guardando");
      const { error } = quitar
        ? await supabase.from("ct_turnos").delete().eq("grupo_id", grupo.id).eq("fecha", k)
        : await supabase.from("ct_turnos").upsert({ grupo_id: grupo.id, fecha: k, especialista_id: selId }, { onConflict: "grupo_id,fecha" });
      marcar(error);
    } else if (modo === "bloquear") {
      toggleNoDisp(selId, day);
    }
  };

  /* ---------- generación automática en bloques ---------- */
  const generar = async () => {
    const rem = Object.fromEntries(especialistas.map((e) => [e.id, Math.max(0, e.turnos)]));
    const nuevoMes = {};
    let idx = 0;
    for (let d = 1; d <= nDias; d++) {
      const k = mkKey(anio, mes, d);
      const dt = new Date(anio, mes, d);
      while (idx < especialistas.length && rem[especialistas[idx].id] <= 0) idx++;
      let hecho = false;
      if (idx < especialistas.length) {
        const cur = especialistas[idx];
        if (rem[cur.id] > 0 && !indisponible(cur, k, dt)) {
          nuevoMes[k] = cur.id; rem[cur.id]--; hecho = true;
        }
      }
      if (!hecho) {
        for (let j = 0; j < especialistas.length; j++) {
          if (j === idx) continue;
          const e = especialistas[j];
          if (rem[e.id] > 0 && !indisponible(e, k, dt)) { nuevoMes[k] = e.id; rem[e.id]--; hecho = true; break; }
        }
      }
    }
    setAsig((p) => {
      const n = {};
      Object.entries(p).forEach(([k, v]) => { if (!k.startsWith(prefMes)) n[k] = v; });
      return { ...n, ...nuevoMes };
    });
    setSync("guardando");
    const del = await supabase.from("ct_turnos").delete().eq("grupo_id", grupo.id)
      .gte("fecha", `${prefMes}-01`).lte("fecha", `${prefMes}-${String(nDias).padStart(2, "0")}`);
    if (del.error) { marcar(del.error); return; }
    const rows = Object.entries(nuevoMes).map(([fecha, id]) => ({ grupo_id: grupo.id, fecha, especialista_id: id }));
    if (rows.length) {
      const ins = await supabase.from("ct_turnos").insert(rows);
      marcar(ins.error);
    } else marcar(null);
  };

  const limpiarMes = async () => {
    if (!window.confirm(`¿Borrar todos los turnos de ${MESES[mes]} ${anio}?`)) return;
    setAsig((p) => { const n = {}; Object.entries(p).forEach(([k, v]) => { if (!k.startsWith(prefMes)) n[k] = v; }); return n; });
    setSync("guardando");
    const { error } = await supabase.from("ct_turnos").delete().eq("grupo_id", grupo.id)
      .gte("fecha", `${prefMes}-01`).lte("fecha", `${prefMes}-${String(nDias).padStart(2, "0")}`);
    marcar(error);
  };

  /* ---------- gestión de especialistas ---------- */
  const editarEsp = (id, campo, valor) =>
    setEspecialistas((p) => p.map((e) => (e.id === id ? { ...e, [campo]: valor } : e)));
  const mover = (i, dir) => {
    setEspecialistas((p) => {
      const n = [...p]; const j = i + dir;
      if (j < 0 || j >= n.length) return p;
      [n[i], n[j]] = [n[j], n[i]]; return n;
    });
  };
  const eliminar = async (id) => {
    const e = especialistas.find((x) => x.id === id);
    if (!window.confirm(`¿Eliminar a ${e ? e.nombre : "este especialista"}? Se borran también sus turnos y salvedades.`)) return;
    setEspecialistas((p) => p.filter((x) => x.id !== id));
    setAsig((p) => { const n = {}; Object.entries(p).forEach(([k, v]) => { if (v !== id) n[k] = v; }); return n; });
    if (selId === id) setSelId(null);
    setSync("guardando");
    const { error } = await supabase.from("ct_especialistas").delete().eq("id", id);
    marcar(error);
  };
  const agregar = async () => {
    setSync("guardando");
    const { data, error } = await supabase.from("ct_especialistas").insert({
      grupo_id: grupo.id,
      nombre: "Dr(a). Nuevo",
      color: PALETA[especialistas.length % PALETA.length],
      turnos: 5, finde: 1, dias_vedados: [], orden: especialistas.length + 1,
    }).select().single();
    marcar(error);
    if (data) { setEspecialistas((p) => [...p, mapEsp(data)]); setSelId(data.id); }
  };

  /* ---------- resumen ---------- */
  const resumen = useMemo(() => {
    return especialistas.map((e) => {
      let asignados = 0, conflictos = 0;
      const findes = new Set();
      for (let d = 1; d <= nDias; d++) {
        const k = mkKey(anio, mes, d);
        if (asig[k] === e.id) {
          asignados++;
          const dt = new Date(anio, mes, d);
          if ((noDisp[k] || {})[e.id] || (e.diasVedados || []).includes(dt.getDay())) conflictos++;
          if (dt.getDay() === 0 || dt.getDay() === 6) findes.add(finDeSemanaKey(dt));
        }
      }
      return { ...e, asignados, findes: findes.size, conflictos };
    });
  }, [especialistas, asig, noDisp, anio, mes, nDias]);

  const sinAsignar = useMemo(() => {
    let c = 0;
    for (let d = 1; d <= nDias; d++) if (!asig[mkKey(anio, mes, d)]) c++;
    return c;
  }, [asig, anio, mes, nDias]);

  /* ---------- exportar al formato Excel Asotrauma ---------- */
  const tint = (hex) => {
    const n = parseInt(hex.slice(1), 16);
    const mix = (v) => Math.round(v + (255 - v) * 0.7);
    return "#" + [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => mix(v).toString(16).padStart(2, "0")).join("");
  };
  const descargarExcel = () => {
    const INI = ["D", "L", "M", "M", "J", "V", "S"];
    const bd = "border:.5pt solid #000000;";
    const gris = `background:#C0C0C0;font-weight:bold;text-align:center;${bd}`;
    let inis = "", nums = "";
    for (let d = 1; d <= nDias; d++) {
      const wd = new Date(anio, mes, d).getDay();
      inis += `<td width="26" style="${gris}">${INI[wd]}</td>`;
      nums += `<td style="${gris}">${d}</td>`;
    }
    const filas = especialistas.map((e) => {
      let tds = "";
      for (let d = 1; d <= nDias; d++) {
        const k = mkKey(anio, mes, d);
        tds += `<td style="text-align:center;font-weight:bold;${bd}">${asig[k] === e.id ? "X" : ""}</td>`;
      }
      const fill = e.excelFill || tint(e.color);
      const nom = (e.nombreExcel || e.nombre).toUpperCase();
      return `<tr><td style="background:${fill};font-weight:bold;${bd}">${nom}</td>${tds}</tr>`;
    }).join("\n");
    const titulo = `${MESES[mes].toUpperCase()}. ${anio}`;
    const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel"><head><meta charset="UTF-8"><!--[if gte mso 9]><xml><x:ExcelWorkbook><x:ExcelWorksheets><x:ExcelWorksheet><x:Name>Hoja1</x:Name><x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions></x:ExcelWorksheet></x:ExcelWorksheets></x:ExcelWorkbook></xml><![endif]--></head><body><table cellspacing="0">
<tr><td></td></tr><tr><td></td></tr>
<tr><td colspan="${nDias + 1}" style="font-family:'Comic Sans MS';font-size:20pt;font-weight:bold;text-align:center;${bd}">${titulo}</td></tr>
<tr><td rowspan="2" width="240" style="${gris}text-align:left;">APELLIDO Y NOMBRE FUNCIONARIO </td>${inis}</tr>
<tr>${nums}</tr>
${filas}
</table></body></html>`;
    const blob = new Blob(["\ufeff" + html], { type: "application/vnd.ms-excel" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `CUADRO_TURNOS_${(grupo ? grupo.slug.toUpperCase() : "GRUPO")}_${MESES[mes].toUpperCase()}_${anio}.xls`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(a.href);
  };

  /* ---------- compartir: WhatsApp texto ---------- */
  const rangos = (ds) => {
    const out = []; let i = 0;
    while (i < ds.length) {
      let j = i;
      while (j + 1 < ds.length && ds[j + 1] === ds[j] + 1) j++;
      out.push(j > i ? (j - i === 1 ? `${ds[i]}, ${ds[j]}` : `${ds[i]} al ${ds[j]}`) : `${ds[i]}`);
      i = j + 1;
    }
    return out.join(", ");
  };
  const textoWhatsApp = useMemo(() => {
    const L = [`*🏥 TURNOS ${(grupo ? grupo.nombre : "").toUpperCase()}*`, `*${MESES[mes].toUpperCase()} ${anio}*`, ""];
    especialistas.forEach((e) => {
      const dias = [];
      for (let d = 1; d <= nDias; d++) if (asig[mkKey(anio, mes, d)] === e.id) dias.push(d);
      if (dias.length) L.push(`👤 *${apellido(e.nombre)}* (${dias.length}): ${rangos(dias)}`);
    });
    const fest = [];
    for (let d = 1; d <= nDias; d++) {
      const k = mkKey(anio, mes, d);
      if (festivos[k]) {
        const quien = especialistas.find((e) => e.id === asig[k]);
        fest.push(`  • ${d} ${festivos[k]}${quien ? ` → ${apellido(quien.nombre)}` : ""}`);
      }
    }
    if (fest.length) { L.push("", "⭐ *Festivos:*", ...fest); }
    const libres = [];
    for (let d = 1; d <= nDias; d++) if (!asig[mkKey(anio, mes, d)]) libres.push(d);
    if (libres.length) L.push("", `⚠️ Sin asignar: ${rangos(libres)}`);
    return L.join("\n");
  }, [especialistas, asig, festivos, anio, mes, nDias]);

  const copiar = async (txt, aviso) => {
    let ok = false;
    try { await navigator.clipboard.writeText(txt); ok = true; }
    catch (e) {
      try {
        const ta = document.createElement("textarea");
        ta.value = txt; ta.style.position = "fixed"; ta.style.opacity = "0";
        document.body.appendChild(ta); ta.focus(); ta.select();
        ok = document.execCommand("copy");
        document.body.removeChild(ta);
      } catch (e2) { ok = false; }
    }
    setMsgCopiado(ok ? aviso : "No se pudo copiar automáticamente: selecciona el texto y cópialo manual");
    setTimeout(() => setMsgCopiado(""), 3500);
  };
  const abrirWhatsApp = () => {
    window.open(`https://wa.me/?text=${encodeURIComponent(textoWhatsApp)}`, "_blank");
  };

  /* ---------- imagen del cuadro (canvas) ---------- */
  const [imgUrl, setImgUrl] = useState("");
  const dibujarCanvas = () => {
    const trunc = (ctx, txt, maxW) => {
      if (ctx.measureText(txt).width <= maxW) return txt;
      let t = txt;
      while (t.length && ctx.measureText(t + "…").width > maxW) t = t.slice(0, -1);
      return t + "…";
    };
    const rr = (ctx, x, y, w, h, r) => {
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.arcTo(x + w, y, x + w, y + h, r);
      ctx.arcTo(x + w, y + h, x, y + h, r);
      ctx.arcTo(x, y + h, x, y, r);
      ctx.arcTo(x, y, x + w, y, r);
      ctx.closePath();
    };
    const sc = 2, W = 1080, mSide = 36;
    const rows = Math.ceil((primerDia + nDias) / 7);
    const mTop = 140, headH = 54, cellH = 148;
    const cellW = (W - mSide * 2) / 7;
    const libres = [];
    for (let d = 1; d <= nDias; d++) if (!asig[mkKey(anio, mes, d)]) libres.push(d);
    const legendH = 60 + resumen.length * 42 + 42 + (libres.length ? 42 : 0);
    const H = mTop + headH + rows * cellH + legendH + 30;

    const canvas = document.createElement("canvas");
    canvas.width = W * sc; canvas.height = H * sc;
    const ctx = canvas.getContext("2d");
    ctx.scale(sc, sc);
    ctx.fillStyle = "#FFFFFF"; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = "#6B7680"; ctx.font = "600 22px Arial";
    ctx.fillText(`TURNOS DE ${(grupo ? grupo.nombre : "").toUpperCase()}`, mSide, 52);
    ctx.fillStyle = "#26303A"; ctx.font = "800 46px Arial";
    ctx.fillText(`${MESES[mes].toUpperCase()} ${anio}`, mSide, 104);

    ctx.fillStyle = "#EDEFEA"; ctx.fillRect(mSide, mTop, W - mSide * 2, headH);
    ctx.font = "800 20px Arial"; ctx.textAlign = "center";
    DIAS.forEach((dn, i) => {
      ctx.fillStyle = i >= 5 ? "#8A3324" : "#3B4652";
      ctx.fillText(dn, mSide + i * cellW + cellW / 2, mTop + 35);
    });
    ctx.textAlign = "left";

    for (let d = 1; d <= nDias; d++) {
      const pos = primerDia + d - 1, row = Math.floor(pos / 7), col = pos % 7;
      const x = mSide + col * cellW, y = mTop + headH + row * cellH;
      const k = mkKey(anio, mes, d);
      const fest = festivos[k];
      const dt = new Date(anio, mes, d);
      const finde = dt.getDay() === 0 || dt.getDay() === 6;
      ctx.fillStyle = fest ? "#FCEBDD" : finde ? "#F2F4F0" : "#FFFFFF";
      ctx.fillRect(x, y, cellW, cellH);
      ctx.strokeStyle = "#D8DDD4"; ctx.lineWidth = 1; ctx.strokeRect(x, y, cellW, cellH);
      if (fest) { ctx.fillStyle = "#C05621"; ctx.fillRect(x, y, cellW, 6); }
      ctx.fillStyle = fest ? "#8A3324" : "#26303A"; ctx.font = "800 25px Arial";
      ctx.fillText(String(d), x + 10, y + 36);
      if (fest) {
        ctx.font = "700 13px Arial"; ctx.fillStyle = "#8A3324";
        ctx.fillText(trunc(ctx, "★ " + fest, cellW - 18), x + 10, y + 58);
      }
      const esp = especialistas.find((e) => e.id === asig[k]);
      if (esp) {
        rr(ctx, x + 8, y + cellH - 52, cellW - 16, 38, 9);
        ctx.fillStyle = esp.color; ctx.fill();
        ctx.fillStyle = "#FFFFFF"; ctx.font = "700 18px Arial"; ctx.textAlign = "center";
        ctx.fillText(trunc(ctx, apellido(esp.nombre), cellW - 26), x + cellW / 2, y + cellH - 26);
        ctx.textAlign = "left";
      }
    }

    let ly = mTop + headH + rows * cellH + 46;
    ctx.fillStyle = "#26303A"; ctx.font = "800 24px Arial";
    ctx.fillText("Resumen", mSide, ly); ly += 14;
    resumen.forEach((r) => {
      ly += 40;
      rr(ctx, mSide, ly - 22, 26, 26, 7); ctx.fillStyle = r.color; ctx.fill();
      ctx.fillStyle = "#26303A"; ctx.font = "600 20px Arial";
      ctx.fillText(`${r.nombre} · ${r.asignados} turnos · ${r.findes} fin(es) de semana`, mSide + 38, ly);
    });
    ly += 40;
    ctx.fillStyle = "#FCEBDD"; ctx.fillRect(mSide, ly - 22, 26, 26);
    ctx.strokeStyle = "#C05621"; ctx.strokeRect(mSide, ly - 22, 26, 26);
    ctx.fillStyle = "#8A3324"; ctx.font = "600 20px Arial";
    ctx.fillText("Festivo en Colombia", mSide + 38, ly);
    if (libres.length) {
      ly += 40;
      ctx.fillStyle = "#B3261E"; ctx.font = "700 20px Arial";
      ctx.fillText(`⚠ Sin asignar: ${rangos(libres)}`, mSide, ly);
    }
    ctx.fillStyle = "#9AA5AE"; ctx.font = "700 16px Arial"; ctx.textAlign = "right";
    ctx.fillText("TURNEADOR", W - mSide, H - 16);
    ctx.textAlign = "left";
    return canvas;
  };
  const generarImagen = () => {
    try { setImgUrl(dibujarCanvas().toDataURL("image/png")); } catch (e) { setImgUrl(""); }
  };
  useEffect(() => {
    if (verCompartir) generarImagen();
  }, [verCompartir, asig, especialistas, mes, anio]);

  const compartirImagen = () => {
    dibujarCanvas().toBlob(async (blob) => {
      if (!blob) return;
      const file = new File([blob], `turnos_${MESES[mes].toLowerCase()}_${anio}.png`, { type: "image/png" });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        try { await navigator.share({ files: [file], title: `Turnos ${MESES[mes]} ${anio}` }); return; } catch (e) { /* cancelado */ }
      }
      descargarImagen();
    }, "image/png");
  };
  const descargarImagen = () => {
    const a = document.createElement("a");
    a.href = dibujarCanvas().toDataURL("image/png");
    a.download = `turnos_${MESES[mes].toLowerCase()}_${anio}.png`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
  };

  const cambiarMes = (dir) => {
    let m = mes + dir, y = anio;
    if (m < 0) { m = 11; y--; } if (m > 11) { m = 0; y++; }
    setMes(m); setAnio(y);
  };

  /* ---------- celdas ---------- */
  const celdas = [];
  for (let i = 0; i < primerDia; i++) celdas.push(null);
  for (let d = 1; d <= nDias; d++) celdas.push(d);

  if (!cargado) {
    return (
      <div style={{ ...S.page, textAlign: "center", paddingTop: 80 }}>
        <style>{CSS}</style>
        <div style={{ fontSize: 40 }}>🏥</div>
        <div style={{ fontSize: 18, fontWeight: 700, marginTop: 10 }}>Cargando Turneador…</div>
      </div>
    );
  }

  if (cargado && conectado && !grupo) {
    return (
      <div style={{ ...S.page, textAlign: "center", paddingTop: 80 }}>
        <style>{CSS}</style>
        <div style={{ fontSize: 40 }}>⚙️</div>
        <div style={{ fontSize: 18, fontWeight: 700, marginTop: 10 }}>Falta la migración de especialidades</div>
        <p style={{ color: "#6B7680", fontSize: 14 }}>Corre el script PASO 8 en el SQL Editor de Supabase y recarga esta página.</p>
      </div>
    );
  }

  return (
    <div style={S.page}>
      <style>{CSS}</style>

      {conectado === false && (
        <div style={S.bannerError}>
          ⚠ No hay conexión con la base de datos. Revisa internet y las credenciales en src/supabase.js, y recarga la página.
        </div>
      )}

      {/* Encabezado */}
      <header style={S.header}>
        <div>
          <div className="no-print" style={S.grupoBarra}>
            <select value={grupo ? grupo.slug : ""} onChange={(ev) => {
              if (ev.target.value === "__nuevo__") crearGrupo();
              else cambiarGrupo(ev.target.value);
            }} style={S.grupoSelect} aria-label="Especialidad">
              {grupos.map((g) => <option key={g.id} value={g.slug}>{g.nombre}</option>)}
              <option value="__nuevo__">＋ Nueva especialidad…</option>
            </select>
          </div>
          <div style={S.kicker}>TURNEADOR · {grupo ? grupo.nombre : ""}</div>
          <div style={S.titulo}>
            <button className="no-print navbtn" onClick={() => cambiarMes(-1)} aria-label="Mes anterior">‹</button>
            <span>{MESES[mes]} {anio}</span>
            <button className="no-print navbtn" onClick={() => cambiarMes(1)} aria-label="Mes siguiente">›</button>
          </div>
          <div className="no-print" style={sync === "error" ? S.guardadoTagError : S.guardadoTag}>
            {sync === "error" ? "⚠ Error al guardar el último cambio: revisa la conexión y reintenta"
              : sync === "guardando" ? "…guardando en la nube"
              : "✓ Guardado en la nube"}
          </div>
        </div>
        <div className="no-print" style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button style={S.btnWhats} onClick={() => setVerCompartir(!verCompartir)}>📤 Compartir</button>
          <button style={S.btnExcel} onClick={descargarExcel}>⬇ Excel</button>
          <button style={S.btnImprimir} onClick={() => window.print()}>🖨</button>
        </div>
      </header>

      {/* Panel de compartir */}
      {verCompartir && (
        <section className="no-print" style={S.panelCompartir}>
          <div style={S.subtitulo}>Compartir el cuadro de {MESES[mes]}</div>
          {imgUrl && <img src={imgUrl} alt={`Cuadro de turnos ${MESES[mes]} ${anio}`} style={S.imgPreview} />}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
            <button style={S.btnWhats} onClick={compartirImagen}>📤 Compartir imagen</button>
            <button style={S.btnGenerar} onClick={descargarImagen}>⬇ Guardar imagen</button>
          </div>
          <p style={S.notaCompartir}>También puedes mantener presionada la imagen y elegir "Compartir" o "Guardar imagen".</p>
          <details style={{ marginTop: 10 }}>
            <summary style={S.summaryTexto}>Otras opciones: texto para WhatsApp</summary>
            <textarea readOnly value={textoWhatsApp} style={{ ...S.textareaWhats, marginTop: 8 }} rows={Math.min(12, textoWhatsApp.split("\n").length + 1)} onFocus={(ev) => ev.target.select()} />
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
              <button style={S.btnLimpiar} onClick={abrirWhatsApp}>Abrir WhatsApp con el texto</button>
              <button style={S.btnLimpiar} onClick={() => copiar(textoWhatsApp, "Texto copiado: pégalo en WhatsApp")}>Copiar texto</button>
            </div>
          </details>
          {msgCopiado && <div style={S.msgCopiado}>{msgCopiado}</div>}
        </section>
      )}

      {/* Barra de herramientas */}
      <section className="no-print" style={S.toolbar}>
        <div style={S.toolGroup}>
          <span style={S.toolLabel}>Especialista activo</span>
          <div style={S.chips}>
            {especialistas.map((e) => (
              <button key={e.id} onClick={() => setSelId(e.id)}
                style={{ ...S.chip, background: selId === e.id ? e.color : "#fff", color: selId === e.id ? "#fff" : e.color, borderColor: e.color }}>
                {apellido(e.nombre)}
              </button>
            ))}
          </div>
        </div>
        <div style={S.toolGroup}>
          <span style={S.toolLabel}>Acción al tocar un día del calendario</span>
          <div style={S.chips}>
            <button onClick={() => setModo("asignar")} style={{ ...S.modoBtn, ...(modo === "asignar" ? S.modoOn : {}) }}>Asignar turno</button>
            <button onClick={() => setModo("bloquear")} style={{ ...S.modoBtn, ...(modo === "bloquear" ? S.modoOn : {}) }}>No disponible 🚫</button>
            <button onClick={() => setModo("borrar")} style={{ ...S.modoBtn, ...(modo === "borrar" ? S.modoOn : {}) }}>Borrar turno</button>
          </div>
        </div>
        <div style={S.toolGroup}>
          <span style={S.toolLabel}>Aplicar a varios días de una vez (usa el especialista y la acción de arriba)</span>
          <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap", fontSize: 14, fontWeight: 600 }}>
            Del
            <input type="number" min="1" max={nDias} placeholder="10" value={rango.d}
              onChange={(ev) => setRango((p) => ({ ...p, d: ev.target.value }))} style={S.inputNum} />
            al
            <input type="number" min="1" max={nDias} placeholder="18" value={rango.h}
              onChange={(ev) => setRango((p) => ({ ...p, h: ev.target.value }))}
              onKeyDown={(ev) => { if (ev.key === "Enter") aplicarRango(); }} style={S.inputNum} />
            <button onClick={aplicarRango} style={S.btnGenerar}>Aplicar</button>
          </div>
        </div>
      </section>

      {/* Salvedades */}
      <section className="no-print" style={S.salvedades}>
        <div style={S.subtitulo}>Salvedades · días que no pueden hacer turno</div>
        <p style={S.nota}>Regístralas ANTES de generar los bloques: el generador salta esos días. Escribe el día y toca Añadir, o usa "No disponible 🚫" y toca los días en el calendario.</p>
        {especialistas.map((e) => {
          const dias = bloqueadosMes(e.id);
          return (
            <div key={e.id} style={S.salvFila}>
              <span style={{ ...S.salvNombre, color: e.color }}>
                {apellido(e.nombre)}
                {(e.diasVedados || []).length > 0 && (
                  <span style={S.vedadoTag}> · nunca: {SEMANA.filter((s) => (e.diasVedados || []).includes(s.d)).map((s) => s.l).join(", ")}</span>
                )}
              </span>
              <input type="text" inputMode="numeric" placeholder="día o 10-18"
                value={salvInput[e.id] || ""}
                onChange={(ev) => setSalvInput((p) => ({ ...p, [e.id]: ev.target.value }))}
                onKeyDown={(ev) => { if (ev.key === "Enter") agregarSalvedad(e.id); }}
                style={{ ...S.inputNum, width: 84 }} />
              <button onClick={() => agregarSalvedad(e.id)} style={S.miniBtnAncho}>Añadir</button>
              <div style={S.salvChips}>
                {dias.length === 0 && <span style={S.salvVacio}>sin salvedades este mes</span>}
                {dias.map((d) => (
                  <span key={d} style={{ ...S.salvChip, borderColor: e.color, color: e.color }}>
                    {d}
                    <button onClick={() => toggleNoDisp(e.id, d)} style={S.salvQuitar} aria-label={`Quitar día ${d}`}>✕</button>
                  </span>
                ))}
              </div>
            </div>
          );
        })}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12, paddingTop: 10, borderTop: "1px solid #EBD9C3" }}>
          <button onClick={generar} style={S.btnGenerar}>⚡ Generar bloques seguidos</button>
          <button onClick={limpiarMes} style={S.btnLimpiar}>Limpiar mes</button>
        </div>
      </section>

      {/* Calendario */}
      <section style={S.calWrap}>
        <div style={S.gridHead}>
          {DIAS.map((d, i) => (
            <div key={d} style={{ ...S.diaSemana, color: i >= 5 ? "#8A3324" : "#3B4652" }}>{d}</div>
          ))}
        </div>
        <div style={S.grid}>
          {celdas.map((d, i) => {
            if (d === null) return <div key={`v${i}`} style={S.celdaVacia} />;
            const k = mkKey(anio, mes, d);
            const fest = festivos[k];
            const dt = new Date(anio, mes, d);
            const esFinde = dt.getDay() === 0 || dt.getDay() === 6;
            const esp = especialistas.find((e) => e.id === asig[k]);
            const bloqueados = especialistas.filter((e) => (noDisp[k] || {})[e.id]);
            const conflicto = esp && ((noDisp[k] || {})[esp.id] || (esp.diasVedados || []).includes(dt.getDay()));
            return (
              <div key={k} onClick={() => clickDia(d)} className="celda"
                style={{ ...S.celda, background: fest ? "#FCEBDD" : esFinde ? "#F2F4F0" : "#FFFFFF", boxShadow: fest ? "inset 0 3px 0 #C05621" : "none" }}>
                <div style={S.celdaTop}>
                  <span className="num-dia" style={{ ...S.num, color: fest ? "#8A3324" : "#26303A" }}>{d}</span>
                  {fest && <span className="fest-tag" style={S.festTag}>★ {fest}</span>}
                </div>
                {esp && (
                  <div className="turno-chip" style={{ ...S.turno, background: esp.color }}>
                    {apellido(esp.nombre)}{conflicto ? " ⚠️" : ""}
                  </div>
                )}
                {bloqueados.length > 0 && (
                  <div style={S.bloqueoFila}>
                    {bloqueados.map((b) => (
                      <span key={b.id} style={{ ...S.bloqueoDot, borderColor: b.color, color: b.color }}>
                        🚫{apellido(b.nombre).slice(0, 4)}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* Resumen */}
      <section style={S.resumen}>
        <div style={S.subtitulo}>Resumen del mes</div>
        <table style={S.tabla}>
          <thead>
            <tr>
              <th style={S.th}>Especialista</th>
              <th style={S.th}>Turnos</th>
              <th style={S.th}>Fines de semana</th>
              <th style={S.th}>Estado</th>
            </tr>
          </thead>
          <tbody>
            {resumen.map((r) => {
              const okTurnos = r.asignados === r.turnos;
              const okFinde = r.findes <= r.finde;
              return (
                <tr key={r.id}>
                  <td style={S.td}><span style={{ ...S.puntico, background: r.color }} />{r.nombre}</td>
                  <td style={{ ...S.td, fontWeight: 700, color: okTurnos ? "#0E7C6B" : "#B3261E" }}>{r.asignados} / {r.turnos}</td>
                  <td style={{ ...S.td, fontWeight: 700, color: okFinde ? "#0E7C6B" : "#B3261E" }}>{r.findes} / {r.finde}</td>
                  <td style={S.td}>
                    {r.conflictos > 0 ? `⚠️ ${r.conflictos} turno(s) en día no permitido` :
                      !okTurnos ? (r.asignados < r.turnos ? "Faltan turnos" : "Sobran turnos") :
                      !okFinde ? "Excede fines de semana" : "✓ Completo"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {sinAsignar > 0 && <div style={S.aviso}>Quedan {sinAsignar} día(s) del mes sin asignar.</div>}
      </section>

      {/* Configuración de especialistas */}
      <section className="no-print" style={S.config}>
        <div style={S.subtitulo}>Especialistas y reglas</div>
        <p style={S.nota}>El orden define la secuencia de los bloques al generar. Cambia nombre, número de turnos por mes, fines de semana permitidos y los días de la semana que nunca hace.</p>
        {especialistas.map((e, i) => (
          <div key={e.id} style={S.espFila}>
            <input type="color" value={e.color} onChange={(ev) => editarEsp(e.id, "color", ev.target.value)} style={S.colorInput} aria-label="Color" />
            <input value={e.nombre} onChange={(ev) => editarEsp(e.id, "nombre", ev.target.value)} style={S.inputNombre} />
            <input value={e.nombreExcel || ""} placeholder="Nombre en el Excel"
              onChange={(ev) => editarEsp(e.id, "nombreExcel", ev.target.value.toUpperCase())} style={S.inputNombre} />
            <label style={S.numLabel}>Turnos
              <input type="number" min="0" max="31" value={e.turnos}
                onChange={(ev) => editarEsp(e.id, "turnos", Math.max(0, parseInt(ev.target.value || "0", 10)))} style={S.inputNum} />
            </label>
            <label style={S.numLabel}>Fines de sem.
              <input type="number" min="0" max="5" value={e.finde}
                onChange={(ev) => editarEsp(e.id, "finde", Math.max(0, parseInt(ev.target.value || "0", 10)))} style={S.inputNum} />
            </label>
            <div style={S.espBtns}>
              <button onClick={() => mover(i, -1)} style={S.miniBtn} aria-label="Subir">↑</button>
              <button onClick={() => mover(i, 1)} style={S.miniBtn} aria-label="Bajar">↓</button>
              <button onClick={() => eliminar(e.id)} style={{ ...S.miniBtn, color: "#B3261E" }} aria-label="Eliminar">✕</button>
            </div>
            <div style={S.vedadosWrap}>
              <span style={S.vedadosLabel}>Nunca hace:</span>
              {SEMANA.map((s) => {
                const on = (e.diasVedados || []).includes(s.d);
                return (
                  <button key={s.d} onClick={() => toggleVedado(e.id, s.d)}
                    style={{ ...S.vedadoBtn, ...(on ? S.vedadoOn : {}) }}
                    aria-pressed={on}>
                    {s.l}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
        <button onClick={agregar} style={S.btnAgregar}>+ Agregar especialista</button>
      </section>

      <footer style={S.footer}>
        Festivos de Colombia calculados automáticamente (Ley Emiliani y Semana Santa). Cada especialidad tiene su propio enlace: comparte esta misma dirección con ?g={grupo ? grupo.slug : "…"} al final y esa especialidad verá solo su cuadro. Los cambios se guardan en la nube. Turneador v2.2
      </footer>
    </div>
  );
}

/* ================= ESTILOS ================= */
const S = {
  page: { maxWidth: 1040, margin: "0 auto", padding: "16px 12px 40px", fontFamily: "'Segoe UI', 'Helvetica Neue', Arial, sans-serif", color: "#26303A", background: "#FDFDFB", minHeight: "100vh" },
  bannerError: { background: "#B3261E", color: "#fff", borderRadius: 10, padding: "10px 14px", fontSize: 13.5, fontWeight: 600, marginBottom: 12, lineHeight: 1.4 },
  header: { display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 12, flexWrap: "wrap", marginBottom: 14 },
  kicker: { fontSize: 12, letterSpacing: "0.08em", color: "#6B7680", marginBottom: 2 },
  titulo: { display: "flex", alignItems: "center", gap: 10, fontSize: 30, fontWeight: 800, lineHeight: 1.05 },
  btnImprimir: { background: "#26303A", color: "#fff", border: "none", borderRadius: 8, padding: "10px 14px", fontSize: 14, fontWeight: 600, cursor: "pointer" },
  btnExcel: { background: "#0E7C6B", color: "#fff", border: "none", borderRadius: 8, padding: "10px 16px", fontSize: 14, fontWeight: 600, cursor: "pointer" },
  btnWhats: { background: "#1DA851", color: "#fff", border: "none", borderRadius: 8, padding: "10px 16px", fontSize: 14, fontWeight: 700, cursor: "pointer" },
  guardadoTag: { fontSize: 11, color: "#0E7C6B", fontWeight: 600, marginTop: 3 },
  guardadoTagError: { fontSize: 11, color: "#B3261E", fontWeight: 700, marginTop: 3, maxWidth: 340, lineHeight: 1.4 },
  grupoBarra: { marginBottom: 6 },
  grupoSelect: { border: "1.5px solid #C6CCC2", borderRadius: 8, padding: "7px 10px", fontSize: 14, fontWeight: 700, background: "#fff", color: "#26303A", maxWidth: 260 },
  panelCompartir: { background: "#EDF7EF", border: "1px solid #C9E3CE", borderRadius: 12, padding: "12px 14px", marginBottom: 14 },
  textareaWhats: { width: "100%", boxSizing: "border-box", border: "1px solid #C9E3CE", borderRadius: 8, padding: 10, fontSize: 13, fontFamily: "inherit", lineHeight: 1.45, background: "#fff", resize: "vertical" },
  msgCopiado: { marginTop: 8, fontSize: 13, fontWeight: 700, color: "#0E7C6B" },
  imgPreview: { width: "100%", borderRadius: 10, border: "1px solid #C9E3CE", display: "block", background: "#fff" },
  notaCompartir: { fontSize: 12, color: "#4A5560", margin: "8px 0 0", lineHeight: 1.5 },
  summaryTexto: { fontSize: 13, fontWeight: 700, color: "#3B4652", cursor: "pointer" },

  toolbar: { display: "flex", flexDirection: "column", gap: 10, background: "#F3F5F2", border: "1px solid #E1E5DE", borderRadius: 12, padding: "12px 14px", marginBottom: 14 },
  toolGroup: { display: "flex", flexDirection: "column", gap: 6 },
  toolLabel: { fontSize: 12, fontWeight: 700, color: "#4A5560" },
  chips: { display: "flex", flexWrap: "wrap", gap: 8 },
  chip: { border: "2px solid", borderRadius: 999, padding: "6px 14px", fontSize: 14, fontWeight: 700, cursor: "pointer", background: "#fff" },
  modoBtn: { border: "1.5px solid #C6CCC2", background: "#fff", borderRadius: 8, padding: "6px 12px", fontSize: 13, cursor: "pointer", color: "#3B4652" },
  modoOn: { background: "#26303A", color: "#fff", borderColor: "#26303A" },
  btnGenerar: { background: "#0E7C6B", color: "#fff", border: "none", borderRadius: 8, padding: "8px 14px", fontSize: 14, fontWeight: 700, cursor: "pointer" },
  btnLimpiar: { background: "#fff", color: "#6B7680", border: "1.5px solid #C6CCC2", borderRadius: 8, padding: "8px 14px", fontSize: 13, cursor: "pointer" },

  salvedades: { marginBottom: 14, background: "#FFF8F0", border: "1px solid #EBD9C3", borderRadius: 12, padding: "12px 14px" },
  salvFila: { display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8, padding: "6px 0", borderTop: "1px dashed #EBD9C3" },
  salvNombre: { fontWeight: 800, fontSize: 14, minWidth: 100 },
  salvChips: { display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" },
  salvChip: { display: "inline-flex", alignItems: "center", gap: 4, border: "1.5px solid", borderRadius: 999, padding: "2px 8px", fontSize: 13, fontWeight: 800, background: "#fff" },
  salvQuitar: { border: "none", background: "none", cursor: "pointer", fontSize: 11, color: "inherit", padding: 0, fontWeight: 800 },
  salvVacio: { fontSize: 12, color: "#9A8F80", fontStyle: "italic" },
  vedadoTag: { fontSize: 11, color: "#B3261E", fontWeight: 700 },
  vedadosWrap: { display: "flex", alignItems: "center", gap: 4, flexWrap: "wrap", width: "100%", paddingTop: 6, borderTop: "1px dashed #E1E5DE" },
  vedadosLabel: { fontSize: 12, fontWeight: 700, color: "#4A5560", marginRight: 4 },
  vedadoBtn: { border: "1.5px solid #C6CCC2", background: "#fff", color: "#3B4652", borderRadius: 7, minWidth: 34, height: 30, cursor: "pointer", fontSize: 12, fontWeight: 700, padding: "0 4px" },
  vedadoOn: { background: "#B3261E", borderColor: "#B3261E", color: "#fff" },
  miniBtnAncho: { border: "1px solid #C6CCC2", background: "#26303A", color: "#fff", borderRadius: 7, padding: "6px 12px", cursor: "pointer", fontSize: 13, fontWeight: 700 },

  calWrap: { border: "1px solid #D8DDD4", borderRadius: 12, overflow: "hidden", background: "#fff" },
  gridHead: { display: "grid", gridTemplateColumns: "repeat(7, minmax(0, 1fr))", background: "#EDEFEA", borderBottom: "1px solid #D8DDD4" },
  diaSemana: { padding: "8px 2px", textAlign: "center", fontSize: 12, fontWeight: 800, letterSpacing: "0.02em" },
  grid: { display: "grid", gridTemplateColumns: "repeat(7, minmax(0, 1fr))" },
  celdaVacia: { minHeight: 74, borderRight: "1px solid #EDEFEA", borderBottom: "1px solid #EDEFEA", background: "#FAFAF8" },
  celda: { minWidth: 0, minHeight: 74, borderRight: "1px solid #EDEFEA", borderBottom: "1px solid #EDEFEA", padding: "4px 4px", cursor: "pointer", display: "flex", flexDirection: "column", gap: 3, overflow: "hidden" },
  celdaTop: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 3 },
  num: { fontSize: 13, fontWeight: 800 },
  festTag: { fontSize: 8.5, color: "#8A3324", fontWeight: 800, textAlign: "right", lineHeight: 1.15, maxWidth: "72%" },
  turno: { color: "#fff", borderRadius: 6, fontSize: 11, fontWeight: 700, padding: "3px 4px", textAlign: "center", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  bloqueoFila: { display: "flex", flexWrap: "wrap", gap: 2 },
  bloqueoDot: { fontSize: 8.5, border: "1px solid", borderRadius: 4, padding: "0 3px", fontWeight: 700 },

  resumen: { marginTop: 16 },
  subtitulo: { fontSize: 17, fontWeight: 800, marginBottom: 8 },
  tabla: { width: "100%", borderCollapse: "collapse", background: "#fff", border: "1px solid #D8DDD4", borderRadius: 10, overflow: "hidden", fontSize: 13.5 },
  th: { textAlign: "left", padding: "8px 10px", background: "#EDEFEA", fontSize: 12, color: "#4A5560" },
  td: { padding: "8px 10px", borderTop: "1px solid #EDEFEA" },
  puntico: { display: "inline-block", width: 10, height: 10, borderRadius: 99, marginRight: 8 },
  aviso: { marginTop: 8, fontSize: 13, color: "#8A3324", fontWeight: 600 },

  config: { marginTop: 20, background: "#F3F5F2", border: "1px solid #E1E5DE", borderRadius: 12, padding: "12px 14px" },
  nota: { fontSize: 12.5, color: "#6B7680", margin: "2px 0 10px" },
  espFila: { display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8, background: "#fff", border: "1px solid #E1E5DE", borderRadius: 10, padding: "8px 10px", marginBottom: 8 },
  colorInput: { width: 34, height: 34, border: "none", background: "none", cursor: "pointer", padding: 0 },
  inputNombre: { flex: "1 1 160px", minWidth: 140, border: "1px solid #C6CCC2", borderRadius: 7, padding: "7px 9px", fontSize: 14, fontWeight: 600 },
  numLabel: { display: "flex", alignItems: "center", gap: 5, fontSize: 12, color: "#4A5560", fontWeight: 600 },
  inputNum: { width: 54, border: "1px solid #C6CCC2", borderRadius: 7, padding: "6px 6px", fontSize: 14, textAlign: "center" },
  espBtns: { display: "flex", gap: 4 },
  miniBtn: { border: "1px solid #C6CCC2", background: "#fff", borderRadius: 7, width: 30, height: 30, cursor: "pointer", fontSize: 14 },
  btnAgregar: { background: "#26303A", color: "#fff", border: "none", borderRadius: 8, padding: "9px 14px", fontSize: 14, fontWeight: 700, cursor: "pointer" },

  footer: { marginTop: 18, fontSize: 11.5, color: "#6B7680", lineHeight: 1.5 },
};

const CSS = `
  .celda:hover { outline: 2px solid #26303A33; outline-offset: -2px; }
  .navbtn { border:1px solid #C6CCC2; background:#fff; border-radius:8px; width:34px; height:34px; font-size:18px; cursor:pointer; }
  @media print {
    .no-print { display: none !important; }
    body { background: #fff; }
  }
  @media (max-width: 560px) {
    .celda { min-height: 58px !important; padding: 2px 2px !important; }
    .turno-chip { font-size: 8.5px !important; padding: 2px 1px !important; border-radius: 4px !important; }
    .fest-tag { font-size: 7px !important; }
    .num-dia { font-size: 11px !important; }
  }
`;
