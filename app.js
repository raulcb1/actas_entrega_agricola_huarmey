const STORAGE_KEY = 'actas_db_local';
const DB_FILE_NAME = 'base_datos.json';

// Estructura maestra
let db = {
  usuarios: [],
  actas_almacen: [],
  actas_ti: []
};
let dbFileHandle = null;

document.addEventListener('DOMContentLoaded', async () => {
  await initializeStore();
  attachDbControls();

  const page = document.body.dataset.page;
  
  // Si estamos en cualquier página de registro, activamos el autocompletado
  if (page === 'registrar_almacen' || page === 'registrar_ti' || page === 'registrar') {
    initUserAutocomplete();
    initRegisterPage();
  } else if (page === 'buscar') {
    initSearchPage();
  } else if (page === 'visualizar' || document.querySelector('.document-container')) {
    initViewPage();
  }

  updateDataStatus();
});

/* =========================================
   1. GESTIÓN DE BASE DE DATOS (JSON)
   ========================================= */

async function initializeStore() {
  const storedDb = readLocalDb();
  const fileDb = await tryLoadDbFromFolder();
  
  // Prioriza el archivo sobre el localstorage
  if (fileDb) {
    db = fileDb;
  } else if (storedDb) {
    db = storedDb;
  }
  
  // Inicializa listas si no existen
  db.usuarios = db.usuarios || [];
  db.actas_almacen = db.actas_almacen || [];
  db.actas_ti = db.actas_ti || [];
  
  persistLocalDb();
}

async function tryLoadDbFromFolder() {
  try {
    const response = await fetch(DB_FILE_NAME, { cache: 'no-store' });
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
}

function readLocalDb() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : null;
  } catch { return null; }
}

function persistLocalDb() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
}

// Botones de carga/descarga
function attachDbControls() {
  const openButton = document.getElementById('open-db-button'); // Puedes cambiarle el ID en tu HTML luego a 'open-db-button'
  const exportButton = document.getElementById('export-db-button');
  const fileInput = document.getElementById('csv-file-input');

  if (openButton) {
    openButton.textContent = "Abrir base_datos.json"; // Cambia el texto dinámicamente
    openButton.addEventListener('click', async () => {
      if ('showOpenFilePicker' in window) {
        try {
          const [handle] = await window.showOpenFilePicker({
            multiple: false,
            types: [{ description: 'Archivo JSON', accept: { 'application/json': ['.json'] } }],
          });
          dbFileHandle = handle;
          const file = await handle.getFile();
          db = JSON.parse(await file.text());
          persistLocalDb();
          alert('Base de datos cargada correctamente.');
          refreshCurrentPage();
          updateDataStatus();
          return;
        } catch (error) { if (error.name !== 'AbortError') console.error(error); }
      }
      if (fileInput) {
        fileInput.accept = ".json";
        fileInput.click();
      }
    });
  }

  if (fileInput) {
    fileInput.addEventListener('change', async () => {
      const file = fileInput.files[0];
      if (!file) return;
      db = JSON.parse(await file.text());
      persistLocalDb();
      fileInput.value = '';
      alert('Base de datos cargada.');
      refreshCurrentPage();
      updateDataStatus();
    });
  }

  if (exportButton) {
    exportButton.textContent = "Exportar JSON";
    exportButton.addEventListener('click', () => {
      downloadText(DB_FILE_NAME, JSON.stringify(db, null, 2), 'application/json');
    });
  }

  // Botón para limpiar la base de datos local
  const clearBtn = document.getElementById('clear-local-db-button');
  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      const confirmacion = confirm('⚠️ ATENCIÓN: ¿Estás seguro de que deseas borrar todos los datos locales del navegador?\n\nSi no has exportado tu archivo base_datos.json, perderás esta información permanentemente.');
      
      if (confirmacion) {
        localStorage.removeItem(STORAGE_KEY);
        // Reinicia la variable global
        db = { usuarios: [], actas_almacen: [], actas_ti: [] };
        alert('Base de datos local eliminada con éxito.');
        updateDataStatus();
      }
    });
  }




}

async function saveDbIfPossible() {
  if (!dbFileHandle) return false;
  try {
    const permission = await dbFileHandle.requestPermission({ mode: 'readwrite' });
    if (permission !== 'granted') return false;
    const writable = await dbFileHandle.createWritable();
    await writable.write(JSON.stringify(db, null, 2));
    await writable.close();
    return true;
  } catch { return false; }
}

/* =========================================
   2. AUTOCOMPLETADO DE USUARIOS
   ========================================= */

function initUserAutocomplete() {
  let datalist = document.getElementById('usuarios-list');
  if (!datalist) {
    datalist = document.createElement('datalist');
    datalist.id = 'usuarios-list';
    document.body.appendChild(datalist);
  }
  
  // Llenar el desplegable invisible
  datalist.innerHTML = '';
  db.usuarios.forEach(u => {
    const option = document.createElement('option');
    option.value = u.nombre;
    datalist.appendChild(option);
  });

  const inputNombre = document.getElementById('usuario_nombre');
  if (inputNombre) {
    inputNombre.setAttribute('list', 'usuarios-list');
    inputNombre.addEventListener('input', (e) => {
      const selected = db.usuarios.find(u => u.nombre.toUpperCase() === e.target.value.toUpperCase());
      if (selected) {
        if(document.getElementById('usuario_dni')) document.getElementById('usuario_dni').value = selected.dni;
        if(document.getElementById('usuario_puesto')) document.getElementById('usuario_puesto').value = selected.puesto;
        if(document.getElementById('sede')) document.getElementById('sede').value = selected.sede || 'Olmos';
      }
    });
  }
}

// Guarda un usuario nuevo o actualiza su puesto si cambió
function upsertUsuario(nombre, dni, puesto, sede) {
  if (!nombre) return;
  const index = db.usuarios.findIndex(u => u.nombre.toUpperCase() === nombre.toUpperCase() || u.dni === dni);
  if (index === -1) {
    db.usuarios.push({ nombre, dni, puesto, sede: sede || 'Olmos' });
  } else {
    db.usuarios[index].puesto = puesto;
    if(sede) db.usuarios[index].sede = sede;
  }
}

/* =========================================
   3. REGISTRO Y RECOLECCIÓN DE DATOS
   ========================================= */

function initRegisterPage() {
  const form = document.getElementById('delivery-form');
  form.addEventListener('submit', handleSave);
  document.getElementById('clear-button')?.addEventListener('click', clearForm);
  
  const id = getQueryParam('id');
  if (id) {
    const record = findRecord(id);
    if (record) {
      fillForm(record);
      if(document.getElementById('form-title')) document.getElementById('form-title').textContent = 'Editar registro';
    }
  }
}

async function handleSave(event) {
  event.preventDefault();
  
  // Determina qué formulario se está guardando (TI tiene un campo "tipo_operacion" o "condicion")
  const isTI = document.getElementById('tipo_operacion') !== null;
  const tipo_acta = isTI ? 'ti' : 'almacen';
  
  const record = collectFormData(tipo_acta);
  if (!record) return;

  upsertRecord(record, tipo_acta);
  
  const savedToFile = await saveDbIfPossible();
  alert(savedToFile
    ? 'Registro guardado en base_datos.json.'
    : 'Registro guardado en el navegador. Usa "Exportar JSON" para crear el archivo físico.');
    
  clearForm();
  updateDataStatus();
}

function collectFormData(tipo_acta) {
  const data = {};
  // Recoge todos los inputs, textareas y selects dentro del formulario
  const inputs = document.querySelectorAll('#delivery-form input, #delivery-form textarea, #delivery-form select');
  
  inputs.forEach(input => {
    if (input.id && input.id !== 'record-id') {
      data[input.id] = input.value.trim();
    }
  });

  if (!data.usuario_nombre || !data.usuario_dni || !data.usuario_puesto || !data.fecha_entrega) {
    alert('Completa nombre, DNI, puesto y fecha.');
    return null;
  }

  return {
    id: document.getElementById('record-id').value || createId(),
    createdAt: new Date().toISOString(),
    tipo_acta: tipo_acta, // Marca importante para saber qué plantilla usar al visualizar
    ...data
  };
}

function upsertRecord(record, tipo_acta) {
  const list = tipo_acta === 'ti' ? db.actas_ti : db.actas_almacen;
  const index = list.findIndex(item => item.id === record.id);
  
  if (index === -1) list.unshift(record);
  else list[index] = record;
  
  // Actualizar la lista de usuarios automáticamente
  upsertUsuario(record.usuario_nombre, record.usuario_dni, record.usuario_puesto, record.sede);
  
  persistLocalDb();
}

function fillForm(record) {
  clearForm();
  document.getElementById('record-id').value = record.id || '';
  Object.keys(record).forEach(key => {
    const el = document.getElementById(key);
    if (el) el.value = record[key];
  });
}

function clearForm() {
  document.getElementById('delivery-form')?.reset();
  if(document.getElementById('record-id')) document.getElementById('record-id').value = '';
}

/* =========================================
   4. BÚSQUEDA Y VISUALIZACIÓN
   ========================================= */

/* =========================================
   4. BÚSQUEDA Y VISUALIZACIÓN
   ========================================= */

function getAllRecords() {
  const almacen = db.actas_almacen.map(r => ({...r, tipo_acta: 'almacen'}));
  const ti = db.actas_ti.map(r => ({...r, tipo_acta: 'ti'}));
  return [...almacen, ...ti].sort((a, b) => String(b.fecha_entrega).localeCompare(String(a.fecha_entrega)));
}

function findRecord(id) {
  const all = getAllRecords();
  return all.find(r => r.id === id);
}

function initSearchPage() {
  // Añadido 'filter-operacion' a los monitores de eventos
  ['search-text', 'date-from', 'date-to', 'filter-operacion'].forEach(id => {
    document.getElementById(id)?.addEventListener('input', renderSearchResults);
  });
  document.getElementById('clear-filters-button')?.addEventListener('click', () => {
    document.getElementById('search-text').value = '';
    document.getElementById('date-from').value = '';
    document.getElementById('date-to').value = '';
    document.getElementById('filter-operacion').value = '';
    renderSearchResults();
  });
  renderSearchResults();
}

function renderSearchResults() {
  const tbody = document.getElementById('records-table-body');
  const count = document.getElementById('report-count');
  if (!tbody) return;

  const filtered = getFilteredRecords();
  tbody.innerHTML = '';
  count.textContent = String(filtered.length);

  if (!filtered.length) {
    tbody.innerHTML = '<tr><td colspan="6">No hay registros para mostrar.</td></tr>';
    return;
  }

  filtered.forEach(record => {
    const row = document.createElement('tr');
    appendCell(row, formatDate(record.fecha_entrega));
    appendCell(row, record.usuario_nombre);
    appendCell(row, record.usuario_dni);
    appendCell(row, record.usuario_puesto);
    
    // Etiqueta visual para distinguir si es acta de Almacén o TI, y si es Devolución
    const tag = record.tipo_acta === 'ti' ? '💻 TI' : '📦 Almacén';
    const opTag = record.tipo_operacion === 'Devolución' ? ' (Devolución)' : '';
    appendCell(row, `[${tag}${opTag}] ` + summarizeEquipment(record));

    const actionCell = document.createElement('td');
    actionCell.className = 'table-actions';
    
    // Redirige al visualizador o editor correcto según el tipo de acta
    const verUrl = record.tipo_acta === 'ti' ? `visualizar_ti.html?id=${record.id}` : `visualizar_almacen.html?id=${record.id}`;
    const editarUrl = record.tipo_acta === 'ti' ? `registrar_ti.html?id=${record.id}` : `registrar_almacen.html?id=${record.id}`;
    
    const btnVer = createLinkButton('Ver', verUrl, 'secondary'); btnVer.target = "_blank";
    const btnEditar = createLinkButton('Editar', editarUrl, 'tertiary');
    
    // NUEVO: Botón Eliminar (Rojo)
    const btnEliminar = document.createElement('button');
    btnEliminar.className = 'button';
    btnEliminar.style.backgroundColor = '#dc2626'; // Rojo peligro
    btnEliminar.style.color = 'white';
    btnEliminar.style.border = 'none';
    btnEliminar.textContent = 'Eliminar';
    btnEliminar.onclick = () => softDeleteRecord(record.id, record.tipo_acta);

    actionCell.append(btnVer, btnEditar, btnEliminar);
    row.appendChild(actionCell);
    tbody.appendChild(row);
  });
}

function getFilteredRecords() {
  const text = (document.getElementById('search-text').value || '').trim().toLowerCase();
  const from = document.getElementById('date-from').value;
  const to = document.getElementById('date-to').value;
  const operacion = document.getElementById('filter-operacion').value; // 'Entrega' o 'Devolución'

  return getAllRecords().filter(record => {
    // 1. Ignorar registros eliminados lógicamente
    if (record.deleted) return false;

    // 2. Filtro de Fechas
    if (from && record.fecha_entrega < from) return false;
    if (to && record.fecha_entrega > to) return false;
    
    // 3. Filtro por tipo de operación (Asumimos "Entrega" para las actas antiguas/almacén que no tienen este campo)
    const tipoOpRegistro = record.tipo_operacion || 'Entrega'; 
    if (operacion && tipoOpRegistro !== operacion) return false;

    // 4. Filtro por Texto libre
    if (!text) return true;
    return Object.values(record).some(val => String(val || '').toLowerCase().includes(text));
  });
}

// NUEVA FUNCIÓN: Eliminación lógica (Soft Delete) con auditoría
async function softDeleteRecord(id, tipo_acta) {
  const motivo = prompt("⚠️ Está a punto de ELIMINAR este registro.\n\nPor favor, ingrese el MOTIVO de la eliminación:");
  
  if (motivo === null) return; // El usuario hizo clic en Cancelar
  if (motivo.trim() === "") {
    alert("❌ Operación cancelada. El motivo es obligatorio para eliminar un registro.");
    return;
  }

  // Encontrar la lista correcta en la base de datos
  const list = tipo_acta === 'ti' ? db.actas_ti : db.actas_almacen;
  const index = list.findIndex(item => item.id === id);
  
  if (index !== -1) {
    // Grabar auditoría (fecha, motivo, navegador, sistema operativo)
    list[index].deleted = true;
    list[index].deleteInfo = {
      motivo: motivo.trim(),
      fecha: new Date().toISOString(),
      agente_navegador: navigator.userAgent, // Ej: "Mozilla/5.0 (Windows NT 10.0; Win64; x64)..."
      plataforma: navigator.platform
    };

    persistLocalDb();
    
    // Si tenemos conexión directa al archivo base_datos.json, lo actualizamos al instante
    await saveDbIfPossible();
    
    alert("✔️ Registro eliminado correctamente.");
    renderSearchResults(); // Refrescar la tabla para que desaparezca
    updateDataStatus();
  }
}
/* =========================================
   5. UTILIDADES Y EXTRAS
   ========================================= */

function updateDataStatus() {
  const status = document.getElementById('data-status');
  if (status) {
    const total = db.actas_almacen.length + db.actas_ti.length;
    status.textContent = `${total} actas | ${db.usuarios.length} usuarios registrados.`;
  }
}

// (Mantenemos las funciones auxiliares de tu código anterior)
function createId() { return window.crypto?.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`; }
function getQueryParam(name) { return new URLSearchParams(window.location.search).get(name) || ''; }
function formatDate(value) { if (!value) return ''; const parts = String(value).split('-'); return parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : value; }
function appendCell(row, text) { const cell = document.createElement('td'); cell.textContent = text || ''; row.appendChild(cell); }
function createLinkButton(text, href, variant) { const link = document.createElement('a'); link.className = `button ${variant}`; link.href = href; link.textContent = text; return link; }

function summarizeEquipment(record) {
  const items = [];
  if (record.chip_numero) items.push(`Chip`);
  if (record.radio_serie || record.radio_marca) items.push(`Radio`);
  if (record.celular_imei || record.celular_modelo) items.push(`Celular`);
  if (record.laptop_serie || record.laptop_modelo) items.push(`Laptop`);
  if (record.monitor_marca) items.push(`Monitor`);
  return items.length ? items.join(' | ') : 'Sin equipos';
}

function downloadText(filename, text, type) {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url; link.download = filename;
  document.body.appendChild(link); link.click();
  link.remove(); URL.revokeObjectURL(url);
}

function refreshCurrentPage() {
  if (document.body.dataset.page === 'buscar') renderSearchResults();
}

/* --- MANTENEMOS ESTO PARA LA PANTALLA VISUALIZAR_ALMACEN --- */
function initViewPage() {
  const id = getQueryParam('id');
  const record = findRecord(id);
  if (!record) { document.body.innerHTML = '<h2 style="text-align:center; padding: 50px;">No se encontró el acta.</h2>'; return; }
  
  if(typeof renderActa === "function") renderActa(record); // Llama a la función si está definida en el HTML
  
  document.getElementById('print-acta-button')?.addEventListener('click', () => window.print());
  document.getElementById('download-json-button')?.addEventListener('click', () => {
    downloadText(`acta_${record.id}.json`, JSON.stringify(record, null, 2), 'application/json');
  });
}