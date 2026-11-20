"use strict";

// -----------------------------------------------------------------------------------
// Import des fonctions nécessaires
// -----------------------------------------------------------------------------------
// Aucune fonction externe à importer.

// -----------------------------------------------------------------------------------
// Déclaration des variables globales
// -----------------------------------------------------------------------------------
const STORAGE_KEY = "anniversaires_pwa_data_v1";
const JSON_URL = "./anniversaires.json";

const MONTHS_FR = {
  1: "Janvier", 2: "Février", 3: "Mars", 4: "Avril",
  5: "Mai", 6: "Juin", 7: "Juillet", 8: "Août",
  9: "Septembre", 10: "Octobre", 11: "Novembre", 12: "Décembre"
};

const WEEKDAYS_FR = [
  "Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"
];

let birthdays = [];
let sortDirections = {};
let activeInlineEditor = null;

// -----------------------------------------------------------------------------------
// Procédures évènementielles
// -----------------------------------------------------------------------------------

// Charge les données et associe chaque commande à son traitement.
async function initializeBirthdays() {
  const statusEl = document.getElementById("statusBadge");
  await loadInitialData(statusEl);
  sortByUpcoming();
  renderTable();
  registerServiceWorker();

  const modal = document.getElementById("birthdayModal");
  const form = document.getElementById("birthdayForm");
  const openButton = document.getElementById("openBirthdayModal");
  openButton.addEventListener("click", () => {
    modal.showModal();
    document.getElementById("dateInput").focus();
  });
  document.getElementById("closeBirthdayModal").addEventListener("click", () => modal.close());
  document.getElementById("cancelBirthdayModal").addEventListener("click", () => modal.close());
  modal.addEventListener("close", () => {
    form.reset();
    openButton.focus();
  });
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    handleAddBirthday();
  });

  document.getElementById("upcomingBtn").addEventListener("click", () => {
    sortDirections = {};
    sortByUpcoming();
    renderTable();
  });

  document.getElementById("searchInput").addEventListener("input", renderTable);

  const fileInput = document.getElementById("jsonFileInput");
  document.getElementById("importJsonBtn").addEventListener("click", () => fileInput.click());
  fileInput.addEventListener("change", (e) => {
    const file = e.target.files && e.target.files[0];
    handleImportJsonFile(file);
    e.target.value = "";
  });

  document.getElementById("exportJsonBtn").addEventListener("click", handleExportJson);
  document.getElementById("pdfBtn").addEventListener("click", handleGeneratePdf);

  document.querySelectorAll("#birthdayTable thead th.sortable").forEach((th) => {
    th.addEventListener("click", () => {
      const col = th.dataset.col;
      if (col) sortByColumn(col);
    });
  });

  document.getElementById("birthdayBody").addEventListener("dblclick", (e) => {
    const cell = e.target.closest("td.editable-cell");
    if (!cell) return;
    const tr = cell.closest("tr");
    if (!tr) return;
    const dataIndex = Number(tr.dataset.index);
    const field = cell.dataset.field;
    if (!Number.isNaN(dataIndex) && field) {
      startInlineEdit(cell, dataIndex, field);
    }
  });
}

// -----------------------------------------------------------------------------------
// Fonctions de traitement
// -----------------------------------------------------------------------------------

// --- Utilitaires de date ---

// Écarte l'heure pour comparer uniquement les dates civiles.
function startOfToday() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

/**
 * Parse "JJ/MM/AAAA" ou "AAAA-MM-JJ" en { date: Date, formatted: "JJ/MM/AAAA", iso: "AAAA-MM-JJ" }.
 */
function parseBirthdayDate(rawStr) {
  if (!rawStr || typeof rawStr !== "string") return null;
  const trimmed = rawStr.trim();

  let day, month, year;
  const frMatch = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(trimmed);
  const isoMatch = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(trimmed);

  if (frMatch) {
    day = Number(frMatch[1]);
    month = Number(frMatch[2]);
    year = Number(frMatch[3]);
  } else if (isoMatch) {
    year = Number(isoMatch[1]);
    month = Number(isoMatch[2]);
    day = Number(isoMatch[3]);
  } else {
    return null;
  }

  if (month < 1 || month > 12 || day < 1 || day > 31 || year < 1900 || year > 2100) {
    return null;
  }

  const candidate = new Date(year, month - 1, day);
  if (
      candidate.getFullYear() !== year ||
      candidate.getMonth() !== month - 1 ||
      candidate.getDate() !== day
  ) {
    return null;
  }

  const dd = String(day).padStart(2, "0");
  const mm = String(month).padStart(2, "0");
  const yyyy = String(year).padStart(4, "0");

  return {
    date: candidate,
    day,
    month,
    year,
    formatted: `${dd}/${mm}/${yyyy}`,
    iso: `${yyyy}-${mm}-${dd}`
  };
}

function safeBirthdayDateForYear(year, month, day) {
  if (month === 2 && day === 29) {
    const test = new Date(year, 1, 29);
    if (test.getMonth() !== 1) {
      return new Date(year, 1, 28);
    }
  }
  return new Date(year, month - 1, day);
}

function daysUntilNextBirthday(dob) {
  const today = startOfToday();
  let nextBday = safeBirthdayDateForYear(today.getFullYear(), dob.month, dob.day);
  if (nextBday < today) {
    nextBday = safeBirthdayDateForYear(today.getFullYear() + 1, dob.month, dob.day);
  }
  const diffMs = nextBday.getTime() - today.getTime();
  return Math.round(diffMs / 86400000);
}

// Construit un âge lisible sans afficher les unités nulles.
function formatAgeParts(years, months, days) {
  const parts = [];
  if (years > 0) {
    parts.push(`${years} ${years === 1 ? "an" : "ans"}`);
  }
  if (months > 0) {
    parts.push(`${months} mois`);
  }
  if (days > 0) {
    parts.push(`${days} ${days === 1 ? "jour" : "jours"}`);
  }

  if (parts.length === 0) return "0 jour";
  if (parts.length === 1) return parts[0];
  return `${parts.slice(0, -1).join(", ")} et ${parts[parts.length - 1]}`;
}

// Facilite la lecture du nombre de jours vécus.
function formatNumberWithSpaces(num) {
  return String(num).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

// Calcule les informations affichées à partir de la date de naissance.
function calculateDetails(dateStr) {
  const parsed = parseBirthdayDate(dateStr);
  if (!parsed) {
    return {
      valid: false,
      ageStr: "Date invalide",
      daysLeft: 999999,
      daysLeftStr: "-",
      daysLived: 0,
      daysLivedStr: "0",
      weekdayName: "Inconnu"
    };
  }

  const today = startOfToday();
  const dobDate = parsed.date;

  if (dobDate > today) {
    return {
      valid: true,
      ageStr: "Futur",
      daysLeft: daysUntilNextBirthday(parsed),
      daysLeftStr: "0 jour",
      daysLived: 0,
      daysLivedStr: "0",
      weekdayName: WEEKDAYS_FR[dobDate.getDay()]
    };
  }

  let years = today.getFullYear() - parsed.year;
  let months = today.getMonth() - (parsed.month - 1);
  let days = today.getDate() - parsed.day;

  if (days < 0) {
    months -= 1;
    const prevMonthLastDay = new Date(today.getFullYear(), today.getMonth(), 0).getDate();
    days += prevMonthLastDay;
  }

  if (months < 0) {
    years -= 1;
    months += 12;
  }

  const daysLeft = daysUntilNextBirthday(parsed);
  const daysLeftStr =
      daysLeft === 0
          ? "Aujourd'hui !"
          : `${daysLeft} ${daysLeft === 1 ? "jour" : "jours"}`;

  const daysLived = Math.max(0, Math.round((today.getTime() - dobDate.getTime()) / 86400000));

  return {
    valid: true,
    ageStr: formatAgeParts(years, months, days),
    daysLeft,
    daysLeftStr,
    daysLived,
    daysLivedStr: formatNumberWithSpaces(daysLived),
    weekdayName: WEEKDAYS_FR[dobDate.getDay()]
  };
}

// --- Persistance : localStorage + fetch("./anniversaires.json") ---

// Valide les dates et élimine les doublons lors d'un chargement ou import.
function normalizeRecords(rawArray) {
  if (!Array.isArray(rawArray)) return [];
  const cleaned = [];
  for (const item of rawArray) {
    if (!item || typeof item !== "object") continue;
    const nom = String(item.nom ?? "").trim();
    const parsed = parseBirthdayDate(String(item.date ?? ""));
    if (!nom || !parsed) continue;

    const isDup = cleaned.some(
        (existing) =>
            existing.date === parsed.formatted &&
            existing.nom.trim().toLowerCase() === nom.toLowerCase()
    );
    if (!isDup) {
      cleaned.push({ date: parsed.formatted, nom });
    }
  }
  return cleaned;
}

// Conserve les modifications sur cet appareil.
function saveToStorage() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(birthdays));
}

// Privilégie la sauvegarde locale puis tente le fichier initial du serveur.
async function loadInitialData(statusEl) {
  const savedRaw = localStorage.getItem(STORAGE_KEY);
  if (savedRaw !== null) {
    try {
      birthdays = normalizeRecords(JSON.parse(savedRaw));
      if (statusEl) statusEl.textContent = "Données locales (navigateur)";
      return;
    } catch (_) {
      // Si localStorage est corrompu, on tente le fichier JSON
    }
  }

  if (window.location.protocol === "http:" || window.location.protocol === "https:") {
    try {
      const res = await fetch(JSON_URL, { cache: "no-store" });
      if (res.ok) {
        const jsonData = await res.json();
        birthdays = normalizeRecords(jsonData);
        saveToStorage();
        if (statusEl) statusEl.textContent = "Chargé depuis anniversaires.json";
        return;
      }
    } catch (_) {
      // Fichier absent ou réseau indisponible
    }
  }

  birthdays = [];
  if (statusEl) statusEl.textContent = "Prêt (aucun fichier JSON chargé)";
}

// --- Tri ---

// Classe les anniversaires par échéance, puis par nom.
function sortByUpcoming() {
  birthdays.sort((a, b) => {
    const pa = parseBirthdayDate(a.date);
    const pb = parseBirthdayDate(b.date);
    const da = pa ? daysUntilNextBirthday(pa) : 999999;
    const db = pb ? daysUntilNextBirthday(pb) : 999999;
    return da - db || a.nom.localeCompare(b.nom, "fr");
  });
}

// Alterne le sens de tri lors des clics sur les en-têtes.
function sortByColumn(col) {
  const reverse = Boolean(sortDirections[col]);
  sortDirections[col] = !reverse;
  const factor = reverse ? -1 : 1;

  birthdays.sort((a, b) => {
    const pa = parseBirthdayDate(a.date);
    const pb = parseBirthdayDate(b.date);
    const da = calculateDetails(a.date);
    const db = calculateDetails(b.date);

    let cmp = 0;
    if (col === "date") {
      const ma = pa ? pa.month * 100 + pa.day : 9999;
      const mb = pb ? pb.month * 100 + pb.day : 9999;
      cmp = ma - mb;
    } else if (col === "nom") {
      cmp = a.nom.localeCompare(b.nom, "fr", { sensitivity: "base" });
    } else if (col === "age") {
      const ta = pa ? pa.date.getTime() : Number.MAX_SAFE_INTEGER;
      const tb = pb ? pb.date.getTime() : Number.MAX_SAFE_INTEGER;
      cmp = ta - tb;
    } else if (col === "prochain") {
      cmp = da.daysLeft - db.daysLeft;
    } else if (col === "joursVecus") {
      cmp = da.daysLived - db.daysLived;
    } else if (col === "jourNais") {
      const order = { Lundi: 1, Mardi: 2, Mercredi: 3, Jeudi: 4, Vendredi: 5, Samedi: 6, Dimanche: 7 };
      cmp = (order[da.weekdayName] || 8) - (order[db.weekdayName] || 8);
    }

    return cmp * factor;
  });

  renderTable();
}

// --- Rendu et édition directe ---

// Applique la recherche à la liste sans modifier les données enregistrées.
function getFilteredBirthdays() {
  const searchEl = document.getElementById("searchInput");
  const query = (searchEl ? searchEl.value : "").trim().toLowerCase();

  return birthdays
      .map((item, dataIndex) => ({ item, dataIndex }))
      .filter(({ item }) => !query || item.nom.toLowerCase().includes(query));
}

// Reconstruit les lignes affichées à partir de la liste filtrée.
function renderTable() {
  cancelInlineEdit();
  const tbody = document.getElementById("birthdayBody");
  if (!tbody) return;

  tbody.innerHTML = "";
  const rows = getFilteredBirthdays();

  if (rows.length === 0) {
    const tr = document.createElement("tr");
    const td = document.createElement("td");
    td.colSpan = 7;
    td.className = "empty-state";
    td.textContent = "Aucun anniversaire à afficher.";
    tr.appendChild(td);
    tbody.appendChild(tr);
    return;
  }

  for (const { item, dataIndex } of rows) {
    const details = calculateDetails(item.date);
    const tr = document.createElement("tr");
    tr.dataset.index = String(dataIndex);

    // Colonne 0 : Supprimer
    const tdDel = document.createElement("td");
    tdDel.className = "col-del";
    const delBtn = document.createElement("button");
    delBtn.type = "button";
    delBtn.className = "del-btn";
    delBtn.title = `Supprimer ${item.nom}`;
    delBtn.textContent = "❌";
    delBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      if (confirm(`Voulez-vous vraiment supprimer ${item.nom} (${item.date}) ?`)) {
        birthdays.splice(dataIndex, 1);
        saveToStorage();
        renderTable();
      }
    });
    tdDel.appendChild(delBtn);

    // Colonne 1 : Date de naissance (éditable)
    const tdDate = document.createElement("td");
    tdDate.className = "center editable-cell";
    tdDate.dataset.field = "date";
    tdDate.textContent = item.date;

    // Colonne 2 : Nom & Prénom (éditable)
    const tdNom = document.createElement("td");
    tdNom.className = "editable-cell";
    tdNom.dataset.field = "nom";
    tdNom.textContent = item.nom;

    // Colonne 3 : Âge
    const tdAge = document.createElement("td");
    tdAge.textContent = details.ageStr;

    // Colonne 4 : Prochain Ann.
    const tdProchain = document.createElement("td");
    tdProchain.className = "center";
    tdProchain.textContent = details.daysLeftStr;

    // Colonne 5 : Jours vécus
    const tdJours = document.createElement("td");
    tdJours.className = "center";
    tdJours.textContent = details.daysLivedStr;

    // Colonne 6 : Jour de naissance
    const tdJourNais = document.createElement("td");
    tdJourNais.textContent = details.weekdayName;

    tr.append(tdDel, tdDate, tdNom, tdAge, tdProchain, tdJours, tdJourNais);
    tbody.appendChild(tr);
  }
}

// Annule une édition de cellule encore en cours.
function cancelInlineEdit() {
  if (!activeInlineEditor) return;
  const { input, cell, originalText } = activeInlineEditor;
  activeInlineEditor = null;
  if (input && input.parentNode) {
    input.remove();
  }
  if (cell) {
    cell.textContent = originalText;
  }
}

// Ouvre l'éditeur de cellule et valide la modification avant sauvegarde.
function startInlineEdit(cell, dataIndex, field) {
  if (activeInlineEditor && activeInlineEditor.cell === cell) return;
  cancelInlineEdit();

  const record = birthdays[dataIndex];
  if (!record) return;

  const originalText = cell.textContent;
  const parsed = parseBirthdayDate(record.date);

  const input = document.createElement("input");
  input.className = "inline-input";

  if (field === "date") {
    input.type = "date";
    input.value = parsed ? parsed.iso : "";
  } else {
    input.type = "text";
    input.value = record.nom;
  }

  cell.textContent = "";
  cell.appendChild(input);
  input.focus();
  if (field === "nom") {
    input.select();
  }

  let finalized = false;
  const commit = () => {
    if (finalized) return;
    finalized = true;

    const rawVal = input.value.trim();
    activeInlineEditor = null;

    if (!rawVal) {
      cell.textContent = originalText;
      alert("La valeur ne peut pas être vide.");
      return;
    }

    let candidateDate = record.date;
    let candidateNom = record.nom;

    if (field === "date") {
      const newParsed = parseBirthdayDate(rawVal);
      if (!newParsed) {
        cell.textContent = originalText;
        alert("Date invalide.");
        return;
      }
      candidateDate = newParsed.formatted;
    } else {
      candidateNom = rawVal;
    }

    const duplicate = birthdays.some(
        (item, idx) =>
            idx !== dataIndex &&
            item.date === candidateDate &&
            item.nom.trim().toLowerCase() === candidateNom.toLowerCase()
    );

    if (duplicate) {
      cell.textContent = originalText;
      alert(`Un enregistrement pour "${candidateNom}" à la date du ${candidateDate} existe déjà.`);
      return;
    }

    birthdays[dataIndex] = { date: candidateDate, nom: candidateNom };
    saveToStorage();
    renderTable();
  };

  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      commit();
    } else if (e.key === "Escape") {
      e.preventDefault();
      finalized = true;
      activeInlineEditor = null;
      cell.textContent = originalText;
    }
  });

  input.addEventListener("blur", commit);

  activeInlineEditor = { input, cell, originalText };
}

// --- Formulaire et Import / Export / PDF ---

// Valide et ajoute un anniversaire avant de fermer la modale.
function handleAddBirthday() {
  const dateInput = document.getElementById("dateInput");
  const nameInput = document.getElementById("nameInput");

  const parsed = parseBirthdayDate(dateInput.value);
  const nom = nameInput.value.trim();

  if (!parsed || !nom) {
    alert("Veuillez renseigner une date valide et un nom & prénom.");
    return;
  }

  const duplicate = birthdays.some(
      (item) =>
          item.date === parsed.formatted &&
          item.nom.trim().toLowerCase() === nom.toLowerCase()
  );

  if (duplicate) {
    alert(`Un anniversaire pour "${nom}" à la date du ${parsed.formatted} existe déjà.`);
    return;
  }

  birthdays.push({ date: parsed.formatted, nom });
  saveToStorage();
  sortByUpcoming();
  renderTable();

  dateInput.value = "";
  nameInput.value = "";
  document.getElementById("birthdayModal").close();
}

// Fusionne les anniversaires valides du fichier importé avec la liste locale.
function handleImportJsonFile(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const parsedJson = JSON.parse(String(reader.result));
      const imported = normalizeRecords(parsedJson);
      if (imported.length === 0) {
        alert("Aucune entrée valide trouvée dans ce fichier JSON.");
        return;
      }

      for (const entry of imported) {
        const exists = birthdays.some(
            (item) =>
                item.date === entry.date &&
                item.nom.trim().toLowerCase() === entry.nom.toLowerCase()
        );
        if (!exists) {
          birthdays.push(entry);
        }
      }

      saveToStorage();
      sortByUpcoming();
      renderTable();
      const statusEl = document.getElementById("statusBadge");
      if (statusEl) statusEl.textContent = `Importé : ${file.name}`;
      alert(`Importation réussie (${imported.length} entrée(s) traitée(s)).`);
    } catch (_) {
      alert("Fichier JSON invalide.");
    }
  };
  reader.readAsText(file, "utf-8");
}

// Télécharge une sauvegarde JSON des anniversaires.
function handleExportJson() {
  const blob = new Blob([JSON.stringify(birthdays, null, 2)], {
    type: "application/json;charset=utf-8"
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "anniversaires.json";
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

// Construit la version imprimable utilisée si la bibliothèque PDF manque.
function buildMonthlyPrintView() {
  const container = document.getElementById("printContainer");
  if (!container) return;

  const today = startOfToday();
  const grouped = Array.from({ length: 13 }, () => []);

  for (const item of birthdays) {
    const dob = parseBirthdayDate(item.date);
    if (!dob) continue;

    let nextBday = safeBirthdayDateForYear(today.getFullYear(), dob.month, dob.day);
    if (nextBday < today) {
      nextBday = safeBirthdayDateForYear(today.getFullYear() + 1, dob.month, dob.day);
    }

    const nextYear = nextBday.getFullYear();
    const nextAge = nextYear - dob.year;
    const nextWeekday = WEEKDAYS_FR[nextBday.getDay()];

    grouped[dob.month].push({
      jour: String(dob.day).padStart(2, "0"),
      nom: item.nom,
      anneeNaiss: String(dob.year),
      prochainAn: String(nextYear),
      prochainJour: nextWeekday,
      ageFutur: `${nextAge} ${nextAge === 1 ? "an" : "ans"}`,
      dayNum: dob.day
    });
  }

  let html = `<h2 class="print-doc-title">Liste des Anniversaires par Mois</h2>`;
  let hasAny = false;

  for (let m = 1; m <= 12; m++) {
    const list = grouped[m];
    if (!list.length) continue;
    hasAny = true;

    list.sort((a, b) => a.dayNum - b.dayNum || a.nom.localeCompare(b.nom, "fr"));

    html += `
      <section class="month-group">
        <h3 class="month-heading">${MONTHS_FR[m]}</h3>
        <table class="print-table">
          <thead>
            <tr>
              <th style="text-align:center;">Jour</th>
              <th>Nom &amp; Prénom</th>
              <th style="text-align:center;">Né(e) en</th>
              <th style="text-align:center;">Proch. An</th>
              <th>Jour (prochain)</th>
              <th style="text-align:center;">Âge</th>
            </tr>
          </thead>
          <tbody>
            ${list
        .map(
            (row) => `
              <tr>
                <td style="text-align:center;">${row.jour}</td>
                <td>${escapeHtml(row.nom)}</td>
                <td style="text-align:center;">${row.anneeNaiss}</td>
                <td style="text-align:center;">${row.prochainAn}</td>
                <td>${row.prochainJour}</td>
                <td style="text-align:center;">${row.ageFutur}</td>
              </tr>
            `
        )
        .join("")}
          </tbody>
        </table>
      </section>
    `;
  }

  if (!hasAny) {
    html += `<p style="text-align:center;">Aucun anniversaire enregistré.</p>`;
  }

  container.innerHTML = html;
}

// Protège les données insérées dans la version imprimable.
function escapeHtml(str) {
  return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
}

// Produit le PDF mensuel ou utilise l'impression du navigateur en secours.
function handleGeneratePdf() {
  if (birthdays.length === 0) {
    alert("La liste est vide, aucun PDF à générer.");
    return;
  }

  const jspdfLib = window.jspdf && window.jspdf.jsPDF;
  if (!jspdfLib) {
    buildMonthlyPrintView();
    window.print();
    return;
  }

  const doc = new jspdfLib({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const marginX = 12;
  const topMargin = 22;
  const bottomMargin = 18;
  const docTitle = "Liste des Anniversaires par Mois";

  const today = startOfToday();
  const grouped = Array.from({ length: 13 }, () => []);

  for (const item of birthdays) {
    const dob = parseBirthdayDate(item.date);
    if (!dob) continue;

    let nextBday = safeBirthdayDateForYear(today.getFullYear(), dob.month, dob.day);
    if (nextBday < today) {
      nextBday = safeBirthdayDateForYear(today.getFullYear() + 1, dob.month, dob.day);
    }

    const nextYear = nextBday.getFullYear();
    const nextAge = nextYear - dob.year;
    const nextWeekday = WEEKDAYS_FR[nextBday.getDay()];

    grouped[dob.month].push({
      jour: String(dob.day).padStart(2, "0"),
      nom: item.nom,
      anneeNaiss: String(dob.year),
      prochainAn: String(nextYear),
      prochainJour: nextWeekday,
      ageFutur: `${nextAge} ${nextAge === 1 ? "an" : "ans"}`,
      dayNum: dob.day
    });
  }

  let cursorY = topMargin;
  let hasContent = false;

  for (let m = 1; m <= 12; m++) {
    const list = grouped[m];
    if (!list.length) continue;
    hasContent = true;

    list.sort((a, b) => a.dayNum - b.dayNum || a.nom.localeCompare(b.nom, "fr"));

    const bodyRows = list.map((row) => [
      row.jour,
      row.nom,
      row.anneeNaiss,
      row.prochainAn,
      row.prochainJour,
      row.ageFutur
    ]);

    const estimatedBlockHeight = 7 + 8 + bodyRows.length * 7 + 6;
    const availableHeight = pageHeight - bottomMargin - cursorY;

    if (cursorY > topMargin && estimatedBlockHeight > availableHeight) {
      doc.addPage();
      cursorY = topMargin;
    }

    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(52, 73, 94);
    doc.text(MONTHS_FR[m].toUpperCase(), marginX, cursorY + 4);
    cursorY += 6;

    doc.autoTable({
      startY: cursorY,
      margin: { left: marginX, right: marginX, top: topMargin, bottom: bottomMargin },
      head: [["Jour", "Nom & Prénom", "Né(e) en", "Proch. An", "Jour (prochain)", "Âge"]],
      body: bodyRows,
      theme: "grid",
      styles: {
        font: "helvetica",
        fontSize: 9,
        cellPadding: 2,
        textColor: [30, 41, 59],
        lineColor: [221, 221, 221],
        lineWidth: 0.2
      },
      headStyles: {
        fillColor: [52, 73, 94],
        textColor: [255, 255, 255],
        fontStyle: "bold"
      },
      alternateRowStyles: {
        fillColor: [249, 249, 249]
      },
      columnStyles: {
        0: { halign: "center", cellWidth: 16 },
        1: { cellWidth: 56 },
        2: { halign: "center", cellWidth: 24 },
        3: { halign: "center", cellWidth: 24 },
        4: { cellWidth: 38 },
        5: { halign: "center", cellWidth: 28 }
      }
    });

    cursorY = doc.lastAutoTable.finalY + 7;
  }

  if (!hasContent) {
    alert("Aucun anniversaire valide à exporter.");
    return;
  }

  // En-tête (titre du document) et pied de page (uniquement numérotation) sur chaque page
  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(44, 62, 80);
    doc.text(docTitle, marginX, 12);

    doc.setDrawColor(189, 195, 199);
    doc.setLineWidth(0.3);
    doc.line(marginX, 14.5, pageWidth - marginX, 14.5);

    doc.line(marginX, pageHeight - 12, pageWidth - marginX, pageHeight - 12);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(127, 140, 141);
    doc.text(`Page ${p} sur ${totalPages}`, pageWidth - marginX, pageHeight - 7, { align: "right" });
  }

  doc.save("liste_anniversaires_par_mois.pdf");
}

// --- Enregistrement du Service Worker ---

function registerServiceWorker() {
  if ("serviceWorker" in navigator && (window.location.protocol === "http:" || window.location.protocol === "https:")) {
    navigator.serviceWorker.register("../sw.js").catch((error) => {
      console.error("Impossible d'activer le mode hors connexion :", error);
    });
  }
}

// -----------------------------------------------------------------------------------
// Programme principal
// -----------------------------------------------------------------------------------
document.addEventListener("DOMContentLoaded", initializeBirthdays);
